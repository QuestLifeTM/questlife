import { Profile, ProfileEditInput, ProfileOverview, ProfilePrivacy, ProfileStatVisibility, QuestFeedPost, QuestPost, QuestPostStats, RequiredProfileName } from "@/types/profile";
import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import type { QuestCategory } from "@/types/content";

export type WeeklyCompletedQuestActivity = { day: string; value: number };
export const DEFAULT_PROFILE_STAT_VISIBILITY: ProfileStatVisibility = {
  highestStreak: true,
  level: true,
  questsDone: true,
  timeSpent: true,
  totalXp: true,
  followers: true,
  following: true,
};
export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacy = {
  stats: "public",
  bio: "public",
  posts: "public",
};
export type ProfileQuestInsights = {
  completionRate: number | null;
  activeDaysThisMonth: number;
  completedThisMonth: number;
  monthlyGoal: number;
  averageQuestMinutes: number;
  bestWeekCompletions: number;
  questVariety: number;
  preferredTimeLabel: string | null;
  photosCaptured: number;
  categoryBreakdown: Array<{ category: QuestCategory; count: number }>;
  difficultyBreakdown: Array<{ difficulty: string; count: number }>;
  monthlyWeeks: Array<{ label: string; value: number }>;
};

type TrailCompletionRow = { quests: { category: QuestCategory } | null };
type InsightCompletionRow = {
  created_at: string;
  photo_urls: string[] | null;
  quests: { category: QuestCategory; difficulty: string; estimated_minutes: number } | null;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function today() {
  return toLocalDateKey(new Date());
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns an exact, local-time seven-day count of the signed-in user's completions. */
export async function fetchWeeklyCompletedQuestActivity(): Promise<WeeklyCompletedQuestActivity[]> {
  assertSupabaseConfigured();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  const { data, error } = await supabase
    .from("quest_completions")
    .select("created_at")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .returns<Array<{ created_at: string }>>();
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const completion of data ?? []) {
    const key = localDayKey(new Date(completion.created_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      day: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      value: counts.get(localDayKey(date)) ?? 0,
    };
  });
}

/** Builds the profile dashboard from durable completion/session history. */
export async function fetchProfileQuestInsights(userId: string): Promise<ProfileQuestInsights> {
  assertSupabaseConfigured();
  const [{ data: completions, error: completionError }, { data: sessions, error: sessionError }] = await Promise.all([
    supabase
      .from("quest_completions")
      .select("created_at, photo_urls, quests(category, difficulty, estimated_minutes)")
      .eq("user_id", userId)
      .returns<InsightCompletionRow[]>(),
    supabase.from("quest_sessions").select("status").eq("user_id", userId).returns<Array<{ status: string }>>(),
  ]);
  if (completionError) throw completionError;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const categoryCounts = new Map<QuestCategory, number>();
  const difficultyCounts = new Map<string, number>();
  const activeDays = new Set<string>();
  const hourlyCounts = new Array<number>(24).fill(0);
  const weeklyCounts = new Map<number, number>();
  let estimatedMinutes = 0;
  let photosCaptured = 0;

  for (const completion of completions ?? []) {
    const completedAt = new Date(completion.created_at);
    const quest = completion.quests;
    if (quest) {
      categoryCounts.set(quest.category, (categoryCounts.get(quest.category) ?? 0) + 1);
      difficultyCounts.set(quest.difficulty, (difficultyCounts.get(quest.difficulty) ?? 0) + 1);
      estimatedMinutes += quest.estimated_minutes;
    }
    photosCaptured += completion.photo_urls?.length ?? 0;
    hourlyCounts[completedAt.getHours()] += 1;
    if (completedAt >= monthStart) activeDays.add(localDayKey(completedAt));
    const weekStart = new Date(completedAt);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const key = weekStart.getTime();
    weeklyCounts.set(key, (weeklyCounts.get(key) ?? 0) + 1);
  }

  const monthWeeks = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (3 - index) * 7);
    return { label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: weeklyCounts.get(start.getTime()) ?? 0 };
  });
  const preferredHour = hourlyCounts.reduce((best, count, hour) => count > hourlyCounts[best] ? hour : best, 0);
  const hasPreferredTime = hourlyCounts[preferredHour] > 0;
  const preferredTimeLabel = !hasPreferredTime ? null : preferredHour < 12 ? "Morning explorer" : preferredHour < 17 ? "Afternoon adventurer" : "Evening explorer";
  const completedThisMonth = (completions ?? []).filter((completion) => new Date(completion.created_at) >= monthStart).length;
  const totalSessions = sessions?.length ?? 0;
  const completedSessions = sessions?.filter((session) => session.status === "completed").length ?? 0;
  const completionRate = sessionError || !totalSessions ? null : Math.round((completedSessions / totalSessions) * 100);

  return {
    completionRate,
    activeDaysThisMonth: activeDays.size,
    completedThisMonth,
    monthlyGoal: Math.max(8, Math.min(24, Math.ceil(Math.max(completedThisMonth, 1) / 4) * 8)),
    averageQuestMinutes: completions?.length ? Math.round(estimatedMinutes / completions.length) : 0,
    bestWeekCompletions: Math.max(0, ...weeklyCounts.values()),
    questVariety: new Set((completions ?? []).filter((completion) => new Date(completion.created_at) >= monthStart).map((completion) => completion.quests?.category).filter(Boolean)).size,
    preferredTimeLabel,
    photosCaptured,
    categoryBreakdown: [...categoryCounts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    difficultyBreakdown: [...difficultyCounts.entries()].map(([difficulty, count]) => ({ difficulty, count })).sort((a, b) => b.count - a.count || a.difficulty.localeCompare(b.difficulty)),
    monthlyWeeks: monthWeeks,
  };
}

