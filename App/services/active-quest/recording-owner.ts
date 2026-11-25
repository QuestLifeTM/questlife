// A short-lived lease, scoped to the durable tracking window. A stale or absent
// background heartbeat always allows the foreground fallback to persist.
const deliveries = new Map<string, number>();
export function backgroundDelivered(window: string) {
  if (deliveries.size > 8) deliveries.clear();
  deliveries.set(window, Date.now());
}
export function backgroundOwnsPersistence(window: string, now = Date.now()) {
  return now - (deliveries.get(window) ?? 0) < 5000;
}
