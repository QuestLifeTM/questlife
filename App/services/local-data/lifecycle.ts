import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Image as ExpoImage } from "expo-image";

import { clearActiveQuestDataForOwner } from "@/services/active-quest/local-store";
import { getTrackingSession, setTrackingSession } from "@/services/active-quest/tracking-session";
import { clearRememberedEmail } from "@/services/auth/rememberedEmail";
import { clearGuestActiveQuest, clearGuestActiveQuestTutorialComplete, clearGuestDemoQuest } from "@/services/onboarding/guest-demo-quest";
import { clearOnboardingUsernameDraft } from "@/services/onboarding/username-draft";

const ROOT = `${FileSystem.documentDirectory}questlife/v2`;
const LEGACY_ACTIVE_QUEST_ROOT = `${FileSystem.documentDirectory}active-quests`;
const OUTBOX_ROOT = `${ROOT}/outbox`;
const LIFECYCLE_KEY = "questlife.local-lifecycle.v1";
const OUTBOX_KEY_PREFIX = "questlife.outbox-key.v1.";

export type LocalLifecyclePhase = "gated" | "checkpointed" | "outboxed" | "cleared" | "signedOut";
export type LocalLifecycleRecord = { userId: string; phase: LocalLifecyclePhase; startedAt: string };

export function localUserRoot(userId: string) {
  return `${ROOT}/users/${encodeURIComponent(userId)}`;
}

export function localUserTempRoot(userId: string) {
  return `${localUserRoot(userId)}/tmp`;
}

export function localOutboxRoot(userId: string) {
  return `${OUTBOX_ROOT}/${encodeURIComponent(userId)}`;
}

export async function writeLifecycleRecord(record: LocalLifecycleRecord) {
  await SecureStore.setItemAsync(LIFECYCLE_KEY, JSON.stringify(record), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function getLifecycleRecord(): Promise<LocalLifecycleRecord | null> {
  const raw = await SecureStore.getItemAsync(LIFECYCLE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LocalLifecycleRecord;
    return value.userId && value.phase && value.startedAt ? value : null;
  } catch {
    return null;
  }
}

export async function clearLifecycleRecord() {
  await SecureStore.deleteItemAsync(LIFECYCLE_KEY);
}

/** Removes plaintext account data and account-bound secure values from this device. */
export async function clearLocalUserData(userId: string, options: { preserveOutbox?: boolean } = {}) {
  await clearActiveQuestDataForOwner(userId);
  await FileSystem.deleteAsync(localUserRoot(userId), { idempotent: true });
  await removeLegacyUnscopedData();
  const trackingSession = await getTrackingSession().catch(() => null);
  if (trackingSession?.ownerId === userId) await setTrackingSession(null);
  if (!options.preserveOutbox) {
    await FileSystem.deleteAsync(localOutboxRoot(userId), { idempotent: true });
    await SecureStore.deleteItemAsync(`${OUTBOX_KEY_PREFIX}${userId}`);
  }
  await SecureStore.deleteItemAsync(`questlife.settings.v1.${userId}`);
  await ExpoImage.clearDiskCache().catch(() => undefined);
}

/** Clears non-account identifiers that should not survive a privacy logout. */
export async function clearSharedDeviceAccountHints() {
  await Promise.all([
    clearRememberedEmail(),
    clearOnboardingUsernameDraft(),
    clearGuestDemoQuest(),
    clearGuestActiveQuest(),
    clearGuestActiveQuestTutorialComplete(),
    SecureStore.deleteItemAsync("quest-start-education-focused"),
    SecureStore.deleteItemAsync("quest-start-education-relaxed"),
    FileSystem.deleteAsync(`${FileSystem.cacheDirectory}questlife-qr-code.png`, { idempotent: true }),
  ]);
}

/** Legacy global files have no trustworthy owner. Never migrate or expose them. */
export async function removeLegacyUnscopedData() {
  await FileSystem.deleteAsync(LEGACY_ACTIVE_QUEST_ROOT, { idempotent: true });
}

export const localOutboxKey = (userId: string) => `${OUTBOX_KEY_PREFIX}${userId}`;
