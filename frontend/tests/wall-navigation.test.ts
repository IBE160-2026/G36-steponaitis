import { describe, expect, it } from "vitest";

import { firstCell, nextCell, type WallCellModel } from "@/components/common/wall";

// Story 10.3 (FR-42, UX-DR42): keyboard movement in the wall grid, as a pure function over the
// layout's logical cells. The browser journey is in e2e/locations-wall.spec.ts.

type Spec = (string | null)[];

/** Cells of one run: each row lists its columns, null for a gap. */
function run(index: number, levels: string[], rows: Spec[]): WallCellModel[] {
  return rows.flatMap((row, rowIndex) =>
    row.map((code, column) => ({
      run: index,
      row: rowIndex,
      column,
      level: levels[rowIndex],
      code,
      occupied: false,
      parts: [],
      best: "none" as const,
    })),
  );
}

// Top run: L4 full, L3 all gaps, L2 and L1 with gaps. Bottom run: L2 with a gap, L1 full.
const TOP_LEVELS = ["4", "3", "2", "1"];
const BOTTOM_LEVELS = ["2", "1"];
const CELLS = [
  ...run(0, TOP_LEVELS, [
    ["T4-0", "T4-1", "T4-2", "T4-3", "T4-4"],
    [null, null, null, null, null],
    ["T2-0", null, "T2-2", null, null],
    [null, null, "T1-2", "T1-3", "T1-4"],
  ]),
  ...run(1, BOTTOM_LEVELS, [
    ["B2-0", "B2-1", null],
    ["B1-0", "B1-1", "B1-2"],
  ]),
];
const RUNS = [{ levels: TOP_LEVELS }, { levels: BOTTOM_LEVELS }];

function at(code: string): WallCellModel {
  const found = CELLS.find((cell) => cell.code === code);
  if (!found) throw new Error(code);
  return found;
}

function move(code: string, key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  return nextCell(CELLS, RUNS, at(code), { key, ...modifiers })?.code;
}

describe("fr42 ux-dr42 wall navigation", () => {
  it("fr42_wall_nav_left_right_skip_gaps_cross_sections_and_stop_at_the_end", () => {
    expect(move("T4-0", "ArrowRight")).toBe("T4-1");
    expect(move("T4-2", "ArrowRight")).toBe("T4-3");
    expect(move("T4-4", "ArrowRight")).toBe("T4-4");
    expect(move("T2-0", "ArrowRight")).toBe("T2-2");
    expect(move("T2-2", "ArrowRight")).toBe("T2-2");
    expect(move("T2-2", "ArrowLeft")).toBe("T2-0");
    expect(move("T1-2", "ArrowLeft")).toBe("T1-2");
    expect(move("T4-3", "ArrowLeft")).toBe("T4-2");
  });

  it("fr42_wall_nav_up_down_take_the_nearest_column_and_skip_an_all_gap_row", () => {
    // L3 has no location: ↓ goes on to L2; column 1 is a gap there, the tie goes left.
    expect(move("T4-1", "ArrowDown")).toBe("T2-0");
    expect(move("T4-4", "ArrowDown")).toBe("T2-2");
    expect(move("T2-0", "ArrowDown")).toBe("T1-2");
    expect(move("T2-2", "ArrowUp")).toBe("T4-2");
    expect(move("T4-3", "ArrowUp")).toBe("T4-3");
  });

  it("fr42_wall_nav_down_from_l1_crosses_into_the_bottom_run_and_up_returns", () => {
    expect(move("T1-2", "ArrowDown")).toBe("B2-1");
    expect(move("B2-1", "ArrowUp")).toBe("T1-2");
    expect(move("T1-4", "ArrowDown")).toBe("B2-1");
    expect(move("B2-0", "ArrowDown")).toBe("B1-0");
    expect(move("B1-2", "ArrowDown")).toBe("B1-2");
    expect(move("B1-2", "ArrowUp")).toBe("B2-1");
  });

  it("fr42_wall_nav_page_keys_jump_between_runs_at_the_same_row", () => {
    expect(move("T4-4", "PageDown")).toBe("B2-1");
    // Row 3 is clamped to the bottom run's last row.
    expect(move("T1-2", "PageDown")).toBe("B1-2");
    // Row 1 of the top run is all gaps: Page Up keeps going up.
    expect(move("B1-0", "PageUp")).toBe("T4-0");
    expect(move("B2-1", "PageUp")).toBe("T4-1");
    expect(move("T4-0", "PageUp")).toBe("T4-0");
    expect(move("B1-1", "PageDown")).toBe("B1-1");
  });

  it("fr42_wall_nav_home_end_and_ctrl_home_end", () => {
    expect(move("T1-4", "Home")).toBe("T1-2");
    expect(move("T2-0", "End")).toBe("T2-2");
    expect(move("B1-2", "Home", { ctrlKey: true })).toBe("T4-0");
    expect(move("T4-0", "End", { ctrlKey: true })).toBe("B1-2");
    expect(move("T2-2", "End", { metaKey: true })).toBe("B1-2");
  });

  it("fr42_wall_nav_ignores_other_keys", () => {
    expect(nextCell(CELLS, RUNS, at("T4-0"), { key: "a" })).toBeNull();
    expect(nextCell(CELLS, RUNS, at("T4-0"), { key: "Tab" })).toBeNull();
    expect(nextCell(CELLS, RUNS, at("T4-0"), { key: "Enter" })).toBeNull();
  });

  it("fr42_wall_nav_single_run_stays_at_the_edges", () => {
    const single = run(0, ["2", "1"], [
      ["S2-0", null],
      [null, "S1-1"],
    ]);
    const runs = [{ levels: ["2", "1"] }];
    const from = single.find((cell) => cell.code === "S1-1")!;
    expect(nextCell(single, runs, from, { key: "ArrowDown" })?.code).toBe("S1-1");
    expect(nextCell(single, runs, from, { key: "PageDown" })?.code).toBe("S1-1");
    expect(nextCell(single, runs, from, { key: "PageUp" })?.code).toBe("S1-1");
    expect(nextCell(single, runs, from, { key: "ArrowUp" })?.code).toBe("S2-0");
  });

  it("fr42_wall_nav_all_gap_rows_have_nowhere_to_go", () => {
    const gaps = run(0, ["2", "1"], [
      ["G2-0", null],
      [null, null],
    ]);
    const runs = [{ levels: ["2", "1"] }];
    const from = gaps[0];
    expect(nextCell(gaps, runs, from, { key: "ArrowDown" })?.code).toBe("G2-0");
    expect(nextCell(gaps, runs, from, { key: "End", ctrlKey: true })?.code).toBe("G2-0");
  });

  it("fr42_wall_nav_first_cell_is_the_default_tab_stop", () => {
    expect(firstCell(CELLS, RUNS)?.code).toBe("T4-0");
    const leading = run(0, ["2", "1"], [
      [null, null],
      [null, "L1-1"],
    ]);
    expect(firstCell(leading, [{ levels: ["2", "1"] }])?.code).toBe("L1-1");
    expect(firstCell([], [])).toBeUndefined();
  });
});
