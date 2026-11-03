import { syncActiveQuestRecord } from "./sync.ios";
import * as Crypto from "expo-crypto";
import * as FileSystem from "@/lib/device-files";
import { supabase } from "@/lib/supabase";
import { localUserRoot } from "@/services/local-data/lifecycle";
import { requireLocalDataOwner, getLocalDataOwner, areLocalDataWritesBlocked } from "@/services/local-data/owner";
import { getCompletedLocalJourney, getActiveQuestSnapshot, putJourneyEvent, updateJourneyEvent } from "./local-store.ios";
import { emptyJourney, validateJourneyEvent, type JourneyEvent, type QuestJourney } from "./journey-model";

const BUCKET = "quest-moments";
const syncing = new Map<string, Promise<void>>();
function assertOwner(owner: string) {
  if (getLocalDataOwner() !== owner || areLocalDataWritesBlocked(owner)) throw new Error("Your account changed. Reopen the quest to continue.");
}

export async function saveJourneyEvent(sessionId: string, input: Omit<JourneyEvent, "id" | "capturedAt" | "syncState" | "xp"> & { id?: string; capturedAt?: string }) {
  const owner = requireLocalDataOwner();
  const event: JourneyEvent = { ...input, id: input.id ?? input.prompt?.id ?? Crypto.randomUUID(), capturedAt: input.capturedAt ?? new Date().toISOString(), syncState: "pending", xp: 0 };
  validateJourneyEvent(event);
  const prior = (await getActiveQuestSnapshot(sessionId))?.session.journey?.events.find(e => e.id === event.id);
  if (prior) return prior;
  if (event.uri && !event.uri.startsWith("https:")) {
    const root = `${localUserRoot(owner)}/active-quests/${sessionId}/moments`;
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    const extension = event.kind === "video" ? (event.uri.toLowerCase().endsWith(".mov") ? "mov" : "mp4") : "jpg";
    const uri = `${root}/${encodeURIComponent(event.id)}.${extension}`;
    await FileSystem.copyAsync({ from: event.uri, to: uri });
    assertOwner(owner);
    event.uri = uri;
    event.mimeType = event.kind === "video" ? (extension === "mov" ? "video/quicktime" : "video/mp4") : "image/jpeg";
  }
  assertOwner(owner);
  const saved = await putJourneyEvent(sessionId, event);
  void syncQuestJourney(sessionId).catch(() => undefined);
  return saved;
}

