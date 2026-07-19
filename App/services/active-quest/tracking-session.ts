import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "questlife-active-quest.db";

export async function setTrackingSession(sessionId: string | null) {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync("CREATE TABLE IF NOT EXISTS active_quest_tracking (id INTEGER PRIMARY KEY CHECK (id = 1), session_id TEXT)");
  if (sessionId) {
    await database.runAsync("INSERT INTO active_quest_tracking (id, session_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id", sessionId);
  } else {
    await database.runAsync("DELETE FROM active_quest_tracking WHERE id = 1");
  }
}

export async function getTrackingSession() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync("CREATE TABLE IF NOT EXISTS active_quest_tracking (id INTEGER PRIMARY KEY CHECK (id = 1), session_id TEXT)");
  const row = await database.getFirstAsync<{ session_id: string }>("SELECT session_id FROM active_quest_tracking WHERE id = 1");
  return row ? { sessionId: row.session_id } : null;
}
