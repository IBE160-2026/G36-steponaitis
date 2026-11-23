// Which aisle and which scope the Locations wall opens on (Stories 10.2, 10.6). The plan's stored
// choice is `swp:plan:<id>:wall`, `{aisle?, scope?}` JSON. The aisle: a valid `?aisle=`, else the
// stored last aisle, else the layout's first aisle. The scope (One aisle | Whole warehouse): an
// explicit `?aisle=` or `?loc=` always opens One aisle, else the stored scope, else One aisle.
// Storage may be blocked or hold anything; then it is ignored.

import { planWallStorageKey, readStored, writeStored } from "@/lib/view-state/storage";
import type { LocationParams } from "@/lib/view-state/urls";

export type WallScope = "aisle" | "warehouse";

export type StoredWall = { aisle: string | null; scope: WallScope };

function isScope(value: unknown): value is WallScope {
  return value === "aisle" || value === "warehouse";
}

/** The plan's stored wall choice; a missing or invalid aisle is null, a missing or invalid scope `"aisle"`. */
export function readStoredWall(planId: string): StoredWall {
  const raw = readStored(planWallStorageKey(planId));
  const stored: StoredWall = { aisle: null, scope: "aisle" };
  if (raw === null) return stored;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null) {
      const { aisle, scope } = value as { aisle?: unknown; scope?: unknown };
      if (typeof aisle === "string") stored.aisle = aisle;
      if (isScope(scope)) stored.scope = scope;
    }
  } catch {
    // Not JSON: ignored.
  }
  return stored;
}

/** The stored last aisle of the plan's wall, or null (nothing stored, blocked or no string `aisle`). */
export function readStoredAisle(planId: string): string | null {
  return readStoredWall(planId).aisle;
}

/** Stores `scope` and, when given, the aisle; without one the stored aisle is kept. */
export function storeWall(planId: string, scope: WallScope, aisle?: string): void {
  const kept = aisle ?? readStoredWall(planId).aisle;
  writeStored(planWallStorageKey(planId), JSON.stringify(kept === null ? { scope } : { aisle: kept, scope }));
}

/** One aisle is open on `aisle`: stores both. */
export function storeAisle(planId: string, aisle: string): void {
  storeWall(planId, "aisle", aisle);
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

/** An explicit `?aisle=` or `?loc=` opens One aisle; otherwise the stored scope decides. */
export function chooseScope(params: LocationParams, storedScope: WallScope): WallScope {
  if (params.aisle !== undefined || params.loc !== undefined) return "aisle";
  return storedScope;
}
