import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import { ProfileSearchResult, SocialOverview } from "@/types/social";

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
    partyInvites: payload.partyInvites ?? [],
    parties: payload.parties ?? [],
  };
}

export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("search_profiles", { p_query: query });
  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
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

export async function createParty(input: { name: string; emoji: string; accentColor: string; gameMode: "together" | "relay"; questIds: string[] }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("create_party", {
    p_name: input.name,
    p_emoji: input.emoji,
    p_accent_color: input.accentColor,
    p_game_mode: input.gameMode,
    p_quest_ids: input.questIds,
  });
  if (error) throw error;
  return data as string;
}

export async function inviteToParty(partyId: string, recipientId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("invite_to_party", { p_party_id: partyId, p_recipient: recipientId });
  if (error) throw error;
}

export async function respondPartyInvite(inviteId: string, accept: boolean) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("respond_party_invite", { p_invite_id: inviteId, p_accept: accept });
  if (error) throw error;
}

export async function leaveParty(partyId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("leave_party", { p_party_id: partyId });
  if (error) throw error;
}

export async function setPartyQuests(partyId: string, questIds: string[]) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("set_party_quests", { p_party_id: partyId, p_quest_ids: questIds });
  if (error) throw error;
}
