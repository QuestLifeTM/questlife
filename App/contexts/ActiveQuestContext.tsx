import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { ensureActiveQuestSession, getActiveQuestSnapshot, updateActiveQuestSession } from "@/services/active-quest/local-store";
import { persistQuestPhoto, retryQuestPhotoSync } from "@/services/active-quest/media";
import { syncActiveQuestRecord } from "@/services/active-quest/sync";
import { beginQuestLocationTracking, stopQuestLocationTracking } from "@/services/active-quest/tracking";
import { ActiveQuestSnapshot } from "@/types/active-quest";

type ActiveQuestContextValue = {
  snapshot: ActiveQuestSnapshot | null;
  loading: boolean;
  trackingMessage: string | null;
  reload: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  saveEntry: (input: { title: string; body: string }) => Promise<void>;
  enableTracking: () => Promise<void>;
  addPhoto: (uri: string) => Promise<void>;
  finishLocalQuest: () => Promise<void>;
};

const ActiveQuestContext = createContext<ActiveQuestContextValue>({
  snapshot: null,
  loading: false,
  trackingMessage: null,
  reload: async () => undefined,
  pause: async () => undefined,
  resume: async () => undefined,
  saveEntry: async () => undefined,
  enableTracking: async () => undefined,
  addPhoto: async () => undefined,
  finishLocalQuest: async () => undefined,
});

function elapsedSince(timestamp: string | null) {
  return timestamp ? Math.max(0, Date.now() - new Date(timestamp).getTime()) : 0;
}

export function ActiveQuestProvider({ children }: PropsWithChildren) {
  const { engine } = useQuestEngine();
  const [snapshot, setSnapshot] = useState<ActiveQuestSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const activeSession = engine?.activeSession;

  const reload = useCallback(async () => {
    if (!activeSession) {
      setSnapshot(null);
      return;
    }
    const next = await getActiveQuestSnapshot(activeSession.id);
    setSnapshot(next);
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setSnapshot(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    ensureActiveQuestSession({
      sessionId: activeSession.id,
      questId: activeSession.questId,
      startedAt: activeSession.startedAt,
      entryTitle: "",
    })
      .then(async () => {
        void retryQuestPhotoSync(activeSession.id);
        void syncActiveQuestRecord(activeSession.id).catch(() => undefined);
        return getActiveQuestSnapshot(activeSession.id);
      })
      .then((next) => {
        if (mounted) setSnapshot(next);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [activeSession]);

  const pause = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "paused") return;
    const now = new Date().toISOString();
    await updateActiveQuestSession(snapshot.session.sessionId, {
      recordingState: "paused",
      pausedAt: now,
      activeSince: null,
      activeDurationMs: snapshot.session.activeDurationMs + elapsedSince(snapshot.session.activeSince),
    });
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const resume = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "recording") return;
    await updateActiveQuestSession(snapshot.session.sessionId, {
      recordingState: "recording",
      pausedAt: null,
      activeSince: new Date().toISOString(),
    });
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const saveEntry = useCallback(async (input: { title: string; body: string }) => {
    if (!snapshot) return;
    await updateActiveQuestSession(snapshot.session.sessionId, { entryTitle: input.title, entryBody: input.body });
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const enableTracking = useCallback(async () => {
    if (!snapshot) return;
    const result = await beginQuestLocationTracking(snapshot.session.sessionId);
    setTrackingMessage(result.started ? (result.backgroundGranted ? "Route recording is on, even while your phone is locked." : "Route recording is on while QuestLife is open.") : result.reason);
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const addPhoto = useCallback(async (uri: string) => {
    if (!snapshot) return;
    await persistQuestPhoto(snapshot.session.sessionId, uri);
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const finishLocalQuest = useCallback(async () => {
    if (!snapshot) return;
    await stopQuestLocationTracking();
    // Keep the completed local record and its media outbox until pending uploads
    // finish. The server session is no longer active, so it cannot reappear as
    // an in-progress quest on the next launch.
    setSnapshot(null);
  }, [snapshot]);

  const value = useMemo(() => ({ snapshot, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest }), [snapshot, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest]);
  return <ActiveQuestContext.Provider value={value}>{children}</ActiveQuestContext.Provider>;
}

export function useActiveQuest() {
  return useContext(ActiveQuestContext);
}
