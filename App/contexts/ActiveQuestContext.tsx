import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { ensureActiveQuestSession, getActiveQuestSnapshot, getPendingCompletionSyncSessionIds, subscribeToActiveQuestStore, updateActiveQuestSession } from "@/services/active-quest/local-store";
import { persistQuestPhoto, retryQuestPhotoSync } from "@/services/active-quest/media";
import { syncActiveQuestRecord } from "@/services/active-quest/sync";
import { beginQuestLocationTracking, stopQuestLocationTracking } from "@/services/active-quest/tracking";
import { persistQuestLocation } from "@/services/active-quest/location-task";
import { ActiveQuestSnapshot } from "@/types/active-quest";

type ActiveQuestContextValue = {
  snapshot: ActiveQuestSnapshot | null;
  liveLocation: { latitude: number; longitude: number } | null;
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
  liveLocation: null,
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
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const activeSession = engine?.activeSession;
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);

  const stopForegroundLocationWatch = useCallback(() => {
    foregroundLocationSubscription.current?.remove();
    foregroundLocationSubscription.current = null;
  }, []);

  const retryCompletedRouteSync = useCallback(async () => {
    const sessionIds = await getPendingCompletionSyncSessionIds();
    await Promise.all(sessionIds.map(async (sessionId) => {
      try {
        await syncActiveQuestRecord(sessionId);
        await updateActiveQuestSession(sessionId, { completionSyncState: "synced" });
      } catch {
        // Keep the durable local record marked pending for the next app launch.
      }
    }));
  }, []);

  useEffect(() => {
    void retryCompletedRouteSync();
  }, [retryCompletedRouteSync]);

  const reload = useCallback(async () => {
    if (!activeSession) {
      setSnapshot(null);
      return;
    }
    const next = await getActiveQuestSnapshot(activeSession.id);
    setSnapshot(next);
  }, [activeSession]);

  const startForegroundLocationWatch = useCallback(async (sessionId: string) => {
    stopForegroundLocationWatch();
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 1, timeInterval: 1_000 },
      (location) => {
        setLiveLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        // This gives the foreground map a prompt source while the same atomic
        // persistence function prevents duplicates with the background task.
        void persistQuestLocation(sessionId, location).catch(() => undefined);
      },
    );
    foregroundLocationSubscription.current = subscription;
  }, [stopForegroundLocationWatch]);

  useEffect(() => subscribeToActiveQuestStore(() => { void reload(); }), [reload]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void reload();
        if (snapshot?.session.recordingState === "recording" && snapshot.session.trackingStatus === "tracking") {
          void startForegroundLocationWatch(snapshot.session.sessionId);
        }
      } else {
        stopForegroundLocationWatch();
      }
    });
    return () => appStateSubscription.remove();
  }, [reload, snapshot?.session.recordingState, snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

  useEffect(() => {
    if (snapshot?.session.recordingState === "recording" && snapshot.session.trackingStatus === "tracking") {
      void startForegroundLocationWatch(snapshot.session.sessionId);
    } else {
      stopForegroundLocationWatch();
    }
  }, [snapshot?.session.recordingState, snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

  useEffect(() => () => stopForegroundLocationWatch(), [stopForegroundLocationWatch]);

  useEffect(() => {
    if (!activeSession) {
      setSnapshot(null);
      setLiveLocation(null);
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
    await stopQuestLocationTracking();
    stopForegroundLocationWatch();
    setTrackingMessage("Route recording is paused.");
    await reload();
  }, [reload, snapshot, stopForegroundLocationWatch]);

  const resume = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "recording") return;
    await updateActiveQuestSession(snapshot.session.sessionId, {
      recordingState: "recording",
      pausedAt: null,
      activeSince: new Date().toISOString(),
    });
    const result = await beginQuestLocationTracking(snapshot.session.sessionId);
    if (result.started) await startForegroundLocationWatch(snapshot.session.sessionId);
    setTrackingMessage(result.started ? (result.backgroundGranted ? "Route recording is on, even while your phone is locked." : "Route recording is on while QuestLife is open.") : result.reason);
    await reload();
  }, [reload, snapshot, startForegroundLocationWatch]);

  const saveEntry = useCallback(async (input: { title: string; body: string }) => {
    if (!snapshot) return;
    await updateActiveQuestSession(snapshot.session.sessionId, { entryTitle: input.title, entryBody: input.body });
    await reload();
  }, [reload, snapshot]);

  const enableTracking = useCallback(async () => {
    if (!snapshot) return;
    const result = await beginQuestLocationTracking(snapshot.session.sessionId);
    if (result.started) await startForegroundLocationWatch(snapshot.session.sessionId);
    setTrackingMessage(result.started ? (result.backgroundGranted ? "Route recording is on, even while your phone is locked." : "Route recording is on while QuestLife is open.") : result.reason);
    await reload();
  }, [reload, snapshot, startForegroundLocationWatch]);

  const addPhoto = useCallback(async (uri: string) => {
    if (!snapshot) return;
    await persistQuestPhoto(snapshot.session.sessionId, uri);
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const finishLocalQuest = useCallback(async () => {
    if (!snapshot) return;
    await stopQuestLocationTracking();
    stopForegroundLocationWatch();
    // Keep the completed local record as an outbox. If the phone is offline,
    // this state is retried automatically on the next app launch.
    await updateActiveQuestSession(snapshot.session.sessionId, { completionSyncState: "pending" });
    await retryCompletedRouteSync();
    setSnapshot(null);
  }, [retryCompletedRouteSync, snapshot, stopForegroundLocationWatch]);

  const value = useMemo(() => ({ snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest }), [snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest]);
  return <ActiveQuestContext.Provider value={value}>{children}</ActiveQuestContext.Provider>;
}

export function useActiveQuest() {
  return useContext(ActiveQuestContext);
}
