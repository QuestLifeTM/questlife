import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  adminPermissions,
  AdminMembership,
  AdminPermission,
  Quest,
  QuestFormInput,
  QuestStatus,
  questCategoryColors,
} from "@/types/content";

type QuestRow = {
  id: string;
  title: string;
  category: Quest["category"];
  experience_points: number;
  description: string;
  steps: string[] | null;
  estimated_minutes: number;
  difficulty: Quest["difficulty"];
  status: QuestStatus;
  featured: boolean;
  accent_color: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  archived_at: string | null;
};

type AdminMembershipRow = {
  permissions: AdminPermission[] | null;
  role: AdminMembership["role"];
  user_id: string;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

export function formatTimeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hours`;
  return `${Number(hours.toFixed(1))} hours`;
}

function mapQuest(row: QuestRow, savedDates: Map<string, string>, completedIds: Set<string>): Quest {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    xp: row.experience_points,
    description: row.description,
    steps: row.steps ?? [],
    timeMin: row.estimated_minutes,
    timeLabel: formatTimeLabel(row.estimated_minutes),
    difficulty: row.difficulty,
    status: row.status,
    featured: row.featured,
    color: questCategoryColors[row.category]?.text ?? row.accent_color,
    saved: savedDates.has(row.id),
    savedAt: savedDates.get(row.id) ?? null,
    completed: completedIds.has(row.id),
    createdBy: row.created_by,
    createdByLabel: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

async function fetchSavedQuestDates() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Map<string, string>();

  const { data, error } = await supabase
    .from("saved_quests")
    .select("quest_id, created_at")
    .eq("user_id", userData.user.id);

  if (error) throw error;

  return new Map((data ?? []).map((item) => [item.quest_id as string, item.created_at as string]));
}

async function fetchCompletedQuestIds() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Set<string>();

  const { data, error } = await supabase
    .from("quest_completions")
    .select("quest_id")
    .eq("user_id", userData.user.id);

  if (error) throw error;

  return new Set((data ?? []).map((item) => item.quest_id as string));
}

export async function fetchContentLibrary({ admin = false }: { admin?: boolean } = {}) {
  assertSupabaseConfigured();

  const [savedDates, completedIds] = await Promise.all([
    fetchSavedQuestDates(),
    fetchCompletedQuestIds(),
  ]);

  let questQuery = supabase
    .from("quests")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!admin) {
    questQuery = questQuery.eq("status", "published");
  }

  const { data: questRows, error: questError } = await questQuery.returns<QuestRow[]>();
  if (questError) throw questError;

  return { quests: (questRows ?? []).map((row) => mapQuest(row, savedDates, completedIds)) };
}

export async function getAdminMembership(): Promise<AdminMembership | null> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("admin_memberships")
    .select("user_id, role, permissions")
    .eq("user_id", userData.user.id)
    .maybeSingle<AdminMembershipRow>();

  if (error) throw error;
  if (!data) return null;

  return {
    permissions: data.role === "super_admin"
      ? [...adminPermissions]
      : (data.permissions ?? []).filter((permission): permission is AdminPermission =>
        (adminPermissions as readonly string[]).includes(permission),
      ),
    role: data.role,
    userId: data.user_id,
  };
}

export async function upsertQuest(input: QuestFormInput & { id?: string }) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const categoryColor = questCategoryColors[input.category]?.text ?? input.color;

  const payload = {
    title: input.title.trim(),
    category: input.category,
    experience_points: input.xp,
    description: input.description.trim(),
    steps: input.steps.map((step) => step.trim()).filter(Boolean),
    estimated_minutes: input.timeMin,
    difficulty: input.difficulty,
    status: input.status,
    featured: input.featured,
    accent_color: categoryColor,
    review_note: input.reviewNote?.trim() || null,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    archived_at: input.status === "archived" ? new Date().toISOString() : null,
    updated_by: userData.user?.id ?? null,
    ...(input.id ? {} : { created_by: userData.user?.id ?? null }),
  };

  const query = input.id
    ? supabase.from("quests").update(payload).eq("id", input.id)
    : supabase.from("quests").insert(payload);

  const { data, error } = await query.select("*").single<QuestRow>();
  if (error) throw error;

  await writeAudit(input.id ? "quest.updated" : "quest.created", "quest", data.id, {
    status: input.status,
    title: input.title,
  });

  return mapQuest(data, new Map(), new Set());
}

export async function toggleSavedQuest(questId: string, saved: boolean) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  if (saved) {
    const { error } = await supabase.from("saved_quests").delete().match({
      quest_id: questId,
      user_id: userData.user.id,
    });
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("saved_quests").upsert({
    quest_id: questId,
    user_id: userData.user.id,
  });
  if (error) throw error;
  return true;
}

async function writeAudit(
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("admin_audit_log").insert({
    action,
    actor_user_id: userData.user?.id ?? null,
    metadata,
    target_id: targetId,
    target_type: targetType,
  });
}
