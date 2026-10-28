import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { compressFeedImage } from "@/services/media/feed-image";
import { normalizeQuestCategory, Quest } from "@/types/content";
import { JournalActiveQuest, JournalData, JournalEntry, JournalMemory, JournalMood, journalMoods } from "@/types/journal";

type CompletionQuestRow = {
  title: string;
  category: string;
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
  photo_urls: string[] | null;
  xp_awarded: number;
  quests: CompletionQuestRow | null;
};

type CompletedSessionRow = {
  id: string;
  quest_id: string;
  ended_at: string | null;
  quest_session_snapshots: {
    active_duration_ms: number;
    distance_meters: number;
    entry_title: string;
    render_route: Array<{ latitude: number; longitude: number; capturedAt?: string }> | null;
  } | null;
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
  quests: { category: string } | null;
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

function mapMemory(row: CompletionRow, session: CompletedSessionRow | null = null): JournalMemory {
  const snapshot = session?.quest_session_snapshots;
  const routePoints = (snapshot?.render_route ?? []).filter((point) => point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180).map(({ latitude, longitude }) => ({ latitude, longitude }));
  // A completion is the user's durable journal record. The quest join can be
  // unavailable after a quest is unpublished, but that must not hide the
  // already-earned memory from its owner.
  const quest = row.quests;
  return {
    completionId: row.id,
    questId: row.quest_id,
    title: snapshot?.entry_title?.trim() || quest?.title || "Completed quest",
    reflection: row.reflection,
    completedAt: row.created_at,
    xp: Math.max(0, row.xp_awarded ?? 0),
    category: normalizeQuestCategory(quest?.category ?? "ADVENTURE"),
    difficulty: quest?.difficulty ?? "EASY",
    color: quest?.accent_color ?? "#49a6f4",
    timeMin: snapshot ? Math.round(Math.max(0, snapshot.active_duration_ms) / 60000) : 0,
    durationRecorded: Boolean(snapshot),
    distanceMeters: snapshot ? Math.max(0, snapshot.distance_meters) : null,
    photoPaths: row.photo_urls ?? [],
    routePoints,
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
    category: normalizeQuestCategory(row.quests.category),
    difficulty: row.quests.difficulty,
    color: row.quests.accent_color,
  };
}

// PostgREST caps a response; page every archive query so old entries and new
// completions remain available after the first thousand records.
async function readAllRows<Row>(page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
  const rows: Row[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return rows;
  }
}

async function fetchJournalEntries(userId: string) {
  const entriesByDate: Record<string, JournalEntry> = {};

  // journal_entries ships with migration 006. If the migration has not been
  // applied yet, the journal still renders read-only instead of erroring out.
  const { data, error } = await readAllRows<JournalEntryRow>((from, to) => supabase
    .from("journal_entries")
    .select("entry_date, title, mood")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true }).range(from, to)
    .returns<JournalEntryRow[]>()).then((data) => ({ data, error: null as { code?: string } | null })).catch((error) => ({ data: null, error: error as { code?: string } }));

  // Keep older app installations readable while the migration rolls out, but
  // surface every other failure so the UI never mistakes a network or policy
  // error for an empty journal.
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return entriesByDate;
    throw error;
  }

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

  const [{ data: profileRow }, { data: completionRows, error: completionsError }, entriesByDate, { data: activeSessionRow }, completedSessionsResult] =
    await Promise.all([
      supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle<{ created_at: string }>(),
      readAllRows<CompletionRow>((from, to) => supabase
        .from("quest_completions")
        .select("id, quest_id, reflection, created_at, xp_awarded, photo_urls, quests(title, category, experience_points, difficulty, accent_color, estimated_minutes)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)
        .returns<CompletionRow[]>()).then((data) => ({ data, error: null })),
      fetchJournalEntries(userId),
      supabase
        .from("quest_sessions")
        .select("id, quest_id, started_at, quests(title, category, experience_points, difficulty, accent_color, estimated_minutes)")
        .eq("user_id", userId)
        .in("status", ["doing_now", "active"])
        .maybeSingle<ActiveSessionRow>(),
      readAllRows<CompletedSessionRow>((from, to) => supabase
        .from("quest_sessions")
        .select("id, quest_id, ended_at, quest_session_snapshots(render_route, active_duration_ms, distance_meters, entry_title)")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("ended_at", "is", null)
        .order("id", { ascending: true }).range(from, to)
        .returns<CompletedSessionRow[]>()).then((data) => ({ data, error: null as unknown })).catch((error: unknown) => ({ data: [] as CompletedSessionRow[], error })),
    ]);

  if (completionsError) throw completionsError;
  // Route enrichment must never make durable completion history disappear.

  const memoriesByDate: Record<string, JournalMemory[]> = {};
  const unmatchedSessions = [...(completedSessionsResult.data ?? [])];
  for (const row of completionRows ?? []) {
    const completionTime = new Date(row.created_at).getTime();
    const candidateIndex = unmatchedSessions.reduce((bestIndex, session, index) => {
      if (session.quest_id !== row.quest_id || !session.ended_at) return bestIndex;
      if (bestIndex < 0) return index;
      const bestTime = new Date(unmatchedSessions[bestIndex].ended_at!).getTime();
      return Math.abs(new Date(session.ended_at).getTime() - completionTime) < Math.abs(bestTime - completionTime) ? index : bestIndex;
    }, -1);
    const candidate = candidateIndex >= 0 ? unmatchedSessions[candidateIndex] : null;
    const candidateDistance = candidate?.ended_at ? Math.abs(new Date(candidate.ended_at).getTime() - completionTime) : Number.POSITIVE_INFINITY;
    const session = candidateIndex >= 0 && candidateDistance <= 1000 ? unmatchedSessions.splice(candidateIndex, 1)[0] : null;
    const memory = mapMemory(row, session);
    const key = toLocalDateKey(new Date(memory.completedAt));
    (memoriesByDate[key] ??= []).push(memory);
  }

  // A journal day reads from the latest moment back through the day. The
  // database query stays chronological so the earliest completion remains
  // available for the journal's join-date fallback below.
  for (const memories of Object.values(memoriesByDate)) {
    memories.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  // Day 1 = the user's actual join date. Fall back to the earliest completion
  // (then today) so the journal still works if the profile row is missing.
  const earliestCompletion = completionRows?.[0]?.created_at;
  const joinedAt = profileRow?.created_at ?? earliestCompletion ?? new Date().toISOString();

  return { joinedAt, memoriesByDate, entriesByDate, activeQuest: mapActiveQuest(activeSessionRow), warning: completedSessionsResult.error ? "Your memories are available, but recorded routes and times couldn’t load. Retry to load them." : undefined };
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
    const category = normalizeQuestCategory(row.quests.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, completedThisMonth]) => ({ category, completedThisMonth }))
    .sort((a, b) => b.completedThisMonth - a.completedThisMonth || a.category.localeCompare(b.category));
}

