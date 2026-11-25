/** Numeric, bounded, opt-in counters. Never pass user content to this module. */
const enabled = process.env.EXPO_PUBLIC_ENERGY_DIAGNOSTICS === "1";
const counters = new Map<string, number>();
export function energyCount(name: string, amount = 1) {
  if (!enabled || !Number.isFinite(amount) || (!counters.has(name) && counters.size >= 64)) return;
  counters.set(name, (counters.get(name) ?? 0) + amount);
}
export function readEnergyDiagnostics() { return Object.fromEntries(counters); }
export function resetEnergyDiagnostics() { counters.clear(); }
