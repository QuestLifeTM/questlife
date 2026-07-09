import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  cancelDuoStreakInvite,
  endDuoStreak,
  fetchStreakOverview,
  respondToDuoStreakInvite,
  sendDuoStreakInvite,
  sendDuoStreakNudge,
  updateStreakVisibility,
} from "@/services/streaks/streakService";
import { StreakOverview, StreakVisibility } from "@/types/streaks";

type StreaksContextValue = {
  overview: StreakOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setVisibility: (visibility: StreakVisibility) => Promise<void>;
  inviteFriend: (friendId: string) => Promise<void>;
  respondToInvite: (inviteId: string, accept: boolean) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  leaveDuoStreak: (streakId: string) => Promise<void>;
  nudgePartner: (streakId: string) => Promise<void>;
};

const StreaksContext = createContext<StreaksContextValue>({
  overview: null,
  loading: false,
  error: null,
  refresh: async () => undefined,
  setVisibility: async () => undefined,
  inviteFriend: async () => undefined,
  respondToInvite: async () => undefined,
  cancelInvite: async () => undefined,
  leaveDuoStreak: async () => undefined,
  nudgePartner: async () => undefined,
});

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function StreaksProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [overview, setOverview] = useState<StreakOverview | null>(null);
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
      setOverview(await fetchStreakOverview());
    } catch (nextError) {
      setError(toMessage(nextError, "Unable to load your streaks."));
    } finally {
      setLoading(false);
    }
  }, [isConfigured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setVisibility = useCallback(
    async (visibility: StreakVisibility) => {
      const previous = overview;
      setOverview((current) =>
        current ? { ...current, personal: { ...current.personal, streakVisibility: visibility } } : current,
      );

      try {
        await updateStreakVisibility(visibility);
      } catch (nextError) {
        setOverview(previous);
        setError(toMessage(nextError, "Unable to update streak visibility."));
      }
    },
    [overview],
  );

  const runAndRefresh = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      try {
        await action();
        await refresh();
      } catch (nextError) {
        setError(toMessage(nextError, fallbackMessage));
        throw nextError;
      }
    },
    [refresh],
  );

  const inviteFriend = useCallback(
    (friendId: string) =>
      runAndRefresh(() => sendDuoStreakInvite(friendId), "Unable to send the streak invite."),
    [runAndRefresh],
  );

  const respondToInvite = useCallback(
    (inviteId: string, accept: boolean) =>
      runAndRefresh(() => respondToDuoStreakInvite(inviteId, accept), "Unable to respond to the invite."),
    [runAndRefresh],
  );

  const cancelInvite = useCallback(
    (inviteId: string) =>
      runAndRefresh(() => cancelDuoStreakInvite(inviteId), "Unable to cancel the invite."),
    [runAndRefresh],
  );

  const leaveDuoStreak = useCallback(
    (streakId: string) => runAndRefresh(() => endDuoStreak(streakId), "Unable to end the streak."),
    [runAndRefresh],
  );

  const nudgePartner = useCallback(
    (streakId: string) =>
      runAndRefresh(() => sendDuoStreakNudge(streakId), "Unable to send the encouragement."),
    [runAndRefresh],
  );

  const value = useMemo(
    () => ({
      overview,
      loading,
      error,
      refresh,
      setVisibility,
      inviteFriend,
      respondToInvite,
      cancelInvite,
      leaveDuoStreak,
      nudgePartner,
    }),
    [
      overview,
      loading,
      error,
      refresh,
      setVisibility,
      inviteFriend,
      respondToInvite,
      cancelInvite,
      leaveDuoStreak,
      nudgePartner,
    ],
  );

  return <StreaksContext.Provider value={value}>{children}</StreaksContext.Provider>;
}

export function useStreaks() {
  return useContext(StreaksContext);
}
