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
  if (next.accuracy !== null && next.accuracy > 50) return false;
  if (!previous) return true;
  const elapsedSeconds = Math.max(1, (new Date(next.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1_000);
  const distance = distanceBetweenMeters(previous, next);
  // Reject implausible GPS jumps. This leaves room for cycling/transit quests
  // while preventing a poor location fix from drawing across a city.
  if (distance / elapsedSeconds > 15 || (next.speed !== null && next.speed > 15)) return false;
  // Ignore duplicates and stationary jitter inside the current uncertainty.
  const uncertainty = Math.max(next.accuracy ?? 0, previous.accuracy ?? 0);
  const minimumMovement = Math.max(3, Math.min(8, uncertainty * 0.35));
  return distance >= minimumMovement || (elapsedSeconds >= 15 && distance >= 2);
}

/** Ramer–Douglas–Peucker keeps a smooth, light polyline while raw samples stay intact. */
export function simplifyRouteForRendering(points: ActiveQuestRoutePoint[], toleranceMeters = 2.5) {
  if (points.length < 3) return points;
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos((points[0].latitude * Math.PI) / 180);
  const perpendicularDistance = (point: ActiveQuestRoutePoint, start: ActiveQuestRoutePoint, end: ActiveQuestRoutePoint) => {
    const px = (point.longitude - start.longitude) * longitudeScale;
    const py = (point.latitude - start.latitude) * latitudeScale;
    const ex = (end.longitude - start.longitude) * longitudeScale;
    const ey = (end.latitude - start.latitude) * latitudeScale;
    const lengthSquared = ex * ex + ey * ey;
    if (!lengthSquared) return Math.hypot(px, py);
    const projection = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));
    return Math.hypot(px - projection * ex, py - projection * ey);
  };
  const keep = new Set<number>([0, points.length - 1]);
  const simplify = (first: number, last: number): void => {
    let farthestIndex = -1;
    let farthestDistance = toleranceMeters;
    for (let index = first + 1; index < last; index += 1) {
      const distance = perpendicularDistance(points[index], points[first], points[last]);
      if (distance > farthestDistance) { farthestIndex = index; farthestDistance = distance; }
    }
    if (farthestIndex >= 0) {
      keep.add(farthestIndex);
      simplify(first, farthestIndex);
      simplify(farthestIndex, last);
    }
  };
  simplify(0, points.length - 1);
  return points.filter((_, index) => keep.has(index));
}
