/** Coalesce concurrent requests into one runner and one dirty follow-up. */
export function createSyncCoordinator() {
  const jobs = new Map<string, { dirty: boolean; promise: Promise<void> }>();
  return (key: string, work: () => Promise<void>): Promise<void> => {
    const running = jobs.get(key);
    if (running) { running.dirty = true; return running.promise; }
    const job = { dirty: false, promise: Promise.resolve() };
    job.promise = Promise.resolve().then(async () => {
      do { job.dirty = false; await work(); } while (job.dirty);
    }).finally(() => { if (jobs.get(key) === job) jobs.delete(key); });
    jobs.set(key, job);
    return job.promise;
  };
}
