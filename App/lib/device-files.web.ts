// IndexedDB preserves owner-scoped quest drafts and media across reloads.
// Keep the native file API shape so business logic has one implementation.
export const documentDirectory = "questlife-local://documents/";
export const cacheDirectory = "questlife-local://cache/";
export const EncodingType = { Base64: "base64", UTF8: "utf8" } as const;
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("questlife-device-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const request = run(tx.objectStore("files"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Browser storage is unavailable."));
  });
}
export async function readAsStringAsync(uri: string, _options?: unknown): Promise<string> {
  const result = await operation("readonly", (store) => store.get(uri));
  if (typeof result !== "string") throw new Error("Local file not found.");
  return result;
}
export async function writeAsStringAsync(uri: string, value: string, _options?: unknown) {
  await operation("readwrite", (store) => store.put(value, uri));
}
export async function makeDirectoryAsync(_uri: string, _options?: unknown) { /* Keys are paths; directories are implicit. */ }
export async function getInfoAsync(uri: string) {
  const value = await operation("readonly", (store) => store.get(uri));
  return { exists: value !== undefined, uri, isDirectory: false, size: typeof value === "string" ? value.length : 0 };
}
export async function deleteAsync(uri: string, _options?: unknown) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.key === uri || String(cursor.key).startsWith(`${uri.replace(/\/$/, "")}/`)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function copyAsync({ from, to }: { from: string; to: string }) {
  const value = from.startsWith("questlife-local:") ? await readAsStringAsync(from) : await toDataUrl(from);
  await writeAsStringAsync(to, value);
}
export async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (uri.startsWith("questlife-local:")) return readAsStringAsync(uri);
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Could not read the selected photo.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}
