import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialFromChoice } from "@/components/common/manual-move-dialog";
import {
  cellRecommendations,
  gridCounts,
  NO_TIP,
  partnerStrips,
  recommendationLinks,
  recommendationsAtVersion,
  tipReducer,
  WallGrid,
  WallPanel,
  WallTooltip,
  wallCells,
} from "@/components/common/wall";
import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { RecommendationRow, WallLocation, WallPart } from "@/lib/api/plans";
import {
  cellName,
  cellPartLine,
  EMPTY_LOCATION_REASON,
  markLabel,
  markSourceText,
  occupancyText,
  partnerStripText,
  partStatsText,
  showRecommendationLabel,
  walkPathText,
  wallGridLabel,
} from "@/lib/copy";
import { parseRecommendationId, planStepHref, recommendationHref } from "@/lib/view-state/urls";
import { expandedForRow, type ListItem } from "@/modules/recommendations/list";

// Story 10.3 (FR-42, UX-DR42, UX-DR43): the wall's keyboard grid, its cell names and descriptions,
// the tooltip and its pinned dialog. Static markup and pure helpers (Vitest has no DOM); focus,
// hover, Esc and Enter in a browser are in e2e/locations-wall.spec.ts.

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function ref(code: string, level: string, isBest = false) {
  return { code, aisle: "A", level, section: null, position: null, is_best: isBest };
}

function cell(run: number, row: number, column: number, code: string | null, level: string): LayoutCell {
  return { run, row, column, gap: code === null, location: code === null ? null : ref(code, level) };
}

const LAYOUT: AisleLayout = {
  aisle: "A",
  source: "code",
  walk_path_first: "0",
  walk_path_last: "2270",
  runs: [
    {
      levels: ["2", "1"],
      columns: 3,
      sections: [
        { section: "01", first_column: 0, columns: 2 },
        { section: "02", first_column: 2, columns: 1 },
      ],
    },
    { levels: ["1"], columns: 2, sections: [{ section: "03", first_column: 0, columns: 2 }] },
  ],
  cells: [
    cell(0, 0, 0, "A-01-02-01", "2"),
    cell(0, 0, 1, null, "2"),
    cell(0, 0, 2, "A-02-02-01", "2"),
    cell(0, 1, 0, "A-01-01-01", "1"),
    cell(0, 1, 1, "A-01-01-02", "1"),
    cell(0, 1, 2, "A-02-01-01", "1"),
    cell(1, 0, 0, "A-03-01-01", "1"),
    cell(1, 0, 1, "A-03-01-02", "1"),
  ],
};

function part(number: string, patch: Partial<WallPart> = {}): WallPart {
  return {
    part: number,
    description: "Oil filter",
    movement_class: "fast",
    picks: 33,
    stock: "4",
    kept_in_place: false,
    ...patch,
  };
}

const LEVEL_1 = { kind: "level", level: "1", aisle: "A" } as const;

function located(code: string, level: string, parts: WallPart[], best = false): WallLocation {
  return {
    location: ref(code, level, best),
    walk_path: "2270",
    occupied: parts.length > 0,
    parts,
    top_part: parts[0] ?? null,
    covering_marks: best ? [LEVEL_1] : [],
  };
}

const TWO_PARTS = located(
  "A-01-01-02",
  "1",
  [part("4410281"), part("0500", { description: "Bolt", movement_class: "slow", picks: 1, stock: "1200", kept_in_place: true })],
  true,
);
const EMPTY = located("A-01-01-01", "1", [], true);
const LOCATIONS: WallLocation[] = [
  located("A-01-02-01", "2", [part("1100", { movement_class: "medium", picks: 12 })]),
  located("A-02-02-01", "2", []),
  EMPTY,
  TWO_PARTS,
  located("A-02-01-01", "1", [part("2200", { movement_class: "dead", picks: 0 })], true),
  located("A-03-01-01", "1", []),
  located("A-03-01-02", "1", [part("3300")]),
];
const WALL = { locations: LOCATIONS, rail_levels: ["1"] };
const CELLS = wallCells(LAYOUT, WALL);

