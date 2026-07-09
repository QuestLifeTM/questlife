export type StreakVisibility = "public" | "private";

/** Friend relationship state relative to duo streaks, from the caller's view. */
export type DuoAvailability = "active" | "pending" | "cooldown" | "available";

export type PersonalStreak = {
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD, local calendar date of the most recent quest. */
  lastQuestOn: string | null;
  /** YYYY-MM-DD start of the current live streak, null when broken. */
  streakStartedOn: string | null;
  questedToday: boolean;
  streakVisibility: StreakVisibility;
};

export type StreakFriend = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  streakVisible: boolean;
  /** Null when the friend keeps their streak private. */
  currentStreak: number | null;
  longestStreak: number | null;
  questedToday: boolean | null;
  duoStatus: DuoAvailability;
  cooldownUntil: string | null;
};

export type DuoStreak = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  startedOn: string;
  lastAdvancedOn: string | null;
  myDoneToday: boolean;
  partnerDoneToday: boolean;
  nudgeSentToday: boolean;
  nudgeReceivedToday: boolean;
};

export type IncomingDuoInvite = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  createdAt: string;
};

export type OutgoingDuoInvite = {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatarUrl: string | null;
  status: "pending" | "declined";
  createdAt: string;
  respondedAt: string | null;
  cooldownUntil: string | null;
};

export type StreakOverview = {
  personal: PersonalStreak;
  friends: StreakFriend[];
  duoStreaks: DuoStreak[];
  incomingInvites: IncomingDuoInvite[];
  outgoingInvites: OutgoingDuoInvite[];
  /** Set of YYYY-MM-DD local dates on which the user completed >= 1 quest. */
  questDays: Set<string>;
};
