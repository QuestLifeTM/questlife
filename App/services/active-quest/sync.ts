import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getActiveQuestSnapshot } from "@/services/active-quest/local-store";

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
}

/** Persists route progress periodically without issuing a write per GPS update. */
export function queueActiveQuestRouteSync(sessionId: string) {
  const now = Date.now();
  if (now - (lastRouteSyncAt.get(sessionId) ?? 0) < ROUTE_SYNC_INTERVAL_MS || activeRouteSyncs.has(sessionId)) return;
  lastRouteSyncAt.set(sessionId, now);
  const task = syncActiveQuestRecord(sessionId).catch(() => undefined).finally(() => activeRouteSyncs.delete(sessionId));
  activeRouteSyncs.set(sessionId, task);
}
