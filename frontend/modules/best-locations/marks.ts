// Pure helpers for the Best locations step (FR-21, FR-22, Story 3.4). They only name and compare
// server marks; best status and counts always come from the server. Story 10.7 adds the marking
// wall's mode-to-mark logic: which mark a click on a location sets or removes, and its preview.

import { ALL_AISLES } from "@/components/common/locations-table";
import type { BestMark, LocationRef, LocationRow } from "@/lib/api/plans";
import type { CommandBody } from "@/lib/commands";
import { markPreviewText } from "@/lib/copy";
import { formatNumber } from "@/lib/format";

export type MarkingMode = "aisle" | "level" | "single";
export type LevelScope = "aisle" | "all";

/** A level mark: in one aisle (`scope` "aisle") or in all aisles. */
export function levelMark(level: string, scope: LevelScope, aisle: string): BestMark {
  return { kind: "level", level, aisle: scope === "all" ? null : aisle };
}

/** The mark a click on `location` stands for in `mode` (Level mode uses `scope`). */
export function markFor(
  mode: MarkingMode,
  scope: LevelScope,
  location: Pick<LocationRef, "code" | "aisle" | "level">,
): BestMark {
  switch (mode) {
    case "aisle":
      return { kind: "aisle", aisle: location.aisle };
    case "level":
      return levelMark(location.level, scope, location.aisle);
    case "single":
      return { kind: "location", location: location.code };
  }
}

/** What a click does with `mark`: remove it when an exact equal mark exists, else set it. */
export type MarkPreview = { mark: BestMark; remove: boolean; text: string };

export function markPreview(mark: BestMark, marks: readonly BestMark[]): MarkPreview {
  const remove = marks.some((existing) => sameMark(existing, mark));
  return { mark, remove, text: markPreviewText(mark, remove) };
}

/** The command a click with `preview` sends: `remove_best_mark` for an exact mark, else `set_best_mark`. */
export function markCommand(preview: Pick<MarkPreview, "mark" | "remove">): CommandBody {
  return { type: preview.remove ? "remove_best_mark" : "set_best_mark", mark: preview.mark };
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
