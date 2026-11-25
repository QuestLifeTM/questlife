import type { JournalMood } from "@/types/journal";

export type JourneyKind = "mood" | "photo" | "video" | "note";
export type QuestPrompt = { id: string; kind: "mood" | "capture" | "note"; dueMs: number; xp: number; version?: 2; title?: string; description?: string; responseKind?: "photo" | "video" | "note"; expiresMs?: number };
export type JourneyEvent = {
  captureGroupId?: string;
  id: string; kind: JourneyKind; capturedAt: string; activeElapsedMs: number;
  mood?: JournalMood; body?: string; uri?: string; mimeType?: string; durationSeconds?: number;
  thumbnailUri?: string; thumbnailRemotePath?: string; remotePath?: string; prompt?: QuestPrompt;
  syncState: "pending" | "synced" | "failed"; xp: number; error?: string;
};
export type QuestJourney = { events: JourneyEvent[]; dismissed: string[]; version?: 2; tasks?: import("@/types/content").QuestSideTask[]; ended?: Record<string, number> };
export const emptyJourney = (): QuestJourney => ({ events: [], dismissed: [] });

export function activeElapsedMs(session: { recordingState: string; activeDurationMs: number; activeSince: string | null }, now = Date.now()) {
  return Math.max(0, session.activeDurationMs + (session.recordingState === "recording" && session.activeSince ? Math.max(0, now - Date.parse(session.activeSince)) : 0));
}

/** Only current opportunities are offered; missed intervals never form a backlog. */
export function availablePrompts(elapsed: number, journey: QuestJourney): QuestPrompt[] {
  if (journey.version === 2) return personalizedPrompts(elapsed, journey);
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
  if (event.prompt?.version === 2) {
    if (event.activeElapsedMs < event.prompt.dueMs || event.activeElapsedMs >= (event.prompt.expiresMs ?? Infinity) || (event.prompt.responseKind && event.kind !== event.prompt.responseKind)) throw new Error("This prompt has expired or requires a different response.");
  } else if (event.prompt) {
    const expected = availablePrompts(event.activeElapsedMs, emptyJourney()).find(p => p.id === event.prompt?.id);
    if (!expected || (expected.kind === "capture" ? !["photo", "video"].includes(event.kind) : expected.kind !== event.kind)) throw new Error("This prompt has expired. Your moment can still be saved without bonus XP.");
  }
}

/** Wall time is independent from route recording and survives pause/restart. */
export function journeyElapsedMs(session: { startedAt: string; journey?: QuestJourney; recordingState: string; activeDurationMs: number; activeSince: string | null }, now = Date.now()) {
  return session.journey?.version === 2 ? Math.max(0, now - Date.parse(session.startedAt)) : activeElapsedMs(session, now);
}

export function personalizedPrompts(elapsed: number, journey: QuestJourney): QuestPrompt[] {
  const slot = elapsed < 300000 ? 0 : 1 + Math.floor((elapsed - 300000) / 450000);
  const prompts: QuestPrompt[] = [{ id: `mood:${slot}`, kind: "mood", version: 2, dueMs: slot ? 300000 + (slot - 1) * 450000 : 0, expiresMs: slot ? 300000 + slot * 450000 : 300000, xp: slot ? 10 : 0 }];
  let cursor = 0;
  const tasks = journey.tasks ?? [];
  for (let index = 0; index < (tasks.length || Math.floor(elapsed / 300000) + 1); index++) {
    const task = tasks[index];
    const id = task ? `task:${task.id}` : `generic:${index}`;
    const dueMs = cursor + (task?.waitMinutes ?? 5) * 60000;
    const expiresMs = dueMs + (task?.expiryMinutes ?? 3) * 60000;
    const response = journey.events.find(event => event.prompt?.id === id);
    const ended = journey.ended?.[id] ?? response?.activeElapsedMs;
    if (ended !== undefined) { cursor = Math.min(expiresMs, Math.max(dueMs, ended)); continue; }
    if (elapsed >= expiresMs) { cursor = expiresMs; continue; }
    if (elapsed >= dueMs) prompts.push({ id, version: 2, kind: task?.kind === "note" || (!task && index % 2 === 1) ? "note" : "capture", responseKind: task?.kind, title: task?.title, description: task?.description, dueMs, expiresMs, xp: task?.xp ?? 10 });
    break;
  }
  return prompts.filter(prompt => !journey.dismissed.includes(prompt.id) && !journey.events.some(event => event.prompt?.id === prompt.id || (prompt.id === "mood:0" && event.id === "initial")));
}
