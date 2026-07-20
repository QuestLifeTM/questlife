import * as FileSystem from "expo-file-system/legacy";

import { ActiveQuestLocalSession, ActiveQuestPhoto, ActiveQuestRecordingState, ActiveQuestRoutePoint, ActiveQuestSnapshot } from "@/types/active-quest";
import { distanceBetweenMeters, routePointIsUsable, simplifyRouteForRendering } from "@/services/active-quest/route-filter";

type ActiveQuestStore = {
  sessions: Record<string, ActiveQuestLocalSession>;
  route: ActiveQuestRoutePoint[];
  renderRoutes: Record<string, ActiveQuestRoutePoint[]>;
  photos: ActiveQuestPhoto[];
  trackingSessionId: string | null;
  nextPointId: number;
  nextPhotoId: number;
};

const STORE_URI = `${FileSystem.documentDirectory}active-quests/store.json`;
const BACKUP_STORE_URI = `${FileSystem.documentDirectory}active-quests/store.backup.json`;
const EMPTY_STORE: ActiveQuestStore = {
  sessions: {},
  route: [],
  renderRoutes: {},
  photos: [],
  trackingSessionId: null,
  nextPointId: 1,
  nextPhotoId: 1,
};

let cache: ActiveQuestStore | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function freshStore(): ActiveQuestStore {
  return { ...EMPTY_STORE, sessions: {}, route: [], renderRoutes: {}, photos: [] };
}

async function loadStore() {
  if (cache) return cache;
  try {
    const raw = await FileSystem.readAsStringAsync(STORE_URI);
    const parsed = JSON.parse(raw) as Partial<ActiveQuestStore>;
    cache = {
      ...freshStore(),
      ...parsed,
      sessions: Object.fromEntries(Object.entries(parsed.sessions ?? {}).map(([id, session]) => [id, {
        ...session,
        completionSyncState: session.completionSyncState ?? "idle",
      }])),
      route: (parsed.route ?? []).map((point) => ({ ...point, altitude: point.altitude ?? null, heading: point.heading ?? null })),
      renderRoutes: parsed.renderRoutes ?? {},
      photos: parsed.photos ?? [],
    };
  } catch {
    try {
      const backup = await FileSystem.readAsStringAsync(BACKUP_STORE_URI);
      const parsed = JSON.parse(backup) as Partial<ActiveQuestStore>;
      cache = {
        ...freshStore(),
        ...parsed,
        sessions: Object.fromEntries(Object.entries(parsed.sessions ?? {}).map(([id, session]) => [id, {
          ...session,
          completionSyncState: session.completionSyncState ?? "idle",
        }])),
        route: (parsed.route ?? []).map((point) => ({ ...point, altitude: point.altitude ?? null, heading: point.heading ?? null })),
        renderRoutes: parsed.renderRoutes ?? {},
        photos: parsed.photos ?? [],
      };
    } catch {
      cache = freshStore();
    }
  }
  return cache;
}

