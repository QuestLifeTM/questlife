import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  adminPermissions,
  AppAnnouncement,
  AdminInvite,
  AdminMembership,
  AdminNotification,
  AdminPermission,
  AdminProfile,
  AdminRole,
  AdventurePack,
  AdventurePackFormInput,
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

type AdventurePackRow = {
  id: string;
  title: string;
  subtitle: string;
  description: string | null;
  status: QuestStatus;
  accent_color: string;
  background_color: string;
  icon: string;
  cover_image_url?: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  archived_at: string | null;
};

type PackQuestRow = {
  adventure_pack_id: string;
  quest_id: string;
  position: number;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type AdminMembershipRow = {
  is_active?: boolean | null;
  last_login?: string | null;
  user_id: string;
  role: AdminRole;
  permissions: AdminPermission[] | null;
};

type AdminInviteRow = {
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string | null;
  email: string;
  expires_at?: string | null;
  id: string;
  invited_by: string | null;
  permissions: AdminPermission[] | null;
  role: AdminRole;
  status: AdminInvite["status"];
};

type AdminNotificationRow = {
  body: string;
  created_at: string | null;
  id: string;
  read_at: string | null;
  related_quest_id: string | null;
  title: string;
  type: AdminNotification["type"];
};

type AppAnnouncementRow = {
  body: string;
  created_at: string | null;
  id: string;
  is_active: boolean;
  title: string;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

function isGrantableAdminPermission(permission: AdminPermission) {
  return permission !== "admins.manage" && permission !== "quests.review_publish";
}

function normalizeAdminPermissions(role: AdminRole, permissions?: AdminPermission[] | null) {
  if (role === "super_admin") return [...adminPermissions];

  return (permissions ?? []).filter((permission): permission is AdminPermission =>
    (adminPermissions as readonly string[]).includes(permission) &&
    isGrantableAdminPermission(permission),
  );
}

function mapInvite(row: AdminInviteRow): AdminInvite {
  return {
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    createdAt: row.created_at,
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    invitedBy: row.invited_by,
    permissions: normalizeAdminPermissions(row.role, row.permissions),
    role: row.role,
    status: row.status,
  };
}

async function invokeAdminAuth<TPayload extends Record<string, unknown>>(payload: TPayload) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke("admin-auth", {
    body: payload,
  });

  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error?: unknown }).error ?? "Admin request failed."));
  }
}

function mapNotification(row: AdminNotificationRow): AdminNotification {
  return {
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    readAt: row.read_at,
    relatedQuestId: row.related_quest_id,
    title: row.title,
    type: row.type,
  };
}

function mapAppAnnouncement(row: AppAnnouncementRow): AppAnnouncement {
  return {
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    title: row.title,
  };
}

