import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  const secret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET");
  if (!secret || request.headers.get("x-notification-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.rpc("run_notification_schedule");
  return new Response(JSON.stringify(error ? { error: error.message } : { ok: true }), { status: error ? 500 : 200, headers: { "Content-Type": "application/json" } });
});