export async function upsertOwnProfile(input: {
  email: string;
  id: string;
  displayName?: string | null;
}) {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { display_name: input.displayName ?? null, email: input.email, id: input.id },
      { onConflict: "id" },
    )
    .select()
    .single<Profile>();

  if (error) throw error;
  return data;
}

export async function fetchProfileOverview(userId?: string): Promise<ProfileOverview> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_profile_overview", {
    p_user: userId ?? null,
    p_today: today(),
  });
  if (error) throw error;
  const payload = data as ProfileOverview | null;
  if (!payload) throw new Error("Profile overview is unavailable.");
  let topCategories = payload.stats?.topCategories ?? [];
  // The overview RPC predates the Quest Rail in some deployments. Build the
  // rail from the actual completion history so it always reflects the three
  // quest categories this profile has participated in most often.
  if (payload.profile?.userId) {
    const { data: completions, error: trailError } = await supabase
      .from("quest_completions")
      .select("quests(category)")
      .eq("user_id", payload.profile.userId)
      .returns<TrailCompletionRow[]>();
    if (!trailError) {
      const counts = new Map<QuestCategory, number>();
      for (const completion of completions ?? []) {
        const category = completion.quests?.category;
        if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
      }
      topCategories = [...counts.entries()]
        .map(([category, completedQuests]) => ({ category, completedQuests }))
        .sort((a, b) => b.completedQuests - a.completedQuests || a.category.localeCompare(b.category))
        .slice(0, 3);
    }
  }
  return {
    isSelf: payload.isSelf,
    isFriend: payload.isFriend,
    isFollowing: payload.isFollowing ?? false,
    followsYou: payload.followsYou ?? false,
    profile: payload.profile ? {
      ...payload.profile,
      statVisibility: { ...DEFAULT_PROFILE_STAT_VISIBILITY, ...(payload.profile.statVisibility ?? {}) },
      privacy: { ...DEFAULT_PROFILE_PRIVACY, ...(payload.profile.privacy ?? {}) },
    } : null,
    stats: {
      ...payload.stats,
      followers: payload.stats?.followers ?? 0,
      following: payload.stats?.following ?? 0,
      // Older deployed schemas do not yet include the Quest Trail payload.
      // Keep the profile usable while the matching migration rolls out.
      topCategories,
    },
    posts: payload.posts ?? [],
    recentCompletions: payload.recentCompletions ?? [],
  };
}

/**
 * Small, self-owned profile read for surfaces that only need the avatar.
 * Keeping this independent from the overview RPC prevents a nonessential
 * overview failure from making the Lobby show the placeholder image.
 */
export async function fetchOwnProfileAvatar(userId: string): Promise<string | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle<{ avatar_url: string | null }>();

  if (error) throw error;
  return data?.avatar_url ?? null;
}

