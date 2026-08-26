import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getActiveQuestSnapshot, hydrateActiveQuestRecord } from "@/services/active-quest/local-store";
import { ActiveQuestActivity, ActiveQuestPhoto, ActiveQuestRoutePoint, ActiveQuestRouteSegment, ActiveQuestRecordingState } from "@/types/active-quest";

const ROUTE_SYNC_INTERVAL_MS = 30_000;
const lastRouteSyncAt = new Map<string, number>();
const activeRouteSyncs = new Map<string, Promise<void>>();

/**
 * Replays the complete local record with stable client keys. This is deliberately
 * idempotent: a crash between a network response and local state update simply
 * upserts the same snapshot/points/media next time the app becomes active.
 */
export async function syncActiveQuestRecord(sessionId: string) {
  if (!isSupabaseConfigured) return;
  const snapshot = await getActiveQuestSnapshot(sessionId);
  if (!snapshot) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  const { session } = snapshot;
  const pointSegments = new Map<number, { id: string; state: "active" | "paused" }>();
  for (const segment of session.routeSegments) for (const pointId of segment.pointIds) pointSegments.set(pointId, { id: segment.id, state: segment.state });
  const snapshotResult = await supabase.from("quest_session_snapshots").upsert({
    session_id: session.sessionId,
    user_id: userId,
    quest_id: session.questId,
    recording_state: session.recordingState,
    started_at: session.startedAt,
    paused_at: session.pausedAt,
    active_duration_ms: session.activeDurationMs,
    distance_meters: session.distanceMeters,
    entry_title: session.entryTitle,
    entry_body: session.entryBody,
    last_location_at: session.lastLocationAt,
    render_route: snapshot.renderRoute.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      capturedAt: point.capturedAt,
    })),
    route_segments: session.routeSegments,
    updated_at: session.updatedAt,
  }, { onConflict: "session_id" });
  if (snapshotResult.error) throw snapshotResult.error;

  if (snapshot.route.length) {
    const routeResult = await supabase.from("quest_session_route_points").upsert(snapshot.route.map((point) => ({
      session_id: session.sessionId,
      user_id: userId,
      client_point_id: `${session.sessionId}-${point.id}`,
      captured_at: point.capturedAt,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy_meters: point.accuracy,
      speed_meters_per_second: point.speed,
      altitude_meters: point.altitude,
      heading_degrees: point.heading,
      segment_id: pointSegments.get(point.id)?.id ?? null,
      segment_state: pointSegments.get(point.id)?.state ?? null,
    })), { onConflict: "session_id,client_point_id" });
    if (routeResult.error) throw routeResult.error;
  }

  const uploadedMedia = snapshot.photos.filter((photo) => !photo.isTutorialMock && photo.remotePath);
  if (uploadedMedia.length) {
    const mediaResult = await supabase.from("quest_session_media").upsert(uploadedMedia.map((photo) => ({
      session_id: session.sessionId,
      user_id: userId,
      client_media_id: `${session.sessionId}-${photo.id}`,
      captured_at: photo.capturedAt,
      storage_url: photo.remotePath,
    })), { onConflict: "session_id,client_media_id" });
    if (mediaResult.error) throw mediaResult.error;
  }

  const activityRows = snapshot.activity.filter((item) => !item.isTutorialMock).map((item) => ({
    session_id: session.sessionId,
    user_id: userId,
    client_activity_id: `${session.sessionId}-${item.id}`,
    kind: item.kind,
    created_at: item.createdAt,
    body: item.body,
    caption: item.caption,
    badge_label: item.badgeLabel,
    client_photo_id: item.photoId === null ? null : `${session.sessionId}-${item.photoId}`,
  }));
  if (activityRows.length) {
    const activityResult = await supabase.from("quest_session_activity").upsert(activityRows, { onConflict: "session_id,client_activity_id" });
    if (activityResult.error) throw activityResult.error;
  }
}

type SnapshotRow = {
  session_id: string;
  quest_id: string;
  recording_state: ActiveQuestRecordingState;
  started_at: string;
  paused_at: string | null;
  active_duration_ms: number;
  distance_meters: number;
  entry_title: string;
  entry_body: string;
  last_location_at: string | null;
  render_route: Array<{ latitude: number; longitude: number; capturedAt: string }> | null;
  route_segments: ActiveQuestRouteSegment[] | null;
  updated_at: string;
};

