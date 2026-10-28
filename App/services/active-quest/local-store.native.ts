import * as FileSystem from "@/lib/device-files";

import { ActiveQuestActivity, ActiveQuestActivityKind, ActiveQuestLocalSession, ActiveQuestPhoto, ActiveQuestRecordingState, ActiveQuestRoutePoint, ActiveQuestRouteSegment, ActiveQuestSnapshot } from "@/types/active-quest";
import { simplifyRouteForRendering } from "@/services/active-quest/route-filter";
import { RawQuestLocation } from "@/services/active-quest/location-quality-filter";
import { measureLocation, emptyMeasurementState, MEASUREMENT_VERSION } from "@/services/active-quest/measurement";
import { readQuestStore, commitQuestStore, closeQuestStore, readQuestObservations } from "@/lib/device-quest-store";
import type { Observation } from "@/lib/device-quest-store.types";
import { buildRenderableSegments } from "@/services/active-quest/route-segments";
import { getTrackingSession } from "@/services/active-quest/tracking-session";
import { areLocalDataWritesBlocked, getLocalDataOwner, requireLocalDataOwner } from "@/services/local-data/owner";

type ActiveQuestStore = {
  ownerId: string;
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

function activeQuestRoot(ownerId: string) { return `${FileSystem.documentDirectory}questlife/v2/users/${encodeURIComponent(ownerId)}/active-quests`; }
function storeUri(ownerId: string) { return `${activeQuestRoot(ownerId)}/store.json`; }
function backupStoreUri(ownerId: string) { return `${activeQuestRoot(ownerId)}/store.backup.json`; }

function emptyStore(ownerId: string): ActiveQuestStore {
  return {
  ownerId,
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
}

const migratedRoots = new Set<string>();
let cache: ActiveQuestStore | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function freshStore(ownerId: string): ActiveQuestStore {
  return { ...emptyStore(ownerId), sessions: {}, route: [], renderRoutes: {}, photos: [], activity: [] };
}

async function loadStore(ownerId: string) {
  if (cache?.ownerId === ownerId) return cache;
  // Database errors must surface, never silently replace a durable recording.
  const durable = await readQuestStore(activeQuestRoot(ownerId));
  if (durable) {
    migratedRoots.add(activeQuestRoot(ownerId));
    const metadata = JSON.parse(durable.metadata) as ActiveQuestStore;
    if (metadata.ownerId !== ownerId) throw new Error("Store owner mismatch");
    cache = { ...freshStore(ownerId), ...metadata, route: durable.points, renderRoutes: {} };
    return cache;
  }
  try {
    const raw = await FileSystem.readAsStringAsync(storeUri(ownerId));
    const parsed = JSON.parse(raw) as Partial<ActiveQuestStore>;
    if (parsed.ownerId !== ownerId) {
      await FileSystem.deleteAsync(storeUri(ownerId), { idempotent: true });
      throw new Error("Store owner mismatch");
    }
    cache = {
      ...freshStore(ownerId),
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
      const backup = await FileSystem.readAsStringAsync(backupStoreUri(ownerId));
      const parsed = JSON.parse(backup) as Partial<ActiveQuestStore>;
      if (parsed.ownerId !== ownerId) {
        await FileSystem.deleteAsync(backupStoreUri(ownerId), { idempotent: true });
        throw new Error("Backup owner mismatch");
      }
      cache = {
        ...freshStore(ownerId),
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
      cache = freshStore(ownerId);
    }
  }
  return cache;
}

async function persistStore(ownerId: string, store: ActiveQuestStore, previous: ActiveQuestStore, observation?: Observation) {
  if (store.ownerId !== ownerId) throw new Error("Refusing to persist data for a different owner.");
  const { route, renderRoutes: _render, ...metadata } = store;
  // First migration writes legacy points once. Subsequent commits append only new points.
  const known = new Set(migratedRoots.has(activeQuestRoot(ownerId)) ? previous.route.map(p => `${p.sessionId}:${p.id}`) : []);
  await commitQuestStore(activeQuestRoot(ownerId), {
    metadata: JSON.stringify(metadata),
    points: route.filter(p => !known.has(`${p.sessionId}:${p.id}`)),
    deletedSessions: Object.keys(previous.sessions).filter(id => !store.sessions[id]),
    observation,
  });
  migratedRoots.add(activeQuestRoot(ownerId));
}

function mutate<T>(operation: (store: ActiveQuestStore) => T | Promise<T>, observation?: Observation) {
  const ownerId = requireLocalDataOwner();
  const result = mutationQueue.then(async () => {
    if (getLocalDataOwner() !== ownerId) throw new Error("Recording owner changed. Retry after signing in.");
    const previous = await loadStore(ownerId);
    // Copy-on-write: a failed transaction must not advance the in-memory distance.
    const store = { ...previous, sessions: { ...previous.sessions }, route: [...previous.route], renderRoutes: { ...previous.renderRoutes }, photos: [...previous.photos], activity: [...previous.activity] };
    const value = await operation(store);
    await persistStore(ownerId, store, previous, observation?.decision ? observation : undefined);
    cache = store;
    return value;
  });
  mutationQueue = result.then(() => undefined, () => undefined);
  void result.then(() => listeners.forEach((listener) => listener()), () => undefined);
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
        // Recover an existing running session from its original start time.
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

    }
  });
  return getActiveQuestSession(input.sessionId);
}

