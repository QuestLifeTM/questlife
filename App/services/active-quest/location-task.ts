import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { addAcceptedRoutePoint } from "@/services/active-quest/local-store";

export const ACTIVE_QUEST_LOCATION_TASK = "questlife-active-quest-location";

export async function persistQuestLocation(sessionId: string, location: Location.LocationObject) {
  const next = {
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
  };
  return addAcceptedRoutePoint(sessionId, next);
}

if (!TaskManager.isTaskDefined(ACTIVE_QUEST_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(ACTIVE_QUEST_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    try {
      for (const location of data.locations) {
        const session = await getActiveQuestSessionForTracking();
        if (!session) return;
        await persistQuestLocation(session.sessionId, location);
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
  const { getTrackingSession } = await import("@/services/active-quest/tracking-session");
  return getTrackingSession();
}
