import { Profile } from "@/types/profile";
import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function upsertOwnProfile(input: {
  email: string;
  id: string;
  displayName?: string | null;
}) {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        display_name: input.displayName ?? null,
        email: input.email,
        id: input.id,
      },
      { onConflict: "id" },
    )
    .select()
    .single<Profile>();

  if (error) {
    throw error;
  }

  return data;
}
