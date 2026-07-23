import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  abandonQuestSession,
  completeQuestV2,
  deleteUserPack,
  fetchEngineState,
  fetchUserPacks,
  resetTodaySoloQuestCompletions,
  saveSessionForLater,
  startQuestSession,
  upsertUserPack,
} from "@/services/engine/questEngineService";
import { CompleteQuestInput, CompletionResult, QuestEngineState, UserPack } from "@/types/engine";

type QuestEngineContextValue = {
  engine: QuestEngineState | null;
  userPacks: UserPack[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startQuest: (input: { questId: string; source?: "explore" | "saved" | "social" }) => Promise<void>;
  abandonActiveQuest: () => Promise<void>;
  saveActiveForLater: () => Promise<void>;
  completeQuest: (input: CompleteQuestInput) => Promise<CompletionResult>;
  resetTodaySoloCompletions: () => Promise<number>;
  saveUserPack: (input: { id?: string; title: string; description?: string | null; icon: string; accentColor: string; coverImageUrl?: string | null; questIds: string[] }) => Promise<void>;
  removeUserPack: (packId: string) => Promise<void>;
};

const QuestEngineContext = createContext<QuestEngineContextValue>({
  engine: null,
  userPacks: [],
  loading: false,
  error: null,
  refresh: async () => undefined,
  startQuest: async () => undefined,
  abandonActiveQuest: async () => undefined,
  saveActiveForLater: async () => undefined,
  completeQuest: async () => ({ completionId: "", xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 }),
  resetTodaySoloCompletions: async () => 0,
  saveUserPack: async () => undefined,
  removeUserPack: async () => undefined,
});

export function QuestEngineProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [engine, setEngine] = useState<QuestEngineState | null>(null);
  const [userPacks, setUserPacks] = useState<UserPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setEngine(null);
      setUserPacks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [engineState, packs] = await Promise.all([
        fetchEngineState(),
        fetchUserPacks(),
      ]);
      setEngine(engineState);
      setUserPacks(packs);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load quest engine state.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startQuest = useCallback(
    async (input: { questId: string; source?: "explore" | "saved" | "social" }) => {
      const session = await startQuestSession(input);
      try {
        setEngine(await fetchEngineState());
      } catch {
        // The session exists remotely. Preserve that fact locally so a retry
        // cannot accidentally try to start a second active quest.
        setEngine((current) => current ? {
          ...current,
          activeSession: {
            id: session.sessionId,
            questId: input.questId,
            source: input.source ?? "explore",
            startedAt: new Date().toISOString(),
          },
        } : current);
      }
    },
    [],
  );

  const abandonActiveQuest = useCallback(async () => {
    const sessionId = engine?.activeSession?.id;
    if (!sessionId) return;
    await abandonQuestSession(sessionId);
    try {
      setEngine(await fetchEngineState());
    } catch {
      setEngine((current) => current ? { ...current, activeSession: null } : current);
    }
  }, [engine?.activeSession?.id]);

  const saveActiveForLater = useCallback(async () => {
    const sessionId = engine?.activeSession?.id;
    if (!sessionId) return;
    await saveSessionForLater(sessionId);
    try {
      setEngine(await fetchEngineState());
    } catch {
      setEngine((current) => current ? { ...current, activeSession: null } : current);
    }
  }, [engine?.activeSession?.id]);

  const completeQuest = useCallback(async (input: CompleteQuestInput) => {
    const result = await completeQuestV2(input);
    // Completion has already committed at this point. A follow-up refresh is
    // useful, but must never turn a completed quest into an apparent failure.
    try {
      setEngine(await fetchEngineState());
    } catch {
      setEngine((current) => current ? { ...current, activeSession: null } : current);
    }
    return result;
  }, []);

  const resetTodaySoloCompletions = useCallback(async () => {
    const removedCount = await resetTodaySoloQuestCompletions();
    try {
      setEngine(await fetchEngineState());
    } catch {
      setEngine((current) => current ? { ...current, dailyUsed: Math.max(0, current.dailyUsed - removedCount) } : current);
    }
    return removedCount;
  }, []);

  const saveUserPack = useCallback(
    async (input: { id?: string; title: string; description?: string | null; icon: string; accentColor: string; coverImageUrl?: string | null; questIds: string[] }) => {
      await upsertUserPack(input);
      setUserPacks(await fetchUserPacks());
    },
    [],
  );

  const removeUserPack = useCallback(async (packId: string) => {
    await deleteUserPack(packId);
    setUserPacks((prev) => prev.filter((pack) => pack.id !== packId));
  }, []);

  const value = useMemo(
    () => ({
      engine,
      userPacks,
      loading,
      error,
      refresh,
      startQuest,
      abandonActiveQuest,
      saveActiveForLater,
      completeQuest,
      resetTodaySoloCompletions,
      saveUserPack,
      removeUserPack,
    }),
    [
      engine,
      userPacks,
      loading,
      error,
      refresh,
      startQuest,
      abandonActiveQuest,
      saveActiveForLater,
      completeQuest,
      resetTodaySoloCompletions,
      saveUserPack,
      removeUserPack,
    ],
  );

  return <QuestEngineContext.Provider value={value}>{children}</QuestEngineContext.Provider>;
}

export function useQuestEngine() {
  return useContext(QuestEngineContext);
}
