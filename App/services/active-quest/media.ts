import * as FileSystem from "expo-file-system/legacy";

import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { addActiveQuestPhoto, getActiveQuestPhotos, updateActiveQuestPhoto } from "@/services/active-quest/local-store";

export async function persistQuestPhoto(sessionId: string, temporaryUri: string) {
  const root = `${FileSystem.documentDirectory}active-quests/${sessionId}`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const uri = `${root}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: temporaryUri, to: uri });
  const photoId = await addActiveQuestPhoto(sessionId, uri);
  void syncQuestPhoto(photoId, uri);
  return uri;
}

async function syncQuestPhoto(id: number, uri: string) {
  try {
    await updateActiveQuestPhoto(id, { syncStatus: "uploading" });
    const remotePath = await uploadQuestPhoto(uri);
    await updateActiveQuestPhoto(id, { syncStatus: "synced", remotePath });
  } catch {
    // The local file and its pending row remain durable. A later app launch or
    // active-quest visit retries it without losing the captured memory.
    await updateActiveQuestPhoto(id, { syncStatus: "failed" });
  }
}

export async function retryQuestPhotoSync(sessionId: string) {
  const photos = await getActiveQuestPhotos(sessionId);
  await Promise.all(photos.filter((photo) => photo.syncStatus !== "synced").map((photo) => syncQuestPhoto(photo.id, photo.uri)));
}
