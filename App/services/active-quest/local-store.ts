import * as FileSystem from "expo-file-system/legacy";

import { ActiveQuestActivity, ActiveQuestActivityKind, ActiveQuestLocalSession, ActiveQuestPhoto, ActiveQuestRecordingState, ActiveQuestRoutePoint, ActiveQuestRouteSegment, ActiveQuestSnapshot } from "@/types/active-quest";
import { distanceBetweenMeters, simplifyRouteForRendering } from "@/services/active-quest/route-filter";
import { isAcceptedQuestLocation, RawQuestLocation } from "@/services/active-quest/location-quality-filter";
import { smoothQuestLocation } from "@/services/active-quest/location-smoothing";
import { buildRenderableSegments } from "@/services/active-quest/route-segments";

type ActiveQuestStore = {
  sessions: Record<string, ActiveQuestLocalSession>;
  route: ActiveQuestRoutePoint[];
  renderRoutes: Record<string, ActiveQuestRoutePoint[]>;
  photos: ActiveQuestPhoto[];
  activity: ActiveQuestActivity[];
  trackingSessionId: string | null;
  nextPointId: number;
  nextPhotoId: number;
  nextActivityId: number;
};

const STORE_URI = `${FileSystem.documentDirectory}active-quests/store.json`;
const BACKUP_STORE_URI = `${FileSystem.documentDirectory}active-quests/store.backup.json`;
const EMPTY_STORE: ActiveQuestStore = {
  sessions: {},
  route: [],
  renderRoutes: {},
  photos: [],
  activity: [],
  trackingSessionId: null,
  nextPointId: 1,
  nextPhotoId: 1,
  nextActivityId: 1,
};

let cache: ActiveQuestStore | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function freshStore(): ActiveQuestStore {
  return { ...EMPTY_STORE, sessions: {}, route: [], renderRoutes: {}, photos: [], activity: [] };
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
        routeSegments: session.routeSegments ?? [{ id: `${id}-legacy`, state: "active", startedAt: session.startedAt, endedAt: null, pointIds: (parsed.route ?? []).filter((point) => point.sessionId === id).map((point) => point.id) }],
      }])),
      route: (parsed.route ?? []).map((point) => ({ ...point, altitude: point.altitude ?? null, heading: point.heading ?? null })),
      renderRoutes: parsed.renderRoutes ?? {},
      photos: (parsed.photos ?? []).map((photo) => ({ ...photo, isTutorialMock: photo.isTutorialMock ?? false })),
      activity: (parsed.activity ?? []).map((item) => ({ ...item, isTutorialMock: item.isTutorialMock ?? false })),
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
          routeSegments: session.routeSegments ?? [{ id: `${id}-legacy`, state: "active", startedAt: session.startedAt, endedAt: null, pointIds: (parsed.route ?? []).filter((point) => point.sessionId === id).map((point) => point.id) }],
        }])),
        route: (parsed.route ?? []).map((point) => ({ ...point, altitude: point.altitude ?? null, heading: point.heading ?? null })),
        renderRoutes: parsed.renderRoutes ?? {},
        photos: (parsed.photos ?? []).map((photo) => ({ ...photo, isTutorialMock: photo.isTutorialMock ?? false })),
        activity: (parsed.activity ?? []).map((item) => ({ ...item, isTutorialMock: item.isTutorialMock ?? false })),
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

export async function ensureActiveQuestSession(input: { sessionId: string; questId: string; startedAt: string; entryTitle: string; resumeExistingSession?: boolean }) {
  await mutate((store) => {
    const existing = store.sessions[input.sessionId];
    if (!existing) {
      store.sessions[input.sessionId] = {
        sessionId: input.sessionId,
        questId: input.questId,
        startedAt: input.startedAt,
        // A new session waits for the 3-2-1-GO start sequence. A session
        // restored on another device resumes as active instead of resetting.
        recordingState: input.resumeExistingSession ? "recording" : "paused",
        pausedAt: input.resumeExistingSession ? null : input.startedAt,
        activeSince: input.resumeExistingSession ? input.startedAt : null,
        activeDurationMs: 0,
        distanceMeters: 0,
        entryTitle: input.entryTitle,
        entryBody: "",
        trackingStatus: "idle",
        lastLocationAt: null,
        completionSyncState: "idle",
        routeSegments: [],
        updatedAt: new Date().toISOString(),
      };
    } else if (input.resumeExistingSession && existing.recordingState === "paused" && existing.activeDurationMs === 0 && !existing.activeSince && !store.route.some((point) => point.sessionId === input.sessionId)) {
      // Repair the empty, device-local placeholder created by older builds
      // when an already-active server session was opened on a second phone.
      store.sessions[input.sessionId] = {
        ...existing,
        recordingState: "recording",
        pausedAt: null,
        activeSince: input.startedAt,
        updatedAt: new Date().toISOString(),
      };
    }
  });
  return getActiveQuestSession(input.sessionId);
}

