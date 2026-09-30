import * as Location from "expo-location";

import { updateActiveQuestSession } from "@/services/active-quest/local-store";
import { ACTIVE_QUEST_LOCATION_TASK } from "@/services/active-quest/location-task";
import { setTrackingSession } from "@/services/active-quest/tracking-session";

const options: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Highest,
  distanceInterval: 5,
  timeInterval: 5_000,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "QuestLife is recording your route",
    notificationBody: "Your active quest is still in progress.",
  },
};

export async function beginQuestLocationTracking(ownerId: string, sessionId: string) {
  try {
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

    // iOS asks for foreground access first. Once granted, this requests the
    // separate Always permission needed for recording while the phone is locked.
    const existingBackground = await Location.getBackgroundPermissionsAsync();
    const background = existingBackground.granted ? existingBackground : await Location.requestBackgroundPermissionsAsync();
    const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
    if (!registered) await Location.startLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK, options);
    // Do not let the background task associate a route with this quest until
    // the native location service has actually started successfully.
    await setTrackingSession({ ownerId, sessionId });
    await updateActiveQuestSession(sessionId, { trackingStatus: "tracking" });
    return { started: true, backgroundGranted: background.granted } as const;
  } catch {
    // This happens only when the installed native app predates the configured
    // iOS location usage strings. Keep the quest usable and explain the fix.
    await updateActiveQuestSession(sessionId, { trackingStatus: "permission-needed" }).catch(() => undefined);
    return { started: false, reason: "Location needs a freshly rebuilt QuestLife iOS app. Rebuild it, then allow Location access." } as const;
  }
}

export async function stopQuestLocationTracking() {
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
