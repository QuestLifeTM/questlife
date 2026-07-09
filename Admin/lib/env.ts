type SupabaseEnv = {
  publishableKey: string;
  url: string;
};

export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL to https://YOUR_PROJECT.supabase.co and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your publishable key.";

function normalizeSupabaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const isSupabaseHost = parsed.hostname.endsWith(".supabase.co");
    const hasPath = parsed.pathname !== "/";

    if (parsed.protocol !== "https:" || !isSupabaseHost || hasPath) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  return {
    publishableKey,
    url,
  };
}

export function getSupabaseEnvOrThrow(): SupabaseEnv {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }

  return env;
}
