import { ActiveQuestRoutePoint } from "@/types/active-quest";

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceBetweenMeters(a: Pick<ActiveQuestRoutePoint, "latitude" | "longitude">, b: Pick<ActiveQuestRoutePoint, "latitude" | "longitude">) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function routePointIsUsable(next: Omit<ActiveQuestRoutePoint, "id" | "sessionId">, previous: ActiveQuestRoutePoint | null) {
  // Keep the drawn route conservative. A low-confidence point can make a
  // route look like it crosses streets the user never visited.
  if (next.accuracy !== null && next.accuracy > 35) return false;
  if (!previous) return true;
  const elapsedSeconds = Math.max(1, (new Date(next.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1_000);
  const distance = distanceBetweenMeters(previous, next);
  // Reject GPS jumps faster than 9 m/s (~32 km/h). A walking quest should not
  // silently draw a route through a location glitch.
  if (distance / elapsedSeconds > 9) return false;
  // Tiny movements inside the reported uncertainty do not make a useful route.
  const uncertainty = Math.max(next.accuracy ?? 0, previous.accuracy ?? 0);
  return distance >= Math.max(4, uncertainty * 0.3);
}
