import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { AisleCounts, WallMove, WarehouseView } from "@/lib/api/plans";
import {
  aisleCardLine,
  selectedMoveLine,
  warehouseBestFigure,
  warehouseEmptyFigure,
  warehouseOccupiedFigure,
  warehouseRunFigure,
} from "@/lib/copy";
import { planWallStorageKey } from "@/lib/view-state/storage";
import { chooseScope, readStoredWall, storeAisle, storeWall } from "@/modules/locations/aisle-choice";
import { LocationsWall } from "@/modules/locations/locations-page";
import { MiniWall } from "@/modules/locations/mini-wall";
import { type MiniWallBox, warehouseRoute, WholeWarehouse } from "@/modules/locations/warehouse-view";

// Story 10.6 (FR-42, UX-DR45/58): the whole-warehouse view. Rendered to static markup (Vitest has
// no DOM); the scope choice and the route are tested as pure helpers, a card click through the
// element tree.

type AnyElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function findByProp(node: ReactNode, prop: string, value: string): AnyElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByProp(child, prop, value);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const element = node as AnyElement;
  if (element.props[prop] === value) return element;
  return findByProp(element.props.children, prop, value);
}

function ref(code: string, aisle: string, level: string) {
  return { code, aisle, level, section: null, position: null, is_best: false };
}

function cell(aisle: string, column: number, code: string | null): LayoutCell {
  return { run: 0, row: 0, column, gap: code === null, location: code === null ? null : ref(code, aisle, "1") };
}

function layoutOf(aisle: string): AisleLayout {
  return {
    aisle,
    source: "code",
    walk_path_first: "0",
    walk_path_last: "100",
    runs: [{ levels: ["1"], columns: 3, sections: [{ section: "01", first_column: 0, columns: 3 }] }],
    cells: [cell(aisle, 0, `${aisle}-01-01-01`), cell(aisle, 1, `${aisle}-01-01-02`), cell(aisle, 2, null)],
  };
}

const LAYOUTS = [layoutOf("A"), layoutOf("G")];

function counts(aisle: string, extra: Partial<AisleCounts> = {}): AisleCounts {
  return {
    aisle,
    locations: 228,
    occupied: 194,
    empty: 34,
    occupied_percent: "85.1",
    best: 0,
    empty_best: 0,
    moves: 1,
    aisle_marked: false,
    ...extra,
  };
}

const MOVE: WallMove = {
  kind: "recommendation",
  recommendation_id: "run-1:1",
  number: 1,
  move_number: null,
  rule: "rule_1",
  part: "4410281",
  description: "Part",
  movement_class: "fast",
  picks: 10,
  from_location: ref("G-01-01-02", "G", "1"),
  to_location: ref("A-01-01-01", "A", "1"),
  status: "open",
};

const VIEW: WarehouseView = {
  version: 3,
  round: 1,
  run: { round: 1, recommendations: 19 },
  locations: [
    { code: "A-01-01-01", occupied: false, movement_class: null },
    { code: "A-01-01-02", occupied: true, movement_class: "fast" },
    { code: "G-01-01-01", occupied: true, movement_class: "slow" },
    { code: "G-01-01-02", occupied: true, movement_class: "medium" },
  ],
  moves: [MOVE],
  aisles: [counts("A", { aisle_marked: true, best: 228, empty_best: 7 }), counts("G")],
  warehouse: { locations: 2000, occupied: 1584, empty: 416, occupied_percent: "79.2", best: 174, empty_best: 7 },
};

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  } as unknown as Storage;
}

