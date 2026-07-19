import * as SQLite from "expo-sqlite";

import { ActiveQuestLocalSession, ActiveQuestPhoto, ActiveQuestRecordingState, ActiveQuestRoutePoint, ActiveQuestSnapshot } from "@/types/active-quest";

type SessionRow = {
  session_id: string;
  quest_id: string;
  started_at: string;
  recording_state: ActiveQuestRecordingState;
  paused_at: string | null;
  active_since: string | null;
  active_duration_ms: number;
  distance_meters: number;
  entry_title: string;
  entry_body: string;
  tracking_status: ActiveQuestLocalSession["trackingStatus"];
  last_location_at: string | null;
  updated_at: string;
};

type PointRow = {
  id: number;
  session_id: string;
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
};

type MediaRow = { id: number; session_id: string; uri: string; captured_at: string; sync_status: ActiveQuestPhoto["syncStatus"]; remote_path: string | null };

const DATABASE_NAME = "questlife-active-quest.db";
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function asSession(row: SessionRow): ActiveQuestLocalSession {
  return {
    sessionId: row.session_id,
    questId: row.quest_id,
    startedAt: row.started_at,
    recordingState: row.recording_state,
    pausedAt: row.paused_at,
    activeSince: row.active_since,
    activeDurationMs: row.active_duration_ms,
    distanceMeters: row.distance_meters,
    entryTitle: row.entry_title,
    entryBody: row.entry_body,
    trackingStatus: row.tracking_status,
    lastLocationAt: row.last_location_at,
    updatedAt: row.updated_at,
  };
}

function asPoint(row: PointRow): ActiveQuestRoutePoint {
  return {
    id: row.id,
    sessionId: row.session_id,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    speed: row.speed,
  };
}

function asPhoto(row: MediaRow): ActiveQuestPhoto {
  return { id: row.id, sessionId: row.session_id, uri: row.uri, capturedAt: row.captured_at, syncStatus: row.sync_status, remotePath: row.remote_path };
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS active_quest_sessions (
          session_id TEXT PRIMARY KEY NOT NULL,
          quest_id TEXT NOT NULL,
          started_at TEXT NOT NULL,
          recording_state TEXT NOT NULL,
          paused_at TEXT,
          active_since TEXT,
          active_duration_ms INTEGER NOT NULL DEFAULT 0,
          distance_meters REAL NOT NULL DEFAULT 0,
          entry_title TEXT NOT NULL DEFAULT '',
          entry_body TEXT NOT NULL DEFAULT '',
          tracking_status TEXT NOT NULL DEFAULT 'idle',
          last_location_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS active_quest_route_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          speed REAL,
          FOREIGN KEY (session_id) REFERENCES active_quest_sessions(session_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS active_quest_route_points_session_time
          ON active_quest_route_points(session_id, captured_at);
        CREATE TABLE IF NOT EXISTS active_quest_media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          remote_path TEXT,
          FOREIGN KEY (session_id) REFERENCES active_quest_sessions(session_id) ON DELETE CASCADE
        );
      `);
      return database;
    });
  }
  return databasePromise;
}

export async function ensureActiveQuestSession(input: { sessionId: string; questId: string; startedAt: string; entryTitle: string }) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO active_quest_sessions (session_id, quest_id, started_at, recording_state, active_since, entry_title, updated_at)
     VALUES (?, ?, ?, 'recording', ?, ?, ?)
     ON CONFLICT(session_id) DO NOTHING`,
    input.sessionId,
    input.questId,
    input.startedAt,
    input.startedAt,
    input.entryTitle,
    now,
  );
  return getActiveQuestSession(input.sessionId);
}

export async function getActiveQuestSession(sessionId: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SessionRow>("SELECT * FROM active_quest_sessions WHERE session_id = ?", sessionId);
  return row ? asSession(row) : null;
}

