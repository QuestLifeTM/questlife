import * as SecureStore from "expo-secure-store";

import { defaultUserSettings, UserSettings } from "@/types/settings";

const memoryStorage = new Map<string, string>();
let hapticsEnabled = true;

function keyFor(userId: string) {
  return `questlife.settings.v1.${userId}`;
}

function webStorage() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

async function read(key: string) {
  const storage = webStorage();
  if (storage) return storage.getItem(key);
  if (typeof window !== "undefined") return memoryStorage.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string) {
  const storage = webStorage();
  if (storage) { storage.setItem(key, value); return; }
  if (typeof window !== "undefined") { memoryStorage.set(key, value); return; }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export function isHapticFeedbackEnabled() {
  return hapticsEnabled;
}

export function setHapticFeedbackEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export async function loadUserSettings(userId: string): Promise<UserSettings> {
  const raw = await read(keyFor(userId));
  if (!raw) return defaultUserSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      notifications: { ...defaultUserSettings.notifications, ...parsed.notifications },
      hapticFeedback: parsed.hapticFeedback ?? defaultUserSettings.hapticFeedback,
      reduceMotion: parsed.reduceMotion ?? defaultUserSettings.reduceMotion,
      highContrast: parsed.highContrast ?? defaultUserSettings.highContrast,
    };
  } catch {
    return defaultUserSettings;
  }
}

export async function saveUserSettings(userId: string, settings: UserSettings) {
  await write(keyFor(userId), JSON.stringify(settings));
}
