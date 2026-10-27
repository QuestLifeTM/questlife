import * as DeviceStorage from "@/lib/device-storage";

export const FINISH_QUEST_PROMPTS = [
  { title: "Calling it a quest?", continueLabel: "Keep Going", endLabel: "End Quest" },
  { title: "End of the adventure?", continueLabel: "Not Yet", endLabel: "End Quest" },
  { title: "That's a wrap?", continueLabel: "Keep Going", endLabel: "Wrap It Up" },
] as const;

const STORAGE_KEY = "finish-quest-prompt-v1";
let current: { sessionId: string; index: number } | null = null;
let pending = Promise.resolve(0);

// Assign once per quest session, including across screen remounts and app restarts.
export function getFinishQuestPromptIndex(sessionId: string): Promise<number> {
  pending = pending.then(async () => {
    if (!current) {
      try {
        const saved = await DeviceStorage.getItemAsync(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed && typeof parsed.sessionId === "string" && Number.isInteger(parsed.index) && parsed.index >= 0 && parsed.index < FINISH_QUEST_PROMPTS.length) current = parsed;
      } catch (error) {
        console.warn("Could not restore quest prompt rotation", error);
      }
    }
    if (current?.sessionId === sessionId) return current.index;
    current = { sessionId, index: current ? (current.index + 1) % FINISH_QUEST_PROMPTS.length : 0 };
    try {
      await DeviceStorage.setItemAsync(STORAGE_KEY, JSON.stringify(current));
    } catch (error) {
      console.warn("Could not save quest prompt rotation", error);
    }
    return current.index;
  });
  return pending;
}