function rec(patch: Partial<RecommendationRow>): RecommendationRow {
  return {
    id: "r1",
    number: 1,
    status: "open",
    rule: "rule_1",
    part: "4410281",
    description: "Oil filter",
    movement_class: "fast",
    picks: 33,
    from_location: "A-01-01-02",
    from_best: true,
    to_location: "A-05-01-01",
    to_best: true,
    reason: null,
    applied: null,
    outdated: null,
    ...patch,
  };
}

const ROWS: RecommendationRow[] = [
  rec({ id: "r1", number: 1 }),
  rec({ id: "r2", number: 2, from_location: "B-01-01-01", to_location: "C-01-01-01" }),
  rec({
    id: "r3",
    number: 3,
    status: "applied",
    rule: "rule_3",
    from_location: "D-01-01-01",
    to_location: "A-01-01-02",
    reason: { kind: "pick_group", partner: "7700", partner_aisle: "A", shared_jobs: 14, min_shared_jobs: 5 },
  }),
];

function grid(props: Partial<Parameters<typeof WallGrid>[0]> = {}): string {
  return renderToStaticMarkup(<WallGrid layout={LAYOUT} cells={CELLS} locations={LOCATIONS} scale={1} {...props} />);
}

function cellTag(markup: string, code: string): string {
  const match = new RegExp(`<div[^>]*data-grid-cell="${code}"[^>]*>`).exec(markup);
  if (!match) throw new Error(`no cell ${code}`);
  return match[0];
}

