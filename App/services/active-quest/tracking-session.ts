import * as SecureStore from "expo-secure-store";

const TRACKING_SESSION_KEY = "questlife.active-location.v2";

export type TrackingSession = { ownerId: string; sessionId: string };

export async function setTrackingSession(session: TrackingSession | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(TRACKING_SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(TRACKING_SESSION_KEY, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
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
