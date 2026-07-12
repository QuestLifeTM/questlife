import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import {
  CreatePartyInput,
  PartyCompletionResult,
  PartyDetail,
  PartyHub,
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
    partyInvites: payload.partyInvites ?? [],
    parties: payload.parties ?? [],
  };
}

export async function fetchPartyHub(): Promise<PartyHub> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_party_hub");
  if (error) throw error;
  const payload = data as PartyHub;
  return { templates: payload.templates ?? [], active: payload.active ?? [], past: payload.past ?? [] };
}

export async function fetchPartyDetail(partyId: string): Promise<PartyDetail> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_party_detail", { p_party_id: partyId });
  if (error) throw error;
  return data as PartyDetail;
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

export async function createParty(input: CreatePartyInput) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("create_party_v2", {
    p_name: input.name,
    p_goal: input.goal ?? "",
    p_photo_path: input.photoPath ?? "",
    p_max_members: input.maxMembers,
    p_member_invites_enabled: input.memberInvitesEnabled,
    p_photo_proof_required: input.photoProofRequired,
    p_game_mode: input.gameMode,
    p_location_type: input.locationType,
    p_location_label: input.locationLabel ?? "",
    p_rules: input.rules,
    p_quest_ids: input.questIds,
  });
  if (error) throw error;
  return data as { id: string; code: string };
}

export async function joinPartyByCode(code: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("join_party_by_code", { p_code: code });
  if (error) throw error;
  return data as string;
}

export async function updateParty(partyId: string, input: CreatePartyInput) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("update_party_v2", {
    p_party_id: partyId,
    p_name: input.name,
    p_goal: input.goal ?? "",
    p_photo_path: input.photoPath ?? "",
    p_max_members: input.maxMembers,
    p_member_invites_enabled: input.memberInvitesEnabled,
    p_photo_proof_required: input.photoProofRequired,
    p_game_mode: input.gameMode,
    p_location_type: input.locationType,
    p_location_label: input.locationLabel ?? "",
    p_rules: input.rules,
  });
  if (error) throw error;
}

export async function endParty(partyId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("end_party_v2", { p_party_id: partyId });
  if (error) throw error;
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

export async function addPartyQuests(partyId: string, questIds: string[]) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("add_party_quests", { p_party_id: partyId, p_quest_ids: questIds });
  if (error) throw error;
}

export async function suggestPartyQuests(partyId: string, questIds: string[]) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("suggest_party_quests", { p_party_id: partyId, p_quest_ids: questIds });
  if (error) throw error;
}

export async function startPartyQuest(partyId: string, questId: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("start_party_quest", { p_party_id: partyId, p_quest_id: questId });
  if (error) throw error;
  return data as { roundId?: string; sessionId?: string; startedAt: string };
}

export async function completePartyQuest(partyId: string, questId: string, reflection?: string, photoPaths: string[] = []) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("complete_party_quest", {
    p_party_id: partyId,
    p_quest_id: questId,
    p_today: today(),
    p_reflection: reflection ?? null,
    p_photo_paths: photoPaths,
  });
  if (error) throw error;
  return data as PartyCompletionResult;
}

export async function endPartyRound(partyId: string, questId?: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("end_party_round", { p_party_id: partyId, p_quest_id: questId ?? null });
  if (error) throw error;
}

export async function reactToPartyPost(postId: string, emoji: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("react_to_party_post", { p_post_id: postId, p_emoji: emoji });
  if (error) throw error;
}

export async function uploadPartyMedia(partyId: string, localUri: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");
  const response = await fetch(localUri);
  const blob = await response.arrayBuffer();
  const extension = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${partyId}/${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("party-media").upload(path, blob, { contentType: extension === "png" ? "image/png" : "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function resolvePartyMedia(paths: string[]) {
  if (!paths.length) return [];
  assertSupabaseConfigured();
  const { data, error } = await supabase.storage.from("party-media").createSignedUrls(paths, 60 * 30);
  if (error) throw error;
  return data.map((item) => item.signedUrl);
}
