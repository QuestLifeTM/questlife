import type { QuestEngineState } from "@/types/engine";
import type { QuestStartInput, QuestStartResult } from "@/services/engine/focused-quest-start";

/** Web retains its existing start behavior and never imports the native form. */
export function useFocusedQuestStart(create: (input: QuestStartInput) => Promise<QuestStartResult>, _reconcile: (state: QuestEngineState) => void) {
  return { startQuest: create, startFlow: null };
}
