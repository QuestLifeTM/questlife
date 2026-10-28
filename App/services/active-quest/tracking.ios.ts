import * as Location from "expo-location";

import { updateActiveQuestSession } from "@/services/active-quest/local-store";
import { ACTIVE_QUEST_LOCATION_TASK } from "@/services/active-quest/location-task-name";
import { getTrackingSession, setTrackingSession } from "@/services/active-quest/tracking-session";

export const questLocationOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Highest,
  distanceInterval: 1,
  timeInterval: 1_000,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "QuestLife is recording your route",
    notificationBody: "Your active quest is still in progress.",
  },
};

// Serialize lifecycle transitions so a delayed start cannot resurrect a stopped recorder.
let lifecycle: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = lifecycle.catch(() => undefined).then(operation);
  lifecycle = next;
  return next;
}
export function beginQuestLocationTracking(ownerId: string, sessionId: string) {
  return serialized(() => beginTracking(ownerId, sessionId));
}
async function beginTracking(ownerId: string, sessionId: string) {
  try {
    const existing = await getTrackingSession();
    const sameSession = existing?.ownerId === ownerId && existing.sessionId === sessionId;
    const marker = sameSession && existing.windowId && existing.startedAt ? existing : { ownerId, sessionId, windowId: `${sessionId}-${Date.now()}`, startedAt: Date.now() };
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      await updateActiveQuestSession(sessionId, { trackingStatus: "unavailable" });
      return { started: false, reason: "Location services are turned off." } as const;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    const foreground = permission.granted ? permission : await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      await updateActiveQuestSession(sessionId, { trackingStatus: "permission-needed" });
      return { started: false, reason: foreground.canAskAgain === false ? "Location access is off for QuestLife. Open iPhone Settings to allow location." : "Allow location access to show your map and record a route.", openSettings: foreground.canAskAgain === false } as const;
    }

    // Foreground permission is enough for a usable map. An Always prompt or
    // native background registration failure must never invalidate that grant.
    await setTrackingSession({ ...marker, backgroundGranted: false });
    await updateActiveQuestSession(sessionId, { trackingStatus: "tracking" });
    let backgroundGranted = false;
    try {
      const current = await Location.getBackgroundPermissionsAsync();
      const background = current.granted ? current : await Location.requestBackgroundPermissionsAsync();
      if (background.granted) {
        await Location.startLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK, questLocationOptions);
        backgroundGranted = true;
      }
    } catch {
      // Continue recording through the foreground watcher. The UI explains the
      // limitation instead of repeatedly asking for an already-granted permission.
    }
    await setTrackingSession({ ...marker, backgroundGranted });
    return { started: true, backgroundGranted, reason: backgroundGranted ? "Route recording continues while your iPhone is locked." : "Location is enabled. Keep QuestLife open to record; background recording is unavailable." } as const;

  } catch {
    const marker = await getTrackingSession().catch(() => null);
    if (marker?.ownerId === ownerId && marker.sessionId === sessionId) await setTrackingSession(null).catch(() => undefined);
    await updateActiveQuestSession(sessionId, { trackingStatus: "unavailable" }).catch(() => undefined);
    return { started: false, reason: "Location could not start or be saved on this iPhone. Check available storage and try again; if this persists, install a fresh development build." } as const;
  }
}

export function stopQuestLocationTracking() {
  return serialized(stopTracking);
}
async function stopTracking() {
  // Invalidate route persistence before waiting on the native service. This
  // covers a location callback delivered during native teardown.
  await setTrackingSession(null);
  try {
    const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
    if (registered) await Location.stopLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  } finally {
    // Clearing the app-owned session is the fail-safe: a later background
    // delivery can never be saved if native teardown reports an error.
    await setTrackingSession(null);
  }
}
