import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { toLocalDateKey } from "@/services/journal/journalService";
import {
  CreatePartyInput,
  PartyCompletionInput,
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

const PARTY_MEDIA_URL_TTL_MS = 25 * 60 * 1000;
const partyMediaUrlCache = new Map<string, { url: string; expiresAt: number }>();
let partyLiveDetailRpcAvailable: boolean | null = null;

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
  // `get_party_detail_live` is introduced with the Party header clock migration.
  // Fall back to the long-standing detail RPC so a client update never makes
  // existing Parties inaccessible while that migration is being deployed.
  if (partyLiveDetailRpcAvailable !== false) {
    const live = await supabase.rpc("get_party_detail_live", { p_party_id: partyId });
    if (!live.error) {
      partyLiveDetailRpcAvailable = true;
      return live.data as PartyDetail;
    }
    // PostgREST's function-not-found response means this client is talking to a
    // database that has not run the header-clock migration yet.
    if (live.error.code === "PGRST202") partyLiveDetailRpcAvailable = false;
  }

  const fallback = await supabase.rpc("get_party_detail", { p_party_id: partyId });
  if (fallback.error) throw fallback.error;
  return fallback.data as PartyDetail;
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
  const { data, error } = await supabase.rpc("create_party_v3", {
    p_name: input.name,
    p_goal: input.goal ?? "",
    p_photo_path: input.photoPath ?? "",
    p_max_members: input.maxMembers,
    p_member_invites_enabled: input.memberInvitesEnabled,
    p_photo_proof_mode: input.photoProofMode,
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
  const { error } = await supabase.rpc("update_party_v3", {
    p_party_id: partyId,
    p_name: input.name,
    p_goal: input.goal ?? "",
    p_photo_path: input.photoPath ?? "",
    p_max_members: input.maxMembers,
    p_member_invites_enabled: input.memberInvitesEnabled,
    p_photo_proof_mode: input.photoProofMode,
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

export async function abandonPartyQuest(partyId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("abandon_party_quest_session", { p_party_id: partyId });
  if (error) throw error;
}

export async function setPartyQuestsEnabled(partyId: string, enabled: boolean) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("set_party_quests_enabled", { p_party_id: partyId, p_enabled: enabled });
  if (error) throw error;
}

export async function completePartyQuest(partyId: string, questId: string, input: PartyCompletionInput) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("complete_party_quest_v2", {
    p_party_id: partyId,
    p_quest_id: questId,
    p_today: today(),
    p_reflection: input.reflection ?? null,
    p_journal_photo_paths: input.journalPhotoPaths,
    p_share_to_feed: input.shareToFeed,
    p_feed_caption: input.feedCaption ?? null,
    p_shared_photo_paths: input.sharedPhotoPaths,
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

export async function markPartyNotificationsRead(partyId: string, kind: "feed" | "leaderboard") {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("mark_party_notifications_read", { p_party_id: partyId, p_kind: kind });
  if (error) throw error;
}

export async function dismissPartyBriefing(partyId: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("dismiss_party_briefing", { p_party_id: partyId });
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

export async function uploadJournalMedia(localUri: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");
  const response = await fetch(localUri);
  const blob = await response.arrayBuffer();
  const extension = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from("journal-media").upload(path, blob, { contentType: extension === "png" ? "image/png" : "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function resolvePartyMedia(paths: string[]) {
  if (!paths.length) return [];
  assertSupabaseConfigured();

  const now = Date.now();
  const missingPaths = paths.filter((path) => {
    const cached = partyMediaUrlCache.get(path);
    return !cached || cached.expiresAt <= now;
  });

  if (missingPaths.length) {
    const { data, error } = await supabase.storage.from("party-media").createSignedUrls(missingPaths, 60 * 30);
    if (error) throw error;
    data.forEach((item, index) => {
      if (item.signedUrl) partyMediaUrlCache.set(missingPaths[index], { url: item.signedUrl, expiresAt: now + PARTY_MEDIA_URL_TTL_MS });
    });
  }

  return paths.flatMap((path) => {
    const cached = partyMediaUrlCache.get(path);
    return cached ? [cached.url] : [];
  });
}
