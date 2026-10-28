import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import * as FileSystem from "@/lib/device-files";

import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { useAuth } from "@/contexts/AuthContext";
import { addActiveQuestActivity, deleteActiveQuestActivity, deleteActiveQuestPhoto, ensureActiveQuestSession, getActiveQuestSnapshot, getPendingCompletionSyncSessionIds, setActiveQuestRecordingState, subscribeToActiveQuestStore, updateActiveQuestActivity, updateActiveQuestSession } from "@/services/active-quest/local-store";
import { persistQuestPhoto, retryQuestPhotoSync } from "@/services/active-quest/media";
import { hydrateActiveQuestFromServer, syncActiveQuestRecord } from "@/services/active-quest/sync";
import { beginQuestLocationTracking, stopQuestLocationTracking, questLocationOptions } from "@/services/active-quest/tracking.ios";
import { persistQuestLocation } from "@/services/active-quest/location-task";
import { getTrackingSession } from "@/services/active-quest/tracking-session";
import { areLocalDataWritesBlocked, getLocalDataOwner, setLocalDataOwner } from "@/services/local-data/owner";
import { locationPreview, newerLiveFix } from "@/services/active-quest/live-fix.ios";
import { ActiveQuestSnapshot } from "@/types/active-quest";

type ActiveQuestContextValue = {
  snapshot: ActiveQuestSnapshot | null;
  liveLocation: { latitude: number; longitude: number; accuracy?: number | null; capturedAt?: string } | null;
  loading: boolean;
  trackingMessage: string | null;
  reload: () => Promise<void>;
  pause: () => Promise<void>;
  resume: (additionalElapsedMs?: number) => Promise<void>;
  saveEntry: (input: { title: string; body: string }) => Promise<void>;
  enableTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  addActivityNote: (body: string, options?: { tutorialOnly?: boolean }) => Promise<void>;
  addPhoto: (uri: string, caption?: string, options?: { tutorialOnly?: boolean }) => Promise<void>;
  updateActivity: (id: number, value: string) => Promise<void>;
  deleteActivity: (id: number) => Promise<void>;
  deletePhoto: (id: number) => Promise<void>;
  finishLocalQuest: (sessionId?: string, guestMode?: boolean) => Promise<void>;
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
  stopTracking: async () => undefined,
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
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<ActiveQuestSnapshot | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number; accuracy?: number | null; capturedAt?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const activeSession = engine?.doingNowSession ?? guestSession;
  const isGuestSession = Boolean(guestSession && activeSession?.id === guestSession.id);
  const watchGeneration = useRef(0);
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);

  // The active-quest service is deliberately owner-bound. A guest sandbox is
  // isolated from authenticated accounts and is never reused for them.
  useEffect(() => {
    setLocalDataOwner(user?.id ?? (guestSession ? "guest" : null));
    return () => { setLocalDataOwner(null); };
  }, [guestSession, user?.id]);

  const stopForegroundLocationWatch = useCallback(() => {
    watchGeneration.current += 1;
    foregroundLocationSubscription.current?.remove();
    foregroundLocationSubscription.current = null;
  }, []);

  const retryCompletedRouteSync = useCallback(async () => {
    // A signed-out browser has no owner-scoped local quest store to recover.
    // Native startup establishes an owner before this effect can matter, but
    // web can mount the provider before its first anonymous route is ready.
    if (!getLocalDataOwner()) return;
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
    void retryCompletedRouteSync().catch(() => {
      setTrackingMessage("Saved quest progress could not be synced. It will retry when you reopen the quest.");
    });
  }, [retryCompletedRouteSync, user?.id]);

  const reload = useCallback(async () => {
    if (!activeSession) {
      setSnapshot(null);
      return;
    }
    const next = await getActiveQuestSnapshot(activeSession.id);
    setSnapshot(next);
    setLiveLocation(previous => newerLiveFix(previous, next?.session.lastFix ?? next?.route.at(-1) ?? null));
  }, [activeSession]);

  const startForegroundLocationWatch = useCallback(async (sessionId: string) => {
    stopForegroundLocationWatch();
    const generation = watchGeneration.current;
    // Foreground callbacks provide an immediate map preview even before the
    // background task's first delivery. Both feed the same serialized estimator.
    const subscription = await Location.watchPositionAsync(
      questLocationOptions,
      (location) => {
        if (generation !== watchGeneration.current) return;
        // A queued foreground callback can arrive after the quest has ended.
        // Verify the durable active-tracking marker before retaining anything.
        void getTrackingSession().then((trackingSession) => {
          if (trackingSession?.sessionId !== sessionId || trackingSession.ownerId !== getLocalDataOwner() || areLocalDataWritesBlocked(trackingSession.ownerId)) return;
          const preview = locationPreview(location);
          if (preview) setLiveLocation(previous => newerLiveFix(previous, preview));
          void persistQuestLocation(trackingSession.ownerId, sessionId, location).catch(() => {
            setTrackingMessage("Route recording could not be saved. Check available device storage and retry.");
          });
        }).catch(() => undefined);
      },
    );
    const trackingSession = await getTrackingSession();
    if (generation !== watchGeneration.current || trackingSession?.sessionId !== sessionId || trackingSession.ownerId !== getLocalDataOwner() || AppState.currentState !== "active") {
      subscription.remove();
      return;
    }
    foregroundLocationSubscription.current = subscription;
  }, [stopForegroundLocationWatch]);

  useEffect(() => subscribeToActiveQuestStore(() => { void reload().catch(() => setTrackingMessage("Route progress could not be loaded. Check device storage.")); }), [reload]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void reload().catch(() => setTrackingMessage("Saved route could not be loaded. Check device storage."));
        if (snapshot?.session.trackingStatus === "tracking") {
          void startForegroundLocationWatch(snapshot.session.sessionId).catch(() => setTrackingMessage("Location updates are unavailable. Check permissions and retry."));
        }
      } else {
        stopForegroundLocationWatch();
      }
    });
    return () => appStateSubscription.remove();
  }, [reload, snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

  useEffect(() => {
    if (snapshot?.session.trackingStatus === "tracking") {
      void startForegroundLocationWatch(snapshot.session.sessionId).catch(() => setTrackingMessage("Location updates are unavailable. Check permissions and retry."));
    } else {
      stopForegroundLocationWatch();
    }
  }, [snapshot?.session.sessionId, snapshot?.session.trackingStatus, startForegroundLocationWatch, stopForegroundLocationWatch]);

  useEffect(() => () => stopForegroundLocationWatch(), [stopForegroundLocationWatch]);
  useEffect(() => {
    if (snapshot?.session.trackingStatus !== "tracking") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void reload().catch(() => setTrackingMessage("Route progress could not be loaded. Check device storage."));
    }, 5_000);
    return () => clearInterval(timer);
  }, [reload, snapshot?.session.trackingStatus]);

  useEffect(() => {
    // There is exactly one native background location task. If the active
    // Doing Now quest disappears or changes, it must not remain attached to a
    // prior quest (including one now merely listed as In progress).
    void getTrackingSession().then((trackingSession) => {
      if (trackingSession && (trackingSession.sessionId !== activeSession?.id || trackingSession.ownerId !== getLocalDataOwner())) {
        stopForegroundLocationWatch();
        return stopQuestLocationTracking();
      }
    }).catch(() => undefined);
  }, [activeSession?.id, stopForegroundLocationWatch]);

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
      .then(async () => {
        // The server copy is authoritative for a session restored after login
        // or on another device. If it is temporarily unavailable, retain the
        // local session rather than clearing any in-progress work.
        if (!isGuestSession) {
          try { await hydrateActiveQuestFromServer(activeSession.id); } catch { /* Local-first fallback remains available. */ }
        }
        void retryQuestPhotoSync(activeSession.id);
        const restoredSession = await getActiveQuestSnapshot(activeSession.id);
        if (restoredSession && (restoredSession.session.trackingStatus === "tracking" || (restoredSession.session.recordingState === "recording" && restoredSession.session.trackingStatus !== "idle"))) {
          const ownerId = getLocalDataOwner();
          if (!ownerId) return restoredSession;
          const result = await beginQuestLocationTracking(ownerId, activeSession.id);
          if (result.started) await startForegroundLocationWatch(activeSession.id);
        }
        return getActiveQuestSnapshot(activeSession.id);
      })
      .then((next) => {
        if (mounted) { setSnapshot(next); setLiveLocation(previous => newerLiveFix(previous, next?.session.lastFix ?? next?.route.at(-1) ?? null)); }
      })
      .catch(() => { if (mounted) setTrackingMessage("Saved quest progress could not be loaded. Retry after checking device storage."); })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [activeSession, isGuestSession, retryQuestPhotoSync, startForegroundLocationWatch]);

  const pause = useCallback(async () => {
    if (!snapshot || snapshot.session.recordingState === "paused") return;
    const now = new Date().toISOString();
    await setActiveQuestRecordingState(snapshot.session.sessionId, "paused", {
      pausedAt: now,
      activeSince: null,
      activeDurationMs: snapshot.session.activeDurationMs + elapsedSince(snapshot.session.activeSince),
    });
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
    setTrackingMessage("Quest time is paused. Your route is still recording.");
    await reload();
  }, [reload, snapshot]);

  const resume = useCallback(async (additionalElapsedMs = 0) => {
    if (!snapshot || snapshot.session.recordingState === "recording") return;
    await setActiveQuestRecordingState(snapshot.session.sessionId, "recording", {
      pausedAt: null,
      activeSince: new Date().toISOString(),
      activeDurationMs: snapshot.session.activeDurationMs + Math.max(0, additionalElapsedMs),
    });
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
    if (snapshot.session.trackingStatus !== "tracking") {
      const ownerId = getLocalDataOwner();
      if (!ownerId) return;
      const result = await beginQuestLocationTracking(ownerId, snapshot.session.sessionId);
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
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
    await reload();
  }, [reload, snapshot]);

  const enableTracking = useCallback(async () => {
    if (!snapshot) {
      setTrackingMessage("Quest progress is still loading. Please try again shortly.");
      throw new Error("Quest progress is still loading. Please try again shortly.");
    }
    const ownerId = getLocalDataOwner();
    if (!ownerId) throw new Error("Your session is still loading. Please try again.");
    setTrackingMessage("Finding your location…");
    const result = await beginQuestLocationTracking(ownerId, snapshot.session.sessionId);
    if (result.started) await startForegroundLocationWatch(snapshot.session.sessionId);
    setTrackingMessage(result.reason);
    if (!result.started && "openSettings" in result && result.openSettings) await Linking.openSettings();
    await reload();
  }, [reload, snapshot, startForegroundLocationWatch]);

  const stopTracking = useCallback(async () => {
    stopForegroundLocationWatch();
    await stopQuestLocationTracking();
    if (snapshot) {
      await updateActiveQuestSession(snapshot.session.sessionId, { trackingStatus: "idle" });
      await reload();
    }
  }, [reload, snapshot, stopForegroundLocationWatch]);

  const addActivityNote = useCallback(async (body: string, options: { tutorialOnly?: boolean } = {}) => {
    if (!snapshot || !body.trim()) return;
    await addActiveQuestActivity(snapshot.session.sessionId, { kind: "note", body, isTutorialMock: options.tutorialOnly });
    await reload();
    if (!options.tutorialOnly) void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const addPhoto = useCallback(async (uri: string, caption?: string, options: { tutorialOnly?: boolean } = {}) => {
    if (!snapshot) return;
    const photo = await persistQuestPhoto(snapshot.session.sessionId, uri, options);
    await addActiveQuestActivity(snapshot.session.sessionId, { kind: "photo", photoId: photo.id, caption, isTutorialMock: options.tutorialOnly });
    await reload();
    if (!options.tutorialOnly) void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
  }, [reload, snapshot]);

  const updateActivity = useCallback(async (id: number, value: string) => {
    if (!snapshot) return;
    const item = snapshot.activity.find((activity) => activity.id === id);
    if (!item) return;
    await updateActiveQuestActivity(id, item.kind === "photo" ? { caption: value } : { body: value });
    await reload();
    void syncActiveQuestRecord(snapshot.session.sessionId).catch(() => undefined);
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

  const finishLocalQuest = useCallback(async (sessionId?: string, guestMode = isGuestSession) => {
    const finishedSessionId = sessionId ?? snapshot?.session.sessionId;
    if (!finishedSessionId) return;
    const finishedSnapshot = snapshot?.session.sessionId === finishedSessionId ? snapshot : await getActiveQuestSnapshot(finishedSessionId);
    await stopQuestLocationTracking();
    await updateActiveQuestSession(finishedSessionId, { trackingStatus: "idle" });
    stopForegroundLocationWatch();
    if (guestMode) {
      await finishGuestQuest({ title: "Personalize your Quest", durationSeconds: Math.round((finishedSnapshot?.session.activeDurationMs ?? 0) / 1_000) });
      setSnapshot(null);
      return;
    }
    // Keep the completed local record as an outbox. If the phone is offline,
    // this state is retried automatically on the next app launch.
    await updateActiveQuestSession(finishedSessionId, { completionSyncState: "pending" });
    await retryCompletedRouteSync();
    setSnapshot(null);
  }, [finishGuestQuest, isGuestSession, retryCompletedRouteSync, snapshot, stopForegroundLocationWatch]);

  const value = useMemo(() => ({ snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, stopTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest }), [snapshot, liveLocation, loading, trackingMessage, reload, pause, resume, saveEntry, enableTracking, stopTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest]);
  return <ActiveQuestContext.Provider value={value}>{children}</ActiveQuestContext.Provider>;
}

export function useActiveQuest() {
  return useContext(ActiveQuestContext);
}
