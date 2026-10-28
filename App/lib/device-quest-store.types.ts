import type { ActiveQuestRoutePoint } from "@/types/active-quest";
import type { LocationSample, MeasurementDecision } from "@/services/active-quest/measurement";
export type Observation = { key: string; sessionId: string; windowId: string; startedAt: number; receivedAt: number; sample: LocationSample; decision?: MeasurementDecision; algorithmVersion: string };
export type QuestStoreCommit = { metadata: string; points: ActiveQuestRoutePoint[]; deletedSessions: string[]; observation?: Observation };
export type StoredQuestData = { metadata: string; points: ActiveQuestRoutePoint[] };
