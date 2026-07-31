import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ActiveQuestSession } from "@/types/engine";
import { clearGuestActiveQuest, clearGuestActiveQuestTutorialComplete, getGuestActiveQuest, getGuestActiveQuestTutorialComplete, markGuestActiveQuestTutorialComplete, saveGuestActiveQuest, saveGuestDemoQuest } from "@/services/onboarding/guest-demo-quest";

type GuestQuestContextValue = {
  guestSession: ActiveQuestSession | null;
  guestTutorialComplete: boolean;
  starting: boolean;
  startGuestQuest: () => Promise<ActiveQuestSession>;
  completeGuestTutorial: () => Promise<void>;
  finishGuestQuest: (input: { title: string; durationSeconds: number }) => Promise<void>;
};

const GuestQuestContext = createContext<GuestQuestContextValue>({
  guestSession: null,
  guestTutorialComplete: false,
  starting: false,
  startGuestQuest: async () => ({ id: "", questId: "", source: "explore", startedAt: new Date(0).toISOString() }),
  completeGuestTutorial: async () => undefined,
  finishGuestQuest: async () => undefined,
});

export function GuestQuestProvider({ children }: PropsWithChildren) {
  const [guestSession, setGuestSession] = useState<ActiveQuestSession | null>(null);
  const [guestTutorialComplete, setGuestTutorialComplete] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void Promise.all([getGuestActiveQuest(), getGuestActiveQuestTutorialComplete()]).then(([session, tutorialComplete]) => {
      setGuestSession(session);
      setGuestTutorialComplete(tutorialComplete);
    });
  }, []);

  const startGuestQuest = useCallback(async () => {
    if (guestSession) return guestSession;
    setStarting(true);
    const session: ActiveQuestSession = {
      id: `guest-first-quest-${Date.now()}`,
      questId: "guest-first-quest",
      source: "explore",
      startedAt: new Date().toISOString(),
    };
    setGuestSession(session);
    setGuestTutorialComplete(false);
    try {
      await Promise.all([saveGuestActiveQuest(session), clearGuestActiveQuestTutorialComplete()]);
    } finally {
      setStarting(false);
    }
    return session;
  }, [guestSession]);

  const completeGuestTutorial = useCallback(async () => {
    setGuestTutorialComplete(true);
    await markGuestActiveQuestTutorialComplete();
  }, []);

  const finishGuestQuest = useCallback(async ({ title, durationSeconds }: { title: string; durationSeconds: number }) => {
    await saveGuestDemoQuest({ completedAt: new Date().toISOString(), title, durationSeconds });
    await Promise.all([clearGuestActiveQuest(), clearGuestActiveQuestTutorialComplete()]);
    setGuestSession(null);
    setGuestTutorialComplete(false);
  }, []);

  const value = useMemo(() => ({ guestSession, guestTutorialComplete, starting, startGuestQuest, completeGuestTutorial, finishGuestQuest }), [completeGuestTutorial, finishGuestQuest, guestSession, guestTutorialComplete, startGuestQuest, starting]);
  return <GuestQuestContext.Provider value={value}>{children}</GuestQuestContext.Provider>;
}

export function useGuestQuest() {
  return useContext(GuestQuestContext);
}
