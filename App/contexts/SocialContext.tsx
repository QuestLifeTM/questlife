import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  cancelFriendRequest,
  dismissPartyBriefing,
  completePartyQuest,
  createParty,
  endParty,
  endPartyRound,
  fetchPartyDetail,
  fetchPartyHub,
  fetchSocialOverview,
  inviteToParty,
  leaveParty,
  joinPartyByCode,
  markPartyNotificationsRead,
  removeFriend,
  respondFriendRequest,
  respondPartyInvite,
  respondQuestChallenge,
  reactToPartyPost,
  searchProfiles,
  sendFriendRequest,
  sendQuestChallenge,
  setPartyQuests,
  setPartyQuestsEnabled,
  shareQuest,
  addPartyQuests,
  abandonPartyQuest,
  startPartyQuest,
  suggestPartyQuests,
  updateParty,
} from "@/services/social/socialService";
import { CreatePartyInput, PartyCompletionInput, PartyCompletionResult, PartyDetail, PartyHub, ProfileSearchResult, SocialOverview } from "@/types/social";

type SocialContextValue = {
  overview: SocialOverview | null;
  partyHub: PartyHub | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  searchUsers: (query: string) => Promise<ProfileSearchResult[]>;
  addFriend: (userId: string) => Promise<void>;
  respondRequest: (requestId: string, accept: boolean) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  shareQuestWith: (recipientId: string, questId: string, message?: string) => Promise<void>;
  challengeFriend: (recipientId: string, questId: string) => Promise<void>;
  respondChallenge: (challengeId: string, accept: boolean) => Promise<void>;
  startParty: (input: CreatePartyInput) => Promise<{ id: string; code: string }>;
  joinPartyWithCode: (code: string) => Promise<string>;
  getParty: (partyId: string) => Promise<PartyDetail>;
  saveParty: (partyId: string, input: CreatePartyInput) => Promise<void>;
  finishParty: (partyId: string) => Promise<void>;
  inviteFriendToParty: (partyId: string, recipientId: string) => Promise<void>;
  respondToPartyInvite: (inviteId: string, accept: boolean) => Promise<void>;
  exitParty: (partyId: string) => Promise<void>;
  updatePartyQuests: (partyId: string, questIds: string[]) => Promise<void>;
  addQuestsToParty: (partyId: string, questIds: string[]) => Promise<void>;
  suggestQuestsForParty: (partyId: string, questIds: string[]) => Promise<void>;
  beginPartyQuest: (partyId: string, questId: string) => Promise<void>;
  abandonPartyQuest: (partyId: string) => Promise<void>;
  setPartyQuestsEnabled: (partyId: string, enabled: boolean) => Promise<void>;
  completePartyQuest: (partyId: string, questId: string, input: PartyCompletionInput) => Promise<PartyCompletionResult>;
  finishPartyQuest: (partyId: string, questId?: string) => Promise<void>;
  reactToPartyFeed: (postId: string, emoji: string) => Promise<void>;
  markPartyNotificationsRead: (partyId: string, kind: "feed" | "leaderboard") => Promise<void>;
  dismissPartyBriefing: (partyId: string) => Promise<void>;
};

const SocialContext = createContext<SocialContextValue>({
  overview: null,
  partyHub: null,
  loading: false,
  error: null,
  refresh: async () => undefined,
  searchUsers: async () => [],
  addFriend: async () => undefined,
  respondRequest: async () => undefined,
  cancelRequest: async () => undefined,
  unfriend: async () => undefined,
  shareQuestWith: async () => undefined,
  challengeFriend: async () => undefined,
  respondChallenge: async () => undefined,
  startParty: async () => ({ id: "", code: "" }),
  joinPartyWithCode: async () => "",
  getParty: async () => { throw new Error("Party unavailable."); },
  saveParty: async () => undefined,
  finishParty: async () => undefined,
  inviteFriendToParty: async () => undefined,
  respondToPartyInvite: async () => undefined,
  exitParty: async () => undefined,
  updatePartyQuests: async () => undefined,
  addQuestsToParty: async () => undefined,
  suggestQuestsForParty: async () => undefined,
  beginPartyQuest: async () => undefined,
  abandonPartyQuest: async () => undefined,
  setPartyQuestsEnabled: async () => undefined,
  completePartyQuest: async () => ({ completionId: "", xpAwarded: 0, dailyUsed: 0, dailyLimit: 5, fastest: null, topFinishers: [], proofMode: "disabled", feedShared: false, elapsedSeconds: 0 }),
  finishPartyQuest: async () => undefined,
  reactToPartyFeed: async () => undefined,
  markPartyNotificationsRead: async () => undefined,
  dismissPartyBriefing: async () => undefined,
});

