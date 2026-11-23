import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BinSwatch } from "@/components/common/bin-swatch";
import {
  Bin,
  CLASS_FILL,
  framedCounts,
  Key,
  MAX_SCALE,
  WallPanel,
  wallCells,
  wallNaturalSize,
  wallScale,
} from "@/components/common/wall";
import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { AisleCounts, WallLocation, WallView } from "@/lib/api/plans";
import {
  aisleTabMoves,
  bestCountTag,
  endCapLabel,
  KEY_LABELS,
  KEY_ORDER,
  type MovementClass,
  wallAisleLine,
  wholeWarehouseFigure,
} from "@/lib/copy";
import { planWallStorageKey } from "@/lib/view-state/storage";
import { parseLocationParams, planStepHref, VIEW_QUERY_KEYS } from "@/lib/view-state/urls";
import { chooseAisle, readStoredAisle, storeAisle } from "@/modules/locations/aisle-choice";
import { isListMode, LocationsWall } from "@/modules/locations/locations-page";

// Story 10.2 (FR-42, FR-14, FR-22): the bin wall of one aisle with its Key. Rendered to static
// markup (Vitest has no DOM); the join, scale and aisle choice are tested as pure helpers.

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function ref(code: string, level: string, isBest = false) {
  return { code, aisle: "A", level, section: null, position: null, is_best: isBest };
}

function cell(run: number, row: number, column: number, code: string | null, level: string): LayoutCell {
  return { run, row, column, gap: code === null, location: code === null ? null : ref(code, level) };
}

// Two runs: sections 01–02 on top (a gap in 02 on L2), 03 below. Levels top to bottom.
const LAYOUT: AisleLayout = {
  aisle: "A",
  source: "code",
  walk_path_first: "0",
  walk_path_last: "2270",
  runs: [
    {
      levels: ["2", "1"],
      columns: 4,
      sections: [
        { section: "01", first_column: 0, columns: 2 },
        { section: "02", first_column: 2, columns: 2 },
      ],
    },
    { levels: ["2", "1"], columns: 2, sections: [{ section: "03", first_column: 0, columns: 2 }] },
  ],
  cells: [
    cell(0, 0, 0, "A-01-02-01", "2"),
    cell(0, 0, 1, "A-01-02-02", "2"),
    cell(0, 0, 2, "A-02-02-01", "2"),
    cell(0, 0, 3, null, "2"),
    cell(0, 1, 0, "A-01-01-01", "1"),
    cell(0, 1, 1, "A-01-01-02", "1"),
    cell(0, 1, 2, "A-02-01-01", "1"),
    cell(0, 1, 3, "A-NOT-IN-WALL", "1"),
    cell(1, 0, 0, "A-03-02-01", "2"),
    cell(1, 0, 1, "A-03-02-02", "2"),
    cell(1, 1, 0, "A-03-01-01", "1"),
    cell(1, 1, 1, "A-03-01-02", "1"),
  ],
};

type Mark = WallLocation["covering_marks"][number];
const LEVEL_1: Mark = { kind: "level", level: "1", aisle: "A" };

function located(code: string, level: string, classes: MovementClass[], marks: Mark[] = []): WallLocation {
  const parts = classes.map((movementClass, index) => ({
    part: `${code}-p${index}`,
    description: "Part",
    movement_class: movementClass,
    picks: 10 - index,
    stock: "1",
    kept_in_place: false,
  }));
  return {
    location: ref(code, level, marks.length > 0),
    walk_path: "10",
    occupied: parts.length > 0,
    parts,
    top_part: parts[0] ?? null,
    covering_marks: marks,
  };
}

function single(code: string): Mark {
  return { kind: "location", location: code };
}

const COUNTS_A: AisleCounts = {
  aisle: "A",
  locations: 228,
  occupied: 198,
  empty: 30,
  occupied_percent: "86.8",
  best: 117,
  empty_best: 3,
  moves: 7,
  aisle_marked: true,
};

const WALL: WallView = {
  version: 3,
  aisle: "A",
  round: 1,
  marks: [],
  moves: [],
  rail_levels: ["1"],
  locations: [
    located("A-01-02-01", "2", ["fast"], [single("A-01-02-01")]),
    located("A-01-02-02", "2", ["medium", "slow"]),
    located("A-02-02-01", "2", ["slow", "dead", "fast"], [single("A-02-02-01")]),
    located("A-01-01-01", "1", [], [LEVEL_1]),
    located("A-01-01-02", "1", ["dead"], [LEVEL_1]),
    located("A-02-01-01", "1", ["fast"], [LEVEL_1]),
    located("A-03-02-01", "2", [], [single("A-03-02-01")]),
    located("A-03-02-02", "2", ["medium"]),
    located("A-03-01-01", "1", ["slow"], [LEVEL_1]),
    located("A-03-01-02", "1", ["fast"], [LEVEL_1, single("A-03-01-02")]),
    located("A-99-99-99", "1", ["fast"]),
  ],
  aisles: [
    COUNTS_A,
    { ...COUNTS_A, aisle: "B", occupied_percent: "70.0", moves: 1, aisle_marked: false },
  ],
  warehouse: { locations: 2000, occupied: 1584, empty: 416, occupied_percent: "79.2", best: 174, empty_best: 7 },
};

