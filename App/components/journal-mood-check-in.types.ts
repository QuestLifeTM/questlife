import type { JournalMood } from "@/types/journal";

export type JournalMoodCheckInProps = {
  entryDate: string;
  mood: JournalMood | null;
  editable: boolean;
  saving: boolean;
  onSave: (mood: JournalMood) => Promise<boolean>;
};

export type MoodFormProps = Omit<JournalMoodCheckInProps, "onSave"> & {
  ownerId: string;
  onClose: () => void;
  onSave: (mood: JournalMood, date: string) => Promise<boolean>;
  questTitle?: string;
  questCategory?: string;
  onConfirmStart?: () => Promise<boolean>;
  onCountdownFinished?: () => void;
  countdownSessionId?: string;
  checkInOnly?: boolean;
  successXp?: number;
};