describe("fr42 warehouse scope choice (UX-DR58)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fr42_warehouse_scope_url_wins_over_stored", () => {
    expect(chooseScope({}, "warehouse")).toBe("warehouse");
    expect(chooseScope({}, "aisle")).toBe("aisle");
    expect(chooseScope({ aisle: "B" }, "warehouse")).toBe("aisle");
    expect(chooseScope({ loc: "A-01-01-01" }, "warehouse")).toBe("aisle");
    expect(chooseScope({ rec: "run-1:1" }, "warehouse")).toBe("warehouse");
  });

  it("fr42_warehouse_scope_stored_with_the_aisle", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));
    expect(readStoredWall("p1")).toEqual({ aisle: null, scope: "aisle" });
    storeWall("p1", "warehouse");
    expect(values[planWallStorageKey("p1")]).toBe('{"scope":"warehouse"}');
    storeAisle("p1", "B");
    storeWall("p1", "warehouse");
    expect(values[planWallStorageKey("p1")]).toBe('{"aisle":"B","scope":"warehouse"}');
    expect(readStoredWall("p1")).toEqual({ aisle: "B", scope: "warehouse" });
    storeWall("p1", "aisle", "C");
    expect(readStoredWall("p1")).toEqual({ aisle: "C", scope: "aisle" });
  });

  it("fr42_warehouse_scope_bad_stored_json_is_one_aisle", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));
    values[planWallStorageKey("p1")] = '{"aisle":"A","scope":"x"}';
    expect(readStoredWall("p1")).toEqual({ aisle: "A", scope: "aisle" });
    values[planWallStorageKey("p1")] = "junk";
    expect(readStoredWall("p1")).toEqual({ aisle: null, scope: "aisle" });
    values[planWallStorageKey("p1")] = '{"aisle":"A"}';
    expect(chooseScope({}, readStoredWall("p1").scope)).toBe("aisle");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => storeWall("p1", "warehouse")).not.toThrow();
    expect(readStoredWall("p1")).toEqual({ aisle: null, scope: "aisle" });
  });
});

