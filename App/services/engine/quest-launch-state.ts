/** Native start-flow handoff. Never persisted: restored sessions retain their normal recovery path. */
export type QuestLaunchState = {
  questId: string;
  sessionId: string | null;
  phase: "preparing" | "countdown" | "complete" | "handed-off";
};
let launch: QuestLaunchState | null = null;
const listeners = new Set<() => void>();
const publish = (next: QuestLaunchState | null) => { launch = next; listeners.forEach(listener => listener()); };
export const getQuestLaunchState = () => launch;
export function subscribeQuestLaunch(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function prepareQuestLaunch(questId: string) { publish({ questId, sessionId: null, phase: "preparing" }); }
export function startQuestLaunchCountdown(questId: string, sessionId: string) {
  if (launch?.questId !== questId) return;
  publish({ questId, sessionId, phase: "countdown" });
}
export function completeQuestLaunch(sessionId: string) {
  if (launch?.sessionId !== sessionId || launch.phase !== "countdown") return false;
  publish({ ...launch, phase: "complete" });
  return true;
}
/** Atomically claim the timer/route handoff, including across overlapping screen mounts. */
export function claimQuestLaunch(sessionId: string) {
  if (launch?.sessionId !== sessionId || launch.phase !== "complete") return false;
  publish({ ...launch, phase: "handed-off" });
  return true;
}
export function cancelQuestLaunch(questId: string) {
  if (launch?.questId === questId && (launch.phase === "preparing" || launch.phase === "countdown")) publish(null);
}
export function isQuestLaunchWaiting(questId: string) {
  return launch?.questId === questId && (launch.phase === "preparing" || launch.phase === "countdown");
}
