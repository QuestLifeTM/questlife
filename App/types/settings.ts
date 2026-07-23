export type NotificationPreferenceKey =
  | "streakAlerts"
  | "questReminders"
  | "milestones"
  | "friendActivity"
  | "partyInvites"
  | "dailyMotivation"
  | "weeklyRecap";

export type UserSettings = {
  notifications: Record<NotificationPreferenceKey, boolean>;
  hapticFeedback: boolean;
};

export const defaultUserSettings: UserSettings = {
  notifications: {
    streakAlerts: true,
    questReminders: true,
    milestones: true,
    friendActivity: true,
    partyInvites: true,
    dailyMotivation: false,
    weeklyRecap: true,
  },
  hapticFeedback: true,
};