describe("fr42 ux-dr42 wall grid", () => {
  it("fr42_wall_grid_roles_counts_and_one_tab_stop", () => {
    const markup = grid();
    expect(gridCounts(LAYOUT)).toEqual({ rows: 5, columns: 4 });
    expect(markup).toContain(`role="grid" aria-label="${wallGridLabel("A")}" aria-rowcount="5" aria-colcount="4"`);
    expect(wallGridLabel("A")).toBe("Aisle A bin wall");
    expect(markup).toContain('data-surface="graphite"');
    expect(markup.match(/role="rowgroup"/g)).toHaveLength(2);
    expect(markup.match(/role="row"/g)).toHaveLength(5);
    expect(markup).toMatch(/role="columnheader" aria-colindex="2" aria-colspan="2"[^>]*>01</);
    expect(markup).toMatch(/role="columnheader" aria-colindex="4" aria-colspan="1"[^>]*>02</);
    expect(markup).toMatch(/role="rowheader" aria-colindex="1"[^>]*>Level 2</);
    expect(markup).toMatch(/role="row" aria-rowindex="5"/);
    expect(markup.match(/role="gridcell"/g)).toHaveLength(8);
    // Exactly one tab stop: the first location of the top run's top level.
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(6);
    expect(cellTag(markup, "A-01-02-01")).toContain('tabindex="0"');
    expect(cellTag(markup, "A-01-02-01")).toContain("data-active");
    // The gap is a gridcell that is never focusable.
    expect(markup).toMatch(/<div role="gridcell" aria-rowindex="2" aria-colindex="3" aria-label="No location"[^>]*data-grid-gap=""/);
    expect(markup).not.toMatch(/data-grid-gap=""[^>]*tabindex/);
    expect(cellTag(markup, "A-01-01-02")).toContain('aria-rowindex="3" aria-colindex="3"');
    expect(cellTag(markup, "A-03-01-02")).toContain('aria-rowindex="5" aria-colindex="3"');
    expect(markup).not.toContain("aria-selected");
    // Geometry: the overlay cell sits where the SVG draws the bin.
    expect(cellTag(markup, "A-01-02-01")).toContain("left:78.5px;top:31px;width:27px;height:29px");
    const svg = renderToStaticMarkup(<WallPanel layout={LAYOUT} cells={CELLS} railLevels={["1"]} />);
    expect(svg).toMatch(/data-cell="A-01-02-01"[^>]*><g data-bin="medium"><rect x="78.5" y="31" width="27" height="29"/);
  });

  it("fr42_wall_grid_cell_names_and_descriptions", () => {
    const markup = grid();
    expect(cellTag(markup, "A-01-01-02")).toContain(
      'aria-label="A-01-01-02, level 1, best location, occupied, fast-moving"',
    );
    expect(cellTag(markup, "A-01-01-01")).toContain('aria-label="A-01-01-01, level 1, best location, empty"');
    expect(cellTag(markup, "A-02-01-01")).toContain("occupied, dead stock");
    expect(cellTag(markup, "A-01-02-01")).toContain('aria-label="A-01-02-01, level 2, occupied, medium-moving"');
    expect(cellTag(markup, "A-01-01-02")).toContain('aria-haspopup="dialog" aria-expanded="false"');
    const describedBy = /aria-describedby="([^"]+)"/.exec(cellTag(markup, "A-01-01-02"))![1];
    const description = new RegExp(`<div id="${describedBy}" hidden="">(.*?)</div>`).exec(markup)![1];
    expect(text(description).trim()).toBe(
      "4410281 Oil filter, fast-moving, 33 picks, stock 4. 0500 Bolt, slow-moving, 1 pick, stock 1,200, kept in place. " +
        "Level 1 in aisle A (best-location mark). Walk Path 2,270.",
    );
    // An empty location is described too: its mark sources and Walk Path.
    const emptyId = /aria-describedby="([^"]+)"/.exec(cellTag(markup, "A-01-01-01"))![1];
    const emptyDescription = new RegExp(`<div id="${emptyId}" hidden="">(.*?)</div>`).exec(markup)![1];
    expect(text(emptyDescription).trim()).toBe("Level 1 in aisle A (best-location mark). Walk Path 2,270.");
    // The partner strips of the recommendations touching the cell are described as well.
    const withRecs = grid({ recommendations: ROWS });
    const recId = /aria-describedby="([^"]+)"/.exec(cellTag(withRecs, "A-01-01-02"))![1];
    const recDescription = new RegExp(`<div id="${recId}" hidden="">(.*?)</div>`).exec(withRecs)![1];
    expect(text(recDescription)).toContain("Partner 7700 · 14 shared jobs · recommendation #3.");

    expect(cellName({ code: "A-07-01-02", level: "1", best: true, occupied: true, topClass: "fast" })).toBe(
      "A-07-01-02, level 1, best location, occupied, fast-moving",
    );
    expect(cellName({ code: "A-07-01-02", level: "1", best: false, occupied: false, selected: true })).toBe(
      "A-07-01-02, level 1, empty, selected",
    );
    expect(cellPartLine(part("9"))).toBe("9 Oil filter, fast-moving, 33 picks, stock 4");
  });

  it("fr42_wall_grid_selected_cell_is_the_tab_stop", () => {
    const markup = grid({ selectedCode: "A-03-01-02" });
    expect(cellTag(markup, "A-03-01-02")).toContain('tabindex="0"');
    expect(cellTag(markup, "A-03-01-02")).toContain("data-selected");
    expect(cellTag(markup, "A-03-01-02")).toContain("occupied, fast-moving, selected");
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    const svg = renderToStaticMarkup(
      <WallPanel layout={LAYOUT} cells={CELLS} railLevels={["1"]} selectedCode="A-03-01-02" />,
    );
    expect(svg).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(svg).not.toContain('role="img"');
    expect(svg).toMatch(/data-cell="A-03-01-02"[^>]*data-selected=""/);
    expect(svg.match(/data-selected-frame/g)).toHaveLength(1);
    expect(svg).toContain('stroke="var(--color-accent)"');
  });
});

