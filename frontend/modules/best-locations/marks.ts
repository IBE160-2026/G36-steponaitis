// Pure helpers for the Best locations step (FR-21, FR-22, Story 3.4). They only name and compare
// server marks; best status and counts always come from the server.

import { ALL_AISLES } from "@/components/common/locations-table";
import type { BestMark, LocationRow } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";

/** "Aisle A", "Level 1 in aisle A", "Level 1 in all aisles", "Location A-01-01-01". */
export function markLabel(mark: BestMark): string {
  switch (mark.kind) {
    case "aisle":
      return `Aisle ${mark.aisle}`;
    case "level":
      return mark.aisle == null ? `Level ${mark.level} in all aisles` : `Level ${mark.level} in aisle ${mark.aisle}`;
    case "location":
      return `Location ${mark.location}`;
  }
}

/** Whether two marks are the same value (exact text; a level's missing aisle equals `null`). */
export function sameMark(a: BestMark, b: BestMark): boolean {
  if (a.kind === "aisle" && b.kind === "aisle") return a.aisle === b.aisle;
  if (a.kind === "level" && b.kind === "level") return a.level === b.level && (a.aisle ?? null) === (b.aisle ?? null);
  if (a.kind === "location" && b.kind === "location") return a.location === b.location;
  return false;
}

/** Whether the row's own location mark is among the marks covering it (server data). */
export function hasLocationMark(row: Pick<LocationRow, "location" | "covering_marks">): boolean {
  return row.covering_marks.some((mark) => mark.kind === "location" && mark.location === row.location.code);
}

/** "174 best · 7 empty" from the server's counts. */
export function bestCountsLine(best: number, empty: number): string {
  return `${formatNumber(best)} best · ${formatNumber(empty)} empty`;
}

/** The levels (in `levels` order) present in `aisle`; every level for all aisles. */
export function levelsInAisle(
  levels: readonly string[],
  rows: readonly Pick<LocationRow, "location">[],
  aisle: string,
): string[] {
  if (aisle === ALL_AISLES) return [...levels];
  const present = new Set(rows.filter((row) => row.location.aisle === aisle).map((row) => row.location.level));
  return levels.filter((level) => present.has(level));
}
