export type Profile = {
  avatar_url: string | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  updated_at: string;
};

export type QuestPost = {
  id: string;
  questId: string;
  questTitle: string;
  questCategory: string;
  questColor: string;
  questXp: number;
  caption: string | null;
  photoUrls: string[];
  visibility: "public" | "friends" | "private";
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
};

export type ProfileRecentCompletion = {
  completionId: string;
  questId: string;
  questTitle: string;
  questColor: string;
  xpAwarded: number;
  completedAt: string;
};

export type ProfileOverview = {
  isSelf: boolean;
  isFriend: boolean;
  profile: {
    userId: string;
    username: string | null;
    displayName: string;
    email: string | null;
    bio: string | null;
    emoji: string;
    avatarColor: string;
    title: string | null;
    totalXp: number;
    joinedAt: string;
    streakVisibility: "public" | "private";
  };
  stats: {
    totalQuests: number;
    currentStreak: number;
    longestStreak: number;
    friendsCount: number;
    daysOnApp: number;
  };
  posts: QuestPost[];
  recentCompletions: ProfileRecentCompletion[];
};

export type ProfileEditInput = {
  displayName?: string;
  username?: string;
  bio?: string | null;
  emoji?: string;
  avatarColor?: string;
  title?: string | null;
};

/** Level curve: each level requires 500 XP more than the previous band. */
export function levelForXp(totalXp: number) {
  const perLevel = 500;
  const level = Math.floor(totalXp / perLevel) + 1;
  const intoLevel = totalXp % perLevel;
  return { level, intoLevel, toNext: perLevel, progress: intoLevel / perLevel };
}

