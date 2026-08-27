export type SocialProfile = {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  emoji: string;
  avatarColor: string;
};

export type SocialFriend = SocialProfile & {
  totalXp: number;
  currentStreak: number | null;
  questedToday: boolean | null;
  lastQuestTitle: string | null;
  lastQuestAt: string | null;
};

export type FriendRequest = SocialProfile & {
  id: string;
  createdAt: string;
};

export type QuestShare = {
  id: string;
  senderId: string;
  senderName: string;
  senderEmoji: string;
  questId: string;
  questTitle: string;
  message: string | null;
  seen: boolean;
  createdAt: string;
};

export type IncomingChallenge = {
  id: string;
  senderId: string;
  senderName: string;
  senderEmoji: string;
  questId: string;
  questTitle: string;
  questXp: number;
  createdAt: string;
};

export type ActiveChallenge = {
  id: string;
  questId: string;
  questTitle: string;
  questXp: number;
  partnerId: string;
  partnerName: string;
  partnerEmoji: string;
  iCompleted: boolean;
  partnerCompleted: boolean;
  myCompletedAt: string | null;
  partnerCompletedAt: string | null;
  winner: "me" | "partner" | null;
  isComplete: boolean;
  isOutgoingPending: boolean;
  createdAt: string;
};

export type SocialOverview = {
  me: SocialProfile;
  friends: SocialFriend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  shares: QuestShare[];
  incomingChallenges: IncomingChallenge[];
  activeChallenges: ActiveChallenge[];
};

export type ProfileSearchResult = SocialProfile & {
  isFriend: boolean;
  isFollowing: boolean;
  followsYou: boolean;
  requestStatus: string | null;
};

export type FollowerProfile = SocialProfile & {
  followedAt: string;
};
