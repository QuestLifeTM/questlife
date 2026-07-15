import type { QuestCategory } from "@/types/content";

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
  status: "active" | "left";
};

export type PartyQuest = {
  questId: string;
  title: string;
  xp: number;
  color: string;
  position: number;
  description?: string;
  suggestionCount?: number;
  myCompletion?: boolean;
  fastest?: { name: string; elapsedSeconds: number } | null;
};

export type PartyQuestSuggestion = {
  questId: string;
  title: string;
  description: string;
  xp: number;
  color: string;
  category: QuestCategory;
  count: number;
};

export type PartyCompletedQuest = {
  id: string;
  questId: string;
  title: string;
  category: QuestCategory;
  color: string;
  xp: number;
  completedAt: string;
  completedCount: number;
};

export type PartyMode = "everyone_together" | "free_for_all";
export type PartyLocationType = "online" | "nearby" | "specific_place" | "flexible";
export type PartyProofMode = "disabled" | "optional" | "required";

export type Party = {
  id: string;
  name: string;
  code: string;
  goal: string | null;
  photoPath: string | null;
  gameMode: PartyMode;
  status: "active" | "ended";
  memberCount: number;
  maxMembers: number | null;
  endedAt: string | null;
  viewerLeftEarly: boolean;
  myRank: number | null;
  members: PartyMember[];
};

export type PartyTemplate = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  questIds: string[];
};

export type PartyHub = {
  templates: PartyTemplate[];
  active: Party[];
  past: Party[];
};

export type PartyRound = {
  id: string;
  questId: string;
  startedAt: string;
  status: "active" | "ended";
  completedCount?: number;
  totalMembers?: number;
  topFinishers?: { userId: string; name: string; emoji: string; elapsedSeconds: number; rank: number }[];
};

export type PartyLeaderboardEntry = {
  userId: string;
  displayName: string;
  emoji: string;
  avatarColor: string;
  xp: number;
  rank: number;
};

export type PartyFeedReaction = { emoji: string; count: number; reacted: boolean };

export type PartyFeedPost = {
  id: string;
  questId: string;
  questTitle: string;
  userName: string;
  userEmoji: string;
  caption: string | null;
  photoPaths: string[];
  createdAt: string;
  postType: "activity" | "adventure" | "proof";
  elapsedSeconds: number | null;
  reactions: PartyFeedReaction[];
};

export type PartyDetail = Party & {
  isHost: boolean;
  showWelcomeBriefing: boolean;
  questsEnabled: boolean;
  /** When the Party-level live clock began: quest-list unlock for Free for All, active-round start for Together. */
  partyStartedAt?: string | null;
  memberInvitesEnabled: boolean;
  photoProofMode: PartyProofMode;
  locationType: PartyLocationType;
  locationLabel: string | null;
  rules: string[];
  quests: PartyQuest[];
  suggestedQuests: PartyQuestSuggestion[];
  completedQuests: PartyCompletedQuest[];
  mySuggestedQuestIds: string[];
  activeRound: PartyRound | null;
  myActiveQuestId: string | null;
  unreadFeedCount: number;
  unreadLeaderboardCount: number;
  leaderboard: PartyLeaderboardEntry[];
  feed: PartyFeedPost[];
};

export type CreatePartyInput = {
  name: string;
  goal?: string;
  photoPath?: string | null;
  maxMembers: number | null;
  memberInvitesEnabled: boolean;
  photoProofMode: PartyProofMode;
  gameMode: PartyMode;
  locationType: PartyLocationType;
  locationLabel?: string;
  rules: string[];
  questIds: string[];
};

export type PartyCompletionResult = {
  completionId: string;
  xpAwarded: number;
  dailyUsed: number;
  dailyLimit: number;
  fastest: { name: string; emoji?: string; elapsedSeconds: number } | null;
  topFinishers: { name: string; emoji: string; elapsedSeconds: number; rank: number }[];
  proofMode: PartyProofMode;
  feedShared: boolean;
  elapsedSeconds: number;
};

export type PartyCompletionInput = {
  reflection?: string;
  journalPhotoPaths: string[];
  shareToFeed: boolean;
  feedCaption?: string;
  sharedPhotoPaths: string[];
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
