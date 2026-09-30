import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from "expo-crypto";

import { getAllActiveQuestSnapshots, hydrateActiveQuestRecord } from "@/services/active-quest/local-store";
import { localOutboxKey, localOutboxRoot } from "@/services/local-data/lifecycle";
import { requireLocalDataOwner } from "@/services/local-data/owner";
import { ActiveQuestSnapshot } from "@/types/active-quest";

const OUTBOX_FILE = "pending-active-quest.json";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

type OutboxPayload = {
  ownerId: string;
  snapshots: ActiveQuestSnapshot[];
  photos: Array<{ sessionId: string; photoId: number; fileName: string; base64: string }>;
};
type EncryptedOutbox = { ownerId: string; createdAt: string; expiresAt: string; iv: string; ciphertext: string; tag: string };

function outboxUri(userId: string) { return `${localOutboxRoot(userId)}/${OUTBOX_FILE}`; }
async function getDeviceOutboxKey() {
  const keyName = "questlife.outbox-master-key.v1";
  const stored = await SecureStore.getItemAsync(keyName);
  if (stored) return stored;
  const key = await AESEncryptionKey.generate(256).then((generated) => generated.encoded("base64"));
  await SecureStore.setItemAsync(keyName, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return key;
}

async function getOutboxEncryptionKey() {
  return AESEncryptionKey.import(await getDeviceOutboxKey(), "base64");
}

/** Encrypts the current owner's plaintext quest files before an offline logout. */
export async function createEncryptedLogoutOutbox(userId: string) {
  if (requireLocalDataOwner() !== userId) throw new Error("Outbox owner mismatch.");
  const snapshots = (await getAllActiveQuestSnapshots()).filter((snapshot): snapshot is ActiveQuestSnapshot => Boolean(snapshot));
  const photos: OutboxPayload["photos"] = [];
  for (const snapshot of snapshots) {
    for (const photo of snapshot.photos) {
      if (!photo.uri.startsWith("file:")) continue;
      try {
        photos.push({ sessionId: snapshot.session.sessionId, photoId: photo.id, fileName: `${photo.id}.jpg`, base64: await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 }) });
      } catch {
        // A missing local copy is already represented by its sync status and
        // must not prevent secure handoff of the rest of the quest.
      }
    }
  }
  if (!snapshots.length) return false;
  const payload: OutboxPayload = { ownerId: userId, snapshots, photos };
  // AES-GCM authenticates ciphertext and binds the account ID as associated
  // data, so an outbox cannot be altered or restored for another account.
  const sealed = await aesEncryptAsync(new TextEncoder().encode(JSON.stringify(payload)), await getOutboxEncryptionKey(), {
    nonce: { length: 12 },
    additionalData: new TextEncoder().encode(userId),
    tagLength: 16,
  });
  const [iv, ciphertext, tag] = await Promise.all([
    sealed.iv("base64") as Promise<string>,
    sealed.ciphertext({ encoding: "base64", includeTag: false }) as Promise<string>,
    sealed.tag("base64") as Promise<string>,
  ]);
  const now = Date.now();
  const record: EncryptedOutbox = { ownerId: userId, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + RETENTION_MS).toISOString(), iv, ciphertext, tag };
  await FileSystem.makeDirectoryAsync(localOutboxRoot(userId), { intermediates: true });
  await FileSystem.writeAsStringAsync(outboxUri(userId), JSON.stringify(record));
  await SecureStore.setItemAsync(localOutboxKey(userId), record.expiresAt, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return true;
}

/** Restores an unexpired outbox only for its original authenticated owner. */
export async function restoreEncryptedLogoutOutbox(userId: string) {
  if (requireLocalDataOwner() !== userId) return false;
  try {
    const raw = await FileSystem.readAsStringAsync(outboxUri(userId));
    const record = JSON.parse(raw) as EncryptedOutbox;
    if (record.ownerId !== userId || new Date(record.expiresAt).getTime() <= Date.now()) {
      await discardEncryptedLogoutOutbox(userId);
      return false;
    }
    if (!record.tag) throw new Error("Outbox authentication tag is missing.");
    const sealed = AESSealedData.fromParts(record.iv, record.ciphertext, record.tag);
    const plaintext = await aesDecryptAsync(sealed, await getOutboxEncryptionKey(), {
      additionalData: new TextEncoder().encode(userId),
    });
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as OutboxPayload;
    if (payload.ownerId !== userId) throw new Error("Outbox owner mismatch.");
    for (const saved of payload.photos) {
      const target = `${FileSystem.documentDirectory}questlife/v2/users/${encodeURIComponent(userId)}/active-quests/${saved.sessionId}/${saved.fileName}`;
      await FileSystem.makeDirectoryAsync(target.slice(0, target.lastIndexOf("/")), { intermediates: true });
      await FileSystem.writeAsStringAsync(target, saved.base64, { encoding: FileSystem.EncodingType.Base64 });
      const snapshot = payload.snapshots.find((item) => item.session.sessionId === saved.sessionId);
      const photo = snapshot?.photos.find((item) => item.id === saved.photoId);
      if (photo) photo.uri = target;
    }
    for (const snapshot of payload.snapshots) await hydrateActiveQuestRecord(snapshot);
    return true;
  } catch {
    // Corrupt encrypted data is never made visible. It remains removable by
    // the normal cleanup path rather than risking cross-account restoration.
    return false;
  }
}

export async function discardEncryptedLogoutOutbox(userId: string) {
  await FileSystem.deleteAsync(localOutboxRoot(userId), { idempotent: true });
  await SecureStore.deleteItemAsync(localOutboxKey(userId));
}
