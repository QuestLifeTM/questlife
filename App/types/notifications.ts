export type AppNotificationCategory = "quest" | "progress" | "social" | "party" | "system";

export type AppNotificationKind =
  | "daily_quest"
  | "active_quest_reminder"
  | "quest_completed"
  | "xp_earned"
  | "streak_risk"
  | "streak_milestone"
  | "level_up"
  | "achievement"
  | "reflection_reminder"
  | "journal_entry_ready"
  | "friend_request"
  | "friend_accepted"
  | "quest_challenge"
  | "party_invite"
  | "party_completed"
  | "admin_announcement"
  | "feature_notice"
  | "service_update";

export type AppNotification = {
  id: string;
  category: AppNotificationCategory;
  kind: AppNotificationKind;
  title: string;
  body: string;
  icon: string;
  color: string;
  metadata: Record<string, unknown>;
  delivery: "in_app" | "push_eligible";
  readAt: string | null;
  createdAt: string;
};
