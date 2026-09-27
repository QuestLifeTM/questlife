import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memoryStorage = new Map<string, string>();

function getWebStorage() {
  // React Native also defines `window`, so checking only for that global sends
  // native sessions to the in-memory fallback. Use the platform to ensure
  // Supabase's session is durably stored in SecureStore on iOS and Android.
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const secureAuthStorage = {
  async getItem(key: string) {
    const webStorage = getWebStorage();
    if (webStorage) {
      return webStorage.getItem(key);
    }

    // Browser storage can be unavailable (for example, privacy-restricted
    // contexts). Native apps always reach SecureStore below.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return memoryStorage.get(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  async removeItem(key: string) {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.removeItem(key);
      return;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      memoryStorage.delete(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
  async setItem(key: string, value: string) {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      memoryStorage.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
