let localOwnerId: string | null = null;
let writesBlockedForOwner: string | null = null;

/** Sets the only account whose private on-device files may be read this run. */
export function setLocalDataOwner(userId: string | null) {
  const previousOwnerId = localOwnerId;
  localOwnerId = userId;
  // A new authenticated lifecycle starts writable. During logout the owner
  // remains unchanged until the session is cleared, so its gate stays active.
  if (userId && previousOwnerId !== userId && writesBlockedForOwner === userId) writesBlockedForOwner = null;
}

export function getLocalDataOwner() {
  return localOwnerId;
}

export function requireLocalDataOwner() {
  if (!localOwnerId) throw new Error("No local data owner is available.");
  return localOwnerId;
}

export function blockLocalDataWrites(userId: string | null) {
  writesBlockedForOwner = userId;
}

export function areLocalDataWritesBlocked(userId = localOwnerId) {
  return Boolean(userId && writesBlockedForOwner === userId);
}
