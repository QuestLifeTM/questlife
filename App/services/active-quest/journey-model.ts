import type { JournalMood } from "@/types/journal";

export type JourneyKind = "mood" | "photo" | "video" | "note";
export type QuestPrompt = { id: string; kind: "mood" | "capture" | "note"; dueMs: number; xp: number };
export type JourneyEvent = {
  id: string; kind: JourneyKind; capturedAt: string; activeElapsedMs: number;
  mood?: JournalMood; body?: string; uri?: string; mimeType?: string; durationSeconds?: number;
  thumbnailUri?: string; thumbnailRemotePath?: string; remotePath?: string; prompt?: QuestPrompt;
  syncState: "pending" | "synced" | "failed"; xp: number; error?: string;
};
export type QuestJourney = { events: JourneyEvent[]; dismissed: string[] };
export const emptyJourney = (): QuestJourney => ({ events: [], dismissed: [] });

export function activeElapsedMs(session: { recordingState: string; activeDurationMs: number; activeSince: string | null }, now = Date.now()) {
  return Math.max(0, session.activeDurationMs + (session.recordingState === "recording" && session.activeSince ? Math.max(0, now - Date.parse(session.activeSince)) : 0));
}

/** Only current opportunities are offered; missed intervals never form a backlog. */
export function availablePrompts(elapsed: number, journey: QuestJourney): QuestPrompt[] {
  const prompts: QuestPrompt[] = [];
  const moodSlot = Math.floor(elapsed / 600_000);
  if (moodSlot > 0) prompts.push({ id: `mood:${moodSlot}`, kind: "mood", dueMs: moodSlot * 600_000, xp: 5 });
  const creativeSlot = Math.floor((elapsed - 300_000) / 600_000);
  if (creativeSlot >= 0) {
    const kind = creativeSlot % 2 === 0 ? "capture" : "note";
    prompts.push({ id: `${kind}:${creativeSlot}`, kind, dueMs: 300_000 + creativeSlot * 600_000, xp: 10 });
  }
  return prompts.filter(p => !journey.dismissed.includes(p.id) && !journey.events.some(e => e.prompt?.id === p.id));
}

export function validateJourneyEvent(event: JourneyEvent) {
  if (!event.id || !Number.isFinite(event.activeElapsedMs) || event.activeElapsedMs < 0) throw new Error("Invalid quest moment.");
  if (event.kind === "mood" && !["sad", "neutral", "happy"].includes(event.mood ?? "")) throw new Error("Choose your mood.");
  if (event.kind === "note" && !event.body?.trim()) throw new Error("Write a note before saving.");
  if ((event.body?.length ?? 0) > 4000) throw new Error("Keep your note under 4,000 characters.");
  if ((event.kind === "photo" || event.kind === "video") && !event.uri && !event.remotePath) throw new Error("Capture a moment before saving.");
  if (event.kind === "video" && (!event.durationSeconds || event.durationSeconds > 30.1)) throw new Error("Videos must be 30 seconds or shorter.");
  if (event.prompt) {
    const expected = availablePrompts(event.activeElapsedMs, emptyJourney()).find(p => p.id === event.prompt?.id);
    if (!expected || (expected.kind === "capture" ? !["photo", "video"].includes(event.kind) : expected.kind !== event.kind)) throw new Error("This prompt has expired. Your moment can still be saved without bonus XP.");
  }
}
