// Browser storage is origin-scoped, not a native keychain. Auth session storage
// continues to use secureAuthStorage, with Supabase's existing PKCE policy.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 0;
export async function getItemAsync(key: string): Promise<string | null> {
  return window.localStorage.getItem(key);
}
export async function setItemAsync(key: string, value: string, _options?: unknown) {
  window.localStorage.setItem(key, value);
}
export async function deleteItemAsync(key: string) { window.localStorage.removeItem(key); }