type RemoteActiveQuestRecord = {
  session: Omit<ActiveQuestLocalSession, "trackingStatus" | "completionSyncState">;
  observations?: Observation[];
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
      (local.recordingState === "paused" && local.pausedAt !== local.startedAt) ||
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
      local && localHasProgress && (
        new Date(local.updatedAt).getTime() > new Date(record.session.updatedAt).getTime() ||
        // A sign-out can race a delayed cloud snapshot. Never let that stale
        // record replace a longer, already-persisted timer on this device.
        local.activeDurationMs > record.session.activeDurationMs
      ),
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

    store.nextPointId = record.route.reduce((next, point) => Math.max(next, point.id + 1), store.nextPointId);
    store.nextPhotoId = Math.max(store.nextPhotoId, ...record.photos.map((photo) => photo.id + 1), 1);
    store.nextActivityId = Math.max(store.nextActivityId, ...record.activity.map((activity) => activity.id + 1), 1);
  });
  if (record.observations?.length) {
    await mutationQueue;
    const owner = requireLocalDataOwner();
    const store = await loadStore(owner);
    const { route: _route, renderRoutes: _render, ...metadata } = store;
    for (const observation of record.observations) {
      if (observation.sessionId !== record.session.sessionId) continue;
      await commitQuestStore(activeQuestRoot(owner), { metadata: JSON.stringify(metadata), points: [], deletedSessions: [], observation });
    }
  }
  return getActiveQuestSnapshot(record.session.sessionId);
}

export async function getActiveQuestSession(sessionId: string) {
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
  const session = store.sessions[sessionId];
  return session ? { ...session } : null;
}