function cellTag(markup: string, code: string): string {
  const match = new RegExp(`<g data-cell="${code}"[^>]*>`).exec(markup);
  if (!match) throw new Error(`no cell ${code}`);
  return match[0];
}

describe("fr42 wall bin", () => {
  const svg = (node: React.ReactNode) => renderToStaticMarkup(<svg>{node}</svg>);

  it("fr42_wall_bin_one_part_shows_its_glyph_in_its_class_colour", () => {
    const markup = svg(<Bin parts={["fast"]} />);
    expect(markup).toContain('fill="var(--color-class-fast)"');
    expect(markup.match(/data-class="fast"/g)).toHaveLength(1);
    expect(markup).not.toContain("data-split");
    expect(markup).not.toContain("data-more-parts");
    expect(markup).not.toContain("FST");
  });

  it("fr42_wall_bin_two_parts_split_the_label_window", () => {
    const markup = svg(<Bin parts={["medium", "slow"]} />);
    expect(markup).toContain('fill="var(--color-class-medium)"');
    expect(markup).toContain("data-split");
    expect(markup).toMatch(/data-class="medium".*data-class="slow"/);
  });

  it("fr42_wall_bin_three_parts_show_the_top_glyph_and_a_plus", () => {
    const markup = svg(<Bin parts={["slow", "dead", "fast"]} />);
    expect(markup).toContain('fill="var(--color-class-slow)"');
    expect(markup.match(/data-class="/g)).toHaveLength(1);
    expect(markup).toContain('data-class="slow"');
    expect(markup).toContain("data-more-parts");
  });

  it("fr42_wall_bin_code_only_at_56px", () => {
    expect(svg(<Bin parts={["fast"]} width={56} height={54} />)).toContain(">FST</text>");
    expect(svg(<Bin parts={["dead"]} drawnWidth={56} />)).toContain(">DED</text>");
    expect(svg(<Bin parts={["fast"]} drawnWidth={35} />)).not.toContain("FST");
    expect(svg(<Bin parts={["fast"]} width={56} height={54} drawnWidth={55} />)).not.toContain("FST");
  });

  it("fr42_wall_class_fills_are_full_variable_names", () => {
    for (const [movementClass, fill] of Object.entries(CLASS_FILL)) {
      expect(fill).toBe(`var(--color-class-${movementClass})`);
    }
    const swatch = renderToStaticMarkup(<BinSwatch movementClass="medium" />);
    expect(swatch).toContain('fill="var(--color-class-medium)"');
  });
});

describe("fr42 wall key", () => {
  it("fr42_wall_key_lists_entries_in_order_without_colour_words", () => {
    const markup = renderToStaticMarkup(<Key />);
    const entries = [...markup.matchAll(/data-key-entry="([^"]+)"/g)].map((match) => match[1]);
    expect(entries).toEqual(["fast", "medium", "slow", "dead", "empty", "best", "selected", "twoParts"]);
    expect(KEY_ORDER.map((entry) => KEY_LABELS[entry])).toEqual([
      "Fast-moving",
      "Medium-moving",
      "Slow-moving",
      "Dead stock",
      "Empty",
      "Best location",
      "Selected",
      "2 parts",
    ]);
    const plain = text(markup);
    for (const label of Object.values(KEY_LABELS)) expect(plain).toContain(label);
    expect(plain.toLowerCase()).not.toMatch(/\b(red|yellow|blue|grey|gray|green|purple|violet|black|white)\b/);
    expect(markup).toMatch(/<p id="([^"]+)"[^>]*>Key<\/p><ul aria-labelledby="\1"/);
    expect(markup).not.toMatch(/<(button|a)\b/);
    expect(markup.match(/width="16" height="18"/g)).toHaveLength(8);
  });
});

describe("fr42 wall cells", () => {
  const cells = wallCells(LAYOUT, WALL);
  const byCode = new Map(cells.map((entry) => [entry.code, entry]));

  it("fr22_wall_rail_vs_frame", () => {
    expect(byCode.get("A-01-02-01")?.best).toBe("frame");
    expect(byCode.get("A-02-02-01")?.best).toBe("frame");
    expect(byCode.get("A-03-02-01")?.best).toBe("frame");
    expect(byCode.get("A-01-02-02")?.best).toBe("none");
    // Under the L1 rail: no frame, even with its own location mark.
    expect(byCode.get("A-03-01-02")?.best).toBe("rail");
    expect(byCode.get("A-01-01-01")?.best).toBe("rail");
    expect(framedCounts(LAYOUT, cells)).toEqual([
      [2, 0],
      [1, 0],
    ]);
  });

  it("fr42_wall_join_by_code_never_crashes_on_unknown_codes", () => {
    expect(cells).toHaveLength(LAYOUT.cells.length);
    expect(cells.filter((entry) => entry.code === null)).toHaveLength(1);
    const unknown = byCode.get("A-NOT-IN-WALL");
    expect(unknown).toMatchObject({ occupied: false, parts: [], best: "rail" });
    expect(byCode.has("A-99-99-99")).toBe(false);
    expect(byCode.get("A-02-02-01")?.parts).toEqual(["slow", "dead", "fast"]);
  });

  it("fr42_wall_panel_draws_flags_tags_and_gaps", () => {
    const markup = renderToStaticMarkup(
      <WallPanel layout={LAYOUT} cells={cells} railLevels={WALL.rail_levels} label="Bin wall of aisle A." />,
    );
    expect(cellTag(markup, "A-01-02-01")).toContain('data-best="frame"');
    expect(cellTag(markup, "A-01-02-01")).toContain('data-class="fast"');
    expect(cellTag(markup, "A-01-02-01")).toContain('data-occupied="true"');
    expect(cellTag(markup, "A-01-02-02")).toContain('data-parts="2"');
    expect(cellTag(markup, "A-02-02-01")).toContain('data-parts="3"');
    expect(cellTag(markup, "A-01-01-01")).toContain('data-occupied="false"');
    expect(cellTag(markup, "A-01-01-01")).toContain('data-parts="0"');
    expect(cellTag(markup, "A-03-01-02")).toContain('data-best="rail"');
    expect(markup.match(/data-gap=""/g)).toHaveLength(1);
    expect(markup.match(/data-rail="1"/g)).toHaveLength(2);
    expect(markup).not.toContain('data-rail="2"');
    expect(markup.match(/data-best-frame=""/g)).toHaveLength(3);
    expect(markup.match(/data-best-tag="BEST"/g)).toHaveLength(2);
    expect(markup).toContain('data-best-tag="BEST 2"');
    expect(markup).toContain('data-best-tag="BEST 1"');
    for (const section of ["01", "02", "03"]) expect(markup).toContain(`data-section="${section}"`);
    expect(markup).toContain("End of aisle A · Walk Path 2,270 →");
    expect(markup).toContain('role="img" aria-label="Bin wall of aisle A."');
    expect(markup).toMatch(/fill="var\(--color-best\)" data-rail="1"/);
    expect(markup).not.toMatch(/var\(--color-[a-z-]*\$\{/);
  });

  it("fr42_wall_scale_clamps_between_27_and_35px", () => {
    const natural = wallNaturalSize(LAYOUT).width;
    expect(wallScale(natural / 2, natural)).toBe(1);
    expect(wallScale(natural * 1.1, natural)).toBeCloseTo(1.1);
    expect(wallScale(natural * 3, natural)).toBe(MAX_SCALE);
    expect(27 * MAX_SCALE).toBeCloseTo(35);
    expect(wallScale(0, natural)).toBe(1);
    const scaled = renderToStaticMarkup(
      <WallPanel layout={LAYOUT} cells={[]} railLevels={[]} scale={1.2} label="x" />,
    );
    expect(scaled).toContain(`width="${wallNaturalSize(LAYOUT).width * 1.2}"`);
  });
});

describe("fr42 wall copy", () => {
  it("fr42_wall_copy_lines", () => {
    expect(wallAisleLine(COUNTS_A, "0", "2270")).toBe(
      "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270",
    );
    expect(
      wallAisleLine({ ...COUNTS_A, locations: 1, occupied: 1, empty: 0, best: 1, empty_best: 0 }, "5", "5"),
    ).toBe("86.8% occupied · 1 of 1 location · 0 empty · 1 best location (0 empty) · Walk Path 5–5");
    expect(wholeWarehouseFigure(WALL.warehouse)).toBe("79.2% whole warehouse · 1,584 of 2,000 · 416 empty · 174 best");
    expect(aisleTabMoves(7)).toBe("7 moves");
    expect(aisleTabMoves(1)).toBe("1 move");
    expect(aisleTabMoves(0)).toBe("0 moves");
    expect(endCapLabel("A", "2270")).toBe("End of aisle A · Walk Path 2,270 →");
    expect(bestCountTag(3)).toBe("BEST 3");
  });

  it("fr42_wall_locations_page_markup", () => {
    const markup = renderToStaticMarkup(
      <LocationsWall
        planId="p1"
        view={WALL}
        layout={{ aisles: [LAYOUT] }}
        selected="A"
        onSelect={() => {}}
        onOpenList={() => {}}
      />,
    );
    const plain = text(markup);
    expect(markup).toMatch(/<h1[^>]*>Locations<\/h1>/);
    expect(markup).toContain('role="tablist" aria-label="Aisles"');
    expect(markup.match(/role="tab"/g)).toHaveLength(2);
    expect(markup).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"[^>]*data-aisle-tab="A"/);
    expect(markup).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*tabindex="-1"[^>]*data-aisle-tab="B"/);
    expect(plain).toContain("A 86.8% BEST 7 moves");
    expect(plain).toContain("B 70.0% 1 move");
    expect(plain).toContain("79.2% whole warehouse · 1,584 of 2,000 · 416 empty · 174 best");
    expect(markup).toMatch(/<h2[^>]*>Aisle A<\/h2>/);
    expect(plain).toContain("86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270");
    expect(markup).toMatch(/<button[^>]*>Open as list<\/button>/);
    expect(markup).toContain(`href="${planStepHref("p1", "best-locations", { aisle: "A" })}"`);
    expect(plain).toContain("Edit best-location marks");
    // Story 10.3: the picture is aria-hidden; the grid over it is the wall's one tab stop.
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"[^>]*data-wall-panel="A"/);
    expect(markup).toContain('role="grid" aria-label="Aisle A bin wall"');
    expect(markup).toMatch(/<div role="region" aria-label="Aisle A wall, scrollable"/);
    expect(markup).not.toMatch(/role="region"[^>]*tabindex/);
    expect(markup.indexOf("data-wall-panel")).toBeLessThan(markup.indexOf("data-wall-key"));
    expect(markup).toMatch(/role="tabpanel" id="([^"]+)" aria-labelledby="[^"]+-tab-A"/);
  });
});

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  } as unknown as Storage;
}

