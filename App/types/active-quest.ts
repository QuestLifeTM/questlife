export type ActiveQuestRecordingState = "recording" | "paused";

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
};

export type ActiveQuestSnapshot = {
  session: ActiveQuestLocalSession;
  route: ActiveQuestRoutePoint[];
  photoCount: number;
  photos: ActiveQuestPhoto[];
};

export type ActiveQuestPhoto = {
  id: number;
  sessionId: string;
  uri: string;
  capturedAt: string;
  syncStatus: "pending" | "uploading" | "synced" | "failed";
  remotePath: string | null;
};
