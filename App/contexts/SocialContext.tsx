import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  cancelFriendRequest,
  createParty,
  fetchSocialOverview,
  inviteToParty,
  leaveParty,
  removeFriend,
  respondFriendRequest,
  respondPartyInvite,
  respondQuestChallenge,
  searchProfiles,
  sendFriendRequest,
  sendQuestChallenge,
  setPartyQuests,
  shareQuest,
} from "@/services/social/socialService";
import { ProfileSearchResult, SocialOverview } from "@/types/social";

type SocialContextValue = {
  overview: SocialOverview | null;
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
  startParty: (input: { name: string; emoji: string; accentColor: string; gameMode: "together" | "relay"; questIds: string[] }) => Promise<string>;
  inviteFriendToParty: (partyId: string, recipientId: string) => Promise<void>;
  respondToPartyInvite: (inviteId: string, accept: boolean) => Promise<void>;
  exitParty: (partyId: string) => Promise<void>;
  updatePartyQuests: (partyId: string, questIds: string[]) => Promise<void>;
};

const SocialContext = createContext<SocialContextValue>({
  overview: null,
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
  startParty: async () => "",
  inviteFriendToParty: async () => undefined,
  respondToPartyInvite: async () => undefined,
  exitParty: async () => undefined,
  updatePartyQuests: async () => undefined,
});

export function SocialProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setOverview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchSocialOverview());
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
      startParty: async (input: { name: string; emoji: string; accentColor: string; gameMode: "together" | "relay"; questIds: string[] }) => {
        const id = await createParty(input);
        await refresh();
        return id;
      },
      inviteFriendToParty: (partyId: string, recipientId: string) =>
        runAndRefresh(() => inviteToParty(partyId, recipientId), "Unable to invite to party."),
      respondToPartyInvite: (inviteId: string, accept: boolean) =>
        runAndRefresh(() => respondPartyInvite(inviteId, accept), "Unable to respond to party invite."),
      exitParty: (partyId: string) => runAndRefresh(() => leaveParty(partyId), "Unable to leave party."),
      updatePartyQuests: (partyId: string, questIds: string[]) =>
        runAndRefresh(() => setPartyQuests(partyId, questIds), "Unable to update party quests."),
    }),
    [overview, loading, error, refresh, runAndRefresh],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  return useContext(SocialContext);
}
