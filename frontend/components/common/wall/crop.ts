// Wall crops (Story 10.5, FR-42, UX-DR57/58): an aisle's layout cut down to the sections around
// some location codes, for the recommendation detail. The layout's cells are kept as they are and
// only renumbered: nothing here parses a code or derives a cell (AD-15). A code is found by its
// cell's `LocationRef`; a code not in the layout is ignored.

import type { AisleLayout, LayoutCell, LayoutRun } from "@/lib/api/imports";

import { sectionIndex } from "./model";

/** The first and last unit (section span or column) of an `n`-unit window around `unit` in `count` units. */
function windowAround(unit: number, count: number, n: number): [number, number] {
  if (count <= n) return [0, count - 1];
  // The unit's own section is centred (N=3: one on each side; N=2: its own and the next).
  const start = Math.min(Math.max(unit - Math.floor((n - 1) / 2), 0), count - n);
  return [start, start + n - 1];
}

/**
 * `aisle` cut to the `sections` consecutive section spans around each of `codes` in each run that
 * holds one (`sections` columns in a layout without sections, the `walk_path` fallback). A run
 * keeps the contiguous range covering every window in it; runs holding none of the codes are
 * dropped. Columns are re-based to 0, runs renumbered; levels and the source are kept. Null when
 * no code is in the aisle.
 */
export function cropLayout(aisle: AisleLayout, codes: readonly string[], sections: number): AisleLayout | null {
  const wanted = new Set(codes);
  const n = Math.max(1, Math.floor(sections));
  const runs: LayoutRun[] = [];
  const cells: LayoutCell[] = [];
  aisle.runs.forEach((run, runIndex) => {
    const columns = aisle.cells
      .filter((cell) => cell.run === runIndex && cell.location !== null && wanted.has(cell.location.code))
      .map((cell) => cell.column);
    if (columns.length === 0) return;
    let first = Infinity;
    let last = -Infinity;
    let spans = run.sections;
    if (run.sections.length > 0) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const column of columns) {
        const [start, end] = windowAround(sectionIndex(run, column), run.sections.length, n);
        lo = Math.min(lo, start);
        hi = Math.max(hi, end);
      }
      spans = run.sections.slice(lo, hi + 1);
      first = spans[0].first_column;
      const end = spans[spans.length - 1];
      last = end.first_column + end.columns - 1;
    } else {
      for (const column of columns) {
        const [start, end] = windowAround(column, run.columns, n);
        first = Math.min(first, start);
        last = Math.max(last, end);
      }
    }
    const index = runs.length;
    runs.push({
      levels: run.levels,
      columns: last - first + 1,
      sections: spans.map((span) => ({ ...span, first_column: span.first_column - first })),
    });
    for (const cell of aisle.cells) {
      if (cell.run !== runIndex || cell.column < first || cell.column > last) continue;
      cells.push({ ...cell, run: index, column: cell.column - first });
    }
  });
  if (runs.length === 0) return null;
  return { ...aisle, runs, cells };
}