export async function getActiveQuestSnapshot(sessionId: string): Promise<ActiveQuestSnapshot | null> {
  const session = await getActiveQuestSession(sessionId);
  if (!session) return null;
  await mutationQueue;
  const store = await loadStore(requireLocalDataOwner());
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
export async function addAcceptedRoutePoint(sessionId: string, point: RawQuestLocation, window: { windowId?: string; startedAt?: number } = {}) {
  const receivedAt = Date.now();
  const windowId = window.windowId ?? sessionId;
  const observation: Observation = { key: `${windowId}:${point.capturedAt}:${point.latitude}:${point.longitude}`, sessionId, windowId, startedAt: window.startedAt ?? 0, receivedAt, sample: point, algorithmVersion: MEASUREMENT_VERSION };
  return mutate(async (store) => {
    const marker = await getTrackingSession();
    if (areLocalDataWritesBlocked(store.ownerId) || !marker || marker.ownerId !== store.ownerId || marker.sessionId !== sessionId || (marker.windowId ?? sessionId) !== windowId) return false;
    const session = store.sessions[sessionId];
    if (!session || session.trackingStatus !== "tracking") return false;
    const decision = measureLocation(session.measurementState ?? emptyMeasurementState(), point, windowId, Math.max(Date.parse(session.startedAt), window.startedAt ?? 0), receivedAt);
    observation.decision = decision.decision;
    let nextSession = { ...session, measurementState: decision.state, measurementVersion: MEASUREMENT_VERSION, lastDecision: decision.decision === "late" ? session.lastDecision : decision.decision };
    if (decision.decision === "accepted" || decision.decision === "stationary") {
      nextSession = { ...nextSession, lastFix: { id: 0, sessionId, ...point }, lastLocationAt: point.capturedAt };
    }
    store.sessions[sessionId] = nextSession;
    if (!decision.point) return false;
    const accepted = decision.point;
    store.nextPointId = Math.max(store.nextPointId, Date.now() * 1000);
    const nextPoint = { id: store.nextPointId++, sessionId, ...accepted };
    store.route.push(nextPoint);
    delete store.renderRoutes[sessionId];
    const currentSegment = session.routeSegments.at(-1);
    const segmentState: ActiveQuestRouteSegment["state"] = session.recordingState === "recording" ? "active" : "paused";
    const previous = store.route.filter(p => p.sessionId === sessionId).at(-2);
    const routeSegments = currentSegment && !decision.breakSegment && currentSegment.state === segmentState
      ? [...session.routeSegments.slice(0, -1), { ...currentSegment, pointIds: [...currentSegment.pointIds, nextPoint.id] }]
      : [...session.routeSegments.map(s => s.endedAt ? s : { ...s, endedAt: accepted.capturedAt }), { id: `${sessionId}-${nextPoint.id}`, state: segmentState, startedAt: accepted.capturedAt, endedAt: null, pointIds: !decision.breakSegment && previous ? [previous.id, nextPoint.id] : [nextPoint.id] }];
    store.sessions[sessionId] = { ...nextSession, routeSegments, distanceMeters: session.distanceMeters + decision.distance, updatedAt: new Date().toISOString() };
    return true;
  }, observation);
}

/** Original observations for private debugging/replay; never emitted to telemetry. */
export async function getQuestRecordingDiagnostics(sessionId: string) {
  await mutationQueue;
  return readQuestObservations(activeQuestRoot(requireLocalDataOwner()), sessionId);
}

export async function markRoutePointsSynced(sessionId: string, through: number) {
  await mutate(store => {
    const session = store.sessions[sessionId];
    if (session) store.sessions[sessionId] = { ...session, routeSyncedThrough: Math.max(session.routeSyncedThrough ?? 0, through) };
  });
}

export async function getLatestRoutePoint(sessionId: string) {
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
  const points = store.route.filter((point) => point.sessionId === sessionId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  return points[0] ? { ...points[0] } : null;
}

export async function getPendingCompletionSyncSessionIds() {
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
  return Object.values(store.sessions).filter((session) => session.completionSyncState === "pending").map((session) => session.sessionId);
}

/** Returns all local records for the current owner, for encrypted handoff only. */
export async function getAllActiveQuestSnapshots() {
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
  const sessionIds = Object.keys(store.sessions);
  return Promise.all(sessionIds.map(async sessionId => {
    const snapshot = await getActiveQuestSnapshot(sessionId);
    return snapshot ? { ...snapshot, observations: await getQuestRecordingDiagnostics(sessionId) } : null;
  }));
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
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
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
  const ownerId = requireLocalDataOwner();
  await mutationQueue;
  const store = await loadStore(ownerId);
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

/** Deletes every plaintext active-quest record for one account. */
export async function clearActiveQuestDataForOwner(ownerId: string) {
  await mutationQueue;
  await closeQuestStore(activeQuestRoot(ownerId));
  migratedRoots.delete(activeQuestRoot(ownerId));
  await FileSystem.deleteAsync(activeQuestRoot(ownerId), { idempotent: true });
  if (cache?.ownerId === ownerId) cache = null;
}

/** Exposed for lifecycle services and background tasks that need owner verification. */
export function getActiveQuestStoreOwner() {
  return getLocalDataOwner();
}
