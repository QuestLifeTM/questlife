import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  cancelFriendRequest,
  fetchSocialOverview,
  followProfile,
  removeFriend,
  unfollowProfile,
  respondFriendRequest,
  respondQuestChallenge,
  searchProfiles,
  sendFriendRequest,
  sendQuestChallenge,
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
  follow: (userId: string) => Promise<void>;
  unfollow: (userId: string) => Promise<void>;
  respondRequest: (requestId: string, accept: boolean) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  shareQuestWith: (recipientId: string, questId: string, message?: string) => Promise<void>;
  challengeFriend: (recipientId: string, questId: string) => Promise<void>;
  respondChallenge: (challengeId: string, accept: boolean) => Promise<void>;
};

const SocialContext = createContext<SocialContextValue>({
  overview: null,
  loading: false,
  error: null,
  refresh: async () => undefined,
  searchUsers: async () => [],
  addFriend: async () => undefined,
  follow: async () => undefined,
  unfollow: async () => undefined,
  respondRequest: async () => undefined,
  cancelRequest: async () => undefined,
  unfriend: async () => undefined,
  shareQuestWith: async () => undefined,
  challengeFriend: async () => undefined,
  respondChallenge: async () => undefined,
});

export function SocialProvider({ children, enabled = true }: PropsWithChildren<{ enabled?: boolean }>) {
  const { isConfigured, session } = useAuth();
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setOverview(null);
      return;
    }
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const requestId = ++requestIdRef.current;
    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        const nextOverview = await fetchSocialOverview();
        if (requestId !== requestIdRef.current) return;
        setOverview(nextOverview);
      } catch (nextError) {
        if (requestId === requestIdRef.current) setError(nextError instanceof Error ? nextError.message : "Unable to load social data.");
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    })();
    refreshInFlightRef.current = request;
    try { await request; } finally { if (refreshInFlightRef.current === request) refreshInFlightRef.current = null; }
  }, [isConfigured, session]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

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
      follow: (userId: string) => runAndRefresh(() => followProfile(userId), "Unable to follow this adventurer."),
      unfollow: (userId: string) => runAndRefresh(() => unfollowProfile(userId), "Unable to unfollow this adventurer."),
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
    }),
    [overview, loading, error, refresh, runAndRefresh],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  return useContext(SocialContext);
}
