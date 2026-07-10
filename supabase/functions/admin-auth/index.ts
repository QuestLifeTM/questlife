import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

type AdminPermission =
  | "quests.view_published"
  | "quests.view_all"
  | "quests.create_draft"
  | "quests.submit_review"
  | "quests.review_publish"
  | "admins.manage"
  | "profile.manage"
  | "inbox.view";

type AdminAction =
  | {
      action: "invite";
      email: string;
      permissions: AdminPermission[];
    }
  | {
      action: "update_access";
      userId: string;
      permissions: AdminPermission[];
      isActive?: boolean;
    }
  | {
      action: "disable" | "reactivate" | "delete" | "reset_password";
      userId: string;
    };

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const grantablePermissions: AdminPermission[] = [
  "quests.view_published",
  "quests.view_all",
  "quests.create_draft",
  "quests.submit_review",
  "profile.manage",
  "inbox.view",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePermissions(permissions: AdminPermission[]) {
  const allowed = new Set(grantablePermissions);
  return [...new Set(permissions)].filter((permission) => allowed.has(permission));
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function insertAudit(
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  action: string,
  targetUserId?: string | null,
  targetEmail?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await adminClient.from("admin_audit_logs").insert({
    action,
    actor_id: actorId,
    metadata,
    target_email: targetEmail ? normalizeEmail(targetEmail) : null,
    target_user_id: targetUserId ?? null,
  });
}

async function requireSuperAdmin(req: Request, adminClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Response("Missing authorization header", { status: 401 });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) throw new Response("Unauthorized", { status: 401 });

  const { data: membership, error: membershipError } = await adminClient
    .from("admin_memberships")
    .select("user_id, role, is_active, deleted_at")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (
    !membership ||
    membership.role !== "super_admin" ||
    !membership.is_active ||
    membership.deleted_at
  ) {
    throw new Response("Forbidden", { status: 403 });
  }

  return userData.user;
}

async function getTargetEmail(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data: userData, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) throw error;
  return userData.user.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const adminDashboardUrl = Deno.env.get("ADMIN_DASHBOARD_URL") ?? "https://admin.questlife.app";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const actor = await requireSuperAdmin(req, adminClient);
    const input = (await req.json()) as AdminAction;

    if (input.action === "invite") {
      const email = normalizeEmail(input.email);
      const permissions = normalizePermissions(input.permissions);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Enter a valid email address." }, 400);
      }

      const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: `${adminDashboardUrl}/auth/callback` },
      );
      if (inviteError) throw inviteError;

      const { error: recordError } = await adminClient.from("admin_invites").upsert(
        {
          email,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          invited_by: actor.id,
          permissions,
          role: "admin",
          status: "pending",
        },
        { onConflict: "email" },
      );
      if (recordError) throw recordError;

      await insertAudit(adminClient, actor.id, "admin_invite", invite.user?.id ?? null, email, {
        permissions,
      });

      return json({ ok: true });
    }

    if (input.action === "update_access") {
      const permissions = normalizePermissions(input.permissions);

      const { data: membership, error: membershipError } = await adminClient
        .from("admin_memberships")
        .select("role")
        .eq("user_id", input.userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Admin account not found." }, 404);
      if (membership.role === "super_admin") {
        return json({ error: "Super Admin permissions cannot be changed here." }, 400);
      }

      const { error: updateError } = await adminClient
        .from("admin_memberships")
        .update({
          is_active: input.isActive ?? true,
          permissions,
          role: "admin",
        })
        .eq("user_id", input.userId);
      if (updateError) throw updateError;

      await adminClient.from("admin_permissions").delete().eq("admin_id", input.userId);
      if (permissions.length) {
        const { error: permissionError } = await adminClient.from("admin_permissions").insert(
          permissions.map((permission) => ({
            admin_id: input.userId,
            permission_name: permission,
          })),
        );
        if (permissionError) throw permissionError;
      }

      await insertAudit(adminClient, actor.id, "admin_permission_change", input.userId, null, {
        isActive: input.isActive ?? true,
        permissions,
      });

      return json({ ok: true });
    }

    const { data: membership, error: membershipError } = await adminClient
      .from("admin_memberships")
      .select("role")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Admin account not found." }, 404);
    if (membership.role === "super_admin") {
      return json({ error: "Super Admin cannot be disabled or deleted here." }, 400);
    }

    const targetEmail = await getTargetEmail(adminClient, input.userId);

    if (input.action === "reset_password") {
      if (!targetEmail) return json({ error: "Admin email not found." }, 404);

      const { error } = await adminClient.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${adminDashboardUrl}/reset-password`,
      });
      if (error) throw error;

      await insertAudit(adminClient, actor.id, "admin_password_reset", input.userId, targetEmail);
      return json({ ok: true });
    }

    if (input.action === "disable" || input.action === "reactivate") {
      const isActive = input.action === "reactivate";
      const { error } = await adminClient
        .from("admin_memberships")
        .update({
          disabled_at: isActive ? null : new Date().toISOString(),
          is_active: isActive,
        })
        .eq("user_id", input.userId);
      if (error) throw error;

      await insertAudit(
        adminClient,
        actor.id,
        isActive ? "admin_reactivated" : "admin_disabled",
        input.userId,
        targetEmail,
      );
      return json({ ok: true });
    }

    if (input.action === "delete") {
      const now = new Date().toISOString();
      const { error: membershipDeleteError } = await adminClient
        .from("admin_memberships")
        .update({
          deleted_at: now,
          disabled_at: now,
          is_active: false,
        })
        .eq("user_id", input.userId);
      if (membershipDeleteError) throw membershipDeleteError;

      await insertAudit(adminClient, actor.id, "admin_deleted", input.userId, targetEmail);
      await adminClient.auth.admin.deleteUser(input.userId);
      return json({ ok: true });
    }

    return json({ error: "Unsupported admin action." }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ error: "Admin request failed. Please try again." }, 500);
  }
});
