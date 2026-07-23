import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import { compressFeedImage } from "@/services/media/feed-image";
import {
  CompleteQuestInput,
  CompletionResult,
  QuestEngineState,
  QuestReviewData,
  UserPack,
} from "@/types/engine";

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

function today() {
  return toLocalDateKey(new Date());
}

/** Translates the RPC error codes into copy the app can show directly. */
export function engineErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error);
  if (message.includes("ACTIVE_SESSION_EXISTS")) {
    return "You already have an active quest. Complete it or save it for later first.";
  }
  if (message.includes("DAILY_LIMIT_REACHED")) {
    return "You've used all 5 quests for today. Come back after midnight for fresh energy!";
  }
  if (message.includes("QUEST_ALREADY_COMPLETED")) {
    return "You've already completed this quest.";
  }
  if (message.includes("ACTIVE_SESSION_NOT_FOUND")) {
    return "This run was reset before it could be finished. Start the quest again to create a fresh active run.";
  }
  if (message.includes("QUEST_NOT_AVAILABLE")) {
    return "This quest is no longer available.";
  }
  if (message.includes("RATING_REQUIRED")) {
    return "Add a star rating to log your lore.";
  }
  if (message.includes('column reference "total_xp" is ambiguous') || message.includes("column reference 'total_xp' is ambiguous")) {
    return "Quest completion needs the latest database migration. Apply the pending Supabase migrations, then try again.";
  }
  if (message.includes("reset_todays_solo_quest_completions") || message.includes("PGRST202")) {
    return "The reset feature needs its latest database migration. Apply the reset_todays_solo_quest_completions migration, then try again.";
  }
  return message;
}

export async function fetchEngineState(): Promise<QuestEngineState> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_quest_engine_state", { p_today: today() });
  if (error) throw error;
  const state = data as QuestEngineState;
  return {
    dailyLimit: state.dailyLimit ?? 5,
    dailyUsed: state.dailyUsed ?? 0,
    activeSession: state.activeSession ?? null,
    todayCompletions: state.todayCompletions ?? [],
  };
}

export async function startQuestSession(input: {
  questId: string;
  source?: "explore" | "saved" | "social";
}) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("start_quest_session", {
    p_quest_id: input.questId,
    p_today: today(),
    p_source: input.source ?? "explore",
  });
  if (error) throw error;
  return data as { sessionId: string };
}

export async function abandonQuestSession(sessionId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("abandon_quest_session", { p_session_id: sessionId });
  if (error) throw error;
}

export async function saveSessionForLater(sessionId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("save_quest_session_for_later", { p_session_id: sessionId });
  if (error) throw error;
}

export async function completeQuestV2(input: CompleteQuestInput): Promise<CompletionResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("complete_quest_v2", {
    p_quest_id: input.questId,
    p_today: today(),
    p_logged: input.logged,
    p_reflection: input.reflection ?? null,
    p_rating: input.rating ?? null,
    p_review: input.review ?? null,
    p_review_public: input.reviewPublic ?? true,
    p_photo_urls: input.photoUrls ?? [],
  });
  if (error) throw error;
  return data as CompletionResult;
}

/** Removes this user's solo completions for the supplied local calendar day. */
export async function resetTodaySoloQuestCompletions(): Promise<number> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("reset_todays_solo_quest_completions", { p_today: today() });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchQuestReviews(questId: string): Promise<QuestReviewData> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_quest_reviews", { p_quest_id: questId });
  if (error) throw error;
  const result = data as QuestReviewData;
  return {
    summary: result.summary ?? { averageRating: null, ratingCount: 0 },
    reviews: result.reviews ?? [],
  };
}