export function SocialProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [partyHub, setPartyHub] = useState<PartyHub | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setOverview(null);
      setPartyHub(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextPartyHub] = await Promise.all([fetchSocialOverview(), fetchPartyHub()]);
      setOverview(nextOverview);
      setPartyHub(nextPartyHub);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load social data.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAndRefresh = useCallback(
    async (action: () => Promise<void>, fallback: string) => {
      try {
        await action();
        await refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : fallback);
        throw nextError;
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      overview,
      partyHub,
      loading,
      error,
      refresh,
      searchUsers: searchProfiles,
      addFriend: (userId: string) => runAndRefresh(() => sendFriendRequest(userId), "Unable to send friend request."),
      respondRequest: (requestId: string, accept: boolean) =>
        runAndRefresh(() => respondFriendRequest(requestId, accept), "Unable to respond to request."),
      cancelRequest: (requestId: string) => runAndRefresh(() => cancelFriendRequest(requestId), "Unable to cancel request."),
      unfriend: (userId: string) => runAndRefresh(() => removeFriend(userId), "Unable to remove friend."),
      shareQuestWith: (recipientId: string, questId: string, message?: string) =>
        runAndRefresh(() => shareQuest(recipientId, questId, message), "Unable to share quest."),
      challengeFriend: (recipientId: string, questId: string) =>
        runAndRefresh(() => sendQuestChallenge(recipientId, questId), "Unable to send challenge."),
      respondChallenge: (challengeId: string, accept: boolean) =>
        runAndRefresh(() => respondQuestChallenge(challengeId, accept), "Unable to respond to challenge."),
      startParty: async (input: CreatePartyInput) => {
        const result = await createParty(input);
        await refresh();
        return result;
      },
      joinPartyWithCode: async (code: string) => {
        const partyId = await joinPartyByCode(code);
        await refresh();
        return partyId;
      },
      getParty: fetchPartyDetail,
      saveParty: (partyId: string, input: CreatePartyInput) => runAndRefresh(() => updateParty(partyId, input), "Unable to save party changes."),
      finishParty: (partyId: string) => runAndRefresh(() => endParty(partyId), "Unable to end this party."),
      inviteFriendToParty: (partyId: string, recipientId: string) =>
        runAndRefresh(() => inviteToParty(partyId, recipientId), "Unable to invite to party."),
      respondToPartyInvite: (inviteId: string, accept: boolean) =>
        runAndRefresh(() => respondPartyInvite(inviteId, accept), "Unable to respond to party invite."),
      exitParty: (partyId: string) => runAndRefresh(() => leaveParty(partyId), "Unable to leave party."),
      updatePartyQuests: (partyId: string, questIds: string[]) =>
        runAndRefresh(() => setPartyQuests(partyId, questIds), "Unable to update party quests."),
      addQuestsToParty: (partyId: string, questIds: string[]) => runAndRefresh(() => addPartyQuests(partyId, questIds), "Unable to add quests."),
      suggestQuestsForParty: (partyId: string, questIds: string[]) => runAndRefresh(() => suggestPartyQuests(partyId, questIds), "Unable to suggest quests."),
      beginPartyQuest: (partyId: string, questId: string) => runAndRefresh(() => startPartyQuest(partyId, questId).then(() => undefined), "Unable to start this party quest."),
      abandonPartyQuest: (partyId: string) => runAndRefresh(() => abandonPartyQuest(partyId), "Unable to abandon this Party quest."),
      setPartyQuestsEnabled: (partyId: string, enabled: boolean) => runAndRefresh(() => setPartyQuestsEnabled(partyId, enabled), "Unable to update Party quests."),
      completePartyQuest: async (partyId: string, questId: string, input: PartyCompletionInput) => {
        const result = await completePartyQuest(partyId, questId, input);
        await refresh();
        return result;
      },
      finishPartyQuest: (partyId: string, questId?: string) => runAndRefresh(() => endPartyRound(partyId, questId), "Unable to end this shared quest."),
      reactToPartyFeed: (postId: string, emoji: string) => runAndRefresh(() => reactToPartyPost(postId, emoji), "Unable to add that reaction."),
      markPartyNotificationsRead: (partyId: string, kind: "feed" | "leaderboard") =>
        runAndRefresh(() => markPartyNotificationsRead(partyId, kind), "Unable to update Party notifications."),
      dismissPartyBriefing: (partyId: string) => runAndRefresh(() => dismissPartyBriefing(partyId), "Unable to save the Party briefing."),
    }),
    [overview, partyHub, loading, error, refresh, runAndRefresh],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  return useContext(SocialContext);
}