async function persistStore(store: ActiveQuestStore) {
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}active-quests`, { intermediates: true });
  const existingStore = await FileSystem.getInfoAsync(STORE_URI);
  if (existingStore.exists) {
    const existingBackup = await FileSystem.getInfoAsync(BACKUP_STORE_URI);
    if (existingBackup.exists) await FileSystem.deleteAsync(BACKUP_STORE_URI, { idempotent: true });
    await FileSystem.copyAsync({ from: STORE_URI, to: BACKUP_STORE_URI });
  }
  await FileSystem.writeAsStringAsync(STORE_URI, JSON.stringify(store));
}

function mutate<T>(operation: (store: ActiveQuestStore) => T | Promise<T>) {
  const result = mutationQueue.then(async () => {
    const store = await loadStore();
    const value = await operation(store);
    await persistStore(store);
    return value;
  });
  mutationQueue = result.then(() => undefined, () => undefined);
  void result.then(() => listeners.forEach((listener) => listener()));
  return result;
}

/** Lets the foreground screen react to points written by the location task. */
export function subscribeToActiveQuestStore(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function ensureActiveQuestSession(input: { sessionId: string; questId: string; startedAt: string; entryTitle: string }) {
  await mutate((store) => {
    if (!store.sessions[input.sessionId]) {
      store.sessions[input.sessionId] = {
        sessionId: input.sessionId,
        questId: input.questId,
        startedAt: input.startedAt,
        recordingState: "recording",
        pausedAt: null,
        activeSince: input.startedAt,
        activeDurationMs: 0,
        distanceMeters: 0,
        entryTitle: input.entryTitle,
        entryBody: "",
        trackingStatus: "idle",
        lastLocationAt: null,
        completionSyncState: "idle",
        updatedAt: new Date().toISOString(),
      };
    }
  });
  return getActiveQuestSession(input.sessionId);
}

export async function getActiveQuestSession(sessionId: string) {
  await mutationQueue;
  const store = await loadStore();
  const session = store.sessions[sessionId];
  return session ? { ...session } : null;
}

export async function getActiveQuestSnapshot(sessionId: string): Promise<ActiveQuestSnapshot | null> {
  const session = await getActiveQuestSession(sessionId);
  if (!session) return null;
  await mutationQueue;
  const store = await loadStore();
  const route = store.route.filter((point) => point.sessionId === sessionId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const photos = store.photos.filter((photo) => photo.sessionId === sessionId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const renderRoute = store.renderRoutes[sessionId] ?? simplifyRouteForRendering(route);
  return { session, route, renderRoute, photoCount: photos.length, photos };
}

export async function updateActiveQuestSession(sessionId: string, changes: Partial<Pick<ActiveQuestLocalSession, "recordingState" | "pausedAt" | "activeSince" | "activeDurationMs" | "distanceMeters" | "entryTitle" | "entryBody" | "trackingStatus" | "lastLocationAt" | "completionSyncState">>) {
  return mutate((store) => {
    const current = store.sessions[sessionId];
    if (!current) return null;
    const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
    store.sessions[sessionId] = next;
    return { ...next };
  });
}

/**
 * Filters and appends under one serialized mutation so foreground and
 * background location sources cannot accept the same point concurrently.
 */
export async function addAcceptedRoutePoint(sessionId: string, point: Omit<ActiveQuestRoutePoint, "id" | "sessionId">) {
  return mutate((store) => {
    const session = store.sessions[sessionId];
    if (!session || session.recordingState !== "recording") return false;
    const previous = store.route
      .filter((routePoint) => routePoint.sessionId === sessionId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null;
    if (!routePointIsUsable(point, previous)) return false;

    store.route.push({ id: store.nextPointId++, sessionId, ...point });
    const sessionRoute = store.route.filter((routePoint) => routePoint.sessionId === sessionId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    store.renderRoutes[sessionId] = simplifyRouteForRendering(sessionRoute);
    store.sessions[sessionId] = {
      ...session,
      distanceMeters: session.distanceMeters + (previous ? distanceBetweenMeters(previous, point) : 0),
      lastLocationAt: point.capturedAt,
      trackingStatus: "tracking",
      updatedAt: new Date().toISOString(),
    };
    return true;
  });
}

export async function getLatestRoutePoint(sessionId: string) {
  await mutationQueue;
  const store = await loadStore();
  const points = store.route.filter((point) => point.sessionId === sessionId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  return points[0] ? { ...points[0] } : null;
}

export async function getPendingCompletionSyncSessionIds() {
  await mutationQueue;
  const store = await loadStore();
  return Object.values(store.sessions).filter((session) => session.completionSyncState === "pending").map((session) => session.sessionId);
}

export async function addActiveQuestPhoto(sessionId: string, uri: string, capturedAt = new Date().toISOString()) {
  return mutate((store) => {
    const id = store.nextPhotoId++;
    store.photos.push({ id, sessionId, uri, capturedAt, syncStatus: "pending", remotePath: null });
    return id;
  });
}

export async function getActiveQuestPhotos(sessionId: string) {
  await mutationQueue;
  const store = await loadStore();
  return store.photos.filter((photo) => photo.sessionId === sessionId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).map((photo) => ({ ...photo }));
}

export async function updateActiveQuestPhoto(id: number, changes: Partial<Pick<ActiveQuestPhoto, "syncStatus" | "remotePath">>) {
  return mutate((store) => {
    const index = store.photos.findIndex((photo) => photo.id === id);
    if (index < 0) return;
    store.photos[index] = { ...store.photos[index], ...changes };
  });
}

export async function setActiveQuestTrackingSession(sessionId: string | null) {
  await mutate((store) => { store.trackingSessionId = sessionId; });
}

export async function getActiveQuestTrackingSession() {
  await mutationQueue;
  const store = await loadStore();
  return store.trackingSessionId ? { sessionId: store.trackingSessionId } : null;
}

export async function clearActiveQuestSession(sessionId: string) {
  await mutate((store) => {
    delete store.sessions[sessionId];
    store.route = store.route.filter((point) => point.sessionId !== sessionId);
    delete store.renderRoutes[sessionId];
    store.photos = store.photos.filter((photo) => photo.sessionId !== sessionId);
    if (store.trackingSessionId === sessionId) store.trackingSessionId = null;
  });
}
