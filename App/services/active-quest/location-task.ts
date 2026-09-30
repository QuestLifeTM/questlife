import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { addAcceptedRoutePoint, getActiveQuestSnapshot } from "@/services/active-quest/local-store";
import { queueActiveQuestRouteSync } from "@/services/active-quest/sync";
import { areLocalDataWritesBlocked, getLocalDataOwner, setLocalDataOwner } from "@/services/local-data/owner";
import { getTrackingSession } from "@/services/active-quest/tracking-session";

export const ACTIVE_QUEST_LOCATION_TASK = "questlife-active-quest-location";

export async function persistQuestLocation(ownerId: string, sessionId: string, location: Location.LocationObject) {
  const trackingSession = await getTrackingSession();
  if (
    getLocalDataOwner() !== ownerId ||
    areLocalDataWritesBlocked(ownerId) ||
    trackingSession?.ownerId !== ownerId ||
    trackingSession.sessionId !== sessionId
  ) return false;
  const next = {
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
  };
  const accepted = await addAcceptedRoutePoint(sessionId, next);
  if (accepted) queueActiveQuestRouteSync(sessionId);
  return accepted;
}

if (!TaskManager.isTaskDefined(ACTIVE_QUEST_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(ACTIVE_QUEST_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    try {
      for (const location of data.locations) {
        const session = await getActiveQuestSessionForTracking();
        // A location task may be delivered just after the user ends a quest.
        // Persist only points for the one session that is actively recording.
        if (!session) {
          await stopStaleLocationTask();
          return;
        }
        if (areLocalDataWritesBlocked(session.ownerId)) return;
        const previousOwner = getLocalDataOwner();
        setLocalDataOwner(session.ownerId);
        try {
          await persistQuestLocation(session.ownerId, session.sessionId, location);
        } finally {
          setLocalDataOwner(previousOwner);
        }
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
  const previousOwner = getLocalDataOwner();
  setLocalDataOwner(trackingSession.ownerId);
  try {
    const snapshot = await getActiveQuestSnapshot(trackingSession.sessionId);
    return snapshot?.session.trackingStatus === "tracking" ? trackingSession : null;
  } finally {
    setLocalDataOwner(previousOwner);
  }
}

async function stopStaleLocationTask() {
  const { setTrackingSession } = await import("@/services/active-quest/tracking-session");
  try {
    const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
    if (registered) await Location.stopLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  } finally {
    await setTrackingSession(null);
  }
}
