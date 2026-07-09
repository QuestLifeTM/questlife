import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

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
  },
  },
);
