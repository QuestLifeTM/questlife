import { useCallback, useMemo, useSyncExternalStore } from "react";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

let currentTime = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  currentTime = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribeToClock(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    tick();
    timer = setInterval(tick, SECOND_MS);
  }

  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getCurrentTime() {
  return currentTime;
}

/** Returns a non-negative duration derived only from the quest start timestamp. */
export function elapsedDurationMs(questStartedAt: string | null | undefined, now = Date.now()) {
  const startedAt = questStartedAt ? new Date(questStartedAt).getTime() : Number.NaN;
  return Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;
}

/**
 * Shares one app-wide, once-per-second clock across every elapsed-time display.
 * It stores the current clock tick, never an elapsed duration.
 */
export function useElapsedDuration(questStartedAt: string | null | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => questStartedAt ? subscribeToClock(listener) : () => undefined,
    [questStartedAt],
  );
  const now = useSyncExternalStore(subscribe, getCurrentTime, getCurrentTime);

  return useMemo(() => elapsedDurationMs(questStartedAt, now), [now, questStartedAt]);
}

function parts(durationMs: number) {
  let remaining = Math.floor(Math.max(0, durationMs) / SECOND_MS);
  const days = Math.floor(remaining / (DAY_MS / SECOND_MS));
  remaining %= DAY_MS / SECOND_MS;
  const hours = Math.floor(remaining / (HOUR_MS / SECOND_MS));
  remaining %= HOUR_MS / SECOND_MS;
  const minutes = Math.floor(remaining / (MINUTE_MS / SECOND_MS));
  const seconds = remaining % (MINUTE_MS / SECOND_MS);
  return { days, hours, minutes, seconds };
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function formatElapsedFull(durationMs: number) {
  const { days, hours, minutes, seconds } = parts(durationMs);
  if (days) return `${days}d ${hours}h ${twoDigits(minutes)}m ${twoDigits(seconds)}s`;
  if (hours) return `${hours}h ${twoDigits(minutes)}m ${twoDigits(seconds)}s`;
  if (minutes) return `${minutes}m ${twoDigits(seconds)}s`;
  return `${seconds}s`;
}

export function formatElapsedCompact(durationMs: number) {
  const { days, hours, minutes, seconds } = parts(durationMs);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${twoDigits(minutes)}m`;
  return `${minutes}m ${twoDigits(seconds)}s`;
}