export async function updateProfile(input: ProfileEditInput) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const payload: Record<string, unknown> = {};
  if (input.displayName !== undefined) payload.display_name = input.displayName?.trim() || null;
  if (input.username !== undefined) payload.username = input.username?.trim() || null;
  if (input.bio !== undefined) payload.bio = input.bio?.trim() || null;
  if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
  if (input.emoji !== undefined) payload.emoji = input.emoji;
  if (input.avatarColor !== undefined) payload.avatar_color = input.avatarColor;
  if (input.title !== undefined) payload.title = input.title?.trim() || null;
  if (input.statVisibility !== undefined) payload.stat_visibility = input.statVisibility;
  if (input.privacy !== undefined) payload.profile_privacy = input.privacy;

  const { error } = await supabase.from("profiles").update(payload).eq("id", userData.user.id);
  if (!error) return;

  // Let ordinary profile edits keep working while the visibility migration is
  // rolling out to an existing project. The next save after migration will
  // persist the selected stat settings as well.
  const missingVisibilityColumn = (input.statVisibility !== undefined || input.privacy !== undefined) && (error.code === "42703" || /stat_visibility|profile_privacy/i.test(error.message));
  if (!missingVisibilityColumn) throw error;

  delete payload.stat_visibility;
  delete payload.profile_privacy;
  const { error: fallbackError } = await supabase.from("profiles").update(payload).eq("id", userData.user.id);
  if (fallbackError) throw fallbackError;
}

async function uploadProfileImage(localUri: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const response = await fetch(localUri);
  const body = await response.arrayBuffer();
  const rawExtension = localUri.split(".").pop()?.split("?")[0]?.toLowerCase();
  const extension = rawExtension === "png" || rawExtension === "webp" ? rawExtension : "jpg";
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  const path = `${userData.user.id}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("profile-avatars")
    .upload(path, body, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw error;

  return supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
}

export async function uploadProfileAvatar(localUri: string) {
  return uploadProfileImage(localUri);
}

export async function fetchRequiredProfileName(userId: string): Promise<RequiredProfileName | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle<RequiredProfileName>();

  if (error) throw error;
  return data;
}

export async function saveRequiredProfileName(firstName: string, lastName: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user?.email) throw new Error("No authenticated user.");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userData.user.id,
      email: userData.user.email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function createQuestPost(input: {
  questId: string;
  completionId?: string | null;
  title?: string | null;
  caption?: string | null;
  photoUrls?: string[];
  durationSeconds?: number | null;
  stats?: QuestPostStats;
  visibility?: "public" | "friends" | "private";
}) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const currentPayload = {
    user_id: userData.user.id,
    quest_id: input.questId,
    completion_id: input.completionId ?? null,
    post_title: input.title?.trim() || null,
    caption: input.caption?.trim() || null,
    photo_urls: input.photoUrls ?? [],
    duration_seconds: input.durationSeconds ?? null,
    post_stats: input.stats ?? {},
    visibility: input.visibility ?? "friends",
  };
  const { data, error } = await supabase.from("quest_posts").insert(currentPayload).select("id").single();
  if (!error) return data;

  // The composition screen can be updated before its accompanying database
  // migration reaches a project. Fall back to the original post shape so a
  // completed quest can still be published while surfacing other real errors.
  const missingPostColumns = error.code === "42703" || /post_(title|stats)|duration_seconds/i.test(error.message);
  if (!missingPostColumns) throw error;

  const { data: legacyData, error: legacyError } = await supabase.from("quest_posts").insert({
    user_id: userData.user.id,
    quest_id: input.questId,
    completion_id: input.completionId ?? null,
    caption: input.caption?.trim() || null,
    photo_urls: input.photoUrls ?? [],
    visibility: input.visibility ?? "friends",
  }).select("id").single();
  if (legacyError) throw legacyError;
  return legacyData;
}

export async function fetchQuestSocialFeed(scope: "public" | "friends") {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_quest_social_feed", { p_scope: scope, p_limit: 30 });
  if (error) throw error;
  return (data ?? []) as QuestFeedPost[];
}

export async function deleteQuestPost(postId: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase
    .from("quest_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

export async function updateQuestPost(postId: string, input: {
  postTitle: string | null;
  caption: string | null;
  photoUrls: string[];
  visibility: "public" | "friends" | "private";
}) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase
    .from("quest_posts")
    .update({
      post_title: input.postTitle?.trim() || null,
      caption: input.caption?.trim() || null,
      photo_urls: input.photoUrls,
      visibility: input.visibility,
    })
    .eq("id", postId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

export async function togglePostLike(postId: string, liked: boolean) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  if (liked) {
    const { error } = await supabase.from("post_likes").delete().match({ post_id: postId, user_id: userData.user.id });
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("post_likes").upsert({ post_id: postId, user_id: userData.user.id });
  if (error) throw error;
  return true;
}

export type { ProfileOverview, QuestFeedPost, QuestPost };
