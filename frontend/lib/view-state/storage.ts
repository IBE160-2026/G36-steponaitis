// Per-browser view state in localStorage (UX-DR, Story 3.4). Every access is wrapped in try/catch:
// storage can be missing (server render), blocked or full, and then reads give `null` and writes
// do nothing, so a page always renders with its defaults.

export function readStored(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Not remembered; the page keeps working with its in-memory state.
  }
}

/** The Best locations step's marking mode, kept per plan. */
export function bestLocationsModeKey(planId: string): string {
  return `swp:best-locations-mode:${planId}`;
}

/** The plan's last flow-step view (`{step, query}` JSON, Story 6.2, AD-20). */
export function planViewKey(planId: string): string {
  return `swp:plan:${planId}:view`;
}

/** The Locations wall's last aisle (`{aisle}` JSON, Story 10.2). */
export function planWallStorageKey(planId: string): string {
  return `swp:plan:${planId}:wall`;
}
