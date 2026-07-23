import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { compressFeedImage } from "@/services/media/feed-image";
import { Quest } from "@/types/content";
import { JournalActiveQuest, JournalData, JournalEntry, JournalMemory, JournalMood, PartyJournalCard, journalMoods } from "@/types/journal";

type CompletionQuestRow = {
  title: string;
  category: Quest["category"];
  experience_points: number;
  difficulty: Quest["difficulty"];
  accent_color: string;
  estimated_minutes: number;
};

type CompletionRow = {
  id: string;
  quest_id: string;
  reflection: string | null;
  created_at: string;
  party_id: string | null;
  photo_urls: string[] | null;
  quests: CompletionQuestRow | null;
};

type JournalEntryRow = {
  entry_date: string;
  title: string | null;
  mood: string | null;
};

type ActiveSessionRow = {
  id: string;
  quest_id: string;
  started_at: string;
  quests: CompletionQuestRow | null;
};

type CompletionHistoryRow = {
  quests: { category: Quest["category"] } | null;
};

export type QuestHistorySignal = {
  category: Quest["category"];
  completedThisMonth: number;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

/** Local-timezone YYYY-MM-DD key, so a day rolls over at the user's midnight. */
export function toLocalDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function mapMemory(row: CompletionRow): JournalMemory | null {
  // Quests join can come back null if a completed quest was later unpublished
  // or archived (RLS only exposes published quests to regular users). There is
  // no denormalised snapshot on quest_completions, so those memories are
  // skipped rather than rendered with invented data.
  if (!row.quests) return null;

  return {
    completionId: row.id,
    questId: row.quest_id,
    title: row.quests.title,
    reflection: row.reflection,
    completedAt: row.created_at,
    xp: row.quests.experience_points,
    category: row.quests.category,
    difficulty: row.quests.difficulty,
    color: row.quests.accent_color,
    timeMin: row.quests.estimated_minutes,
    partyId: row.party_id,
    photoPaths: row.photo_urls ?? [],
    participants: [],
  };
}

function mapEntry(row: JournalEntryRow): JournalEntry {
  const mood = journalMoods.includes(row.mood as JournalMood) ? (row.mood as JournalMood) : null;
  return { entryDate: row.entry_date, title: row.title, mood };
}

function mapActiveQuest(row: ActiveSessionRow | null): JournalActiveQuest | null {
  if (!row?.quests) return null;
  return {
    sessionId: row.id,
    questId: row.quest_id,
    title: row.quests.title,
    startedAt: row.started_at,
    category: row.quests.category,
    difficulty: row.quests.difficulty,
    color: row.quests.accent_color,
  };
}

async function fetchJournalEntries(userId: string) {
  const entriesByDate: Record<string, JournalEntry> = {};

  // journal_entries ships with migration 006. If the migration has not been
  // applied yet, the journal still renders read-only instead of erroring out.
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date, title, mood")
    .eq("user_id", userId)
    .returns<JournalEntryRow[]>();

  if (error) return entriesByDate;

  for (const row of data ?? []) {
    entriesByDate[row.entry_date] = mapEntry(row);
  }
  return entriesByDate;
}

export async function fetchJournalData(): Promise<JournalData> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const userId = userData.user.id;

  const [{ data: profileRow }, { data: completionRows, error: completionsError }, entriesByDate, partyHistoryResult, { data: activeSessionRow }] =
    await Promise.all([
      supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle<{ created_at: string }>(),
      supabase
        .from("quest_completions")
        .select("id, quest_id, reflection, created_at, party_id, photo_urls, quests(title, category, experience_points, difficulty, accent_color, estimated_minutes)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .returns<CompletionRow[]>(),
      fetchJournalEntries(userId),
      supabase.rpc("get_party_journal_history"),
      supabase
        .from("quest_sessions")
        .select("id, quest_id, started_at, quests(title, category, experience_points, difficulty, accent_color, estimated_minutes)")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle<ActiveSessionRow>(),
    ]);

  if (completionsError) throw completionsError;

  const memoriesByDate: Record<string, JournalMemory[]> = {};
  for (const row of completionRows ?? []) {
    const memory = mapMemory(row);
    if (!memory) continue;
    const key = toLocalDateKey(new Date(memory.completedAt));
    (memoriesByDate[key] ??= []).push(memory);
  }

  // Day 1 = the user's actual join date. Fall back to the earliest completion
  // (then today) so the journal still works if the profile row is missing.
  const earliestCompletion = completionRows?.[0]?.created_at;
  const joinedAt = profileRow?.created_at ?? earliestCompletion ?? new Date().toISOString();

  return { joinedAt, memoriesByDate, entriesByDate, partyHistory: (partyHistoryResult.data ?? []) as PartyJournalCard[], activeQuest: mapActiveQuest(activeSessionRow) };
}

/** A lightweight monthly completion signal for contextual recommendations. */
export async function fetchQuestHistorySignals(): Promise<QuestHistorySignal[]> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from("quest_completions")
    .select("quests(category)")
    .eq("user_id", userData.user.id)
    .gte("created_at", monthStart)
    .returns<CompletionHistoryRow[]>();
  if (error) throw error;

  const counts = new Map<Quest["category"], number>();
  for (const row of data ?? []) {
    if (!row.quests) continue;
    counts.set(row.quests.category, (counts.get(row.quests.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, completedThisMonth]) => ({ category, completedThisMonth }))
    .sort((a, b) => b.completedThisMonth - a.completedThisMonth || a.category.localeCompare(b.category));
}

export async function fetchJournalMemory(completionId: string): Promise<JournalMemory | null> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { data, error } = await supabase
    .from("quest_completions")
    .select("id, quest_id, reflection, created_at, party_id, photo_urls, quests(title, category, experience_points, difficulty, accent_color, estimated_minutes)")
    .eq("id", completionId)
    .eq("user_id", userData.user.id)
    .maybeSingle<CompletionRow>();

  if (error) throw error;
  if (!data) return null;
  return mapMemory(data);
}

