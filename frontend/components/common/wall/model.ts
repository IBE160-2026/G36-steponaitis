// The wall's drawing model (Story 10.2, FR-42): the import layout's logical cells joined to the
// plan's wall view by location code. Nothing here parses codes, derives cells or computes
// occupancy, best or counts: the layout gives the cells and gaps, the wall view gives every flag.
// A code missing on either side is drawn as an empty slot and never throws.

import type { AisleLayout, LayoutRun } from "@/lib/api/imports";
import type { WallLocation, WallView } from "@/lib/api/plans";
import type { MovementClass } from "@/lib/copy";

import { BIN_HEIGHT, BIN_WIDTH } from "./bin";

/** How a cell shows best: under its level's rail, framed on its own, or not at all. */
export type CellBest = "rail" | "frame" | "none";

export type WallCellModel = {
  run: number;
  row: number;
  column: number;
  level: string;
  /** The location code, or null for a gap (a section position with no location). */
  code: string | null;
  occupied: boolean;
  /** Each stocked part's class, top part first (empty when the location is empty). */
  parts: MovementClass[];
  best: CellBest;
};

/** A best location with no aisle or level mark covering it: framed, not under a rail. */
export function isFramed(location: Pick<WallLocation, "location" | "covering_marks">): boolean {
  return location.location.is_best && location.covering_marks.every((mark) => mark.kind === "location");
}

/** Every layout cell of the aisle with its flags from `wall`, in layout order. */
export function wallCells(layout: AisleLayout, wall: Pick<WallView, "locations" | "rail_levels">): WallCellModel[] {
  const byCode = new Map(wall.locations.map((entry) => [entry.location.code, entry]));
  const rails = new Set(wall.rail_levels);
  return layout.cells.map((cell) => {
    const level = layout.runs[cell.run]?.levels[cell.row] ?? "";
    const code = cell.gap || cell.location === null ? null : cell.location.code;
    const entry = code === null ? undefined : byCode.get(code);
    let best: CellBest = "none";
    if (code !== null && rails.has(level)) best = "rail";
    else if (entry !== undefined && isFramed(entry)) best = "frame";
    return {
      run: cell.run,
      row: cell.row,
      column: cell.column,
      level,
      code,
      occupied: entry?.occupied ?? false,
      parts: entry?.parts.map((part) => part.movement_class) ?? [],
      best,
    };
  });
}

/** Framed cells per level row of each run: `counts[run][row]`. */
export function framedCounts(layout: Pick<AisleLayout, "runs">, cells: readonly WallCellModel[]): number[][] {
  const counts = layout.runs.map((run) => run.levels.map(() => 0));
  for (const cell of cells) {
    if (cell.best === "frame" && counts[cell.run]?.[cell.row] !== undefined) counts[cell.run][cell.row] += 1;
  }
  return counts;
}

// Geometry in natural pixels (bin pitch 30, bin 27 × 29). The panel scales it as a whole.
export const PITCH = 30;
export const PAD = 10;
export const LABEL_WIDTH = 60;
export const SECTION_GAP = 7;
export const UPRIGHT_WIDTH = 5;
export const SECTION_HEADER = 18;
export const ROW_HEIGHT = 38;
export const BIN_TOP = 3;
export const BEAM_TOP = 33;
export const BEAM_HEIGHT = 4;
export const RUN_GAP = 14;
export const END_CAP = 22;
/** A bin's left inset inside its column pitch. */
export const BIN_INSET = (PITCH - BIN_WIDTH) / 2;
/** The largest bin scale: 27px bins grow to 35px at most (UX-DR41). */
export const MAX_SCALE = 35 / 27;

/** The section index (0-based) holding `column`: the last span that starts at or before it. */
export function sectionIndex(run: Pick<LayoutRun, "sections">, column: number): number {
  let index = 0;
  run.sections.forEach((span, i) => {
    if (span.first_column <= column) index = i;
  });
  return index;
}

/** The left edge of `column`'s pitch inside a run, from the run's left edge. */
export function columnX(run: Pick<LayoutRun, "sections">, column: number): number {
  return column * PITCH + (sectionIndex(run, column) + 1) * SECTION_GAP;
}

/** A run's width: its columns, a gap at each section start, and a closing upright. */
export function runWidth(run: Pick<LayoutRun, "sections" | "columns">): number {
  return run.columns * PITCH + (Math.max(run.sections.length, 1) + 1) * SECTION_GAP;
}

export function runHeight(run: Pick<LayoutRun, "levels">): number {
  return SECTION_HEADER + run.levels.length * ROW_HEIGHT;
}

/** Each run's top edge in natural pixels: the SVG and the keyboard grid over it use the same numbers. */
export function runTops(layout: Pick<AisleLayout, "runs">): number[] {
  const tops: number[] = [];
  let top = PAD;
  for (const run of layout.runs) {
    tops.push(top);
    top += runHeight(run) + RUN_GAP;
  }
  return tops;
}

/** A cell's bin rectangle in natural pixels (multiply by the scale for drawn pixels). */
export function cellRect(
  layout: Pick<AisleLayout, "runs">,
  tops: readonly number[],
  cell: Pick<WallCellModel, "run" | "row" | "column">,
): { x: number; y: number; width: number; height: number } | null {
  const run = layout.runs[cell.run];
  const top = tops[cell.run];
  if (run === undefined || top === undefined) return null;
  return {
    x: PAD + LABEL_WIDTH + columnX(run, cell.column) + BIN_INSET,
    y: top + SECTION_HEADER + cell.row * ROW_HEIGHT + BIN_TOP,
    width: BIN_WIDTH,
    height: BIN_HEIGHT,
  };
}

/** The wall's natural size before scaling. */
export function wallNaturalSize(layout: Pick<AisleLayout, "runs">): { width: number; height: number } {
  const widest = Math.max(0, ...layout.runs.map(runWidth));
  const runs = layout.runs.reduce((sum, run) => sum + runHeight(run), 0);
  return {
    width: PAD + LABEL_WIDTH + widest + PAD,
    height: PAD + runs + RUN_GAP * Math.max(layout.runs.length - 1, 0) + END_CAP + PAD,
  };
}

/** clamp(container / natural, 1, 35/27): bins never shrink below 27px; the panel scrolls instead. */
export function wallScale(containerWidth: number, naturalWidth: number): number {
  if (!(containerWidth > 0) || !(naturalWidth > 0)) return 1;
  return Math.min(Math.max(containerWidth / naturalWidth, 1), MAX_SCALE);
}
