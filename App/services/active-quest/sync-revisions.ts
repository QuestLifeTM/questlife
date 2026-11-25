import { energyCount } from "./energy-diagnostics";
// In-memory acknowledgements are intentionally discarded on restart: replay is
// safe and recovers lost responses without changing the persisted schema.
const acknowledged = new Map<string, string>();
export async function syncChanged<T>(key: string, payload: T, send: () => PromiseLike<{ error: unknown }>) {
  const revision = JSON.stringify(payload);
  if (acknowledged.get(key) === revision) { energyCount("sync.skipped"); return; }
  energyCount("sync.requests");
  energyCount("sync.payloadCharacters", revision.length);
  const result = await send();
  if (result.error) throw result.error;
  if (acknowledged.size >= 128) acknowledged.delete(acknowledged.keys().next().value!);
  acknowledged.set(key, revision);
}