export async function getActiveQuestSnapshot(sessionId: string): Promise<ActiveQuestSnapshot | null> {
  const session = await getActiveQuestSession(sessionId);
  if (!session) return null;
  const database = await getDatabase();
  const [routeRows, photoRows] = await Promise.all([
    database.getAllAsync<PointRow>("SELECT * FROM active_quest_route_points WHERE session_id = ? ORDER BY captured_at ASC", sessionId),
    database.getAllAsync<MediaRow>("SELECT * FROM active_quest_media WHERE session_id = ? ORDER BY captured_at DESC", sessionId),
  ]);
  return { session, route: routeRows.map(asPoint), photoCount: photoRows.length, photos: photoRows.map(asPhoto) };
}

export async function updateActiveQuestSession(sessionId: string, changes: Partial<Pick<ActiveQuestLocalSession, "recordingState" | "pausedAt" | "activeSince" | "activeDurationMs" | "distanceMeters" | "entryTitle" | "entryBody" | "trackingStatus" | "lastLocationAt">>) {
  const current = await getActiveQuestSession(sessionId);
  if (!current) return null;
  const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE active_quest_sessions SET recording_state = ?, paused_at = ?, active_since = ?, active_duration_ms = ?, distance_meters = ?, entry_title = ?, entry_body = ?, tracking_status = ?, last_location_at = ?, updated_at = ? WHERE session_id = ?`,
    next.recordingState,
    next.pausedAt,
    next.activeSince,
    next.activeDurationMs,
    next.distanceMeters,
    next.entryTitle,
    next.entryBody,
    next.trackingStatus,
    next.lastLocationAt,
    next.updatedAt,
    sessionId,
  );
  return next;
}

export async function addRoutePoint(sessionId: string, point: Omit<ActiveQuestRoutePoint, "id" | "sessionId">, distanceDeltaMeters: number) {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "INSERT INTO active_quest_route_points (session_id, captured_at, latitude, longitude, accuracy, speed) VALUES (?, ?, ?, ?, ?, ?)",
      sessionId,
      point.capturedAt,
      point.latitude,
      point.longitude,
      point.accuracy,
      point.speed,
    );
    await transaction.runAsync(
      "UPDATE active_quest_sessions SET distance_meters = distance_meters + ?, last_location_at = ?, tracking_status = 'tracking', updated_at = ? WHERE session_id = ?",
      distanceDeltaMeters,
      point.capturedAt,
      new Date().toISOString(),
      sessionId,
    );
  });
}

export async function getLatestRoutePoint(sessionId: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<PointRow>("SELECT * FROM active_quest_route_points WHERE session_id = ? ORDER BY captured_at DESC LIMIT 1", sessionId);
  return row ? asPoint(row) : null;
}

export async function addActiveQuestPhoto(sessionId: string, uri: string, capturedAt = new Date().toISOString()) {
  const database = await getDatabase();
  const result = await database.runAsync("INSERT INTO active_quest_media (session_id, uri, captured_at) VALUES (?, ?, ?)", sessionId, uri, capturedAt);
  return Number(result.lastInsertRowId);
}

export async function getActiveQuestPhotos(sessionId: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<MediaRow>("SELECT * FROM active_quest_media WHERE session_id = ? ORDER BY captured_at DESC", sessionId);
  return rows.map(asPhoto);
}

export async function updateActiveQuestPhoto(id: number, changes: Partial<Pick<ActiveQuestPhoto, "syncStatus" | "remotePath">>) {
  const database = await getDatabase();
  const current = await database.getFirstAsync<MediaRow>("SELECT * FROM active_quest_media WHERE id = ?", id);
  if (!current) return;
  await database.runAsync("UPDATE active_quest_media SET sync_status = ?, remote_path = ? WHERE id = ?", changes.syncStatus ?? current.sync_status, changes.remotePath ?? current.remote_path, id);
}

export async function clearActiveQuestSession(sessionId: string) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM active_quest_sessions WHERE session_id = ?", sessionId);
}