describe("fr42 warehouse view (UX-DR45/58)", () => {
  it("fr42_warehouse_figures_and_no_run_text", () => {
    expect(warehouseOccupiedFigure(VIEW.warehouse)).toBe("79.2% occupied");
    expect(warehouseEmptyFigure(VIEW.warehouse)).toBe("416 empty locations");
    expect(warehouseBestFigure(VIEW.warehouse)).toBe("174 best locations · 7 of them empty");
    expect(warehouseRunFigure(VIEW.run)).toBe("19 recommendations in round 1");
    expect(warehouseRunFigure(null)).toBe("No recommendations yet");
    expect(aisleCardLine(counts("A"))).toBe("194 of 228 · 34 empty");
    expect(selectedMoveLine(MOVE)).toBe("Selected move: 4410281 · G-01-01-02 → A-01-01-01");

    const markup = renderToStaticMarkup(
      <WholeWarehouse view={VIEW} layout={{ aisles: LAYOUTS }} onSelectAisle={() => {}} />,
    );
    const plain = text(markup);
    for (const figure of [
      "79.2% occupied",
      "416 empty locations",
      "174 best locations · 7 of them empty",
      "19 recommendations in round 1",
    ]) {
      expect(plain).toContain(figure);
    }
    const noRun = text(
      renderToStaticMarkup(
        <WholeWarehouse view={{ ...VIEW, run: null, moves: [] }} layout={{ aisles: LAYOUTS }} onSelectAisle={() => {}} />,
      ),
    );
    expect(noRun).toContain("No recommendations yet");
  });

  it("fr42_warehouse_cards_in_server_order_with_best_tag", () => {
    const markup = renderToStaticMarkup(
      <WholeWarehouse view={VIEW} layout={{ aisles: LAYOUTS }} onSelectAisle={() => {}} />,
    );
    expect([...markup.matchAll(/data-aisle-card="([^"]+)"/g)].map((match) => match[1])).toEqual(["A", "G"]);
    expect(markup).toMatch(/<button type="button"[^>]*data-aisle-card="A"/);
    expect(markup).toContain("grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3");
    const plain = text(markup);
    expect(plain).toContain("A 85.1% BEST 194 of 228 · 34 empty 1 move");
    expect(plain).toContain("G 85.1% 194 of 228 · 34 empty 1 move");
    expect(markup.match(/data-best-tag=""/g)).toHaveLength(1);
    expect(markup.indexOf("data-aisle-cards")).toBeLessThan(markup.indexOf("data-wall-key"));
    // No selection: no route, no selected-move line.
    expect(markup).not.toContain("data-warehouse-route");
    expect(markup).not.toContain("data-selected-move");
  });

  it("fr42_warehouse_mini_wall_is_decorative", () => {
    const locations = new Map(VIEW.locations.map((entry) => [entry.code, entry]));
    const markup = renderToStaticMarkup(<MiniWall layout={LAYOUTS[0]} locations={locations} />);
    expect(markup).toMatch(/^<svg aria-hidden="true"/);
    expect(markup).not.toMatch(/<text|<title|tabindex|role=/);
    expect(text(markup).trim()).toBe("");
    // A-01-01-01 is empty (a slot), A-01-01-02 a fast bin; the gap is not drawn.
    expect(markup.match(/data-mini-cell=/g)).toHaveLength(2);
    expect(markup).toContain('data-mini-cell="empty"');
    expect(markup).toContain('data-mini-cell="fast"');
    expect(markup).toContain('fill="var(--color-class-fast)"');
  });

  it("fr42_warehouse_card_click_selects_the_aisle", () => {
    const select = vi.fn();
    let tree: ReactNode = null;
    function Capture() {
      tree = WholeWarehouse({ view: VIEW, layout: { aisles: LAYOUTS }, onSelectAisle: select });
      return tree;
    }
    renderToStaticMarkup(<Capture />);
    const card = findByProp(tree, "data-aisle-card", "G");
    expect(card?.type).toBe("button");
    (card?.props.onClick as () => void)();
    expect(select).toHaveBeenCalledWith("G");
  });

  it("fr42_warehouse_route_only_for_a_found_move", () => {
    const boxes = new Map<string, MiniWallBox>([
      ["A", { x: 0, y: 0, scale: 0.5 }],
      ["G", { x: 400, y: 300, scale: 0.5 }],
    ]);
    const route = warehouseRoute(LAYOUTS, MOVE, boxes);
    expect(route).not.toBeNull();
    // From the centre of G-01-01-02 (column 1) in the G card.
    expect(route?.d).toMatch(/^M4\d\d(\.\d+)? 3\d\d/);
    expect(warehouseRoute(LAYOUTS, undefined, boxes)).toBeNull();
    const outside = { ...MOVE, to_location: ref("A-99-99-99", "A", "1") };
    expect(warehouseRoute(LAYOUTS, outside, boxes)).toBeNull();
    expect(warehouseRoute(LAYOUTS, MOVE, new Map([["A", boxes.get("A")!]]))).toBeNull();
  });

  it("fr42_warehouse_selected_move_line", () => {
    const markup = renderToStaticMarkup(
      <WholeWarehouse view={VIEW} layout={{ aisles: LAYOUTS }} selectedMove={MOVE} onSelectAisle={() => {}} />,
    );
    expect(text(markup)).toContain("Selected move: 4410281 · G-01-01-02 → A-01-01-01");
  });

  it("fr42_warehouse_control_and_figure_button_in_one_aisle", () => {
    const onScopeChange = vi.fn();
    const wall = {
      version: 3,
      aisle: "A",
      round: 1,
      moves: [],
      rail_levels: [],
      locations: [],
      aisles: VIEW.aisles,
      warehouse: VIEW.warehouse,
    };
    const markup = renderToStaticMarkup(
      <LocationsWall
        planId="p1"
        view={wall}
        layout={{ aisles: LAYOUTS }}
        selected="A"
        onSelect={() => {}}
        onOpenList={() => {}}
        onScopeChange={onScopeChange}
      />,
    );
    expect(markup).toContain('role="radiogroup" aria-label="Locations view"');
    expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>One aisle</);
    expect(markup).toMatch(/role="radio" aria-checked="false"[^>]*>Whole warehouse</);
    expect(markup).toMatch(/<button type="button"[^>]*data-whole-warehouse="">79.2% whole warehouse/);
    expect(markup.indexOf('aria-label="Locations view"')).toBeLessThan(markup.indexOf('role="tablist"'));
  });
});
