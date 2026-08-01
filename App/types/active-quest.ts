export type ActiveQuestRecordingState = "recording" | "paused";
export type ActiveQuestRouteSegmentState = "active" | "paused";

export type ActiveQuestLocalSession = {
  sessionId: string;
  questId: string;
  startedAt: string;
  recordingState: ActiveQuestRecordingState;
  pausedAt: string | null;
  activeSince: string | null;
  activeDurationMs: number;
  distanceMeters: number;
  entryTitle: string;
  entryBody: string;
  trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable";
  lastLocationAt: string | null;
  completionSyncState: "idle" | "pending" | "synced";
  routeSegments: ActiveQuestRouteSegment[];
  updatedAt: string;
};

export type ActiveQuestRoutePoint = {
  id: number;
  sessionId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  heading: number | null;
};

export type ActiveQuestRouteSegment = {
  id: string;
  state: ActiveQuestRouteSegmentState;
  startedAt: string;
  endedAt: string | null;
  pointIds: number[];
};

export type ActiveQuestRenderableSegment = {
  id: string;
  state: ActiveQuestRouteSegmentState;
  points: ActiveQuestRoutePoint[];
};

/** Optional quest waypoints for future guided routes; absent for free-roam quests. */
export type ActiveQuestCheckpoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type ActiveQuestSnapshot = {
  session: ActiveQuestLocalSession;
  route: ActiveQuestRoutePoint[];
  renderRoute: ActiveQuestRoutePoint[];
  renderSegments: ActiveQuestRenderableSegment[];
  photoCount: number;
  photos: ActiveQuestPhoto[];
  activity: ActiveQuestActivity[];
};

export type ActiveQuestPhoto = {
  id: number;
  sessionId: string;
  uri: string;
  capturedAt: string;
  syncStatus: "pending" | "uploading" | "synced" | "failed";
  remotePath: string | null;
  /** A bundled onboarding sample that is visible only while teaching the quest flow. */
  isTutorialMock: boolean;
};

export type ActiveQuestActivityKind = "note" | "photo" | "badge";

/** A durable, chronological record of moments captured during a live quest. */
export type ActiveQuestActivity = {
  id: number;
  sessionId: string;
  kind: ActiveQuestActivityKind;
  createdAt: string;
  body: string | null;
  caption: string | null;
  photoId: number | null;
  badgeLabel: string | null;
  /** A local onboarding sample that must not be treated as a user journal entry. */
  isTutorialMock: boolean;
};