describe("fr42 ux-dr43 wall tooltip", () => {
  it("fr42_wall_tooltip_shows_level_best_occupancy_marks_walk_path_parts_and_partner", () => {
    const touching = cellRecommendations(ROWS, TWO_PARTS.location.code);
    expect(touching.map((row) => row.id)).toEqual(["r1", "r3"]);
    const markup = renderToStaticMarkup(
      <WallTooltip location={TWO_PARTS} pinned={false} labelId="t" partners={partnerStrips(touching)} />,
    );
    const plain = text(markup);
    expect(markup).toMatch(/^<div aria-hidden="true" data-wall-tooltip="A-01-01-02"/);
    expect(markup).not.toContain('role="dialog"');
    expect(plain).toContain("A-01-01-02");
    expect(plain).toContain("Level 1");
    expect(markup).toContain('data-tip-best="">BEST<');
    expect(plain).toContain("Occupied · 2 parts");
    expect(plain).toContain("Level 1 in aisle A (best-location mark)");
    expect(plain).toContain("Walk Path 2,270");
    expect(plain).toContain("4410281 Oil filter Fast-moving · 33 picks · stock 4");
    expect(plain).toContain("0500 Bolt Slow-moving · 1 pick · stock 1,200 kept in place");
    expect(markup.match(/data-kept-in-place=""/g)).toHaveLength(1);
    expect(markup).toContain('data-class="fast"');
    expect(markup).toContain('data-class="slow"');
    expect(plain).toContain("Partner 7700 · 14 shared jobs · recommendation #3");
    expect(plain.toLowerCase()).not.toMatch(/capacity|distance|metre|meter/);
    expect(markup).not.toMatch(/<(button|a)\b/);
  });

  it("fr42_wall_tooltip_empty_location", () => {
    const plain = text(renderToStaticMarkup(<WallTooltip location={EMPTY} pinned={false} labelId="t" />));
    expect(plain).toContain("Empty");
    expect(plain).not.toContain("Occupied");
    expect(plain).not.toContain("picks");
    expect(EMPTY_LOCATION_REASON).toBe("This location is empty.");
  });

  it("fr42_wall_tooltip_pinned_is_a_dialog_with_actions_in_order", () => {
    const touching = cellRecommendations(ROWS, TWO_PARTS.location.code);
    const links = recommendationLinks(touching, (row) => recommendationHref("p1", row));
    const markup = renderToStaticMarkup(
      <WallTooltip
        location={TWO_PARTS}
        pinned
        labelId="tip-label"
        links={links}
        manualMove={<button type="button">Manual move…</button>}
      />,
    );
    expect(markup).toMatch(/^<div role="dialog" aria-labelledby="tip-label" data-wall-tooltip="A-01-01-02" data-pinned=""/);
    expect(markup).toContain('<p id="tip-label" class="type-code text-ink">A-01-01-02</p>');
    expect(markup).not.toContain("aria-hidden=\"true\" data-wall-tooltip");
    const actions = [...markup.matchAll(/<(button|a)\b[^>]*>(.*?)<\/\1>/g)].map((match) => text(match[2]).trim());
    expect(actions).toEqual([
      "4410281 Oil filter Fast-moving · 33 picks · stock 4",
      "0500 Bolt Slow-moving · 1 pick · stock 1,200 kept in place",
      "Manual move…",
      "Show recommendation #1",
      "Show recommendation #3",
    ]);
    expect(markup).toContain('href="/plans/p1/recommendations?tab=open&amp;rec=r1"');
    expect(markup).toContain('href="/plans/p1/recommendations?tab=applied&amp;rec=r3"');
  });

  it("fr42_wall_tooltip_versions_disagree_hides_recommendations", () => {
    const view = { version: 4, recommendations: ROWS };
    expect(recommendationsAtVersion(view, 4)).toBe(ROWS);
    expect(recommendationsAtVersion(view, 5)).toBeUndefined();
    expect(recommendationsAtVersion(undefined, 5)).toBeUndefined();
    // Without agreeing recommendations the grid gets none: no links, no partner strip.
    const markup = renderToStaticMarkup(<WallTooltip location={TWO_PARTS} pinned labelId="t" />);
    expect(markup).not.toContain("Show recommendation");
    expect(markup).not.toContain("data-partner-strip");
  });

  it("fr42_wall_tooltip_state_esc_hides_enter_pins", () => {
    const shown = tipReducer(NO_TIP, { type: "focus", code: "A" });
    expect(shown).toEqual({ code: "A", pinned: false });
    // Esc hides the tooltip; focus is not the reducer's (it stays on the cell).
    expect(tipReducer(shown, { type: "escape" })).toEqual(NO_TIP);
    const pinned = tipReducer(shown, { type: "pin", code: "A" });
    expect(pinned).toEqual({ code: "A", pinned: true });
    // The dialog stays while its cell is focused or another cell is hovered.
    expect(tipReducer(pinned, { type: "focus", code: "A" })).toBe(pinned);
    expect(tipReducer(pinned, { type: "hover", code: "B" })).toBe(pinned);
    expect(tipReducer(pinned, { type: "hide" })).toBe(pinned);
    // Focus on another cell, Esc, or focus leaving both closes it; only one exists at a time.
    expect(tipReducer(pinned, { type: "focus", code: "B" })).toEqual({ code: "B", pinned: false });
    expect(tipReducer(pinned, { type: "escape" })).toEqual(NO_TIP);
    expect(tipReducer(pinned, { type: "close" })).toEqual(NO_TIP);
    expect(tipReducer(pinned, { type: "pin", code: "B" })).toEqual({ code: "B", pinned: true });
    expect(tipReducer(shown, { type: "hover", code: "B" })).toEqual({ code: "B", pinned: false });
    expect(tipReducer(shown, { type: "hide" })).toEqual(NO_TIP);
  });

  it("fr42_wall_tooltip_copy", () => {
    expect(occupancyText(true, 1)).toBe("Occupied · 1 part");
    expect(occupancyText(true, 3)).toBe("Occupied · 3 parts");
    expect(occupancyText(false, 0)).toBe("Empty");
    expect(markSourceText(LEVEL_1)).toBe("Level 1 in aisle A (best-location mark)");
    expect(markLabel({ kind: "aisle", aisle: "B" })).toBe("Aisle B");
    expect(walkPathText("2270")).toBe("Walk Path 2,270");
    expect(partStatsText(part("1"))).toBe("Fast-moving · 33 picks · stock 4");
    expect(partnerStripText("4410281", 14, 2)).toBe("Partner 4410281 · 14 shared jobs · recommendation #2");
    expect(showRecommendationLabel(2)).toBe("Show recommendation #2");
    expect(partnerStrips([rec({ rule: "rule_1" })])).toEqual([]);
  });
});

