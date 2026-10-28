import * as Location from "expo-location";
import { Platform } from "react-native";

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
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      await updateActiveQuestSession(sessionId, { trackingStatus: "permission-needed" });
      return { started: false, reason: "Location permission is needed to record your route." } as const;
    }

    if (Platform.OS === "web") {
      await setTrackingSession({ ...marker, backgroundGranted: false });
      await updateActiveQuestSession(sessionId, { trackingStatus: "tracking" });
      return { started: true, backgroundGranted: false, reason: "Keep this browser tab open to record your route. Browsers pause location when the tab or device sleeps." } as const;
    }

    // iOS asks for foreground access first. Once granted, this requests the
    // separate Always permission needed for recording while the phone is locked.
    const existingBackground = await Location.getBackgroundPermissionsAsync();
    const background = existingBackground.granted ? existingBackground : await Location.requestBackgroundPermissionsAsync();
    // Foreground-only permission is a supported fallback; never claim background
    // recording succeeded when the OS denied it.
    // Publish the window before registration: the OS can immediately deliver a batch.
    await setTrackingSession({ ...marker, backgroundGranted: background.granted });
    await updateActiveQuestSession(sessionId, { trackingStatus: "tracking" });
    if (background.granted) await Location.startLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK, questLocationOptions);
    return { started: true, backgroundGranted: background.granted } as const;
  } catch {
    const marker = await getTrackingSession().catch(() => null);
    if (marker?.ownerId === ownerId && marker.sessionId === sessionId) await setTrackingSession(null).catch(() => undefined);
    await updateActiveQuestSession(sessionId, { trackingStatus: "permission-needed" }).catch(() => undefined);
    return { started: false, reason: Platform.OS === "web" ? "Location could not start. Allow location for this site in your browser, then try again. Your quest can continue without route recording." : "Route recording could not start. Check precise location permissions and try again. If this persists, install a fresh development build." } as const;
  }
}

export function stopQuestLocationTracking() {
  return serialized(stopTracking);
}
async function stopTracking() {
  // Invalidate route persistence before waiting on the native service. This
  // covers a location callback delivered during native teardown.
  await setTrackingSession(null);
  if (Platform.OS === "web") return;
  try {
    const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
    if (registered) await Location.stopLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  } finally {
    // Clearing the app-owned session is the fail-safe: a later background
    // delivery can never be saved if native teardown reports an error.
    await setTrackingSession(null);
  }
}
