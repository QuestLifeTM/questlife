export const questCategories = [
  "All",
  "ADVENTURE",
  "FOOD AND DRINKS",
  "FITNESS",
  "NATURE",
  "CREATIVITY",
  "EVENTS",
  "SKILLS",
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

export type AdventurePack = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: QuestStatus;
  color: string;
  bgColor: string;
  icon: string;
  questIds: string[];
  questCount: number;
  timeMin: number;
  timeRange: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  coverImageUrl?: string | null;
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

export type AdventurePackFormInput = {
  title: string;
  subtitle: string;
  description: string;
  status: QuestStatus;
  color: string;
  bgColor: string;
  icon: string;
  questIds: string[];
  coverImageUrl?: string | null;
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

export type AdminInvite = {
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  createdAt?: string | null;
  email: string;
  id: string;
  invitedBy?: string | null;
  permissions: AdminPermission[];
  role: AdminRole;
  status: "pending" | "accepted" | "revoked";
};

export type AdminNotification = {
  body: string;
  createdAt?: string | null;
  id: string;
  readAt?: string | null;
  relatedQuestId?: string | null;
  title: string;
  type: "quest_approved" | "quest_denied" | "admin_invite" | "system";
};

export type AdminProfile = {
  email?: string | null;
  displayName?: string | null;
  permissions: AdminPermission[];
  role: AdminRole;
  userId: string;
};

export type AdminLoginState = {
  allowed: boolean;
  email: string;
  firstTime: boolean;
  message?: string | null;
};
