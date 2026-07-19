import * as Location from "expo-location";

import { updateActiveQuestSession } from "@/services/active-quest/local-store";
import { ACTIVE_QUEST_LOCATION_TASK } from "@/services/active-quest/location-task";
import { setTrackingSession } from "@/services/active-quest/tracking-session";

const options: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 8,
  timeInterval: 10_000,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "QuestLife is recording your route",
    notificationBody: "Your active quest is still in progress.",
  },
};

export async function beginQuestLocationTracking(sessionId: string) {
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

  // Requesting background access after foreground permission lets an active
  // quest continue while locked. If it is declined, foreground tracking still
  // works and the user can keep the quest going.
  const background = await Location.requestBackgroundPermissionsAsync();
  await setTrackingSession(sessionId);
  const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  if (!registered) await Location.startLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK, options);
  await updateActiveQuestSession(sessionId, { trackingStatus: "tracking" });
  return { started: true, backgroundGranted: background.granted } as const;
}

export async function stopQuestLocationTracking() {
  const registered = await Location.hasStartedLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  if (registered) await Location.stopLocationUpdatesAsync(ACTIVE_QUEST_LOCATION_TASK);
  await setTrackingSession(null);
}
