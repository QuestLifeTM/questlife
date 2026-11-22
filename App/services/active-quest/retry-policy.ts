/** Called by automatic triggers only; explicit Retry bypasses this gate. */
export function createRetryPolicy() {
  const failures = new Map<string, { count: number; after: number }>();
  return {
    ready: (key: string) => Date.now() >= (failures.get(key)?.after ?? 0),
    success: (key: string) => { failures.delete(key); },
    failure: (key: string) => {
      const count = Math.min(5, (failures.get(key)?.count ?? 0) + 1);
      if (failures.size > 32) failures.clear();
      failures.set(key, { count, after: Date.now() + Math.min(300000, 15000 * 2 ** count) * (0.8 + Math.random() * 0.4) });
    },
  };
}
