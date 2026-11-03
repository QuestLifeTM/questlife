import type { QuestEngineState } from "@/types/engine";

export type QuestStartInput = { questId: string; source?: "explore" | "saved" | "social" };
export type QuestStartResult = { sessionId: string; mode: "focused" | "flexible"; navigationHandled?: boolean };

export class QuestStartCancelled extends Error {
  constructor() { super("Quest start cancelled"); this.name = "QuestStartCancelled"; }
}
export const isQuestStartCancelled = (error: unknown) => error instanceof Error && error.name === "QuestStartCancelled";

/** A failed response can still mean the server created a session. Always reconcile before retry. */
export function createFocusedStartAttempt(deps: {
  input: QuestStartInput;
  readState: () => Promise<QuestEngineState>;
  create: (input: QuestStartInput) => Promise<QuestStartResult>;
}) {
  let result: QuestStartResult | null = null;
  let inFlight: Promise<QuestStartResult> | null = null;
  const run = async (): Promise<QuestStartResult> => {
    if (result) return result;
    const state = await deps.readState();
    if (state.doingNowSession) {
      if (state.doingNowSession.questId !== deps.input.questId) throw new Error("You already have an active quest. Return to the quest details to continue it.");
      result = { sessionId: state.doingNowSession.id, mode: "focused" };
      return result;
    }
    try { result = await deps.create(deps.input); }
    catch (error) {
      const reconciled = await deps.readState();
      if (reconciled.doingNowSession?.questId !== deps.input.questId) throw error;
      result = { sessionId: reconciled.doingNowSession.id, mode: "focused" };
    }
    return result;
  };
  return () => {
    if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  };
}
