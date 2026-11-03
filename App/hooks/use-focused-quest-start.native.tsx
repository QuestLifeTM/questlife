import { prepareQuestLaunch, startQuestLaunchCountdown, completeQuestLaunch, cancelQuestLaunch } from "@/services/engine/quest-launch-state";
import type { QuestEngineState } from "@/types/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { MoodForm } from "@/components/journal-mood-check-in";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { fetchEngineState, engineErrorMessage } from "@/services/engine/questEngineService";
import { createFocusedStartAttempt, QuestStartCancelled, type QuestStartInput, type QuestStartResult } from "@/services/engine/focused-quest-start";
import { toLocalDateKey, upsertJournalEntry } from "@/services/journal/journalService";

type PendingStart = {
  input: QuestStartInput;
  title: string;
  date: string;
  ownerId: string;
  result?: QuestStartResult;
  attempt: () => Promise<QuestStartResult>;
  resolve: (result: QuestStartResult) => void;
  reject: (error: Error) => void;
};

export function useFocusedQuestStart(create: (input: QuestStartInput) => Promise<QuestStartResult>, reconcile: (state: QuestEngineState) => void) {
  const { user } = useAuth();
  const { getQuest } = useContent();
  const router = useRouter();
  const [pending, setPending] = useState<PendingStart | null>(null);
  const pendingRef = useRef<PendingStart | null>(null);
  const opening = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (pendingRef.current) { cancelQuestLaunch(pendingRef.current.input.questId); pendingRef.current.reject(new QuestStartCancelled()); } pendingRef.current = null; };
  }, []);

  const readState = useCallback(async () => {
    const state = await fetchEngineState();
    if (!mounted.current) throw new QuestStartCancelled();
    reconcile(state);
    return state;
  }, [reconcile]);

  const startQuest = useCallback(async (input: QuestStartInput) => {
    const quest = getQuest(input.questId);
    if (!quest) throw new Error("This quest could not be loaded. Refresh and try again.");
    if (quest.mode === "flexible") return create(input);
    if (!user) throw new Error("Sign in to start a quest.");
    if (opening.current || pendingRef.current) throw new QuestStartCancelled();
    opening.current = true;
    try {
      const state = await readState();
      if (!mounted.current) throw new QuestStartCancelled();
      if (state.doingNowSession) {
        if (state.doingNowSession.questId === input.questId) return { sessionId: state.doingNowSession.id, mode: "focused" as const };
        throw new Error("You already have an active quest. Finish or abandon it before starting another.");
      }
      return await new Promise<QuestStartResult>((resolve, reject) => {
        const request: PendingStart = { input, title: quest.title, date: toLocalDateKey(new Date()), ownerId: user.id, attempt: createFocusedStartAttempt({ input, readState, create }), resolve, reject };
        prepareQuestLaunch(input.questId);
        pendingRef.current = request;
        setPending(request);
      });
    } finally { opening.current = false; }
  }, [create, getQuest, readState, user]);

  const cancel = () => {
    const request = pendingRef.current;
    if (!request || request.result) return;
    cancelQuestLaunch(request.input.questId);
    pendingRef.current = null;
    setPending(null);
    request.reject(new QuestStartCancelled());
    router.replace({ pathname: "/quest/[id]", params: { id: request.input.questId } });
  };
  const startFlow = pending ? <MoodForm
    key={`${pending.ownerId}:${pending.input.questId}`}
    entryDate={pending.date} mood={null} editable saving={false} ownerId={pending.ownerId}
    questTitle={pending.title} onClose={cancel}
    onCountdownFinished={() => {
      if (pendingRef.current !== pending || !pending.result) return;
      completeQuestLaunch(pending.result.sessionId);
      pendingRef.current = null;
      setPending(null);
      pending.resolve(pending.result);
    }}
    onSave={async (mood, date) => {
      if (pendingRef.current !== pending) throw new QuestStartCancelled();
      await upsertJournalEntry({ entryDate: date, mood });
      if (pendingRef.current !== pending) throw new QuestStartCancelled();
      let result: QuestStartResult;
      try { result = await pending.attempt(); }
      catch (error) { throw new Error(`Your mood is saved, but the quest couldn't start. ${engineErrorMessage(error)} Try again or close to return to the quest.`); }
      if (pendingRef.current !== pending) return false;
      pending.result = result;
      startQuestLaunchCountdown(pending.input.questId, result.sessionId);
      return true;
    }}
  /> : null;
  return { startQuest, startFlow };
}
