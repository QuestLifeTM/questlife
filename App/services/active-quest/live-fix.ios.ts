import type { LocationObject } from "expo-location";
export type LiveFix = { latitude: number; longitude: number; accuracy: number | null; capturedAt: string };
/** Preview may show a coarse fix with its halo; only the recorder awards distance. */
export function locationPreview(location: LocationObject, now = Date.now()): LiveFix | null {
  const { latitude, longitude, accuracy } = location.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      !Number.isFinite(location.timestamp) || now - location.timestamp > 60_000 || location.timestamp > now + 10_000 ||
      (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000))) return null;
  return { latitude, longitude, accuracy, capturedAt: new Date(location.timestamp).toISOString() };
}
export function newerLiveFix<T extends { capturedAt?: string }>(previous: T | null, next: T | null): T | null {
  if (!next) return previous;
  if (!previous || Date.parse(next.capturedAt ?? "") >= Date.parse(previous.capturedAt ?? "") || !previous.capturedAt) return next;
  return previous;
}
