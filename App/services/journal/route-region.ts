import type { JournalRoutePoint } from "@/types/journal";

/** Bounds a recorded route, including routes crossing the international date line. */
export function getJournalRouteRegion(points: JournalRoutePoint[]) {
  const valid = points.filter((point) => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
  if (!valid.length) return null;
  let minLat = 90, maxLat = -90;
  const longitudes = valid.map((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    return (point.longitude + 360) % 360;
  }).sort((a, b) => a - b);
  let gap = -1, start = longitudes[0];
  for (let i = 0; i < longitudes.length; i++) {
    const next = i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360;
    if (next - longitudes[i] > gap) { gap = next - longitudes[i]; start = next % 360; }
  }
  const span = 360 - gap;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: ((start + span / 2 + 180) % 360) - 180,
    latitudeDelta: Math.min(180, Math.max((maxLat - minLat) * 1.45, 0.006)),
    longitudeDelta: Math.min(360, Math.max(span * 1.45, 0.006)),
  };
}
