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

function buildPersonalStreakFromQuestDays(questDays: Set<string>): PersonalStreak {
  const completedDays = [...questDays].sort();
  const today = localToday();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);
  const lastQuestOn = completedDays.at(-1) ?? null;

  let currentStreak = 0;
  let streakStartedOn: string | null = null;
  if (lastQuestOn === today || lastQuestOn === yesterdayKey) {
    let cursor = new Date(`${lastQuestOn}T12:00:00`);
    while (questDays.has(toLocalDateKey(cursor))) {
      currentStreak += 1;
      streakStartedOn = toLocalDateKey(cursor);
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of completedDays) {
    if (previous) {
      const expected = new Date(`${previous}T12:00:00`);
      expected.setDate(expected.getDate() + 1);
      run = day === toLocalDateKey(expected) ? run + 1 : 1;
    } else run = 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  return { currentStreak, longestStreak, lastQuestOn, streakStartedOn, questedToday: questDays.has(today), streakVisibility: "public" };
}

export async function fetchStreakOverview(): Promise<StreakOverview> {
  assertSupabaseConfigured();
  const userId = await requireUserId();

  const [overviewResult, questDays] = await Promise.all([
    supabase.rpc("get_streak_overview", { p_today: localToday() }),
    fetchQuestDays(userId),
  ]);

  // Completion history is sufficient for personal streaks. Keep that core
  // experience usable if a migration or RPC deployment is temporarily behind.
  if (overviewResult.error) {
    return {
      personal: buildPersonalStreakFromQuestDays(questDays),
      friends: [],
      duoStreaks: [],
      incomingInvites: [],
      outgoingInvites: [],
      questDays,
    };
  }

  const payload = (overviewResult.data ?? {}) as OverviewPayload;
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
