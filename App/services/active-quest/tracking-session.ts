import * as SecureStore from "@/lib/device-storage";

const TRACKING_SESSION_KEY = "questlife.active-location.v2";

export type TrackingSession = { ownerId: string; sessionId: string; windowId?: string; startedAt?: number; backgroundGranted?: boolean };

export async function setTrackingSession(session: TrackingSession | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(TRACKING_SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(TRACKING_SESSION_KEY, JSON.stringify(session), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}

export async function getTrackingSession(): Promise<TrackingSession | null> {
  const raw = await SecureStore.getItemAsync(TRACKING_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as TrackingSession;
    return session.ownerId && session.sessionId ? session : null;
  } catch {
    await setTrackingSession(null);
    return null;
  }
}
