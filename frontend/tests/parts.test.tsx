import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BinSwatch } from "@/components/common/bin-swatch";
import type { MovementClass } from "@/components/common/class-glyph";
import { DataTable, nextRowIndex, nextSort } from "@/components/common/data-table";
import type { PartRow, PartsView as PartsData } from "@/lib/api/plans";
import { compareNumber, compareText, sortRows } from "@/lib/sort";
import { COLUMNS, countLine, filterByClass, NO_CURRENT_LOCATION, PartsView, whyLine } from "@/modules/parts/parts-page";

// Story 2.3: the parts roster, DataTable and BinSwatch (FR-13, AD-14, UX-DR18, UX-DR23, UX-DR24).
// Rendered to static markup; Vitest has no DOM, so keyboard behaviour is tested as pure helpers.

const html = renderToStaticMarkup;

function ref(code: string) {
  return { code, aisle: code.slice(0, 1), level: "01", section: null, position: null, is_best: false };
}

function row(overrides: Partial<PartRow> = {}): PartRow {
  return {
    rank: 1,
    part: "5000",
    description: "Engine oil 5W-30",
    total_stock: "1234.5",
    total_stock_sort_rank: 0,
    current_location: ref("G-14-04-02"),
    other_locations: [],
    movement_class: "fast",
    picks: 61,
    pick_group_count: 1,
    kept_in_place: false,
    ...overrides,
  };
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("fr13 why-line", () => {
  it("fr13_why_line_with_current_location", () => {
    expect(whyLine(row())).toBe("Fast-moving · 61 picks · G-14-04-02");
  });

  it("fr13_why_line_without_current_location", () => {
    expect(whyLine(row({ movement_class: "dead", picks: 0, current_location: null }))).toBe(
      `Dead stock · 0 picks · ${NO_CURRENT_LOCATION}`,
    );
    expect(NO_CURRENT_LOCATION).toBe("No current location (no stock above zero)");
  });

  it("fr13_why_line_singular_pick", () => {
    expect(whyLine(row({ movement_class: "slow", picks: 1 }))).toBe("Slow-moving · 1 pick · G-14-04-02");
  });

  it("fr13_why_line_thousands", () => {
    expect(whyLine(row({ picks: 1584, movement_class: "medium" }))).toBe("Medium-moving · 1,584 picks · G-14-04-02");
  });
});

describe("fr13 user sorts (AD-14)", () => {
  it("fr13_sort_numbers_numerically_and_text_by_code_point", () => {
    expect(compareText("30400", "3050")).toBeLessThan(0);
    expect(compareText("a", "B")).toBeGreaterThan(0);
    expect(compareNumber(9, 10)).toBeLessThan(0);

    const rows = [
      { id: "a", n: 10, t: "3050" },
      { id: "b", n: 9, t: "30400" },
      { id: "c", n: 10, t: "30400" },
      { id: "d", n: 9, t: "3050" },
    ];
    expect(sortRows(rows, (r) => r.n, "ascending").map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
    expect(sortRows(rows, (r) => r.n, "descending").map((r) => r.id)).toEqual(["a", "c", "b", "d"]);
    expect(sortRows(rows, (r) => r.t, "ascending").map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("fr13_sort_decimals_by_sort_rank", () => {
    const rows = [
      row({ part: "A", total_stock: "10", total_stock_sort_rank: 2 }),
      row({ part: "B", total_stock: "9.5", total_stock_sort_rank: 1 }),
      row({ part: "C", total_stock: "10", total_stock_sort_rank: 2 }),
      row({ part: "D", total_stock: "0", total_stock_sort_rank: 0 }),
    ];
    expect(sortRows(rows, (r) => r.total_stock_sort_rank, "ascending").map((r) => r.part)).toEqual(["D", "B", "A", "C"]);
  });

  it("fr13_total_stock_column_sorts_by_sort_rank", () => {
    const column = COLUMNS.find((c) => c.key === "total_stock")!;
    expect(column.sortKind).toBe("number");
    const rows = [
      row({ part: "TEN", total_stock: "10", total_stock_sort_rank: 1 }),
      row({ part: "NINE", total_stock: "9.5", total_stock_sort_rank: 0 }),
    ];
    expect(sortRows(rows, column.sortValue!, "ascending").map((r) => r.part)).toEqual(["NINE", "TEN"]);
  });

  it("fr13_column_head_sorts_ascending_first_then_flips", () => {
    expect(nextSort(null, "picks")).toEqual({ key: "picks", direction: "ascending" });
    expect(nextSort({ key: "picks", direction: "ascending" }, "picks")).toEqual({ key: "picks", direction: "descending" });
    expect(nextSort({ key: "picks", direction: "descending" }, "rank")).toEqual({ key: "rank", direction: "ascending" });
  });
});

describe("fr13 class filter", () => {
  const rows = (["fast", "slow", "fast", "dead", "medium"] as MovementClass[]).map((movementClass, index) =>
    row({ part: String(index), rank: index + 1, movement_class: movementClass }),
  );

  it("fr13_class_filter", () => {
    expect(filterByClass(rows, new Set())).toHaveLength(5);
    const fast = filterByClass(rows, new Set<MovementClass>(["fast"]));
    expect(fast.map((r) => r.rank)).toEqual([1, 3]);
    expect(filterByClass(rows, new Set<MovementClass>(["fast", "dead"])).map((r) => r.rank)).toEqual([1, 3, 4]);
  });

  it("fr13_count_line", () => {
    expect(countLine(1545, 1545, false)).toBe("1,545 parts");
    expect(countLine(80, 1545, true)).toBe("80 of 1,545 parts");
    expect(countLine(1, 1, false)).toBe("1 part");
  });

  it("fr13_roster_renders_glossary_chips_and_rows_in_server_order", () => {
    const view: PartsData = {
      version: 1,
      parts: [
        row({ rank: 1, part: "5000", other_locations: [ref("A-01-01-01"), ref("B-01-01-01")] }),
        row({ rank: 2, part: "1008614-00", movement_class: "dead", picks: 0, current_location: null, total_stock: "0" }),
      ],
    };
    const markup = html(<PartsView view={view} />);
    const plain = text(markup);
    expect(plain).toContain("2 parts");
    for (const label of ["Fast-moving", "Medium-moving", "Slow-moving", "Dead stock"]) {
      expect(markup).toMatch(new RegExp(`aria-pressed="false"[^>]*>.*?${label}`));
    }
    expect(plain.indexOf("5000")).toBeLessThan(plain.indexOf("1008614-00"));
    expect(plain).toContain("A-01-01-01, B-01-01-01");
    expect(plain).toContain("1,234.5");
    expect(plain).toContain(NO_CURRENT_LOCATION);
    expect(plain).toContain("None");
    expect(markup).not.toMatch(/[▲◆▼⊘]/u);
  });
});

describe("uxdr18 data table keyboard", () => {
  it("uxdr18_next_row_index", () => {
    expect(nextRowIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextRowIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextRowIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextRowIndex("ArrowUp", 2, 3)).toBe(1);
    expect(nextRowIndex("Home", 2, 3)).toBe(0);
    expect(nextRowIndex("End", 0, 3)).toBe(2);
    expect(nextRowIndex("Enter", 1, 3)).toBe("open");
    expect(nextRowIndex("a", 1, 3)).toBeNull();
    expect(nextRowIndex("ArrowDown", 0, 0)).toBeNull();
  });

  it("uxdr18_one_tab_stop_and_sortable_heads", () => {
    const markup = html(
      <DataTable
        label="Things"
        rows={[{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }]}
        rowKey={(r) => r.id}
        columns={[
          { key: "id", header: "Id", cell: (r) => r.id },
          { key: "n", header: "Number", align: "end", sortValue: (r) => r.n, sortKind: "number", cell: (r) => r.n },
        ]}
      />,
    );
    expect(markup.match(/<tr[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/<tr[^>]*tabindex="-1"/g)).toHaveLength(2);
    expect(markup).toContain('aria-sort="none"');
    expect(markup.match(/aria-sort=/g)).toHaveLength(1);
    expect(markup).toContain("type-column-head text-ink-secondary");
    expect(markup).toContain("text-right tabular-nums");
    expect(markup).toContain("border-hairline");
  });
});

describe("uxdr23 bin swatch", () => {
  it.each<MovementClass>(["fast", "medium", "slow", "dead"])("uxdr23_bin_swatch_svg %s", (movementClass) => {
    const markup = html(<BinSwatch movementClass={movementClass} />);
    expect(markup).toMatch(/^<svg/);
    expect(markup).toContain('width="16"');
    expect(markup).toContain(`var(--color-class-${movementClass})`);
    expect(markup).toMatch(/stroke="var\(--color-ink\)"/);
    expect(markup).toContain(`data-class="${movementClass}"`);
    expect(markup).not.toMatch(/[▲◆▼⊘]/u);
    expect(markup).toContain('aria-hidden="true"');
  });

  it("uxdr23_bin_swatch_labelled", () => {
    const markup = html(<BinSwatch movementClass="fast" label="Fast-moving" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Fast-moving"');
  });
});

describe("ux-dr24 part panel opens without re-rendering the roster", () => {
  it("uxdr24_parts_view_is_memoized_so_a_panel_change_skips_the_table", () => {
    // PartsPage re-renders when `?part=` changes; a memoized view with default (shallow) props
    // comparison skips the 1,545-row table when its props are the same stable values.
    const memoized = PartsView as unknown as { $$typeof: symbol; compare: unknown };
    expect(memoized.$$typeof).toBe(Symbol.for("react.memo"));
    expect(memoized.compare).toBeNull();
  });
});