describe("fr42 wall links", () => {
  it("fr42_wall_recommendation_href_and_rec_param", () => {
    expect(recommendationHref("p1", { id: "r9", status: "outdated" })).toBe(
      "/plans/p1/recommendations?tab=outdated&rec=r9",
    );
    expect(recommendationHref("p 1", { id: "a&b", status: "kept" })).toBe(
      "/plans/p%201/recommendations?tab=kept&rec=a%26b",
    );
    expect(parseRecommendationId(new URLSearchParams("tab=open&rec=r2"))).toBe("r2");
    expect(parseRecommendationId(new URLSearchParams("rec="))).toBeUndefined();
    expect(parseRecommendationId({ rec: ["r3", "r4"] })).toBe("r3");
    expect(planStepHref("p1", "locations", { aisle: "B", loc: "B-01" })).toBe("/plans/p1/locations?aisle=B&loc=B-01");
  });

  it("fr42_wall_rec_link_expands_a_hidden_band", () => {
    const items: ListItem[] = Array.from({ length: 7 }, (_, index) => ({
      kind: "rec" as const,
      row: rec({ id: `r${index}`, number: index + 1 }),
    }));
    expect(expandedForRow(items, "open", "r6")).toEqual(new Set(["open:rule_1"]));
    expect(expandedForRow(items, "open", "r2")).toEqual(new Set());
    expect(expandedForRow(items, "open", "nope")).toEqual(new Set());
    expect(expandedForRow(items, "open", undefined)).toEqual(new Set());
  });

  it("fr42_manual_move_initial_from", () => {
    expect(initialFromChoice(["A-01", "B-02"], "B-02")).toBe("B-02");
    expect(initialFromChoice(["A-01", "B-02"], "C-03")).toBe("A-01");
    expect(initialFromChoice(["A-01"], undefined)).toBe("A-01");
    expect(initialFromChoice([], "A-01")).toBe("");
  });
});
