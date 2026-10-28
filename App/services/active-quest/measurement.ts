import type { ActiveQuestRoutePoint } from "@/types/active-quest";
import { distanceBetweenMeters } from "@/services/active-quest/route-filter";

export type LocationSample = Omit<ActiveQuestRoutePoint, "id" | "sessionId">;
export const MEASUREMENT_VERSION = "quest-walk-v3";
export const GAP_MS = 15_000;
export type MeasurementState = {
  last: LocationSample | null;
  anchor: LocationSample | null;
  candidate: LocationSample | null;
  windowId: string | null;
};
export type MeasurementDecision = "accepted" | "stationary" | "acquiring" | "weak" | "invalid" | "late" | "jump";
export type MeasurementResult = {
  state: MeasurementState; decision: MeasurementDecision;
  point: LocationSample | null; distance: number; breakSegment: boolean;
};
export const emptyMeasurementState = (): MeasurementState => ({ last: null, anchor: null, candidate: null, windowId: null });

/** Pure, replayable measurement. Never smooth coordinates or measure a display polyline. */
export function measureLocation(previous: MeasurementState, sample: LocationSample, windowId: string, startedAt: number, receivedAt: number): MeasurementResult {
  const result = (decision: MeasurementDecision, state = previous, point: LocationSample | null = null, distance = 0, breakSegment = false): MeasurementResult => ({ decision, state, point, distance, breakSegment });
  const t = Date.parse(sample.capturedAt);
  if (!Number.isFinite(t) || t < startedAt || t > receivedAt + 10_000 ||
      !Number.isFinite(sample.latitude) || Math.abs(sample.latitude) > 90 ||
      !Number.isFinite(sample.longitude) || Math.abs(sample.longitude) > 180) return result("invalid");
  // Unknown accuracy is not a precise fix. Negative native sentinel values are invalid.
  if (sample.accuracy === null || !Number.isFinite(sample.accuracy) || sample.accuracy <= 0 || sample.accuracy > 35) return result("weak");
  const point = { ...sample, speed: sample.speed !== null && Number.isFinite(sample.speed) && sample.speed >= 0 ? sample.speed : null };
  const last = previous.last;
  if (last && t <= Date.parse(last.capturedAt)) return result("late");
  const interrupted = previous.candidate !== null || previous.windowId !== windowId || !last || t - Date.parse(last.capturedAt) > GAP_MS;
  if (interrupted) {
    // Require two nearby, chronological fixes before starting/reacquiring. A single
    // bad first fix must not trap the recorder at an impossible anchor.
    const candidate = previous.candidate;
    const delta = candidate ? t - Date.parse(candidate.capturedAt) : 0;
    if (!candidate || previous.windowId !== windowId || delta <= 0 || delta > GAP_MS || distanceBetweenMeters(candidate, point) > Math.max(20, delta / 1000 * 12)) {
      return result("acquiring", { ...previous, candidate: point, windowId });
    }
    return result("accepted", { last: point, anchor: point, candidate: null, windowId }, point, 0, true);
  }
  const seconds = (t - Date.parse(last.capturedAt)) / 1000;
  const step = distanceBetweenMeters(last, point);
  if (step > Math.max(12, seconds * 15) || (point.speed !== null && point.speed > 15)) return result("jump");
  const anchor = previous.anchor ?? last;
  const distance = distanceBetweenMeters(anchor, point);
  // Low reported speed requires displacement outside the uncertainty envelope.
  // Unknown speed still permits slow walking once cumulative displacement is credible.
  const stationary = point.speed !== null && point.speed < 0.35;
  const uncertainty = Math.max(anchor.accuracy ?? 0, point.accuracy ?? 0);
  const floor = stationary ? Math.max(6, uncertainty) : Math.max(1.5, Math.min(4, uncertainty * 0.3));
  if (distance < floor) return result("stationary", { ...previous, last: point, candidate: null });
  return result("accepted", { last: point, anchor: point, candidate: null, windowId }, point, distance);
}
