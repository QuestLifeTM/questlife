import * as SecureStore from "expo-secure-store";

const memoryStorage = new Map<string, string>();

function getWebStorage() {
  if (typeof window === "undefined") {
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

    if (typeof window !== "undefined") {
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

    if (typeof window !== "undefined") {
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

    if (typeof window !== "undefined") {
      memoryStorage.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
