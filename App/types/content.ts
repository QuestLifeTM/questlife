export const questCategories = [
  "All",
  "ADVENTURE",
  "FITNESS",
  "FOOD AND DRINKS",
  "CREATIVITY",
  "SOCIAL",
] as const;

export const questDifficulties = [
  "EASY",
  "MEDIUM",
  "HARD",
  "FORMIDABLE",
] as const;

export const questStatuses = ["draft", "in_review", "published", "archived"] as const;

export type QuestCategory = Exclude<(typeof questCategories)[number], "All">;
export type QuestDifficulty = (typeof questDifficulties)[number];
export type QuestStatus = (typeof questStatuses)[number];
export type QuestMode = "focused" | "flexible";

/** Maps records created before the category consolidation to their live category. */
export function normalizeQuestCategory(category: string | null | undefined): QuestCategory {
  // Keep the stored Food & Drinks key compatible with older app versions.
  const key = (category ?? "").trim().toUpperCase();
  if (key === "FOOD & DRINKS") return "FOOD AND DRINKS";
  return key !== "ALL" && (questCategories as readonly string[]).includes(key)
    ? key as QuestCategory
    : "SOCIAL";
}

export const questCategoryColors: Record<QuestCategory, { text: string; bg: string }> = {
  ADVENTURE: { text: "#4AA3FF", bg: "#E9F4FF" },
  "FOOD AND DRINKS": { text: "#FF9A4A", bg: "#FFF3E9" },
  FITNESS: { text: "#FF5C5C", bg: "#FFEBEB" },
  CREATIVITY: { text: "#A474FF", bg: "#F4EEFF" },
  SOCIAL: { text: "#4ACF78", bg: "#E9F9EF" },
};

export type QuestSideTask = { id: string; title: string; description: string; xp: number; kind: "photo" | "video" | "note"; waitMinutes: number; expiryMinutes: number };

export type Quest = {
  sideTasks?: QuestSideTask[];
  id: string;
  title: string;
  category: QuestCategory;
  xp: number;
  description: string;
  steps: string[];
  timeMin: number;
  timeLabel: string;
  difficulty: QuestDifficulty;
  mode?: QuestMode;
  status: QuestStatus;
  featured: boolean;
  color: string;
  saved: boolean;
  savedAt?: string | null;
  completed: boolean;
  createdBy?: string | null;
  createdByLabel?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export type QuestFormInput = {
  sideTasks?: QuestSideTask[];
  title: string;
  category: QuestCategory;
  xp: number;
  description: string;
  steps: string[];
  timeMin: number;
  difficulty: QuestDifficulty;
  mode: QuestMode;
  status: QuestStatus;
  featured: boolean;
  color: string;
  reviewNote?: string | null;
};

export const adminPermissions = [
  "quests.view_published",
  "quests.view_all",
  "quests.create_draft",
  "quests.submit_review",
  "quests.review_publish",
  "admins.manage",
  "profile.manage",
  "inbox.view",
] as const;

export type AdminRole = "admin" | "super_admin";
export type AdminPermission = (typeof adminPermissions)[number];

export type AdminMembership = {
  email?: string | null;
  displayName?: string | null;
  permissions: AdminPermission[];
  userId: string;
  role: AdminRole;
};
