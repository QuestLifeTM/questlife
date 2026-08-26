import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import { compressFeedImage } from "@/services/media/feed-image";
import {
  FollowerProfile,
  ProfileSearchResult,
  SocialOverview,
} from "@/types/social";

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function today() {
  return toLocalDateKey(new Date());
}

export async function fetchSocialOverview(): Promise<SocialOverview> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_social_overview", { p_today: today() });
  if (error) throw error;
  const payload = data as SocialOverview;
  return {
    me: payload.me,
    friends: payload.friends ?? [],
    incomingRequests: payload.incomingRequests ?? [],
    outgoingRequests: payload.outgoingRequests ?? [],
    shares: payload.shares ?? [],
    incomingChallenges: payload.incomingChallenges ?? [],
    activeChallenges: payload.activeChallenges ?? [],
  };
}

export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("search_profiles", { p_query: query });
  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
}

export async function fetchFriendSuggestions(): Promise<ProfileSearchResult[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_friend_suggestions");
  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
}

export async function findProfilesByContactEmails(emails: string[]): Promise<ProfileSearchResult[]> {
  assertSupabaseConfigured();
  if (!emails.length) return [];
  const { data, error } = await supabase.rpc("find_profiles_by_contact_emails", { p_emails: emails });
  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
}

export async function fetchFriendProfile(userId: string): Promise<ProfileSearchResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_friend_profile", { p_user: userId });
  if (error) throw error;
  if (!data) throw new Error("This adventurer is no longer available.");
  return data as ProfileSearchResult;
}

export async function sendFriendRequest(userId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("send_friend_request", { p_user: userId });
  if (error) throw error;
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("respond_friend_request", { p_request_id: requestId, p_accept: accept });
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("cancel_friend_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function removeFriend(userId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("remove_friend", { p_user: userId });
  if (error) throw error;
}

export async function followProfile(userId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("follow_profile", { p_user: userId });
  if (error) throw error;
}

export async function unfollowProfile(userId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("unfollow_profile", { p_user: userId });
  if (error) throw error;
}

export async function fetchFollowers(): Promise<FollowerProfile[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_profile_followers");
  if (error) throw error;
  return (data ?? []) as FollowerProfile[];
}

export async function removeFollower(userId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("remove_profile_follower", { p_user: userId });
  if (error) throw error;
}

export async function shareQuest(recipientId: string, questId: string, message?: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("share_quest", { p_recipient: recipientId, p_quest_id: questId, p_message: message ?? null });
  if (error) throw error;
}

export async function sendQuestChallenge(recipientId: string, questId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("send_quest_challenge", { p_recipient: recipientId, p_quest_id: questId });
  if (error) throw error;
}

export async function respondQuestChallenge(challengeId: string, accept: boolean) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("respond_quest_challenge", { p_challenge_id: challengeId, p_accept: accept });
  if (error) throw error;
}

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
  const { error } = await supabase.storage.from("journal-media").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}
