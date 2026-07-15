import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import "@/lib/urlPolyfill";

import { getSupabaseEnv } from "@/lib/env";
import { secureAuthStorage } from "@/lib/secureAuthStorage";

const supabaseEnv = getSupabaseEnv();

export const isSupabaseConfigured = Boolean(supabaseEnv);

export const supabase = createClient(
  supabaseEnv?.url ?? "https://placeholder.supabase.co",
  supabaseEnv?.publishableKey ?? "placeholder-key",
  {
  auth: {
    storage: secureAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    lock: processLock,
  },
  },
);

// Keep the long-lived refresh token usable while the app is foregrounded, but
// avoid background refresh work and races when the device is inactive.
if (Platform.OS !== "web") {
  const syncAuthRefreshWithAppState = (state: string) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  syncAuthRefreshWithAppState(AppState.currentState ?? "active");
  AppState.addEventListener("change", syncAuthRefreshWithAppState);
}
