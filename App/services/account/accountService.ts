import { supabase } from "@/lib/supabase";

export async function deleteOwnAccount() {
  const { error } = await supabase.functions.invoke("delete-own-account");
  if (error) throw error;
}
