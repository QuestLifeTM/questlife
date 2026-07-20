import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import {
  CompleteQuestInput,
  CompletionResult,
  DailyPlan,
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
  source?: "explore" | "pack" | "plan" | "featured" | "saved" | "social";
  packId?: string | null;
}) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("start_quest_session", {
    p_quest_id: input.questId,
    p_today: today(),
    p_source: input.source ?? "explore",
    p_pack_id: input.packId ?? null,
  });
  if (error) throw error;
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

  const response = await fetch(localUri);
  const blob = await response.arrayBuffer();
  const extension = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from("quest-photos").upload(path, blob, {
    contentType: extension === "png" ? "image/png" : "image/jpeg",
  });
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
// User adventure packs
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

  const payload = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    icon: input.icon || "🎒",
    accent_color: input.accentColor,
    cover_image_url: input.coverImageUrl ?? null,
    user_id: userData.user.id,
  };

  const runUpsert = (nextPayload: typeof payload | Omit<typeof payload, "cover_image_url">) => {
    const query = input.id
      ? supabase.from("user_adventure_packs").update(nextPayload).eq("id", input.id)
      : supabase.from("user_adventure_packs").insert(nextPayload);
    return query.select("id").single<{ id: string }>();
  };

  let { data, error } = await runUpsert(payload);
  if (error && isMissingCollectionCoverColumn(error)) {
    const { cover_image_url: _coverImageUrl, ...legacyPayload } = payload;
    ({ data, error } = await runUpsert(legacyPayload));
  }
  if (error || !data) throw error ?? new Error("Unable to save this collection.");

  const { error: deleteError } = await supabase
    .from("user_adventure_pack_quests")
    .delete()
    .eq("user_pack_id", data.id);
  if (deleteError) throw deleteError;

  if (input.questIds.length) {
    const { error: insertError } = await supabase.from("user_adventure_pack_quests").insert(
      input.questIds.map((questId, index) => ({
        user_pack_id: data.id,
        quest_id: questId,
        position: index,
      })),
    );
    if (insertError) throw insertError;
  }

  return data.id;
}

export async function deleteUserPack(packId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.from("user_adventure_packs").delete().eq("id", packId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Daily plans
// ---------------------------------------------------------------------------

type DailyPlanRow = {
  id: string;
  plan_on: string;
  source_pack_id: string | null;
};

export async function fetchTodayPlan(): Promise<DailyPlan | null> {
  assertSupabaseConfigured();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: planRow, error } = await supabase
    .from("daily_plans")
    .select("id, plan_on, source_pack_id")
    .eq("user_id", userData.user.id)
    .eq("plan_on", today())
    .maybeSingle<DailyPlanRow>();

  if (error) throw error;
  if (!planRow) return null;

  const { data: questRows, error: questError } = await supabase
    .from("daily_plan_quests")
    .select("quest_id, position")
    .eq("plan_id", planRow.id)
    .order("position", { ascending: true });

  if (questError) throw questError;

  return {
    id: planRow.id,
    planOn: planRow.plan_on,
    sourcePackId: planRow.source_pack_id,
    questIds: (questRows ?? []).map((row) => row.quest_id as string),
  };
}

export async function saveTodayPlan(input: { questIds: string[]; sourcePackId?: string | null }): Promise<DailyPlan | null> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { data: planRow, error } = await supabase
    .from("daily_plans")
    .upsert(
      {
        user_id: userData.user.id,
        plan_on: today(),
        source_pack_id: input.sourcePackId ?? null,
      },
      { onConflict: "user_id,plan_on" },
    )
    .select("id, plan_on, source_pack_id")
    .single<DailyPlanRow>();

  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("daily_plan_quests")
    .delete()
    .eq("plan_id", planRow.id);
  if (deleteError) throw deleteError;

  if (input.questIds.length) {
    const { error: insertError } = await supabase.from("daily_plan_quests").insert(
      input.questIds.map((questId, index) => ({
        plan_id: planRow.id,
        quest_id: questId,
        position: index,
      })),
    );
    if (insertError) throw insertError;
  }

  return {
    id: planRow.id,
    planOn: planRow.plan_on,
    sourcePackId: planRow.source_pack_id,
    questIds: input.questIds,
  };
}

export async function clearTodayPlan() {
  assertSupabaseConfigured();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const { error } = await supabase
    .from("daily_plans")
    .delete()
    .eq("user_id", userData.user.id)
    .eq("plan_on", today());

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Featured batch for today
// ---------------------------------------------------------------------------

export async function fetchTodayFeaturedQuestIds(): Promise<string[]> {
  assertSupabaseConfigured();

  const { data: batch, error } = await supabase
    .from("featured_quest_batches")
    .select("id")
    .eq("featured_on", today())
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  if (!batch) return [];

  const { data: rows, error: questError } = await supabase
    .from("featured_batch_quests")
    .select("quest_id, position")
    .eq("batch_id", batch.id)
    .order("position", { ascending: true });

  if (questError) throw questError;
  return (rows ?? []).map((row) => row.quest_id as string);
}
