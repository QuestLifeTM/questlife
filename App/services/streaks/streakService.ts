import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import {
  DuoStreak,
  IncomingDuoInvite,
  OutgoingDuoInvite,
  PersonalStreak,
  StreakFriend,
  StreakOverview,
  StreakVisibility,
} from "@/types/streaks";

type OverviewPayload = {
  personal: {
    currentStreak: number | null;
    longestStreak: number | null;
    lastQuestOn: string | null;
    streakStartedOn: string | null;
    questedToday: boolean | null;
    streakVisibility: StreakVisibility | null;
  } | null;
  friends: StreakFriend[] | null;
  duoStreaks: DuoStreak[] | null;
  incomingInvites: IncomingDuoInvite[] | null;
  outgoingInvites: OutgoingDuoInvite[] | null;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("No authenticated user.");
  return data.user.id;
}

/** Today's date key in the user's local timezone. */
export function localToday() {
  return toLocalDateKey(new Date());
}

async function fetchQuestDays(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("quest_completions")
    .select("completed_on")
    .eq("user_id", userId)
    .returns<{ completed_on: string }[]>();

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.completed_on));
}

export async function fetchStreakOverview(): Promise<StreakOverview> {
  assertSupabaseConfigured();
  const userId = await requireUserId();

  const [{ data, error }, questDays] = await Promise.all([
    supabase.rpc("get_streak_overview", { p_today: localToday() }),
    fetchQuestDays(userId),
  ]);

  if (error) throw error;

  const payload = (data ?? {}) as OverviewPayload;
  const personal: PersonalStreak = {
    currentStreak: payload.personal?.currentStreak ?? 0,
    longestStreak: payload.personal?.longestStreak ?? 0,
    lastQuestOn: payload.personal?.lastQuestOn ?? null,
    streakStartedOn: payload.personal?.streakStartedOn ?? null,
    questedToday: payload.personal?.questedToday ?? false,
    streakVisibility: payload.personal?.streakVisibility ?? "public",
  };

  return {
    personal,
    friends: payload.friends ?? [],
    duoStreaks: payload.duoStreaks ?? [],
    incomingInvites: payload.incomingInvites ?? [],
    outgoingInvites: payload.outgoingInvites ?? [],
    questDays,
  };
}

export async function updateStreakVisibility(visibility: StreakVisibility) {
  assertSupabaseConfigured();
  const userId = await requireUserId();

  const { error } = await supabase
    .from("profiles")
    .update({ streak_visibility: visibility })
    .eq("id", userId);

  if (error) throw error;
}

export async function restoreStreak() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("restore_streak", { p_today: localToday() });
  if (error) throw error;
  return data as { currentStreak: number; recoveredOn: string };
}

export async function sendDuoStreakInvite(recipientId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("send_duo_streak_invite", { p_recipient: recipientId });
  if (error) throw error;
}

export async function respondToDuoStreakInvite(inviteId: string, accept: boolean) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("respond_duo_streak_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function cancelDuoStreakInvite(inviteId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("cancel_duo_streak_invite", { p_invite_id: inviteId });
  if (error) throw error;
}

export async function endDuoStreak(streakId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("end_duo_streak", { p_streak_id: streakId });
  if (error) throw error;
}

export async function sendDuoStreakNudge(streakId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("send_duo_streak_nudge", {
    p_streak_id: streakId,
    p_today: localToday(),
  });
  if (error) throw error;
}
