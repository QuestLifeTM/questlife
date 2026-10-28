import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { addAcceptedRoutePoint, getActiveQuestSession } from "@/services/active-quest/local-store";
import { ACTIVE_QUEST_LOCATION_TASK } from "@/services/active-quest/location-task-name";
import { queueActiveQuestRouteSync } from "@/services/active-quest/sync";
import { areLocalDataWritesBlocked, getLocalDataOwner, setLocalDataOwner } from "@/services/local-data/owner";
import { getTrackingSession } from "@/services/active-quest/tracking-session";

export async function persistQuestLocation(ownerId: string, sessionId: string, location: Location.LocationObject) {
  const trackingSession = await getTrackingSession();
  if (
    getLocalDataOwner() !== ownerId ||
    areLocalDataWritesBlocked(ownerId) ||
    trackingSession?.ownerId !== ownerId ||
    trackingSession.sessionId !== sessionId
  ) return false;
  if (!Number.isFinite(location.timestamp)) return false;
  const next = {
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
  };
  const accepted = await addAcceptedRoutePoint(sessionId, next, trackingSession);
  if (accepted) queueActiveQuestRouteSync(sessionId);
  return accepted;
}

if (!TaskManager.isTaskDefined(ACTIVE_QUEST_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(ACTIVE_QUEST_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    try {
      for (const location of [...data.locations].sort((a, b) => a.timestamp - b.timestamp)) {
        const session = await getActiveQuestSessionForTracking();
        // A location task may be delivered just after the user ends a quest.
        // Persist only points for the one session that is actively recording.
        if (!session) {
          await stopStaleLocationTask();
          return;
        }
        if (areLocalDataWritesBlocked(session.ownerId)) return;
        // Never temporarily overwrite a foreground account. A headless runtime
        // establishes its owner from the durable marker once.
        if (getLocalDataOwner() !== session.ownerId) return;
        await persistQuestLocation(session.ownerId, session.sessionId, location);
      }
    } catch {
      // Background task failures must not escape to LogBox. The location API
      // will deliver the next usable point and tracking can continue then.
    }
  });
}

async function getActiveQuestSessionForTracking() {
  // Background tasks cannot access React context. The task only receives points
  // for the currently registered session, persisted in the active-quest store.
  const trackingSession = await getTrackingSession();
  if (!trackingSession) return null;
  if (areLocalDataWritesBlocked(trackingSession.ownerId)) return null;
  const previousOwner = getLocalDataOwner();
  if (previousOwner && previousOwner !== trackingSession.ownerId) return null;
  if (!previousOwner) setLocalDataOwner(trackingSession.ownerId);
  const snapshot = await getActiveQuestSession(trackingSession.sessionId);
  return snapshot?.trackingStatus === "tracking" ? trackingSession : null;
}

async function stopStaleLocationTask() {
  // A newer registration may have won while this callback was awaiting storage.
  if (await getTrackingSession()) return;
  const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  if (registered && !(await getTrackingSession())) await Location.stopLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
}
