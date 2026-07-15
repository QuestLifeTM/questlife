import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AppNotification, AppNotificationCategory, AppNotificationKind } from "@/types/notifications";

type AppNotificationRow = {
  id: string;
  category: AppNotificationCategory;
  kind: AppNotificationKind;
  title: string;
  body: string;
  icon: string;
  color: string;
  metadata: Record<string, unknown> | null;
  delivery: "in_app" | "push_eligible";
  read_at: string | null;
  created_at: string;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function mapNotification(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    category: row.category,
    kind: row.kind,
    title: row.title,
    body: row.body,
    icon: row.icon,
    color: row.color,
    metadata: row.metadata ?? {},
    delivery: row.delivery,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function localDateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function fetchAppNotifications(): Promise<AppNotification[]> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("app_notifications")
    .select("id, category, kind, title, body, icon, color, metadata, delivery, read_at, created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AppNotificationRow[]>();

  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markAppNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return;

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .in("id", ids)
    .is("read_at", null);

  if (error) throw error;
}

export async function markJournalNotificationsRead() {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return;

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .eq("kind", "journal_entry_ready")
    .is("read_at", null);

  if (error) throw error;
}

export async function ensureEngagementNotifications() {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("ensure_engagement_notifications", {
    p_local_date: localDateKey(),
    p_local_hour: new Date().getHours(),
  });
  if (error) throw error;
}
