import { Profile, ProfileEditInput, ProfileOverview, QuestFeedPost, QuestPost, QuestPostStats, RequiredProfileName } from "@/types/profile";
import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function today() {
  return toLocalDateKey(new Date());
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
  return {
    isSelf: payload.isSelf,
    isFriend: payload.isFriend,
    profile: payload.profile ?? null,
    stats: payload.stats,
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

  const { error } = await supabase.from("profiles").update(payload).eq("id", userData.user.id);
  if (error) throw error;
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