function numericClientId(sessionId: string, clientId: string, fallback: number) {
  const suffix = clientId.startsWith(`${sessionId}-`) ? clientId.slice(sessionId.length + 1) : "";
  const parsed = Number(suffix);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Restores an active quest's server-backed progress after login or device change. */
export async function hydrateActiveQuestFromServer(sessionId: string) {
  if (!isSupabaseConfigured) return null;
  const [snapshotResult, routeResult, mediaResult, activityResult] = await Promise.all([
    supabase.from("quest_session_snapshots").select("session_id, quest_id, recording_state, started_at, paused_at, active_duration_ms, distance_meters, entry_title, entry_body, last_location_at, render_route, route_segments, updated_at").eq("session_id", sessionId).maybeSingle<SnapshotRow>(),
    supabase.from("quest_session_route_points").select("client_point_id, captured_at, latitude, longitude, accuracy_meters, speed_meters_per_second, altitude_meters, heading_degrees").eq("session_id", sessionId).order("captured_at", { ascending: true }),
    supabase.from("quest_session_media").select("client_media_id, captured_at, storage_url").eq("session_id", sessionId).order("captured_at", { ascending: true }),
    supabase.from("quest_session_activity").select("client_activity_id, kind, created_at, body, caption, badge_label, client_photo_id").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);
  if (snapshotResult.error) throw snapshotResult.error;
  if (routeResult.error) throw routeResult.error;
  if (mediaResult.error) throw mediaResult.error;
  // Older installations may not have the activity migration yet. The core
  // session, route, and photos remain recoverable while it is rolling out.
  const remoteActivity = activityResult.error ? [] : activityResult.data ?? [];
  const snapshot = snapshotResult.data;
  if (!snapshot) return null;

  const route: ActiveQuestRoutePoint[] = (routeResult.data ?? []).map((point, index) => ({
    id: numericClientId(sessionId, point.client_point_id, index + 1), sessionId, capturedAt: point.captured_at,
    latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy_meters, speed: point.speed_meters_per_second,
    altitude: point.altitude_meters, heading: point.heading_degrees,
  }));
  const photos: ActiveQuestPhoto[] = (mediaResult.data ?? []).map((photo, index) => ({
    id: numericClientId(sessionId, photo.client_media_id, index + 1), sessionId, uri: photo.storage_url, capturedAt: photo.captured_at,
    syncStatus: "synced", remotePath: photo.storage_url, isTutorialMock: false,
  }));
  const photoIds = new Map((mediaResult.data ?? []).map((photo, index) => [photo.client_media_id, numericClientId(sessionId, photo.client_media_id, index + 1)]));
  const activity: ActiveQuestActivity[] = remoteActivity.map((item, index) => ({
    id: numericClientId(sessionId, item.client_activity_id, index + 1), sessionId, kind: item.kind as ActiveQuestActivity["kind"], createdAt: item.created_at,
    body: item.body, caption: item.caption, badgeLabel: item.badge_label, photoId: item.client_photo_id ? photoIds.get(item.client_photo_id) ?? null : null, isTutorialMock: false,
  }));
  const renderRoute: ActiveQuestRoutePoint[] = (snapshot.render_route ?? []).map((point, index) => ({ id: -(index + 1), sessionId, capturedAt: point.capturedAt, latitude: point.latitude, longitude: point.longitude, accuracy: null, speed: null, altitude: null, heading: null }));
  return hydrateActiveQuestRecord({
    session: {
      sessionId, questId: snapshot.quest_id, recordingState: snapshot.recording_state, startedAt: snapshot.started_at,
      pausedAt: snapshot.paused_at, activeSince: snapshot.recording_state === "recording" ? snapshot.updated_at : null,
      activeDurationMs: snapshot.active_duration_ms, distanceMeters: snapshot.distance_meters, entryTitle: snapshot.entry_title,
      entryBody: snapshot.entry_body, lastLocationAt: snapshot.last_location_at, routeSegments: snapshot.route_segments ?? [], updatedAt: snapshot.updated_at,
    }, route, renderRoute, photos, activity,
  });
}

/** Makes one best-effort durable checkpoint while the current account is still authenticated. */
export async function flushCurrentUsersActiveQuest() {
  if (!isSupabaseConfigured) return;
  const { data: session, error } = await supabase
    .from("quest_sessions")
    .select("id")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (session) await syncActiveQuestRecord(session.id);
}

/** Persists route progress periodically without issuing a write per GPS update. */
export function queueActiveQuestRouteSync(sessionId: string) {
  const now = Date.now();
  if (now - (lastRouteSyncAt.get(sessionId) ?? 0) < ROUTE_SYNC_INTERVAL_MS || activeRouteSyncs.has(sessionId)) return;
  lastRouteSyncAt.set(sessionId, now);
  const task = syncActiveQuestRecord(sessionId).catch(() => undefined).finally(() => activeRouteSyncs.delete(sessionId));
  activeRouteSyncs.set(sessionId, task);
}
