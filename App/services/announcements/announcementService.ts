import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AppAnnouncement = {
  body: string;
  createdAt: string;
  id: string;
  title: string;
};

type AppAnnouncementRow = {
  body: string;
  created_at: string;
  id: string;
  title: string;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function mapAnnouncement(row: AppAnnouncementRow): AppAnnouncement {
  return {
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    title: row.title,
  };
}

function parseBoolean(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  throw new Error("The intro setting returned an invalid value.");
}

export async function getIntroEnabled() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_intro_enabled");
  if (error) throw error;
  return parseBoolean(data);
}

export async function getActiveAppAnnouncement(): Promise<AppAnnouncement | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_active_app_announcement");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapAnnouncement(row as AppAnnouncementRow) : null;
}

export async function dismissAppAnnouncement(id: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("dismiss_app_announcement", { p_announcement_id: id });
  if (error) throw error;
}

export function subscribeToAppAnnouncements(onAnnouncement: (announcement: AppAnnouncement) => void) {
  return supabase
    .channel("app-announcements")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "app_announcements" },
      (payload) => onAnnouncement(mapAnnouncement(payload.new as AppAnnouncementRow)),
    )
    .subscribe();
}
