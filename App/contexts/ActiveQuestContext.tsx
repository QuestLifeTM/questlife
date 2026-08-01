import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";

import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { addActiveQuestActivity, deleteActiveQuestActivity, deleteActiveQuestPhoto, ensureActiveQuestSession, getActiveQuestSnapshot, getPendingCompletionSyncSessionIds, setActiveQuestRecordingState, subscribeToActiveQuestStore, updateActiveQuestActivity, updateActiveQuestSession } from "@/services/active-quest/local-store";
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
  addActivityNote: (body: string, options?: { tutorialOnly?: boolean }) => Promise<void>;
  addPhoto: (uri: string, caption?: string, options?: { tutorialOnly?: boolean }) => Promise<void>;
  updateActivity: (id: number, value: string) => Promise<void>;
  deleteActivity: (id: number) => Promise<void>;
  deletePhoto: (id: number) => Promise<void>;
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
  addActivityNote: async () => undefined,
  addPhoto: async () => undefined,
  updateActivity: async () => undefined,
  deleteActivity: async () => undefined,
  deletePhoto: async () => undefined,
  finishLocalQuest: async () => undefined,
});

function elapsedSince(timestamp: string | null) {
  return timestamp ? Math.max(0, Date.now() - new Date(timestamp).getTime()) : 0;
}

export function ActiveQuestProvider({ children }: PropsWithChildren) {
  const { engine } = useQuestEngine();
  const { guestSession, finishGuestQuest } = useGuestQuest();
  const [snapshot, setSnapshot] = useState<ActiveQuestSnapshot | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const activeSession = engine?.activeSession ?? guestSession;
  const isGuestSession = Boolean(guestSession && activeSession?.id === guestSession.id);
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
        if (snapshot?.session.trackingStatus === "tracking") {
          void startForegroundLocationWatch(snapshot.session.sessionId);
        }
      } else {
        stopForegroundLocationWatch();
      }
    });
    return () => appStateSubscription.remove();
  }, [reload, snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

  useEffect(() => {
    if (snapshot?.session.trackingStatus === "tracking") {
      void startForegroundLocationWatch(snapshot.session.sessionId);
    } else {
      stopForegroundLocationWatch();
    }
  }, [snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

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
      resumeExistingSession: Date.now() - new Date(activeSession.startedAt).getTime() > 15_000,
    })
      .then(async (localSession) => {
        void retryQuestPhotoSync(activeSession.id);
        if (localSession?.recordingState === "recording" && localSession.trackingStatus !== "tracking") {
          const result = await beginQuestLocationTracking(activeSession.id);
          if (result.started) await startForegroundLocationWatch(activeSession.id);
        }
        return getActiveQuestSnapshot(activeSession.id);
      })
      .then((next) => {
        if (mounted) setSnapshot(next);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [activeSession, startForegroundLocationWatch]);

  const pause = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "paused") return;
    const now = new Date().toISOString();
    await setActiveQuestRecordingState(snapshot.session.sessionId, "paused", {
      pausedAt: now,
      activeSince: null,
      activeDurationMs: snapshot.session.activeDurationMs + elapsedSince(snapshot.session.activeSince),
    });
    setTrackingMessage("Quest time is paused. Your route is still recording.");
    await reload();
  }, [reload, snapshot]);

  const resume = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "recording") return;
    await setActiveQuestRecordingState(snapshot.session.sessionId, "recording", {
      pausedAt: null,
      activeSince: new Date().toISOString(),
      activeDurationMs: snapshot.session.activeDurationMs,
    });
    if (snapshot.session.trackingStatus !== "tracking") {
      const result = await beginQuestLocationTracking(snapshot.session.sessionId);
      if (result.started) await startForegroundLocationWatch(snapshot.session.sessionId);
      setTrackingMessage(result.started ? (result.backgroundGranted ? "Route recording is on, even while your phone is locked." : "Route recording is on while QuestLife is open.") : result.reason);
    } else {
      setTrackingMessage("Quest time resumed. Your route is still recording.");
    }
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

  const addActivityNote = useCallback(async (body: string, options: { tutorialOnly?: boolean } = {}) => {
    if (!snapshot || !body.trim()) return;
    await addActiveQuestActivity(snapshot.session.sessionId, { kind: "note", body, isTutorialMock: options.tutorialOnly });
    await reload();
    if (!options.tutorialOnly) void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const addPhoto = useCallback(async (uri: string, caption?: string, options: { tutorialOnly?: boolean } = {}) => {
    if (!snapshot) return;
    const photo = await persistQuestPhoto(snapshot.session.sessionId, uri, options);
    await addActiveQuestActivity(snapshot.session.sessionId, { kind: "photo", photoId: photo.id, caption });
    await reload();
    if (!options.tutorialOnly) void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const updateActivity = useCallback(async (id: number, value: string) => {
    if (!snapshot) return;
    const item = snapshot.activity.find((activity) => activity.id === id);
    if (!item) return;
    await updateActiveQuestActivity(id, item.kind === "photo" ? { caption: value } : { body: value });
    await reload();
  }, [reload, snapshot]);

  const deletePhoto = useCallback(async (id: number) => {
    const photo = await deleteActiveQuestPhoto(id);
    if (!photo) return;
    try { await FileSystem.deleteAsync(photo.uri, { idempotent: true }); } catch { /* Local metadata has already been safely removed. */ }
    await reload();
    void syncActiveQuestRecord(photo.sessionId).catch(() => undefined);
  }, [reload]);

  const deleteActivity = useCallback(async (id: number) => {
    if (!snapshot) return;
    const item = snapshot.activity.find((activity) => activity.id === id);
    if (!item) return;
    if (item.photoId) {
      await deletePhoto(item.photoId);
      return;
    }
    const removed = await deleteActiveQuestActivity(id);
    if (!removed) return;
    await reload();
    void syncActiveQuestRecord(removed.sessionId).catch(() => undefined);
  }, [deletePhoto, reload, snapshot]);

  const finishLocalQuest = useCallback(async () => {
    if (!snapshot) return;
    await stopQuestLocationTracking();
    stopForegroundLocationWatch();
    if (isGuestSession) {
      await finishGuestQuest({ title: "Your First Quest", durationSeconds: Math.round(snapshot.session.activeDurationMs / 1_000) });
      setSnapshot(null);
      return;
    }
    // Keep the completed local record as an outbox. If the phone is offline,
    // this state is retried automatically on the next app launch.
    await updateActiveQuestSession(snapshot.session.sessionId, { completionSyncState: "pending" });
    await retryCompletedRouteSync();
    setSnapshot(null);
  }, [finishGuestQuest, isGuestSession, retryCompletedRouteSync, snapshot, stopForegroundLocationWatch]);

  const value = useMemo(() => ({ snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest }), [snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest]);
  return <ActiveQuestContext.Provider value={value}>{children}</ActiveQuestContext.Provider>;
}

export function useActiveQuest() {
  return useContext(ActiveQuestContext);
}
