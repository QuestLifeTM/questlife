import * as FileSystem from "@/lib/device-files";
import { supabase } from "@/lib/supabase";
import { getLocalDataOwner } from "@/services/local-data/owner";
import { getCompletedLocalJourney } from "@/services/active-quest/local-store.ios";
import type { JourneyEvent } from "@/services/active-quest/journey-model";
import type { JournalData } from "@/types/journal";
import { journeyMedia, memoryAlbum, mergeAlbumMedia, type AlbumMedia, type QuestAlbum } from "./album-model";

let cachedOwner: string | null = null;
let completedCache: { owner: string; albums: QuestAlbum[]; warning?: string } | undefined;
const signedCache = new Map<string, { uri: string; expires: number }>();
const signing = new Map<string, Promise<{ uri?: string; error?: string }>>();
function prepareCache() {
  const owner = getLocalDataOwner();
  if (owner !== cachedOwner) {
    signedCache.clear(); signing.clear(); completedCache = undefined; cachedOwner = owner;
  }
  return owner;
}
export function getCachedCompletedAlbums() {
  prepareCache();
  return completedCache;
}
export function getCachedAlbumMedia(items: AlbumMedia[]): ResolvedAlbumMedia[] {
  prepareCache();
  return items.map(item => {
    const path = item.kind === "video" ? item.thumbnailPath : item.path;
    const cached = signedCache.get(`${item.bucket}:${path}`);
    return { ...item, previewUri: cached && cached.expires > Date.now() ? cached.uri : undefined };
  });
}

function assertOwner(owner: string | null) {
  if (!owner || getLocalDataOwner() !== owner) throw new Error("Your account changed. Reopen your album.");
}

export async function loadCompletedAlbums(data: JournalData) {
  const owner = getLocalDataOwner();
  assertOwner(owner);
  const albums = Object.values(data.memoriesByDate).flat().map(memoryAlbum);
  let warning: string | undefined;
  type Session = { id: string; completion_id: string | null; quest_id: string; ended_at: string | null };
  const sessions: Session[] = [];
  const memories = Object.values(data.memoriesByDate).flat();
  try {
    for (let from = 0; ; from += 500) {
      const result = await supabase.from("quest_sessions").select("id, completion_id, quest_id, ended_at")
        .eq("user_id", owner!).eq("status", "completed").order("id").range(from, from + 499);
      if (result.error) throw result.error;
      sessions.push(...result.data);
      if (result.data.length < 500) break;
    }
    const used = new Set<string>();
    for (const album of albums) {
      let session = sessions.find(s => s.completion_id === album.completionId);
      if (!session) {
        const memory = memories.find(m => m.completionId === album.completionId)!;
        session = sessions.filter(s => !s.completion_id && !used.has(s.id) && s.quest_id === memory.questId && s.ended_at && Math.abs(Date.parse(s.ended_at) - Date.parse(memory.completedAt)) <= 1000)
          .sort((a, b) => Math.abs(Date.parse(a.ended_at!) - Date.parse(memory.completedAt)) - Math.abs(Date.parse(b.ended_at!) - Date.parse(memory.completedAt)))[0];
      }
      if (session) { album.sessionId = session.id; used.add(session.id); }
    }
    const bySession = new Map(albums.filter(a => a.sessionId).map(a => [a.sessionId!, a]));
    const ids = [...bySession.keys()];
    for (let offset = 0; offset < ids.length; offset += 100) {
      for (let from = 0; ; from += 500) {
        const result = await supabase.from("quest_journey_events").select("session_id, event")
          .in("session_id", ids.slice(offset, offset + 100)).order("session_id").order("active_elapsed_ms").order("client_event_id").range(from, from + 499);
        if (result.error) throw result.error;
        for (const row of result.data) {
          const album = bySession.get(row.session_id);
          if (album) album.items = mergeAlbumMedia(album.items, journeyMedia([row.event as JourneyEvent]));
        }
        if (result.data.length < 500) break;
      }
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    warning = ["42P01", "42703", "PGRST204", "PGRST205"].includes(code ?? "")
      ? "This app’s backend needs the quest media update. Saved photos are still shown."
      : "Some quest media couldn’t sync. Your saved photos are still shown. Try again.";
  }
  // Local pending captures survive completion and remain visible while the outbox retries.
  for (const album of albums) {
    const local = await getCompletedLocalJourney(album.completionId!);
    assertOwner(owner);
    if (local) album.items = mergeAlbumMedia(album.items, journeyMedia(local.events));
  }
  assertOwner(owner);
  prepareCache();
  completedCache = { owner: owner!, albums, warning };
  return { albums, warning };
}

export async function availableLocalUri(uri?: string): Promise<string | undefined> {
  if (!uri || /^https?:/i.test(uri)) return undefined;
  try { return (await FileSystem.getInfoAsync(uri)).exists ? uri : undefined; } catch { return undefined; }
}

export type ResolvedAlbumMedia = AlbumMedia & { previewUri?: string; error?: string };
/** fullMedia resolves the playable video; default resolution stays thumbnail-only for album strips. */
export async function resolveAlbumMedia(items: AlbumMedia[], preferRemote = false, fullMedia = false): Promise<ResolvedAlbumMedia[]> {
  const owner = prepareCache();
  assertOwner(owner);
  const resolved = await Promise.all(items.map(async (item): Promise<ResolvedAlbumMedia> => {
    const local = await availableLocalUri(item.kind === "video" && !fullMedia ? item.thumbnailUri : item.localUri);
    if (local && !preferRemote) return { ...item, previewUri: local };
    const path = item.kind === "video" && !fullMedia ? item.thumbnailPath : item.path;
    if (!path && local) return { ...item, previewUri: local };
    if (!path) return { ...item, error: item.kind === "video" ? undefined : "Media is waiting to upload." };
    if (/^https?:/i.test(path)) {
      // Stored signed URLs from older builds must be renewed, not reused forever.
      const match = path.match(/\/storage\/v1\/object\/(?:sign|authenticated)\/(journal-media|quest-moments)\/(.*?)(?:\?|$)/);
      if (!match) return { ...item, previewUri: path };
      return sign(item, match[1] as AlbumMedia["bucket"], decodeURIComponent(match[2]), preferRemote);
    }
    return sign(item, item.bucket, path, preferRemote);
  }));
  assertOwner(owner);
  return resolved;
}

async function sign(item: AlbumMedia, bucket: AlbumMedia["bucket"], path: string, force = false): Promise<ResolvedAlbumMedia> {
  const owner = prepareCache();
  const key = `${bucket}:${path}`;
  const cached = signedCache.get(key);
  if (!force && cached && cached.expires > Date.now()) return { ...item, previewUri: cached.uri };
  let task = !force ? signing.get(key) : undefined;
  if (!task) {
    task = (async () => {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 1800);
        if (error) {
          const message = error.message.toLowerCase();
          return { error: message.includes("not found") ? "Saved media could not be found." : "Couldn’t access saved media. Tap to retry." };
        }
        if (getLocalDataOwner() === owner && cachedOwner === owner) {
          // Bounded, owner-scoped cache; never persist signed URLs to the database.
          if (signedCache.size >= 512) signedCache.delete(signedCache.keys().next().value!);
          signedCache.set(key, { uri: data.signedUrl, expires: Date.now() + 24 * 60_000 });
        }
        return { uri: data.signedUrl };
      } catch { return { error: "Connection interrupted. Tap to retry." }; }
    })();
    signing.set(key, task);
  }
  try {
    const result = await task;
    return { ...item, previewUri: result.uri, error: result.error };
  } finally { if (signing.get(key) === task) signing.delete(key); }
}
