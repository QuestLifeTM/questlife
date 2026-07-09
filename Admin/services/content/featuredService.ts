import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type FeaturedBatch = {
  id: string;
  featuredOn: string;
  questIds: string[];
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_CONFIG_ERROR);
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function fetchFeaturedBatches(fromDate?: string, toDate?: string): Promise<FeaturedBatch[]> {
  assertSupabaseConfigured();

  let query = supabase
    .from("featured_quest_batches")
    .select("id, featured_on")
    .order("featured_on", { ascending: true });

  if (fromDate) query = query.gte("featured_on", fromDate);
  if (toDate) query = query.lte("featured_on", toDate);

  const { data: batches, error } = await query;
  if (error) throw error;
  if (!batches?.length) return [];

  const batchIds = batches.map((b) => b.id as string);
  const { data: rows, error: questError } = await supabase
    .from("featured_batch_quests")
    .select("batch_id, quest_id, position")
    .in("batch_id", batchIds)
    .order("position", { ascending: true });

  if (questError) throw questError;

  const questIdsByBatch = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const current = questIdsByBatch.get(row.batch_id as string) ?? [];
    current.push(row.quest_id as string);
    questIdsByBatch.set(row.batch_id as string, current);
  }

  return batches.map((batch) => ({
    id: batch.id as string,
    featuredOn: batch.featured_on as string,
    questIds: questIdsByBatch.get(batch.id as string) ?? [],
  }));
}

export async function fetchFeaturedDatesForQuest(questId: string): Promise<string[]> {
  assertSupabaseConfigured();

  const { data: rows, error } = await supabase
    .from("featured_batch_quests")
    .select("batch_id, featured_quest_batches(featured_on)")
    .eq("quest_id", questId);

  if (error) throw error;

  return (rows ?? [])
    .map((row) => {
      const batch = row.featured_quest_batches as { featured_on?: string } | null;
      return batch?.featured_on ?? null;
    })
    .filter(Boolean) as string[];
}

export async function upsertFeaturedBatch(featuredOn: string, questIds: string[]) {
  assertSupabaseConfigured();

  if (questIds.length !== 6) {
    throw new Error("Featured batches must contain exactly 6 quests.");
  }

  const today = toDateKey(new Date());
  if (featuredOn < today) {
    throw new Error("Cannot edit featured batches for past dates.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data: existing, error: findError } = await supabase
    .from("featured_quest_batches")
    .select("id")
    .eq("featured_on", featuredOn)
    .maybeSingle<{ id: string }>();

  if (findError) throw findError;

  let batchId = existing?.id;

  if (batchId) {
    const { error: updateError } = await supabase
      .from("featured_quest_batches")
      .update({ updated_by: userData.user?.id ?? null })
      .eq("id", batchId);
    if (updateError) throw updateError;
  } else {
    const { data: created, error: createError } = await supabase
      .from("featured_quest_batches")
      .insert({
        featured_on: featuredOn,
        created_by: userData.user?.id ?? null,
        updated_by: userData.user?.id ?? null,
      })
      .select("id")
      .single<{ id: string }>();
    if (createError) throw createError;
    batchId = created.id;
  }

  const { error: deleteError } = await supabase.from("featured_batch_quests").delete().eq("batch_id", batchId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("featured_batch_quests").insert(
    questIds.map((questId, position) => ({
      batch_id: batchId,
      quest_id: questId,
      position,
    })),
  );
  if (insertError) throw insertError;
}

export async function deleteFeaturedBatch(featuredOn: string) {
  assertSupabaseConfigured();
  const today = toDateKey(new Date());
  if (featuredOn < today) throw new Error("Cannot delete past featured batches.");

  const { error } = await supabase.from("featured_quest_batches").delete().eq("featured_on", featuredOn);
  if (error) throw error;
}

export { toDateKey as featuredDateKey };
