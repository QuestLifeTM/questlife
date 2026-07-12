import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Quest } from "@/types/content";
import { JournalData, JournalEntry, JournalMemory, JournalMood, PartyJournalCard, journalMoods } from "@/types/journal";

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

  const [{ data: profileRow }, { data: completionRows, error: completionsError }, entriesByDate, partyHistoryResult] =
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

  return { joinedAt, memoriesByDate, entriesByDate, partyHistory: (partyHistoryResult.data ?? []) as PartyJournalCard[] };
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

export async function resolveJournalMedia(paths: string[]) {
  if (!paths.length) return [];
  assertSupabaseConfigured();
  const { data, error } = await supabase.storage.from("journal-media").createSignedUrls(paths, 60 * 30);
  if (error) throw error;
  return data.map((item) => item.signedUrl).filter((url): url is string => Boolean(url));
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