export function formatTimeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hours`;
  return `${Number(hours.toFixed(1))} hours`;
}

export function formatPackTimeRange(minutes: number) {
  if (!minutes) return "Flexible";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours <= 1) return "1 hour";
  return `${Math.round(hours * 10) / 10} hours`;
}

function mapQuest(
  row: QuestRow,
  savedIds: Set<string>,
  completedIds: Set<string>,
  profileLabels: Map<string, string> = new Map(),
): Quest {
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
    saved: savedIds.has(row.id),
    completed: completedIds.has(row.id),
    createdBy: row.created_by,
    createdByLabel: row.created_by ? profileLabels.get(row.created_by) ?? shortUserId(row.created_by) : "Unknown admin",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

function mapPack(row: AdventurePackRow, questIds: string[], quests: Quest[]): AdventurePack {
  const packQuests = questIds
    .map((questId) => quests.find((quest) => quest.id === questId))
    .filter(Boolean) as Quest[];
  const visibleQuestIds = packQuests.map((quest) => quest.id);
  const totalMinutes = packQuests.reduce((sum, quest) => sum + quest.timeMin, 0);

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description ?? "",
    status: row.status,
    color: row.accent_color,
    bgColor: row.background_color,
    icon: row.icon,
    questIds: visibleQuestIds,
    questCount: visibleQuestIds.length,
    timeMin: totalMinutes,
    timeRange: formatPackTimeRange(totalMinutes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    coverImageUrl: row.cover_image_url ?? null,
  };
}

async function fetchSavedQuestIds() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Set<string>();

  const { data, error } = await supabase
    .from("saved_quests")
    .select("quest_id")
    .eq("user_id", userData.user.id);

  if (error) throw error;

  return new Set((data ?? []).map((item) => item.quest_id as string));
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

function shortUserId(id: string) {
  return `Admin ${id.slice(0, 6)}`;
}

async function fetchProfileLabels(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const labels = new Map<string, string>();

  if (!uniqueIds.length) {
    return labels;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", uniqueIds)
    .returns<ProfileRow[]>();

  if (error) {
    return labels;
  }

  for (const profile of data ?? []) {
    labels.set(profile.id, profile.display_name || profile.email || shortUserId(profile.id));
  }

  return labels;
}

export async function fetchContentLibrary({ admin = false }: { admin?: boolean } = {}) {
  assertSupabaseConfigured();

  const [savedIds, completedIds] = await Promise.all([
    fetchSavedQuestIds(),
    fetchCompletedQuestIds(),
  ]);

  let questQuery = supabase
    .from("quests")
    .select("*")
    .order("featured", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!admin) {
    questQuery = questQuery.eq("status", "published");
  }

  const { data: questRows, error: questError } = await questQuery.returns<QuestRow[]>();
  if (questError) throw questError;

  const profileLabels = admin
    ? await fetchProfileLabels((questRows ?? []).flatMap((row) => [row.created_by, row.updated_by, row.reviewed_by].filter(Boolean) as string[]))
    : new Map<string, string>();

  const quests = (questRows ?? []).map((row) => mapQuest(row, savedIds, completedIds, profileLabels));

  let packQuery = supabase
    .from("adventure_packs")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!admin) {
    packQuery = packQuery.eq("status", "published");
  }

  const [{ data: packRows, error: packError }, { data: packQuestRows, error: packQuestError }] =
    await Promise.all([
      packQuery.returns<AdventurePackRow[]>(),
      supabase
        .from("adventure_pack_quests")
        .select("adventure_pack_id, quest_id, position")
        .order("position", { ascending: true })
        .returns<PackQuestRow[]>(),
    ]);

  if (packError) throw packError;
  if (packQuestError) throw packQuestError;

  const questIdsByPack = new Map<string, string[]>();
  for (const item of packQuestRows ?? []) {
    const current = questIdsByPack.get(item.adventure_pack_id) ?? [];
    current.push(item.quest_id);
    questIdsByPack.set(item.adventure_pack_id, current);
  }

  const adventurePacks = (packRows ?? [])
    .map((row) => mapPack(row, questIdsByPack.get(row.id) ?? [], quests))
    .filter((pack) => admin || pack.questCount > 0);

  return { adventurePacks, quests };
}

export async function getAdminMembership(): Promise<AdminMembership | null> {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("admin_memberships")
    .select("user_id, role, permissions, is_active, last_login")
    .eq("user_id", userData.user.id)
    .maybeSingle<AdminMembershipRow>();

  if (error) throw error;
  if (!data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", userData.user.id)
    .maybeSingle<ProfileRow>();

  return {
    displayName: profile?.display_name ?? null,
    email: profile?.email ?? userData.user.email ?? null,
    isActive: data.is_active ?? true,
    lastLogin: data.last_login ?? null,
    permissions: normalizeAdminPermissions(data.role, data.permissions),
    role: data.role,
    userId: data.user_id,
  };
}

export async function getDailyQuestLimitEnabled(): Promise<boolean> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_daily_quest_limit_enabled");
  if (error) throw error;
  return parseBooleanRpcValue(data);
}

export async function setDailyQuestLimitEnabled(enabled: boolean): Promise<boolean> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("set_daily_quest_limit_enabled", { p_enabled: enabled });
  if (error) throw error;
  return parseBooleanRpcValue(data);
}

export async function getIntroEnabled(): Promise<boolean> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_intro_enabled");
  if (error) throw error;
  return parseBooleanRpcValue(data);
}

export async function setIntroEnabled(enabled: boolean): Promise<boolean> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("set_intro_enabled", { p_enabled: enabled });
  if (error) throw error;
  return parseBooleanRpcValue(data);
}

export async function listAppAnnouncements(): Promise<AppAnnouncement[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("app_announcements")
    .select("id, title, body, is_active, created_at")
    .order("created_at", { ascending: false })
    .returns<AppAnnouncementRow[]>();

  if (error) throw error;
  return (data ?? []).map(mapAppAnnouncement);
}

export async function publishAppAnnouncement(input: { title: string; body: string }): Promise<AppAnnouncement> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("publish_app_announcement", {
    p_body: input.body.trim(),
    p_title: input.title.trim(),
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("The announcement could not be created.");
  return mapAppAnnouncement(row as AppAnnouncementRow);
}

export async function deactivateAppAnnouncement(id: string) {
  assertSupabaseConfigured();
  const { error } = await supabase
    .from("app_announcements")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw error;
}

function parseBooleanRpcValue(value: unknown): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  throw new Error("The quest-limit setting returned an invalid value.");
}

export async function listAdminProfiles(): Promise<AdminProfile[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc("list_admin_accounts");

  if (error) throw error;

  return ((data ?? []) as Array<{
    bio: string | null;
    display_name: string | null;
    email: string | null;
    is_active: boolean;
    last_login: string | null;
    permissions: AdminPermission[] | null;
    role: AdminRole;
    user_id: string;
  }>).map((row) => ({
    bio: row.bio,
    displayName: row.display_name,
    email: row.email,
    isActive: row.is_active,
    lastLogin: row.last_login,
    permissions: normalizeAdminPermissions(row.role, row.permissions),
    role: row.role,
    userId: row.user_id,
  }));
}

export async function listAdminInvites(): Promise<AdminInvite[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from("admin_invites")
    .select("id, email, role, permissions, status, invited_by, accepted_by, accepted_at, created_at, expires_at")
    .order("created_at", { ascending: false })
    .returns<AdminInviteRow[]>();

  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export async function inviteAdmin(input: {
  email: string;
  permissions: AdminPermission[];
  role: AdminRole;
}): Promise<AdminInvite> {
  if (input.role === "super_admin") {
    throw new Error("Super admin access is seeded manually and cannot be granted from the dashboard.");
  }

  await invokeAdminAuth({
    action: "invite",
    email: input.email.trim().toLowerCase(),
    permissions: normalizeAdminPermissions(input.role, input.permissions),
  });

  const invites = await listAdminInvites();
  const created = invites.find((invite) => invite.email.toLowerCase() === input.email.trim().toLowerCase());
  if (!created) throw new Error("Invite was created, but could not be loaded.");
  return created;
}

export async function updateAdminAccess(input: {
  permissions: AdminPermission[];
  role: AdminRole;
  userId: string;
}) {
  if (input.role === "super_admin") {
    throw new Error("Super Admin permissions cannot be changed here.");
  }

  await invokeAdminAuth({
    action: "update_access",
    permissions: normalizeAdminPermissions(input.role, input.permissions),
    userId: input.userId,
  });
}

export async function disableAdmin(userId: string) {
  await invokeAdminAuth({ action: "disable", userId });
}

export async function reactivateAdmin(userId: string) {
  await invokeAdminAuth({ action: "reactivate", userId });
}

export async function deleteAdmin(userId: string) {
  await invokeAdminAuth({ action: "delete", userId });
}

export async function resetAdminPassword(userId: string) {
  await invokeAdminAuth({ action: "reset_password", userId });
}

export async function updateInviteAccess(input: {
  id: string;
  permissions: AdminPermission[];
  role: AdminRole;
  status: AdminInvite["status"];
}) {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from("admin_invites")
    .update({
      permissions: normalizeAdminPermissions(input.role, input.permissions),
      role: input.role,
      status: input.status,
    })
    .eq("id", input.id);

  if (error) throw error;
}

export async function updateOwnAdminProfile(displayName: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("profiles").upsert(
    {
      display_name: displayName.trim() || null,
      email: userData.user.email?.toLowerCase() ?? null,
      id: userData.user.id,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function fetchAdminNotifications(): Promise<AdminNotification[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from("admin_notifications")
    .select("id, type, title, body, related_quest_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .returns<AdminNotificationRow[]>();

  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markAdminNotificationRead(id: string) {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAdminNotificationsRead(ids: string[], read: boolean) {
  assertSupabaseConfigured();
  if (!ids.length) return;

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .in("id", ids);

  if (error) throw error;
}

export async function markAllAdminNotificationsRead() {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id);

  if (error) throw error;
}

export async function deleteAdminNotifications(ids?: string[]) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  let query = supabase.from("admin_notifications").delete().eq("user_id", userData.user.id);
  if (ids) {
    if (!ids.length) return;
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) throw error;
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
    reviewed_at: input.status === "published" || input.reviewNote?.trim() ? new Date().toISOString() : null,
    reviewed_by: input.status === "published" || input.reviewNote?.trim() ? userData.user?.id ?? null : null,
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

  return mapQuest(data, new Set(), new Set());
}

export async function deleteQuest(questId: string) {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from("quests")
    .delete()
    .eq("id", questId)
    .eq("status", "draft");

  if (error) throw error;

  await writeAudit("quest.deleted", "quest", questId, { status: "draft" });
}

export async function notifyQuestReviewResult(input: {
  quest: Quest;
  report?: string | null;
  result: "approved" | "denied";
}) {
  assertSupabaseConfigured();
  if (!input.quest.createdBy) return;

  const approved = input.result === "approved";
  const { error } = await supabase.from("admin_notifications").insert({
    body: approved
      ? `${input.quest.title} was approved and published.`
      : `${input.quest.title} was returned to draft.${input.report ? ` Report: ${input.report}` : ""}`,
    related_quest_id: input.quest.id,
    title: approved ? "Quest approved" : "Quest needs changes",
    type: approved ? "quest_approved" : "quest_denied",
    user_id: input.quest.createdBy,
  });

  if (error) throw error;
}

export async function upsertAdventurePack(input: AdventurePackFormInput & { id?: string }) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const payload = {
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    description: input.description.trim() || null,
    status: input.status,
    accent_color: input.color,
    background_color: input.bgColor,
    icon: input.icon.trim() || "🧭",
    cover_image_url: input.coverImageUrl?.trim() || null,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    archived_at: input.status === "archived" ? new Date().toISOString() : null,
    updated_by: userData.user?.id ?? null,
    ...(input.id ? {} : { created_by: userData.user?.id ?? null }),
  };

  const query = input.id
    ? supabase.from("adventure_packs").update(payload).eq("id", input.id)
    : supabase.from("adventure_packs").insert(payload);

  const { data, error } = await query.select("*").single<AdventurePackRow>();
  if (error) throw error;

  const packId = data.id;
  const { error: deleteError } = await supabase
    .from("adventure_pack_quests")
    .delete()
    .eq("adventure_pack_id", packId);
  if (deleteError) throw deleteError;

  if (input.questIds.length) {
    const { error: insertError } = await supabase.from("adventure_pack_quests").insert(
      input.questIds.map((questId, index) => ({
        adventure_pack_id: packId,
        position: index,
        quest_id: questId,
      })),
    );
    if (insertError) throw insertError;
  }

  await writeAudit(
    input.id ? "adventure_pack.updated" : "adventure_pack.created",
    "adventure_pack",
    packId,
    { status: input.status, title: input.title, questCount: input.questIds.length },
  );

  return data;
}

export async function deleteAdventurePack(packId: string) {
  assertSupabaseConfigured();

  // The foreign key cascades the related quest assignments. Deleting the pack
  // first keeps this operation atomic when row-level security rejects it.
  const { data, error } = await supabase
    .from("adventure_packs")
    .delete()
    .eq("id", packId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) throw new Error("Adventure pack was not found or you do not have permission to delete it.");

  await writeAudit("adventure_pack.deleted", "adventure_pack", packId, {});
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

export async function completeQuest(questId: string, reflection?: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("quest_completions").insert({
    quest_id: questId,
    reflection: reflection?.trim() || null,
    user_id: userData.user.id,
  });

  if (error) throw error;
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
