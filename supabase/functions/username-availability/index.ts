import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MAX_REQUESTS_PER_MINUTE = 12;
const attempts = new Map<string, { count: number; resetAt: number }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serviceRoleKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  const keys = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS")) as Record<string, unknown>;
  const key = Object.values(keys).find((value): value is string => typeof value === "string" && Boolean(value));
  if (!key) throw new Error("Missing Supabase secret key");
  return key;
}

function clientAddress(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(req: Request) {
  const address = clientAddress(req);
  const now = Date.now();
  const attempt = attempts.get(address);
  if (!attempt || now >= attempt.resetAt) {
    attempts.set(address, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (attempt.count >= MAX_REQUESTS_PER_MINUTE) return true;
  attempt.count += 1;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (isRateLimited(req)) return json({ error: "Too many username checks. Please wait a moment." }, 429);

  try {
    const input = await req.json() as { username?: unknown };
    const username = typeof input.username === "string" ? input.username.trim() : "";
    if (!USERNAME_PATTERN.test(username)) return json({ available: false }, 200);

    const adminClient = createClient(requiredEnv("SUPABASE_URL"), serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await adminClient.rpc("is_username_available", {
      raw_username: username,
    });
    if (error) throw error;

    return json({ available: Boolean(data) });
  } catch (error) {
    console.error("username-availability failed", error);
    return json({ error: "Unable to check username availability." }, 500);
  }
});
