import { QuestCategory, QuestDifficulty } from "@/types/content";

export const journalMoods = ["sad", "neutral", "happy"] as const;
export type JournalMood = (typeof journalMoods)[number];

/**
 * One completed quest, rendered as a memory card on the Journal.
 * Backed by public.quest_completions joined to public.quests.
 */
export type JournalMemory = {
  completionId: string;
  questId: string;
  title: string;
  reflection: string | null;
  completedAt: string;
  xp: number;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  color: string;
  timeMin: number;
  photoPaths: string[];
  participants: JournalParticipant[];
};

export type JournalParticipant = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  emoji: string;
  color: string;
};

/** Per-day editable entry (title + mood), backed by public.journal_entries. */
export type JournalEntry = {
  entryDate: string;
  title: string | null;
  mood: JournalMood | null;
};

/** A live solo quest is surfaced in Journal before it becomes a completion. */
export type JournalActiveQuest = {
  sessionId: string;
  questId: string;
  title: string;
  startedAt: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  color: string;
};

export type JournalData = {
  /** ISO timestamp of profiles.created_at — Day 1 of the archive. */
  joinedAt: string;
  memoriesByDate: Record<string, JournalMemory[]>;
  entriesByDate: Record<string, JournalEntry>;
  activeQuest: JournalActiveQuest | null;
};
