import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { addRoutePoint, getActiveQuestSession, getLatestRoutePoint } from "@/services/active-quest/local-store";
import { distanceBetweenMeters, routePointIsUsable } from "@/services/active-quest/route-filter";
import { syncActiveQuestRecord } from "@/services/active-quest/sync";

export const ACTIVE_QUEST_LOCATION_TASK = "questlife-active-quest-location";

export async function persistQuestLocation(sessionId: string, location: Location.LocationObject) {
  const session = await getActiveQuestSession(sessionId);
  if (!session || session.recordingState !== "recording") return false;

  const next = {
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
  };
  const previous = await getLatestRoutePoint(sessionId);
  if (!routePointIsUsable(next, previous)) return false;

  await addRoutePoint(sessionId, next, previous ? distanceBetweenMeters(previous, next) : 0);
  void syncActiveQuestRecord(sessionId).catch(() => undefined);
  return true;
}

if (!TaskManager.isTaskDefined(ACTIVE_QUEST_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(ACTIVE_QUEST_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    for (const location of data.locations) {
      const session = await getActiveQuestSessionForTracking();
      if (!session) return;
      await persistQuestLocation(session.sessionId, location);
    }
  });
}

async function getActiveQuestSessionForTracking() {
  // Background tasks cannot access React context. The task only receives points
  // for the currently registered session, recorded in SQLite on activation.
  const { getTrackingSession } = await import("@/services/active-quest/tracking-session");
  return getTrackingSession();
}
