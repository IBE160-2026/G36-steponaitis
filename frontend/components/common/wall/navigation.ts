// Keyboard movement in the wall grid (Story 10.3, UX-DR42). Pure: it reads only the layout's
// logical cells (run, row, column, gap) and never parses a location code.
//
// - `←/→`: the next non-gap cell in the same run and level row, across sections; stops at the end.
// - `↑/↓`: one level in the same run; `↓` from the top run's last row (L1) goes to the bottom run's
//   top level, `↑` back.
// - `PageDown`/`PageUp`: the next/previous run at the same row index (clamped).
// - `Home`/`End`: the row's first/last non-gap cell; with Ctrl (or ⌘), the wall's first/last.
// A target column that is a gap or missing takes the nearest non-gap column (tie: left); a target
// row with none keeps going in the same direction; with nothing found, focus stays.

import type { LayoutRun } from "@/lib/api/imports";

import type { WallCellModel } from "./model";

/** The keys `nextCell` handles. */
export const WALL_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"] as const;

export type WallKeyEvent = { key: string; ctrlKey?: boolean; metaKey?: boolean };

type Rows = {
  /** Every level row in layout order: run by run, top level first. */
  order: { run: number; row: number }[];
  /** Non-gap cells of each `run:row`, by column. */
  cells: Map<string, WallCellModel[]>;
};

function rowKey(run: number, row: number): string {
  return `${run}:${row}`;
}

function indexRows(cells: readonly WallCellModel[], runs: readonly Pick<LayoutRun, "levels">[]): Rows {
  const order = runs.flatMap((run, runIndex) => run.levels.map((_, row) => ({ run: runIndex, row })));
  const byRow = new Map<string, WallCellModel[]>();
  for (const cell of cells) {
    if (cell.code === null) continue;
    const key = rowKey(cell.run, cell.row);
    const list = byRow.get(key);
    if (list) list.push(cell);
    else byRow.set(key, [cell]);
  }
  for (const list of byRow.values()) list.sort((a, b) => a.column - b.column);
  return { order, cells: byRow };
}

/** The non-gap cell of the row nearest `column` (tie: the left one); undefined when the row has none. */
function nearest(list: readonly WallCellModel[] | undefined, column: number): WallCellModel | undefined {
  let best: WallCellModel | undefined;
  for (const cell of list ?? []) {
    const distance = Math.abs(cell.column - column);
    if (best === undefined || distance < Math.abs(best.column - column)) best = cell;
  }
  return best;
}

/** From row `start` in layout order (inclusive), the first row in `step` direction with a cell near `column`. */
function search(rows: Rows, start: number, step: 1 | -1, column: number): WallCellModel | undefined {
  for (let index = start; index >= 0 && index < rows.order.length; index += step) {
    const { run, row } = rows.order[index];
    const found = nearest(rows.cells.get(rowKey(run, row)), column);
    if (found) return found;
  }
  return undefined;
}

/**
 * The cell focus moves to from `from` on `event`: the same cell when the key is handled but there
 * is nowhere to go, and null when the key is not a wall key (the caller lets it through).
 */
export function nextCell(
  cells: readonly WallCellModel[],
  runs: readonly Pick<LayoutRun, "levels">[],
  from: WallCellModel,
  event: WallKeyEvent,
): WallCellModel | null {
  if (!(WALL_KEYS as readonly string[]).includes(event.key)) return null;
  const rows = indexRows(cells, runs);
  const row = rows.cells.get(rowKey(from.run, from.row)) ?? [];
  const here = rows.order.findIndex((entry) => entry.run === from.run && entry.row === from.row);
  const modified = event.ctrlKey === true || event.metaKey === true;
  let target: WallCellModel | undefined;
  switch (event.key) {
    case "ArrowRight":
      target = row.find((cell) => cell.column > from.column);
      break;
    case "ArrowLeft":
      target = row.findLast((cell) => cell.column < from.column);
      break;
    case "ArrowDown":
      target = here < 0 ? undefined : search(rows, here + 1, 1, from.column);
      break;
    case "ArrowUp":
      target = here < 0 ? undefined : search(rows, here - 1, -1, from.column);
      break;
    case "PageDown":
    case "PageUp": {
      const down = event.key === "PageDown";
      const runIndex = from.run + (down ? 1 : -1);
      const run = runs[runIndex];
      if (run === undefined || run.levels.length === 0) break;
      const rowIndex = Math.min(from.row, run.levels.length - 1);
      const start = rows.order.findIndex((entry) => entry.run === runIndex && entry.row === rowIndex);
      target = search(rows, start, down ? 1 : -1, from.column);
      break;
    }
    case "Home":
      if (modified) target = rows.order.map(({ run, row: r }) => rows.cells.get(rowKey(run, r))?.[0]).find(Boolean);
      else target = row[0];
      break;
    case "End":
      if (modified) {
        target = rows.order
          .map(({ run, row: r }) => rows.cells.get(rowKey(run, r))?.at(-1))
          .findLast(Boolean);
      } else target = row.at(-1);
      break;
  }
  return target ?? from;
}

/** The first non-gap cell in layout order (run, row, column): the wall's default tab stop. */
export function firstCell(cells: readonly WallCellModel[], runs: readonly Pick<LayoutRun, "levels">[]): WallCellModel | undefined {
  const rows = indexRows(cells, runs);
  for (const { run, row } of rows.order) {
    const first = rows.cells.get(rowKey(run, row))?.[0];
    if (first) return first;
  }
  return undefined;
}
