import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Content-Type": "application/json" };
const expoUrl = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (request) => {
  const secret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET");
  if (!secret || request.headers.get("x-notification-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await supabase
    .from("notification_push_outbox")
    .select("id, attempts, notification:app_notifications(id,title,body,priority,metadata), device:notification_devices(id,expo_push_token)")
    .in("status", ["queued", "retry"])
    .lte("next_attempt_at", new Date().toISOString())
    .limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  if (!jobs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: cors });

  const messages = jobs.map((job: any) => ({
    to: job.device.expo_push_token,
    title: job.notification.title,
    body: job.notification.body,
    sound: "default",
    priority: job.notification.priority === "priority" ? "high" : "default",
    data: { notificationId: job.notification.id, ...job.notification.metadata },
  }));
  const response = await fetch(expoUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(messages) });
  const payload = await response.json();
  const tickets = payload.data ?? [];
  await Promise.all(jobs.map(async (job: any, index: number) => {
    const ticket = tickets[index];
    const terminal = ticket?.details?.error === "DeviceNotRegistered";
    const failed = !ticket || ticket.status === "error";
    const attempts = job.attempts + 1;
    await supabase.from("notification_push_outbox").update({
      attempts,
      expo_ticket_id: ticket?.id ?? null,
      status: failed ? (terminal || attempts >= 4 ? "failed" : "retry") : "sent",
      next_attempt_at: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1000).toISOString(),
      last_error: ticket?.message ?? null,
    }).eq("id", job.id);
    if (terminal) await supabase.from("notification_devices").update({ active: false }).eq("id", job.device.id);
    await supabase.from("app_notifications").update({ push_status: failed ? (terminal || attempts >= 4 ? "failed" : "queued") : "sent" }).eq("id", job.notification.id);
  }));
  return new Response(JSON.stringify({ sent: jobs.length }), { headers: cors });
});
