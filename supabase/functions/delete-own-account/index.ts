import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function removeProfileMedia(adminClient: ReturnType<typeof createClient>, userId: string) {
  for (const bucket of ["profile-avatars", "profile-covers", "quest-photos", "journal-media", "collection-covers"]) {
    await removeStoragePrefix(adminClient, bucket, userId);
  }
}

async function removeStoragePrefix(adminClient: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  // Storage.list is non-recursive: a user-owned object might be under an
  // individual quest/session directory. Collect every leaf before removing
  // anything so pagination offsets cannot skip shifted entries.
  const directories = [prefix];
  const paths: string[] = [];
  while (directories.length) {
    const directory = directories.pop()!;
    let offset = 0;
    while (true) {
      const { data: objects, error: listError } = await adminClient.storage.from(bucket).list(directory, { limit: 1_000, offset });
      if (listError) throw listError;
      if (!objects?.length) break;
      for (const object of objects) {
        const objectPath = `${directory}/${object.name}`;
        if (object.id) paths.push(objectPath);
        else directories.push(objectPath);
      }
      if (objects.length < 1_000) break;
      offset += objects.length;
    }
  }
  for (let index = 0; index < paths.length; index += 100) {
    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (removeError) throw removeError;
  }
}

async function removePartyMedia(adminClient: ReturnType<typeof createClient>, userId: string) {
  const [posts, completions, parties] = await Promise.all([
    adminClient.from("party_feed_posts").select("photo_paths").eq("user_id", userId),
    adminClient.from("party_completions").select("shared_photo_paths").eq("user_id", userId),
    adminClient.from("parties").select("photo_path").eq("created_by", userId),
  ]);
  if (posts.error) throw posts.error;
  if (completions.error) throw completions.error;
  if (parties.error) throw parties.error;
  const paths = new Set<string>();
  const addStoragePath = (path: unknown) => {
    // A public URL is not a Storage object path and must never be sent to
    // Storage.remove. Current writers store paths; this guards legacy rows.
    if (typeof path === "string" && path && !/^https?:\/\//i.test(path)) paths.add(path);
  };
  for (const row of posts.data ?? []) for (const path of row.photo_paths ?? []) addStoragePath(path);
  for (const row of completions.data ?? []) for (const path of row.shared_photo_paths ?? []) addStoragePath(path);
  for (const row of parties.data ?? []) addStoragePath(row.photo_path);
  for (const batch of Array.from(paths).reduce<string[][]>((all, path, index) => {
    const batchIndex = Math.floor(index / 100);
    (all[batchIndex] ??= []).push(path);
    return all;
  }, [])) {
    const { error } = await adminClient.storage.from("party-media").remove(batch);
    if (error) throw error;
  }
}

async function redactRetainedAuditRecords(adminClient: ReturnType<typeof createClient>, userId: string) {
  // Audit events retain operational history, but must never retain a deleted
  // account's identifier or email address.
  const { error } = await adminClient
    .from("admin_audit_logs")
    .update({ actor_id: null, target_user_id: null, target_email: null })
    .or(`actor_id.eq.${userId},target_user_id.eq.${userId}`);
  if (error) throw error;
  // The older audit table has no email column, but its actor identifier is
  // likewise retained for operational history and must be redacted.
  const { error: legacyError } = await adminClient
    .from("admin_audit_log")
    .update({ actor_user_id: null })
    .eq("actor_user_id", userId);
  if (legacyError) throw legacyError;
}

async function removeUserStartedPartyRounds(adminClient: ReturnType<typeof createClient>, userId: string) {
  // This historic FK intentionally used RESTRICT. A round is authored shared
  // content, so delete it before Auth rather than letting it block privacy
  // deletion; linked session/completion references are SET NULL by schema.
  const { error } = await adminClient.from("party_quest_rounds").delete().eq("started_by", userId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("authorization");
    if (!authorization) return json({ error: "Missing authorization." }, 401);

    const adminClient = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized." }, 401);

    const userId = userData.user.id;
    // Storage is not covered by database cascades. Remove every personally
    // owned object before deleting Auth; failures are retryable and never
    // leave a successfully deleted account with known orphaned media.
    await removeProfileMedia(adminClient, userId);
    await removePartyMedia(adminClient, userId);
    await removeUserStartedPartyRounds(adminClient, userId);
    await redactRetainedAuditRecords(adminClient, userId);
    const { error: revokeError } = await adminClient.auth.admin.signOut(token, "global");
    if (revokeError) throw revokeError;
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ ok: true });
  } catch (error) {
    console.error("delete-own-account failed", error);
    return json({ error: "Unable to delete this account." }, 500);
  }
});
