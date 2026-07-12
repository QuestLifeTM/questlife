import { Profile, ProfileEditInput, ProfileOverview, QuestPost } from "@/types/profile";
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

export async function updateProfile(input: ProfileEditInput) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const payload: Record<string, unknown> = {};
  if (input.displayName !== undefined) payload.display_name = input.displayName?.trim() || null;
  if (input.username !== undefined) payload.username = input.username?.trim() || null;
  if (input.bio !== undefined) payload.bio = input.bio?.trim() || null;
  if (input.emoji !== undefined) payload.emoji = input.emoji;
  if (input.avatarColor !== undefined) payload.avatar_color = input.avatarColor;
  if (input.title !== undefined) payload.title = input.title?.trim() || null;

  const { error } = await supabase.from("profiles").update(payload).eq("id", userData.user.id);
  if (error) throw error;
}

export async function createQuestPost(input: {
  questId: string;
  completionId?: string | null;
  caption?: string | null;
  photoUrls?: string[];
  visibility?: "public" | "friends" | "private";
}) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("quest_posts").insert({
    user_id: userData.user.id,
    quest_id: input.questId,
    completion_id: input.completionId ?? null,
    caption: input.caption?.trim() || null,
    photo_urls: input.photoUrls ?? [],
    visibility: input.visibility ?? "friends",
  });
  if (error) throw error;
}

export async function deleteQuestPost(postId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.from("quest_posts").delete().eq("id", postId);
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

export type { ProfileOverview, QuestPost };
