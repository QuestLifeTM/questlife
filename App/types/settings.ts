export type NotificationPreferenceKey =
  | "streakAlerts"
  | "questReminders"
  | "milestones"
  | "friendActivity"
  | "partyInvites"
  | "dailyMotivation"
  | "weeklyRecap";

export type AppearancePreference = "system" | "light" | "dark";

export type UserSettings = {
  notifications: Record<NotificationPreferenceKey, boolean>;
  hapticFeedback: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  appearance: AppearancePreference;
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
  reduceMotion: false,
  highContrast: false,
  appearance: "system",
};
