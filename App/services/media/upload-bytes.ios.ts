import * as FileSystem from "@/lib/device-files";

/** Native file:// captures are not HTTP responses; read their actual bytes. */
export async function readUploadBytes(uri: string): Promise<ArrayBuffer> {
  let bytes: ArrayBuffer;
  if (/^https?:/i.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Couldn’t download this photo. Please retry.");
    bytes = await response.arrayBuffer();
  } else {
    const encoded = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)).buffer;
  }
  if (!bytes.byteLength) throw new Error("This photo is empty. Please select it again.");
  return bytes;
}
