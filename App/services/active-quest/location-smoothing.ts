import { RawQuestLocation } from "@/services/active-quest/location-quality-filter";
import { ActiveQuestRoutePoint } from "@/types/active-quest";

/** Lightweight exponential smoothing: reduces GPS jitter without map matching. */
export const locationSmoothingConfig = { enabled: true, baseAlpha: 0.72 } as const;

export function smoothQuestLocation(next: RawQuestLocation, previous: ActiveQuestRoutePoint | null): RawQuestLocation {
  if (!locationSmoothingConfig.enabled || !previous) return next;
  const accuracyPenalty = Math.min(0.18, Math.max(0, (next.accuracy ?? 0) / 250));
  const alpha = Math.max(0.55, locationSmoothingConfig.baseAlpha - accuracyPenalty);
  return {
    ...next,
    latitude: previous.latitude + (next.latitude - previous.latitude) * alpha,
    longitude: previous.longitude + (next.longitude - previous.longitude) * alpha,
  };
}
