import { useCallback, useState } from "react";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { engineErrorMessage } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";

export type QuestStartBlock =
  | { type: "daily_limit" }
  | { type: "repeat_quest"; quest: Quest; repeatXp: number }
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
          // The disabled, dark "A quest is active right now" button is the
          // normal affordance. This can only occur if another device starts a
          // quest between render and request, so refresh silently instead of
          // showing a second, redundant blocking sheet.
          await refresh();
        } else if (message.includes("already completed")) {
          const quest = getQuest(input.questId);
          if (quest) setBlock({ type: "repeat_quest", quest, repeatXp: Math.round(quest.xp * 0.2) });
          else setBlock({ type: "error", message });
        } else {
          setBlock({ type: "error", message });
        }
        return false;
      } finally {
        setStarting(false);
      }
    },
    [engine?.todayCompletions, getQuest, refresh, startQuest],
  );

  const clearBlock = useCallback(() => setBlock(null), []);

  return { tryStart, block, clearBlock, starting };
}