type RemoteActiveQuestRecord = {
  session: Omit<ActiveQuestLocalSession, "trackingStatus" | "completionSyncState">;
  route: ActiveQuestRoutePoint[];
  renderRoute: ActiveQuestRoutePoint[];
  photos: ActiveQuestPhoto[];
  activity: ActiveQuestActivity[];
};

/**
 * Restores the durable server copy without discarding any newer local work.
 * The stable client IDs used by sync make this safe to call repeatedly.
 */
export async function hydrateActiveQuestRecord(record: RemoteActiveQuestRecord) {
  await mutate((store) => {
    const sessionId = record.session.sessionId;
    const local = store.sessions[sessionId];
    const localHasProgress = Boolean(local && (
      local.activeDurationMs > 0 ||
      local.distanceMeters > 0 ||
      Boolean(local.entryTitle.trim() || local.entryBody.trim()) ||
      local.routeSegments.some((segment) => segment.pointIds.length > 0) ||
      store.route.some((point) => point.sessionId === sessionId) ||
      store.photos.some((photo) => photo.sessionId === sessionId) ||
      store.activity.some((item) => item.sessionId === sessionId)
    ));
    // `ensureActiveQuestSession` creates an intentionally empty local shell
    // before this restore runs. Its fresh timestamp must never win over the
    // durable server record just because the app was opened more recently.
    const retainNewerLocalWork = Boolean(
      local && localHasProgress && new Date(local.updatedAt).getTime() > new Date(record.session.updatedAt).getTime(),
    );
    const restoredSession: ActiveQuestLocalSession = {
      ...record.session,
      trackingStatus: local?.trackingStatus ?? "idle",
      completionSyncState: local?.completionSyncState ?? "idle",
    };
    store.sessions[sessionId] = retainNewerLocalWork
      ? { ...restoredSession, ...local!, routeSegments: local!.routeSegments.length ? local!.routeSegments : restoredSession.routeSegments }
      : restoredSession;

    const knownRouteIds = new Set(store.route.filter((point) => point.sessionId === sessionId).map((point) => point.id));
    for (const point of record.route) if (!knownRouteIds.has(point.id)) store.route.push({ ...point, sessionId });
    if (record.renderRoute.length) store.renderRoutes[sessionId] = record.renderRoute.map((point) => ({ ...point, sessionId }));

    const knownPhotoIds = new Set(store.photos.filter((photo) => photo.sessionId === sessionId).map((photo) => photo.id));
    for (const photo of record.photos) if (!knownPhotoIds.has(photo.id)) store.photos.push({ ...photo, sessionId });
    const knownActivityIds = new Set(store.activity.filter((item) => item.sessionId === sessionId).map((item) => item.id));
    for (const activity of record.activity) if (!knownActivityIds.has(activity.id)) store.activity.push({ ...activity, sessionId });

    store.nextPointId = Math.max(store.nextPointId, ...record.route.map((point) => point.id + 1), 1);
    store.nextPhotoId = Math.max(store.nextPhotoId, ...record.photos.map((photo) => photo.id + 1), 1);
    store.nextActivityId = Math.max(store.nextActivityId, ...record.activity.map((activity) => activity.id + 1), 1);
  });
  return getActiveQuestSnapshot(record.session.sessionId);
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
  // Activity reads like a story: the quest begins at the top and each new
  // note, photo, or badge is appended further down the timeline.
  const activity = store.activity.filter((item) => item.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const renderSegments = buildRenderableSegments(session.routeSegments, route);
  const renderRoute = store.renderRoutes[sessionId] ?? simplifyRouteForRendering(route);
  return { session, route, renderRoute, renderSegments, photoCount: photos.length, photos, activity };
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

export async function setActiveQuestRecordingState(sessionId: string, recordingState: ActiveQuestRecordingState, changes: Pick<ActiveQuestLocalSession, "pausedAt" | "activeSince" | "activeDurationMs">) {
  return mutate((store) => {
    const current = store.sessions[sessionId];
    if (!current || current.recordingState === recordingState) return current ?? null;
    const now = new Date().toISOString();
    const route = store.route.filter((point) => point.sessionId === sessionId).sort((a, b) => a.id - b.id);
    const previousPoint = route.at(-1);
    const nextState = recordingState === "recording" ? "active" : "paused";
    const nextSegment: ActiveQuestRouteSegment = {
      id: `${sessionId}-${Date.now()}`,
      state: nextState,
      startedAt: now,
      endedAt: null,
      // Repeat the shared boundary in the next segment so the route stays
      // visually continuous when its color changes.
      pointIds: previousPoint ? [previousPoint.id] : [],
    };
    store.sessions[sessionId] = {
      ...current,
      ...changes,
      recordingState,
      routeSegments: [...current.routeSegments.map((segment, index) => index === current.routeSegments.length - 1 && !segment.endedAt ? { ...segment, endedAt: now } : segment), nextSegment],
      updatedAt: now,
    };
    return { ...store.sessions[sessionId] };
  });
}

/**
 * Filters and appends under one serialized mutation so foreground and
 * background location sources cannot accept the same point concurrently.
 */
export async function addAcceptedRoutePoint(sessionId: string, point: RawQuestLocation) {
  return mutate((store) => {
    const session = store.sessions[sessionId];
    if (!session) return false;
    const previous = store.route
      .filter((routePoint) => routePoint.sessionId === sessionId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null;
    if (!isAcceptedQuestLocation(point, previous)) return false;
    const accepted = smoothQuestLocation(point, previous);

    const nextPoint = { id: store.nextPointId++, sessionId, ...accepted };
    store.route.push(nextPoint);
    const sessionRoute = store.route.filter((routePoint) => routePoint.sessionId === sessionId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    store.renderRoutes[sessionId] = simplifyRouteForRendering(sessionRoute);
    const currentSegment = session.routeSegments.at(-1);
    const segmentState: ActiveQuestRouteSegment["state"] = session.recordingState === "recording" ? "active" : "paused";
    const routeSegments = currentSegment && currentSegment.state === segmentState
      ? [...session.routeSegments.slice(0, -1), { ...currentSegment, pointIds: [...currentSegment.pointIds, nextPoint.id] }]
      : [...session.routeSegments, { id: `${sessionId}-${Date.now()}`, state: segmentState, startedAt: accepted.capturedAt, endedAt: null, pointIds: previous ? [previous.id, nextPoint.id] : [nextPoint.id] }];
    store.sessions[sessionId] = {
      ...session,
      routeSegments,
      distanceMeters: session.distanceMeters + (previous ? distanceBetweenMeters(previous, accepted) : 0),
      lastLocationAt: accepted.capturedAt,
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

export async function addActiveQuestPhoto(sessionId: string, uri: string, capturedAt = new Date().toISOString(), isTutorialMock = false) {
  return mutate((store) => {
    const id = store.nextPhotoId++;
    store.photos.push({ id, sessionId, uri, capturedAt, syncStatus: isTutorialMock ? "synced" : "pending", remotePath: null, isTutorialMock });
    return id;
  });
}

export async function addActiveQuestActivity(sessionId: string, input: { kind: ActiveQuestActivityKind; body?: string; caption?: string; photoId?: number; badgeLabel?: string; createdAt?: string; isTutorialMock?: boolean }) {
  return mutate((store) => {
    const session = store.sessions[sessionId];
    if (!session) return null;
    const activity: ActiveQuestActivity = {
      id: store.nextActivityId++,
      sessionId,
      kind: input.kind,
      createdAt: input.createdAt ?? new Date().toISOString(),
      body: input.body?.trim() || null,
      caption: input.caption?.trim() || null,
      photoId: input.photoId ?? null,
      badgeLabel: input.badgeLabel?.trim() || null,
      isTutorialMock: Boolean(input.isTutorialMock),
    };
    store.activity.push(activity);
    store.sessions[sessionId] = { ...session, updatedAt: activity.createdAt };
    return { ...activity };
  });
}

export async function updateActiveQuestActivity(id: number, changes: Partial<Pick<ActiveQuestActivity, "body" | "caption" | "badgeLabel">>) {
  return mutate((store) => {
    const index = store.activity.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = store.activity[index];
    const next = {
      ...current,
      body: changes.body === undefined ? current.body : changes.body?.trim() || null,
      caption: changes.caption === undefined ? current.caption : changes.caption?.trim() || null,
      badgeLabel: changes.badgeLabel === undefined ? current.badgeLabel : changes.badgeLabel?.trim() || null,
    };
    store.activity[index] = next;
    const session = store.sessions[current.sessionId];
    if (session) store.sessions[current.sessionId] = { ...session, updatedAt: new Date().toISOString() };
    return { ...next };
  });
}

export async function deleteActiveQuestActivity(id: number) {
  return mutate((store) => {
    const activity = store.activity.find((item) => item.id === id);
    if (!activity) return null;
    store.activity = store.activity.filter((item) => item.id !== id);
    const session = store.sessions[activity.sessionId];
    if (session) store.sessions[activity.sessionId] = { ...session, updatedAt: new Date().toISOString() };
    return { ...activity };
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

export async function deleteActiveQuestPhoto(id: number) {
  return mutate((store) => {
    const photo = store.photos.find((item) => item.id === id);
    if (!photo) return null;
    store.photos = store.photos.filter((item) => item.id !== id);
    store.activity = store.activity.filter((item) => item.photoId !== id);
    const session = store.sessions[photo.sessionId];
    if (session) store.sessions[photo.sessionId] = { ...session, updatedAt: new Date().toISOString() };
    return { ...photo };
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
    store.activity = store.activity.filter((item) => item.sessionId !== sessionId);
    if (store.trackingSessionId === sessionId) store.trackingSessionId = null;
  });
}
