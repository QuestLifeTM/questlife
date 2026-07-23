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
  for (const bucket of ["profile-avatars", "profile-covers"]) {
    const { data: objects, error: listError } = await adminClient.storage.from(bucket).list(userId, { limit: 1_000 });
    if (listError) throw listError;
    if (!objects?.length) continue;

    const paths = objects.map((object) => `${userId}/${object.name}`);
    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }
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

    await removeProfileMedia(adminClient, userData.user.id);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
    if (deleteError) throw deleteError;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to delete this account." }, 500);
  }
});
