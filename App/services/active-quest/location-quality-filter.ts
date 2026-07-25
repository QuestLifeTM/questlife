import { ActiveQuestRoutePoint } from "@/types/active-quest";
import { distanceBetweenMeters } from "@/services/active-quest/route-filter";

/** Centralized, conservative GPS acceptance thresholds. */
export const locationQualityConfig = {
  maxAccuracyMeters: 45,
  minimumMovementMeters: 3,
  minimumIntervalMs: 1_000,
  maximumSpeedMetersPerSecond: 15,
  stationaryDriftMeters: 8,
  staleReadingMs: 60_000,
} as const;

export type RawQuestLocation = Omit<ActiveQuestRoutePoint, "id" | "sessionId">;

export function isAcceptedQuestLocation(next: RawQuestLocation, previous: ActiveQuestRoutePoint | null, now = Date.now()) {
  const timestamp = new Date(next.capturedAt).getTime();
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude) || Math.abs(next.latitude) > 90 || Math.abs(next.longitude) > 180) return false;
  if (!Number.isFinite(timestamp) || timestamp > now + 10_000 || now - timestamp > locationQualityConfig.staleReadingMs) return false;
  if (next.accuracy !== null && (!Number.isFinite(next.accuracy) || next.accuracy > locationQualityConfig.maxAccuracyMeters)) return false;
  if (!previous) return true;

  const elapsedMs = timestamp - new Date(previous.capturedAt).getTime();
  if (elapsedMs <= 0) return false;
  const distance = distanceBetweenMeters(previous, next);
  const measuredSpeed = distance / (elapsedMs / 1_000);
  if (measuredSpeed > locationQualityConfig.maximumSpeedMetersPerSecond || (next.speed !== null && next.speed > locationQualityConfig.maximumSpeedMetersPerSecond)) return false;
  if (elapsedMs < locationQualityConfig.minimumIntervalMs && distance < locationQualityConfig.minimumMovementMeters) return false;
  const uncertainty = Math.max(next.accuracy ?? 0, previous.accuracy ?? 0);
  const jitterFloor = Math.max(locationQualityConfig.minimumMovementMeters, Math.min(locationQualityConfig.stationaryDriftMeters, uncertainty * 0.35));
  return distance >= jitterFloor || (elapsedMs >= 15_000 && distance >= locationQualityConfig.minimumMovementMeters);
}
