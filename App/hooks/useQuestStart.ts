import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { abandonMyActiveQuestSession, clearMyActiveQuestRecovery, engineErrorMessage, fetchEngineState } from "@/services/engine/questEngineService";
import { Sentry } from "@/lib/sentry";
import { Quest } from "@/types/content";

export type QuestStartBlock =
  | { type: "daily_limit" }
  | { type: "repeat_quest"; quest: Quest; repeatXp: number }
  | { type: "active_session"; quest: Quest | null; requestedQuest?: Quest | null; actionColor?: string }
  | { type: "error"; message: string };

/**
 * Wraps quest-engine start checks with friendly popup state.
 * Returns a block reason when start fails, or null on success.
 */
export function useQuestStart(getQuest: (id?: string) => Quest | null) {
  const { engine, refresh, startQuest } = useQuestEngine();
  const [block, setBlock] = useState<QuestStartBlock | null>(null);
  const [starting, setStarting] = useState(false);

  const tryStart = useCallback(
    async (input: { questId: string; source?: "explore" | "saved" | "social"; confirmedRepeat?: boolean }) => {
      setStarting(true);
      setBlock(null);
      try {
        const quest = getQuest(input.questId);
        const completedToday = engine?.todayCompletions.some((completion) => completion.questId === input.questId) ?? false;
        if (!input.confirmedRepeat && quest && (quest.completed || completedToday)) {
          setBlock({ type: "repeat_quest", quest, repeatXp: Math.round(quest.xp * 0.2) });
          return false;
        }
        await startQuest(input);
        await refresh();
        return true;
      } catch (error) {
        const message = engineErrorMessage(error);
        if (message.includes("daily limit") || message.includes("5 quests")) {
          setBlock({ type: "daily_limit" });
        } else if (message.includes("already have an active")) {
          // Reconcile with the server rather than silently leaving the user
          // blocked after an interrupted app run or cross-device change.
          const state = await fetchEngineState().catch(() => null);
          await refresh();
          Sentry.captureMessage("quest_active_session_recovery_required", "warning");
          setBlock({ type: "active_session", quest: state?.activeSession ? getQuest(state.activeSession.questId) : null });
        } else if (message.includes("already completed")) {
          const quest = getQuest(input.questId);
          if (quest) setBlock({ type: "repeat_quest", quest, repeatXp: Math.round(quest.xp * 0.2) });
          else setBlock({ type: "error", message });
        } else {
          setBlock({ type: "error", message });
          // The sheet is useful in-app context, but a native alert guarantees
          // a failed start is never silent if the sheet cannot render.
          Alert.alert("Couldn't start quest", message);
        }
        return false;
      } finally {
        setStarting(false);
      }
    },
    [engine?.todayCompletions, getQuest, refresh, startQuest],
  );

  const clearBlock = useCallback(() => setBlock(null), []);

  const resumeActiveQuest = useCallback(async () => {
    setStarting(true);
    try {
      await clearMyActiveQuestRecovery();
      const state = await fetchEngineState();
      if (!state.activeSession) throw new Error("Your active quest is no longer available.");
      await refresh();
      setBlock(null);
      return true;
    } catch (error) {
      const message = engineErrorMessage(error);
      setBlock({ type: "error", message });
      Alert.alert("Couldn't resume quest", message);
      return false;
    } finally {
      setStarting(false);
    }
  }, [refresh]);

  const showActiveSessionBlock = useCallback((requestedQuest: Quest, actionColor?: string) => {
    const activeQuest = engine?.activeSession ? getQuest(engine.activeSession.questId) : null;
    setBlock({ type: "active_session", quest: activeQuest, requestedQuest, actionColor });
  }, [engine?.activeSession, getQuest]);

  const abandonActiveAndRetry = useCallback(async (input: { questId: string; source?: "explore" | "saved" | "social" }) => {
    setStarting(true);
    setBlock(null);
    try {
      await abandonMyActiveQuestSession();
      await refresh();
      await startQuest(input);
      await refresh();
      return true;
    } catch (error) {
      const message = engineErrorMessage(error);
      setBlock({ type: "error", message });
      Alert.alert("Couldn't start quest", message);
      return false;
    } finally {
      setStarting(false);
    }
  }, [refresh, startQuest]);

  return { tryStart, abandonActiveAndRetry, resumeActiveQuest, block, clearBlock, showActiveSessionBlock, starting };
}
