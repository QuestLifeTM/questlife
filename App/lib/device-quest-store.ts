import * as SQLite from "expo-sqlite";
import * as FileSystem from "@/lib/device-files";
import type { Observation, QuestStoreCommit, StoredQuestData } from "./device-quest-store.types";
const handles = new Map<string, Promise<SQLite.SQLiteDatabase>>();
function open(root: string) {
  let handle = handles.get(root);
  if (!handle) {
    handle = (async () => {
      await FileSystem.makeDirectoryAsync(root, { intermediates: true });
      const db = await SQLite.openDatabaseAsync("recording.sqlite", {}, root);
      await db.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS points (id INTEGER NOT NULL, session TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (session, id));
        CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, session TEXT NOT NULL, value TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS observations_session ON observations(session);`);
      return db;
    })();
    handles.set(root, handle);
    void handle.catch(() => handles.delete(root));
  }
  return handle;
}
export async function readQuestStore(root: string): Promise<StoredQuestData | null> {
  const db = await open(root);
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM snapshot WHERE id = 1");
  if (!row) return null;
  const points = await db.getAllAsync<{ value: string }>("SELECT value FROM points ORDER BY id");
  return { metadata: row.value, points: points.map(p => JSON.parse(p.value)) };
}
export async function commitQuestStore(root: string, data: QuestStoreCommit) {
  const db = await open(root);
  await db.withExclusiveTransactionAsync(async tx => {
    for (const session of data.deletedSessions) {
      await tx.runAsync("DELETE FROM points WHERE session = ?", session);
      await tx.runAsync("DELETE FROM observations WHERE session = ?", session);
    }
    for (const point of data.points) await tx.runAsync("INSERT OR REPLACE INTO points VALUES (?, ?, ?)", point.id, point.sessionId, JSON.stringify(point));
    if (data.observation) await tx.runAsync("INSERT OR IGNORE INTO observations VALUES (?, ?, ?)", data.observation.key, data.observation.sessionId, JSON.stringify(data.observation));
    await tx.runAsync("INSERT OR REPLACE INTO snapshot VALUES (1, ?)", data.metadata);
  });
}
export async function readQuestObservations(root: string, sessionId: string): Promise<Observation[]> {
  const db = await open(root);
  const rows = await db.getAllAsync<{ value: string }>("SELECT value FROM observations WHERE session = ? ORDER BY rowid", sessionId);
  return rows.map(row => JSON.parse(row.value));
}
export async function closeQuestStore(root: string) {
  const db = handles.get(root);
  handles.delete(root);
  if (db) await (await db).closeAsync();
}
