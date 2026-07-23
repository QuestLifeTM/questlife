export type ActiveQuestSession = {
  id: string;
  questId: string;
  source: "explore" | "saved" | "social";
  startedAt: string;
};

export type TodayCompletion = {
  completionId: string;
  questId: string;
  xpAwarded: number;
  logged: boolean;
  completedAt: string;
};

export type QuestEngineState = {
  dailyLimit: number;
  dailyUsed: number;
  activeSession: ActiveQuestSession | null;
  todayCompletions: TodayCompletion[];
};

export type CompletionResult = {
  completionId: string;
  xpAwarded: number;
  dailyUsed: number;
  dailyLimit: number;
};

export type CompleteQuestInput = {
  questId: string;
  logged: boolean;
  reflection?: string | null;
  rating?: number | null;
  review?: string | null;
  reviewPublic?: boolean;
  photoUrls?: string[];
};

export type QuestReview = {
  reviewerName: string;
  reviewerEmoji: string;
  rating: number;
  reviewText: string | null;
  photoUrls: string[];
  createdAt: string;
};

export type QuestReviewData = {
  summary: { averageRating: number | null; ratingCount: number };
  reviews: QuestReview[];
};

export type UserPack = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  accentColor: string;
  coverImageUrl: string | null;
  isPinned: boolean;
  questIds: string[];
  createdAt: string;
};