describe("fr42 wall aisle choice", () => {
  afterEach(() => vi.unstubAllGlobals());
  const aisles = ["A", "B", "C"];

  it("fr42_wall_aisle_url_then_stored_then_first", () => {
    expect(chooseAisle("B", "C", aisles)).toBe("B");
    expect(chooseAisle("Z", "C", aisles)).toBe("C");
    expect(chooseAisle(undefined, "C", aisles)).toBe("C");
    expect(chooseAisle(undefined, "Z", aisles)).toBe("A");
    expect(chooseAisle(undefined, null, aisles)).toBe("A");
    expect(chooseAisle(undefined, null, [])).toBeUndefined();
  });

  it("fr42_wall_aisle_stored_per_plan", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));
    expect(readStoredAisle("p1")).toBeNull();
    storeAisle("p1", "B");
    expect(values[planWallStorageKey("p1")]).toBe('{"aisle":"B","scope":"aisle"}');
    expect(planWallStorageKey("p1")).toBe("swp:plan:p1:wall");
    expect(readStoredAisle("p1")).toBe("B");
    expect(readStoredAisle("p2")).toBeNull();
    values[planWallStorageKey("p1")] = "not json";
    expect(readStoredAisle("p1")).toBeNull();
    values[planWallStorageKey("p1")] = '{"aisle":3}';
    expect(readStoredAisle("p1")).toBeNull();
  });

  it("fr42_wall_aisle_blocked_storage_falls_back", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => storeAisle("p1", "B")).not.toThrow();
    expect(readStoredAisle("p1")).toBeNull();
    expect(chooseAisle(undefined, readStoredAisle("p1"), aisles)).toBe("A");
  });

  it("fr42_wall_list_mode_from_url", () => {
    expect(VIEW_QUERY_KEYS).toContain("mode");
    expect(parseLocationParams(new URLSearchParams("aisle=A&mode=list"))).toEqual({ aisle: "A", mode: "list" });
    expect(isListMode({ mode: "list" })).toBe(true);
    // Story 10.3: a location link opens the wall; only `?mode=list` is the table.
    expect(isListMode({ loc: "A-01" })).toBe(false);
    expect(isListMode({ mode: "list", loc: "A-01" })).toBe(true);
    expect(isListMode({ aisle: "A" })).toBe(false);
    expect(planStepHref("p1", "locations", { aisle: "A", mode: "list" })).toBe("/plans/p1/locations?aisle=A&mode=list");
  });
});
