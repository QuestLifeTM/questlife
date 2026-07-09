export type SocialProfile = {
  userId: string;
  username: string | null;
  displayName: string;
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
  isOutgoingPending: boolean;
  createdAt: string;
};

export type PartyInvite = {
  id: string;
  partyId: string;
  partyName: string;
  partyEmoji: string;
  senderName: string;
  createdAt: string;
};

export type PartyMember = {
  userId: string;
  displayName: string;
  emoji: string;
  avatarColor: string;
  role: "leader" | "member";
};

export type PartyQuest = {
  questId: string;
  title: string;
  xp: number;
  color: string;
  position: number;
  completedBy: string[];
};

export type Party = {
  id: string;
  name: string;
  emoji: string;
  accentColor: string;
  gameMode: "together" | "relay";
  createdAt: string;
  members: PartyMember[];
  quests: PartyQuest[];
};

export type SocialOverview = {
  me: SocialProfile;
  friends: SocialFriend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  shares: QuestShare[];
  incomingChallenges: IncomingChallenge[];
  activeChallenges: ActiveChallenge[];
  partyInvites: PartyInvite[];
  parties: Party[];
};

export type ProfileSearchResult = SocialProfile & {
  isFriend: boolean;
  requestStatus: string | null;
};
