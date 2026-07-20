import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  abandonQuestSession,
  clearTodayPlan,
  completeQuestV2,
  deleteUserPack,
  fetchEngineState,
  fetchTodayFeaturedQuestIds,
  fetchTodayPlan,
  fetchUserPacks,
  resetTodaySoloQuestCompletions,
  saveSessionForLater,
  saveTodayPlan,
  startQuestSession,
  upsertUserPack,
} from "@/services/engine/questEngineService";
import { CompleteQuestInput, CompletionResult, DailyPlan, QuestEngineState, UserPack } from "@/types/engine";

type QuestEngineContextValue = {
  engine: QuestEngineState | null;
  userPacks: UserPack[];
  todayPlan: DailyPlan | null;
  featuredQuestIds: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startQuest: (input: { questId: string; source?: "explore" | "pack" | "plan" | "featured" | "saved" | "social"; packId?: string | null }) => Promise<void>;
  abandonActiveQuest: () => Promise<void>;
  saveActiveForLater: () => Promise<void>;
  completeQuest: (input: CompleteQuestInput) => Promise<CompletionResult>;
  resetTodaySoloCompletions: () => Promise<number>;
  savePlan: (questIds: string[], sourcePackId?: string | null) => Promise<void>;
  clearPlan: () => Promise<void>;
  saveUserPack: (input: { id?: string; title: string; description?: string | null; icon: string; accentColor: string; coverImageUrl?: string | null; questIds: string[] }) => Promise<void>;
  removeUserPack: (packId: string) => Promise<void>;
};

const QuestEngineContext = createContext<QuestEngineContextValue>({
  engine: null,
  userPacks: [],
  todayPlan: null,
  featuredQuestIds: [],
  loading: false,
  error: null,
  refresh: async () => undefined,
  startQuest: async () => undefined,
  abandonActiveQuest: async () => undefined,
  saveActiveForLater: async () => undefined,
  completeQuest: async () => ({ completionId: "", xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 }),
  resetTodaySoloCompletions: async () => 0,
  savePlan: async () => undefined,
  clearPlan: async () => undefined,
  saveUserPack: async () => undefined,
  removeUserPack: async () => undefined,
});

export function QuestEngineProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [engine, setEngine] = useState<QuestEngineState | null>(null);
  const [userPacks, setUserPacks] = useState<UserPack[]>([]);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [featuredQuestIds, setFeaturedQuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setEngine(null);
      setUserPacks([]);
      setTodayPlan(null);
      setFeaturedQuestIds([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [engineState, packs, plan, featured] = await Promise.all([
        fetchEngineState(),
        fetchUserPacks(),
        fetchTodayPlan(),
        fetchTodayFeaturedQuestIds(),
      ]);
      setEngine(engineState);
      setUserPacks(packs);
      setTodayPlan(plan);
      setFeaturedQuestIds(featured);
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
    async (input: { questId: string; source?: "explore" | "pack" | "plan" | "featured" | "saved" | "social"; packId?: string | null }) => {
      await startQuestSession(input);
      setEngine(await fetchEngineState());
    },
    [],
  );

  const abandonActiveQuest = useCallback(async () => {
    const sessionId = engine?.activeSession?.id;
    if (!sessionId) return;
    await abandonQuestSession(sessionId);
    setEngine(await fetchEngineState());
  }, [engine?.activeSession?.id]);

  const saveActiveForLater = useCallback(async () => {
    const sessionId = engine?.activeSession?.id;
    if (!sessionId) return;
    await saveSessionForLater(sessionId);
    setEngine(await fetchEngineState());
  }, [engine?.activeSession?.id]);

  const completeQuest = useCallback(async (input: CompleteQuestInput) => {
    const result = await completeQuestV2(input);
    setEngine(await fetchEngineState());
    return result;
  }, []);

  const resetTodaySoloCompletions = useCallback(async () => {
    const removedCount = await resetTodaySoloQuestCompletions();
    setEngine(await fetchEngineState());
    return removedCount;
  }, []);

  const savePlan = useCallback(async (questIds: string[], sourcePackId?: string | null) => {
    const plan = await saveTodayPlan({ questIds, sourcePackId });
    setTodayPlan(plan);
  }, []);

  const clearPlan = useCallback(async () => {
    await clearTodayPlan();
    setTodayPlan(null);
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
      todayPlan,
      featuredQuestIds,
      loading,
      error,
      refresh,
      startQuest,
      abandonActiveQuest,
      saveActiveForLater,
      completeQuest,
      resetTodaySoloCompletions,
      savePlan,
      clearPlan,
      saveUserPack,
      removeUserPack,
    }),
    [
      engine,
      userPacks,
      todayPlan,
      featuredQuestIds,
      loading,
      error,
      refresh,
      startQuest,
      abandonActiveQuest,
      saveActiveForLater,
      completeQuest,
      resetTodaySoloCompletions,
      savePlan,
      clearPlan,
      saveUserPack,
      removeUserPack,
    ],
  );

  return <QuestEngineContext.Provider value={value}>{children}</QuestEngineContext.Provider>;
}

export function useQuestEngine() {
  return useContext(QuestEngineContext);
}