export async function fetchJournalMemory(completionId: string): Promise<JournalMemory | null> {
  // Use the same matching and recorded metadata as the journal cards. This also
  // prevents a repeat run from borrowing a different run's route in detail view.
  const journal = await fetchJournalData();
  return Object.values(journal.memoriesByDate).flat().find((memory) => memory.completionId === completionId) ?? null;
}

/** Updates the authenticated user's private reflection for a completed quest. */
export async function updateJournalMemoryReflection(input: { completionId: string; reflection: string | null }) {
  assertSupabaseConfigured();
  const { error } = await supabase
    .rpc("update_journal_memory_reflection", {
      p_completion_id: input.completionId,
      p_reflection: input.reflection?.trim() || null,
    });
  if (error) throw error;
}

/** Replaces the ordered photo list for one of the user's completed memories. */
export async function updateJournalMemoryPhotos(input: { completionId: string; photoPaths: string[] }) {
  assertSupabaseConfigured();
  const { error } = await supabase
    .rpc("replace_journal_memory_photos", {
      p_completion_id: input.completionId,
      p_photo_paths: input.photoPaths,
    });
  if (error) throw error;
}

/** Removes private Journal-media objects after their database references are gone. */
export async function deleteJournalMedia(paths: string[]) {
  const privatePaths = paths.filter((path) => !/^https?:\/\//i.test(path));
  if (!privatePaths.length || !isSupabaseConfigured) return;
  await supabase.storage.from("journal-media").remove(privatePaths);
}

/** Keeps the stored identity attached even when an earlier photo is missing. */
export async function resolveJournalMediaItems(paths: string[]): Promise<{ path: string; uri: string }[]> {
  if (!paths.length) return [];
  assertSupabaseConfigured();
  const isDirectUri = (path: string) => /^(?:https?:|file:|content:|ph:|asset:)/i.test(path);
  const privatePaths = [...new Set(paths.filter((path) => !isDirectUri(path)))];
  const signedByPath = new Map<string, string>();
  if (privatePaths.length) {
    const { data, error } = await supabase.storage.from("journal-media").createSignedUrls(privatePaths, 60 * 30);
    if (error) throw error;
    for (const item of data ?? []) {
      if (!item.error && item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
  }
  return paths.flatMap((path) => {
    const uri = isDirectUri(path) ? path : signedByPath.get(path);
    return uri ? [{ path, uri }] : [];
  });
}

export async function resolveJournalMedia(paths: string[]) {
  return (await resolveJournalMediaItems(paths)).map((item) => item.uri);
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
    .upsert(payload, { onConflict: "user_id,entry_date" })
    .select("entry_date")
    .single();

  if (error) throw error;
}
