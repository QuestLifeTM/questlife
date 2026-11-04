import type { JournalMemory } from "@/types/journal";
import type { JourneyEvent } from "@/services/active-quest/journey-model";

export type AlbumMedia = {
  id: string;
  kind: "photo" | "video";
  bucket: "journal-media" | "quest-moments";
  path?: string;
  localUri?: string;
  thumbnailPath?: string;
  thumbnailUri?: string;
  capturedAt: string;
};
export type QuestAlbum = {
  id: string;
  completionId?: string;
  sessionId?: string;
  title: string;
  date: string;
  items: AlbumMedia[];
};

export function journeyMedia(events: JourneyEvent[]): AlbumMedia[] {
  return events.filter((event) => event.kind === "photo" || event.kind === "video").map((event) => ({
    id: event.id, kind: event.kind as "photo" | "video", bucket: "quest-moments",
    path: event.remotePath, localUri: event.uri, thumbnailPath: event.thumbnailRemotePath,
    thumbnailUri: event.thumbnailUri, capturedAt: event.capturedAt,
  }));
}

export function mergeAlbumMedia(...sources: AlbumMedia[][]): AlbumMedia[] {
  const merged = new Map<string, AlbumMedia>();
  const identities = new Map<string, string>();
  for (const item of sources.flat()) {
    const identity = item.path ? `${item.bucket}:${item.path}` : item.localUri;
    const key = identities.get(identity ?? "") ?? item.id;
    const previous = merged.get(key);
    merged.set(key, { ...previous, ...item,
      localUri: item.localUri ?? previous?.localUri,
      thumbnailUri: item.thumbnailUri ?? previous?.thumbnailUri,
      path: item.path ?? previous?.path,
      thumbnailPath: item.thumbnailPath ?? previous?.thumbnailPath,
    });
    if (identity) identities.set(identity, key);
  }
  return [...merged.values()].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id));
}

export function memoryAlbum(memory: JournalMemory): QuestAlbum {
  return { id: memory.completionId, completionId: memory.completionId, title: memory.title, date: memory.completedAt,
    items: memory.photoPaths.map((path, index) => ({ id: `legacy:${index}`, kind: "photo", bucket: "journal-media", path, capturedAt: memory.completedAt })) };
}

/** The rotated bounds fit inside the strip even on a narrow iPhone. */
export function albumGeometry(availableWidth: number, count: number) {
  const width = Math.min(availableWidth, 420);
  const cardWidth = Math.max(1, (width - 20) / 3);
  const cardHeight = cardWidth * 4 / 3;
  const step = cardWidth * 2 / 3;
  const visible = Math.min(4, Math.max(0, count));
  return { width, cardWidth, cardHeight, step, visible, height: cardHeight + 22,
    left: (width - (visible ? cardWidth + (visible - 1) * step : 0)) / 2,
    extra: Math.max(0, count - 4) };
}