export async function uploadQuestPhoto(localUri: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const compressedUri = await compressFeedImage(localUri);
  const response = await fetch(compressedUri);
  const blob = await response.arrayBuffer();
  const extension = "jpg";
  const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from("quest-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("quest-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadCollectionCover(localUri: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const response = await fetch(localUri);
  const blob = await response.arrayBuffer();
  const extension = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  let bucket = "collection-covers";
  let { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType });

  // Older QuestLife projects predate the dedicated collection-covers bucket.
  // Keep optional cover photos from blocking collection creation during rollout.
  if (error && /bucket not found/i.test(error.message)) {
    bucket = "quest-photos";
    ({ error } = await supabase.storage.from(bucket).upload(path, blob, { contentType }));
  }
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Quest Collections (the established database table names predate this UI).
// ---------------------------------------------------------------------------

type UserPackRow = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  accent_color: string;
  cover_image_url: string | null;
  created_at: string;
};

function isMissingCollectionCoverColumn(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
  return /cover_image_url/i.test(message) && /(column|schema cache)/i.test(message);
}

export async function fetchUserPacks(): Promise<UserPack[]> {
  assertSupabaseConfigured();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const [packResult, { data: questRows, error: questError }] = await Promise.all([
    supabase
      .from("user_adventure_packs")
      .select("id, title, description, icon, accent_color, cover_image_url, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .returns<UserPackRow[]>(),
    supabase
      .from("user_adventure_pack_quests")
      .select("user_pack_id, quest_id, position")
      .order("position", { ascending: true }),
  ]);

  let packRows = packResult.data;
  let packError = packResult.error;
  if (packError && isMissingCollectionCoverColumn(packError)) {
    const legacyResult = await supabase
      .from("user_adventure_packs")
      .select("id, title, description, icon, accent_color, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .returns<Omit<UserPackRow, "cover_image_url">[]>();
    packRows = (legacyResult.data ?? []).map((row) => ({ ...row, cover_image_url: null }));
    packError = legacyResult.error;
  }

  if (packError) throw packError;
  if (questError) throw questError;

  const questsByPack = new Map<string, string[]>();
  for (const row of questRows ?? []) {
    const list = questsByPack.get(row.user_pack_id) ?? [];
    list.push(row.quest_id);
    questsByPack.set(row.user_pack_id, list);
  }

  return (packRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    accentColor: row.accent_color,
    coverImageUrl: row.cover_image_url,
    questIds: questsByPack.get(row.id) ?? [],
    createdAt: row.created_at,
  }));
}

export async function upsertUserPack(input: {
  id?: string;
  title: string;
  description?: string | null;
  icon: string;
  accentColor: string;
  coverImageUrl?: string | null;
  questIds: string[];
}): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const title = input.title.trim();
  if (!title) throw new Error("A collection name is required.");
  const questIds = [...new Set(input.questIds)];

  const payload = {
    title,
    description: input.description?.trim() || null,
    icon: input.icon || "🎒",
    accent_color: input.accentColor,
    cover_image_url: input.coverImageUrl ?? null,
    user_id: userData.user.id,
  };

  const runUpsert = (nextPayload: typeof payload | Omit<typeof payload, "cover_image_url">) => {
    const query = input.id
      ? supabase.from("user_adventure_packs").update(nextPayload).eq("id", input.id).eq("user_id", userData.user.id)
      : supabase.from("user_adventure_packs").insert(nextPayload);
    return query.select("id").single<{ id: string }>();
  };

  let { data, error } = await runUpsert(payload);
  if (error && isMissingCollectionCoverColumn(error)) {
    const { cover_image_url: _coverImageUrl, ...legacyPayload } = payload;
    ({ data, error } = await runUpsert(legacyPayload));
  }
  if (error || !data) throw error ?? new Error("Unable to save this collection.");

  const { data: existingQuestRows, error: existingQuestError } = await supabase
    .from("user_adventure_pack_quests")
    .select("quest_id, position")
    .eq("user_pack_id", data.id);
  if (existingQuestError) throw existingQuestError;

  const { error: deleteError } = await supabase
    .from("user_adventure_pack_quests")
    .delete()
    .eq("user_pack_id", data.id);
  if (deleteError) throw deleteError;

  if (questIds.length) {
    const { error: insertError } = await supabase.from("user_adventure_pack_quests").insert(
      questIds.map((questId, index) => ({
        user_pack_id: data.id,
        quest_id: questId,
        position: index,
      })),
    );
    if (insertError) {
      // The API has no transaction boundary across a parent update and this
      // membership replacement. Restore the prior rows before surfacing the
      // error so a failed save cannot empty an existing collection.
      const previousMemberships = existingQuestRows ?? [];
      if (previousMemberships.length) {
        await supabase.from("user_adventure_pack_quests").insert(
          previousMemberships.map((row) => ({
            user_pack_id: data.id,
            quest_id: row.quest_id,
            position: row.position,
          })),
        );
      }
      if (!input.id) {
        await supabase
          .from("user_adventure_packs")
          .delete()
          .eq("id", data.id)
          .eq("user_id", userData.user.id);
      }
      throw insertError;
    }
  }

  return data.id;
}

export async function deleteUserPack(packId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.from("user_adventure_packs").delete().eq("id", packId);
  if (error) throw error;
}
