// Which aisle the Locations wall opens on (Story 10.2): a valid `?aisle=`, else the plan's stored
// last aisle (`swp:plan:<id>:wall`, `{aisle}` JSON), else the layout's first aisle. Storage may be
// blocked or hold anything; then it is ignored.

import { planWallStorageKey, readStored, writeStored } from "@/lib/view-state/storage";

/** The stored last aisle of the plan's wall, or null (nothing stored, blocked or not `{aisle}` JSON). */
export function readStoredAisle(planId: string): string | null {
  const raw = readStored(planWallStorageKey(planId));
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && typeof (value as { aisle?: unknown }).aisle === "string") {
      return (value as { aisle: string }).aisle;
    }
  } catch {
    // Not JSON: ignored.
  }
  return null;
}

export function storeAisle(planId: string, aisle: string): void {
  writeStored(planWallStorageKey(planId), JSON.stringify({ aisle }));
}

/** URL aisle > stored aisle > first aisle, each only when it is one of `aisles` (server order). */
export function chooseAisle(
  urlAisle: string | undefined,
  storedAisle: string | null,
  aisles: readonly string[],
): string | undefined {
  if (urlAisle !== undefined && aisles.includes(urlAisle)) return urlAisle;
  if (storedAisle !== null && aisles.includes(storedAisle)) return storedAisle;
  return aisles[0];
}
