import * as FileSystem from "@/lib/device-files";
import { localUserRoot } from "@/services/local-data/lifecycle";
import { areLocalDataWritesBlocked, getLocalDataOwner } from "@/services/local-data/owner";

export const MOOD_NOTE_LIMIT = 1000;

function notePath(ownerId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid journal date.");
  return `${localUserRoot(ownerId)}/mood-notes/${date}.json`;
}

function assertOwner(ownerId: string) {
  if (getLocalDataOwner() !== ownerId || areLocalDataWritesBlocked(ownerId)) {
    throw new Error("Your session changed. Reopen the journal to continue.");
  }
}

/** Native-only notes live under the account's existing logout/deletion boundary. */
export async function readMoodNote(ownerId: string, date: string): Promise<string> {
  assertOwner(ownerId);
  const path = notePath(ownerId, date);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return "";
  const value: unknown = JSON.parse(await FileSystem.readAsStringAsync(path));
  assertOwner(ownerId);
  if (typeof value !== "string") throw new Error("Your saved note could not be read.");
  return value;
}

export async function writeMoodNote(ownerId: string, date: string, note: string) {
  assertOwner(ownerId);
  if (note.length > MOOD_NOTE_LIMIT) throw new Error("Keep your note under 1,000 characters.");
  const path = notePath(ownerId, date);
  const directory = `${localUserRoot(ownerId)}/mood-notes`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  assertOwner(ownerId);
  // Write a temporary file first so a failed write cannot truncate the previous note.
  const temporary = `${path}.pending`;
  await FileSystem.writeAsStringAsync(temporary, JSON.stringify(note));
  assertOwner(ownerId);
  await FileSystem.moveAsync({ from: temporary, to: path });
  if (getLocalDataOwner() !== ownerId || areLocalDataWritesBlocked(ownerId)) {
    await FileSystem.deleteAsync(directory, { idempotent: true });
    throw new Error("Your session changed. Reopen the journal to continue.");
  }
}