/** Updates the authenticated user's private reflection for a completed quest. */
export async function updateJournalMemoryReflection(input: { completionId: string; reflection: string | null }) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase
    .from("quest_completions")
    .update({ reflection: input.reflection?.trim() || null })
    .eq("id", input.completionId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

export async function resolveJournalMedia(paths: string[]) {
  if (!paths.length) return [];
  assertSupabaseConfigured();
  // Legacy completions may hold public URLs, while new private journal media
  // stores object paths. Keep both formats readable during the rollout.
  const privatePaths = paths.filter((path) => !/^https?:\/\//i.test(path));
  if (!privatePaths.length) return paths;

  const { data, error } = await supabase.storage.from("journal-media").createSignedUrls(privatePaths, 60 * 30);
  if (error) throw error;
  const signedByPath = new Map(privatePaths.map((path, index) => [path, data[index]?.signedUrl]));
  return paths
    .map((path) => /^https?:\/\//i.test(path) ? path : signedByPath.get(path))
    .filter((url): url is string => Boolean(url));
}

/** Uploads a private journal image and returns the stored object path. */
export async function uploadJournalMedia(localUri: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const compressedUri = await compressFeedImage(localUri);
  const response = await fetch(compressedUri);
  const blob = await response.arrayBuffer();
  const extension = "jpg";
  const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const contentType = "image/jpeg";

  const { error } = await supabase.storage.from("journal-media").upload(path, blob, { contentType });
  if (error) throw error;
  return path;
}

export async function upsertJournalEntry(input: {
  entryDate: string;
  title?: string | null;
  mood?: JournalMood | null;
}) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const payload: Record<string, unknown> = {
    entry_date: input.entryDate,
    user_id: userData.user.id,
  };
  if (input.title !== undefined) payload.title = input.title?.trim() || null;
  if (input.mood !== undefined) payload.mood = input.mood;

  const { error } = await supabase
    .from("journal_entries")
    .upsert(payload, { onConflict: "user_id,entry_date" });

  if (error) throw error;
}
