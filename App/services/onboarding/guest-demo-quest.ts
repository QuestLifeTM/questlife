import { secureAuthStorage } from "@/lib/secureAuthStorage";
import { ActiveQuestSession } from "@/types/engine";

const GUEST_DEMO_QUEST_KEY = "questlife.onboarding.guest-demo-quest.v1";
const GUEST_ACTIVE_QUEST_KEY = "questlife.onboarding.guest-active-quest.v1";
const GUEST_ACTIVE_QUEST_TUTORIAL_KEY = "questlife.onboarding.guest-active-quest-tutorial.v1";

export type GuestDemoQuest = {
  completedAt: string;
  title: string;
  durationSeconds: number;
};

/**
 * Keeps the completed demo available across the sign-up flow without creating
 * an unauthenticated remote quest record. Account linking can safely consume
 * this handoff after the user has authenticated.
 */
export async function saveGuestDemoQuest(quest: GuestDemoQuest) {
  await secureAuthStorage.setItem(GUEST_DEMO_QUEST_KEY, JSON.stringify(quest));
}

export async function getGuestDemoQuest(): Promise<GuestDemoQuest | null> {
  const raw = await secureAuthStorage.getItem(GUEST_DEMO_QUEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GuestDemoQuest>;
    if (!parsed.completedAt || !parsed.title || typeof parsed.durationSeconds !== "number") return null;
    return { completedAt: parsed.completedAt, title: parsed.title, durationSeconds: parsed.durationSeconds };
  } catch {
    return null;
  }
}

export async function saveGuestActiveQuest(session: ActiveQuestSession) {
  await secureAuthStorage.setItem(GUEST_ACTIVE_QUEST_KEY, JSON.stringify(session));
}

export async function getGuestActiveQuest(): Promise<ActiveQuestSession | null> {
  const raw = await secureAuthStorage.getItem(GUEST_ACTIVE_QUEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveQuestSession>;
    if (!parsed.id || !parsed.questId || !parsed.startedAt || !parsed.source) return null;
    return { id: parsed.id, questId: parsed.questId, startedAt: parsed.startedAt, source: parsed.source };
  } catch {
    return null;
  }
}

export async function clearGuestActiveQuest() {
  await secureAuthStorage.removeItem(GUEST_ACTIVE_QUEST_KEY);
}

/** Keeps the one-time guest walkthrough from restarting after an app reload. */
export async function getGuestActiveQuestTutorialComplete() {
  return (await secureAuthStorage.getItem(GUEST_ACTIVE_QUEST_TUTORIAL_KEY)) === "complete";
}

export async function markGuestActiveQuestTutorialComplete() {
  await secureAuthStorage.setItem(GUEST_ACTIVE_QUEST_TUTORIAL_KEY, "complete");
}

export async function clearGuestActiveQuestTutorialComplete() {
  await secureAuthStorage.removeItem(GUEST_ACTIVE_QUEST_TUTORIAL_KEY);
}
