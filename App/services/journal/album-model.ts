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
  category?: string;
  grouped?: boolean;
};
export type AlbumGrouping = "quest" | "week" | "month" | "category";

export function groupAlbums(albums: QuestAlbum[], grouping: AlbumGrouping): QuestAlbum[] {
  if (grouping === "quest") return albums;
  const groups = new Map<string, QuestAlbum>();
  const seen = new Set<string>();
  for (const album of albums) for (const item of album.items) {
    const identity = item.path ? `${item.bucket}:${item.path}` : item.localUri ?? `${album.id}:${item.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const captured = new Date(item.capturedAt || album.date);
    const date = Number.isNaN(captured.getTime()) ? new Date(album.date) : captured;
    const start = new Date(date.getFullYear(), date.getMonth(), grouping === "month" ? 1 : date.getDate());
    if (grouping === "week") start.setDate(start.getDate() - start.getDay());
    const key = grouping === "category" ? album.category ?? "Other" : `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const format = (value: Date) => value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const title = grouping === "category" ? key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, " ")
      : grouping === "month" ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${format(start)} – ${format(end)}`;
    const group = groups.get(key) ?? { id: `${grouping}:${key}`, title, date: start.toISOString(), items: [], grouped: true };
    group.items.push({ ...item, id: `${album.id}:${item.id}` });
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, items: group.items.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => grouping === "category" ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date));
}

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
  return { id: memory.completionId, completionId: memory.completionId, title: memory.title, date: memory.completedAt, category: memory.category,
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
