export const questCategories = [
  "All",
  "ADVENTURE",
  "FOOD AND DRINKS",
  "FITNESS",
  "CREATIVITY",
  "EVENTS",
  "SOCIAL",
  "WILD CARD",
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

/** Maps records created before the category consolidation to their live category. */
export function normalizeQuestCategory(category: string): QuestCategory {
  if (category === "SKILLS") return "CREATIVITY";
  if (category === "NATURE") return "ADVENTURE";
  return category as QuestCategory;
}

export const questCategoryColors: Record<QuestCategory, { text: string; bg: string }> = {
  SOCIAL: { text: "#00E6B3", bg: "#E5FFF9" },
  ADVENTURE: { text: "#4D9CFF", bg: "#EAF4FF" },
  "FOOD AND DRINKS": { text: "#FF9C4D", bg: "#FFF2E3" },
  FITNESS: { text: "#FF4560", bg: "#FFECEF" },
  EVENTS: { text: "#FF4D9C", bg: "#FFEAF4" },
  CREATIVITY: { text: "#9C4DFF", bg: "#F3EAFF" },
  "WILD CARD": { text: "#D14DFF", bg: "#FAE9FF" },
};

export type Quest = {
  id: string;
  title: string;
  category: QuestCategory;
  xp: number;
  description: string;
  steps: string[];
  timeMin: number;
  timeLabel: string;
  difficulty: QuestDifficulty;
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
  title: string;
  category: QuestCategory;
  xp: number;
  description: string;
  steps: string[];
  timeMin: number;
  difficulty: QuestDifficulty;
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
