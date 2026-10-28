import type { Observation, QuestStoreCommit, StoredQuestData } from "./device-quest-store.types";
// Share the existing owner-scoped file database so account erasure removes all data.
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("questlife-device-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
export async function readQuestStore(root: string): Promise<StoredQuestData | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").get(`${root}/recording-v3`);
    tx.oncomplete = () => resolve(request.result ?? null);
    tx.onerror = () => reject(tx.error);
  });
}
export async function commitQuestStore(root: string, data: QuestStoreCommit) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const request = store.get(`${root}/recording-v3`);
    request.onsuccess = () => {
      const previous = request.result as StoredQuestData | undefined;
      const points = new Map((previous?.points ?? []).filter(p => !data.deletedSessions.includes(p.sessionId)).map(p => [p.id, p]));
      for (const p of data.points) points.set(p.id, p);
      store.put({ metadata: data.metadata, points: [...points.values()] }, `${root}/recording-v3`);
      if (data.observation) store.put(data.observation, `${root}/observations/${data.observation.sessionId}/${data.observation.key}`);
      for (const sessionId of data.deletedSessions) {
        const prefix = `${root}/observations/${sessionId}/`;
        const cursor = store.openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
        cursor.onsuccess = () => { const c = cursor.result; if (c) { c.delete(); c.continue(); } };
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Could not save route on this device."));
  });
}
export async function readQuestObservations(root: string, sessionId: string): Promise<Observation[]> {
  const db = await open();
  const prefix = `${root}/observations/${sessionId}/`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").getAll(IDBKeyRange.bound(prefix, prefix + "\uffff"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}
export async function closeQuestStore(_root: string) { /* Shared IndexedDB lifecycle. */ }