/** Owner/session serialized outbox. Stable object paths and RPC IDs make lost responses safe. */
export function syncQuestJourney(sessionId: string): Promise<void> {
  const owner = requireLocalDataOwner();
  if (owner === "guest") return Promise.resolve();
  const key = `${owner}:${sessionId}`;
  const previous = syncing.get(key) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    assertOwner(owner);
    const snapshot = await getActiveQuestSnapshot(sessionId);
    if (!snapshot?.session.journey?.events.some(event => event.syncState !== "synced")) return;
    await syncActiveQuestRecord(sessionId);
    for (const event of snapshot?.session.journey?.events ?? []) {
      if (event.syncState === "synced") continue;
      try {
        assertOwner(owner);
        let thumbnailUri = event.thumbnailUri;
        let thumbnailRemotePath = event.thumbnailRemotePath;
        if (event.kind === "video" && event.uri && !thumbnailUri) {
          // Optional thumbnail work runs after the durable save, never on the camera transition.
          try {
            const { createVideoPlayer } = await import("expo-video");
            const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
            const player = createVideoPlayer(event.uri);
            try {
              const [frame] = await player.generateThumbnailsAsync(0, { maxWidth: 480 });
              assertOwner(owner);
              const rendered = await ImageManipulator.manipulate(frame).resize({ width: 480 }).renderAsync();
              const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
              thumbnailUri = `${localUserRoot(owner)}/active-quests/${sessionId}/moments/${encodeURIComponent(event.id)}.thumb.jpg`;
              await FileSystem.makeDirectoryAsync(`${localUserRoot(owner)}/active-quests/${sessionId}/moments`, { intermediates: true });
              await FileSystem.copyAsync({ from: image.uri, to: thumbnailUri });
              assertOwner(owner);
              await updateJourneyEvent(sessionId, event.id, { thumbnailUri });
            } finally { player.release(); }
          } catch { assertOwner(owner); /* A missing poster must not lose the video. */ }
        }
        if (thumbnailUri && !thumbnailRemotePath) {
          try {
            const bytes = Uint8Array.from(atob(await FileSystem.readAsStringAsync(thumbnailUri, { encoding: FileSystem.EncodingType.Base64 })), c => c.charCodeAt(0));
            assertOwner(owner);
            const path = `${owner}/${sessionId}/${encodeURIComponent(event.id)}.thumb.jpg`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
            if (!error) { thumbnailRemotePath = path; assertOwner(owner); await updateJourneyEvent(sessionId, event.id, { thumbnailRemotePath }); }
          } catch { assertOwner(owner); }
        }
        let remotePath = event.remotePath;
        if (event.uri && !remotePath) {
          const extension = event.mimeType === "video/quicktime" ? "mov" : event.kind === "video" ? "mp4" : "jpg";
          remotePath = `${owner}/${sessionId}/${encodeURIComponent(event.id)}.${extension}`;
          const base64 = await FileSystem.readAsStringAsync(event.uri, { encoding: FileSystem.EncodingType.Base64 });
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          assertOwner(owner);
          const uploaded = await supabase.storage.from(BUCKET).upload(remotePath, bytes, { contentType: event.mimeType, upsert: true });
          if (uploaded.error) throw uploaded.error;
          assertOwner(owner);
          await updateJourneyEvent(sessionId, event.id, { remotePath });
        }
        assertOwner(owner);
        const result = await supabase.rpc("save_quest_journey_event", { p_session_id: sessionId, p_event: {
          id: event.id, kind: event.kind, mood: event.mood, body: event.body, capturedAt: event.capturedAt,
          activeElapsedMs: Math.floor(event.activeElapsedMs), promptId: event.prompt?.id,
          storagePath: remotePath, thumbnailPath: thumbnailRemotePath, mimeType: event.mimeType, durationSeconds: event.durationSeconds,
        } });
        if (result.error) throw result.error;
        assertOwner(owner);
        await updateJourneyEvent(sessionId, event.id, { syncState: "synced", xp: result.data?.xp ?? 0, error: undefined });
      } catch (error) {
        assertOwner(owner);
        await updateJourneyEvent(sessionId, event.id, { syncState: "failed", error: "Saved on this device. Sync will retry; bonus XP is pending." });
        throw error;
      }
    }
  });
  syncing.set(key, task);
  void task.finally(() => { if (syncing.get(key) === task) syncing.delete(key); }).catch(() => undefined);
  return task;
}

export async function fetchQuestJourney(sessionId: string): Promise<QuestJourney> {
  const owner = requireLocalDataOwner();
  const { data, error } = await supabase.from("quest_journey_events").select("event").eq("session_id", sessionId).order("active_elapsed_ms");
  if (error) throw error;
  const events = await Promise.all((data ?? []).map(async row => {
    const event = row.event as JourneyEvent;
    if (event.remotePath) {
      const { data: media, error: mediaError } = await supabase.storage.from(BUCKET).createSignedUrl(event.remotePath, 3600);
      if (mediaError) throw mediaError;
      event.uri = media.signedUrl;
      if (event.thumbnailRemotePath) {
        const { data: poster } = await supabase.storage.from(BUCKET).createSignedUrl(event.thumbnailRemotePath, 3600);
        event.thumbnailUri = poster?.signedUrl;
      }
    }
    return { ...event, syncState: "synced" as const };
  }));
  assertOwner(owner);
  return { ...emptyJourney(), events };
}

export async function hydrateQuestJourney(sessionId: string) {
  const journey = await fetchQuestJourney(sessionId);
  for (const event of journey.events) await putJourneyEvent(sessionId, event, true);
}

export async function fetchCompletedQuestJourney(completionId: string) {
  const local = await getCompletedLocalJourney(completionId);
  try {
    const { data, error } = await supabase.from("quest_sessions").select("id").eq("completion_id", completionId).maybeSingle();
    if (error) throw error;
    if (!data) return local ?? emptyJourney();
    const remote = await fetchQuestJourney(data.id);
    const events = new Map(remote.events.map(event => [event.id, event]));
    for (const event of local?.events ?? []) {
      const synced = events.get(event.id);
      events.set(event.id, synced ? { ...synced, uri: event.uri ?? synced.uri, thumbnailUri: event.thumbnailUri ?? synced.thumbnailUri } : event);
    }
    return { ...remote, events: [...events.values()] };
  } catch (error) {
    if (local) return local;
    throw error;
  }
}
