import * as FileSystem from "expo-file-system/legacy";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as MediaLibrary from "expo-media-library";

import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { addActiveQuestPhoto, getActiveQuestPhotos, updateActiveQuestPhoto } from "@/services/active-quest/local-store";
import { compressFeedImage } from "@/services/media/feed-image";

export async function persistQuestPhoto(sessionId: string, temporaryUri: string) {
  // The system camera returns a temporary URI on some Android devices. Save it
  // to the user's library first, then preserve a stable private copy for the
  // quest album and eventual upload.
  if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
    try {
      const mediaPermission = await MediaLibrary.requestPermissionsAsync(true);
      if (mediaPermission.granted) await MediaLibrary.saveToLibraryAsync(temporaryUri);
    } catch {
      // The system camera may have already saved the capture. A media-library
      // issue must never prevent the photo from being added to this quest.
    }
  }
  // Keep a display-ready JPEG in the quest store. This substantially reduces
  // upload and scrolling cost without changing the original camera roll copy.
  let compressedUri = temporaryUri;
  try {
    compressedUri = await compressFeedImage(temporaryUri);
  } catch {
    // Preserve the moment even if a device cannot transform this camera file.
  }
  const root = `${FileSystem.documentDirectory}active-quests/${sessionId}`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const uri = `${root}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: compressedUri, to: uri });
  const photoId = await addActiveQuestPhoto(sessionId, uri);
  void syncQuestPhoto(photoId, uri);
  return { id: photoId, uri };
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
