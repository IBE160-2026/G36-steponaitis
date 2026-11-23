import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { cropLayout } from "@/components/common/wall";
import type { AisleLayout, LayoutCell, LayoutView } from "@/lib/api/imports";
import type { PlanSummary, RecentMove, RecommendationRow, RecommendationsView, WallLocation, WallMove, WallView } from "@/lib/api/plans";
import { cropName, NO_RECENT_MOVES, RECENT_MOVES_TITLE, SHOW_ON_LOCATIONS_WALL, undoFirstText } from "@/lib/copy";
import {
  CROP_NARROW_QUERY,
  cropPlan,
  CropsView,
  currentCropSections,
  RecentMoves,
  showOnWallHref,
  ShowOnWallLinkView,
} from "@/modules/recommendations/crops";
import { RecommendationsView as View } from "@/modules/recommendations/recommendations-page";

// Story 10.5 (FR-42, UX-DR34/57/58): wall crops in the recommendation detail. Static markup and
// pure helpers (Vitest has no DOM); the page in a browser is in e2e/recommendations-page.spec.ts.

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function ref(code: string, level: string, aisle: string, isBest = false) {
  return { code, aisle, level, section: null, position: null, is_best: isBest };
}

/** An aisle of `sections` sections of 2 columns, levels 2 and 1; codes `<aisle>-<ss>-<level>-<p>`. */
function aisle(name: string, sections: number, source: AisleLayout["source"] = "code"): AisleLayout {
  const cells: LayoutCell[] = [];
  ["2", "1"].forEach((level, row) => {
    for (let s = 0; s < sections; s += 1) {
      for (let p = 0; p < 2; p += 1) {
        const code = `${name}-${String(s + 1).padStart(2, "0")}-0${level}-0${p + 1}`;
        cells.push({ run: 0, row, column: s * 2 + p, gap: false, location: ref(code, level, name) });
      }
    }
  });
  return {
    aisle: name,
    source,
    walk_path_first: "0",
    walk_path_last: "100",
    runs: [
      {
        levels: ["2", "1"],
        columns: sections * 2,
        sections: Array.from({ length: sections }, (_, s) => ({
          section: String(s + 1).padStart(2, "0"),
          first_column: s * 2,
          columns: 2,
        })),
      },
    ],
    cells,
  };
}

/** The walk_path fallback: one run per level, `columns` positions, no sections. */
function fallback(columns: number): AisleLayout {
  const cells: LayoutCell[] = [];
  ["2", "1"].forEach((level, run) => {
    for (let c = 0; c < columns; c += 1) {
      cells.push({ run, row: 0, column: c, gap: false, location: ref(`F${level}-${c}`, level, "F") });
    }
  });
  return {
    aisle: "F",
    source: "walk_path",
    walk_path_first: "0",
    walk_path_last: "100",
    runs: [
      { levels: ["2"], columns, sections: [] },
      { levels: ["1"], columns, sections: [] },
    ],
    cells,
  };
}

/** Two runs (sections 01–04 on top, 05–08 below), as the domain splits an aisle. */
function twoRuns(): AisleLayout {
  const top = aisle("A", 4);
  const bottom = aisle("A", 8);
  const lower = bottom.cells
    .filter((cell) => cell.column >= 8)
    .map((cell) => ({ ...cell, run: 1, column: cell.column - 8 }));
  return {
    ...top,
    runs: [
      top.runs[0],
      {
        levels: ["2", "1"],
        columns: 8,
        sections: bottom.runs[0].sections.slice(4).map((span) => ({ ...span, first_column: span.first_column - 8 })),
      },
    ],
    cells: [...top.cells, ...lower],
  };
}

function sectionsOf(crop: AisleLayout | null): string[][] {
  return crop?.runs.map((run) => run.sections.map((span) => span.section)) ?? [];
}

describe("fr42 cropLayout (UX-DR57)", () => {
  const A = aisle("A", 5);

  it("fr42_crop_centres_the_section", () => {
    const crop = cropLayout(A, ["A-03-01-02"], 3);
    expect(sectionsOf(crop)).toEqual([["02", "03", "04"]]);
    expect(crop?.runs[0].columns).toBe(6);
    expect(crop?.runs[0].sections.map((span) => span.first_column)).toEqual([0, 2, 4]);
    expect(crop?.runs[0].levels).toEqual(["2", "1"]);
    expect(crop?.source).toBe("code");
    expect(crop?.cells).toHaveLength(12);
    expect(crop?.cells.find((cell) => cell.location?.code === "A-03-01-02")).toMatchObject({ run: 0, row: 1, column: 3 });
  });

  it("fr42_crop_shifts_inside_the_run_at_an_edge", () => {
    expect(sectionsOf(cropLayout(A, ["A-01-02-01"], 3))).toEqual([["01", "02", "03"]]);
    expect(sectionsOf(cropLayout(A, ["A-05-02-01"], 3))).toEqual([["03", "04", "05"]]);
  });

  it("fr42_crop_two_sections_take_the_next_one", () => {
    expect(sectionsOf(cropLayout(A, ["A-03-01-01"], 2))).toEqual([["03", "04"]]);
    expect(sectionsOf(cropLayout(A, ["A-05-01-01"], 2))).toEqual([["04", "05"]]);
  });

  it("fr42_crop_short_run_is_whole", () => {
    expect(sectionsOf(cropLayout(aisle("B", 2), ["B-01-01-01"], 3))).toEqual([["01", "02"]]);
  });

  it("fr42_crop_covers_both_codes_contiguously", () => {
    expect(sectionsOf(cropLayout(aisle("A", 9), ["A-02-01-01", "A-08-01-01"], 3))).toEqual([
      ["01", "02", "03", "04", "05", "06", "07", "08", "09"],
    ]);
  });

  it("fr42_crop_fallback_uses_positions", () => {
    const crop = cropLayout(fallback(8), ["F1-0"], 3);
    expect(crop?.runs).toEqual([{ levels: ["1"], columns: 3, sections: [] }]);
    expect(crop?.cells.map((cell) => [cell.run, cell.column, cell.location?.code])).toEqual([
      [0, 0, "F1-0"],
      [0, 1, "F1-1"],
      [0, 2, "F1-2"],
    ]);
    expect(cropLayout(fallback(8), ["F2-4"], 3)?.cells.map((cell) => cell.location?.code)).toEqual(["F2-3", "F2-4", "F2-5"]);
    expect(cropLayout(fallback(8), ["F2-4"], 2)?.cells.map((cell) => cell.location?.code)).toEqual(["F2-4", "F2-5"]);
  });

  it("fr42_crop_two_codes_in_two_runs_keep_both_runs", () => {
    const crop = cropLayout(twoRuns(), ["A-01-01-01", "A-08-02-02"], 3);
    expect(sectionsOf(crop)).toEqual([
      ["01", "02", "03"],
      ["06", "07", "08"],
    ]);
    expect(crop?.cells.find((cell) => cell.location?.code === "A-08-02-02")).toMatchObject({ run: 1, column: 5 });
  });

  it("fr42_crop_drops_runs_without_a_code_and_renumbers", () => {
    const crop = cropLayout(twoRuns(), ["A-07-01-01"], 3);
    expect(sectionsOf(crop)).toEqual([["06", "07", "08"]]);
    expect(crop?.cells.every((cell) => cell.run === 0)).toBe(true);
  });

  it("fr42_crop_unknown_code_is_null", () => {
    expect(cropLayout(A, ["Z-99-01-01"], 3)).toBeNull();
  });
});

// --- The detail's crops ---

const LAYOUT: LayoutView = { aisles: [aisle("A", 5), aisle("G", 5)] };

function rec(fields: Partial<RecommendationRow> = {}): RecommendationRow {
  return {
    id: "run:1",
    number: 1,
    rule: "rule_1",
    part: "8044172",
    description: "Oil filter",
    movement_class: "fast",
    picks: 33,
    from_location: "A-04-01-01",
    to_location: "A-02-01-02",
    from_best: false,
    to_best: true,
    status: "open",
    applied: null,
    outdated: null,
    reason: null,
    ...fields,
  };
}

function located(code: string, level: string, wallAisle: string, occupied: boolean): WallLocation {
  const parts = occupied
    ? [{ part: `${code}-p`, description: "Part", movement_class: "fast" as const, picks: 9, stock: "1", kept_in_place: false }]
    : [];
  return { location: ref(code, level, wallAisle), walk_path: "10", occupied, parts, top_part: parts[0] ?? null, covering_marks: [] };
}

function wallMove(row: RecommendationRow, fromAisle: string, toAisle: string): WallMove {
  const status = row.status === "applied" ? "applied" : "open";
  return {
    kind: "recommendation",
    recommendation_id: row.id,
    number: row.number,
    move_number: row.applied?.move_number ?? null,
    rule: row.rule,
    part: row.part,
    description: row.description,
    movement_class: "fast",
    picks: 33,
    status,
    from_location: ref(row.from_location, "1", fromAisle),
    to_location: ref(row.applied?.to_location ?? row.to_location, "1", toAisle, true),
  };
}

function wall(name: string, moves: WallMove[], version = 5, occupied: readonly string[] = []): WallView {
  return {
    version,
    aisle: name,
    round: 1,
    moves,
    marks: [],
    rail_levels: [],
    locations: aisle(name, 5).cells.map((cell) =>
      located(cell.location!.code, cell.location!.level, name, occupied.includes(cell.location!.code)),
    ),
    aisles: [],
    warehouse: { locations: 20, occupied: 1, empty: 19, occupied_percent: "5.0", best: 1, empty_best: 1 },
  };
}

function renderCrops(row: RecommendationRow, walls: Record<string, WallView | undefined>, sections = 3, version = 5) {
  const plan = cropPlan(LAYOUT, row, sections);
  if (plan === null) return null;
  return renderToStaticMarkup(<CropsView plan={plan} walls={walls} version={version} row={row} round={1} />);
}

describe("fr42 crops in the detail (UX-DR34/57)", () => {
  it("fr42_uxdr57_same_aisle_is_one_crop_with_the_arrow_and_the_caption_under_it", () => {
    const row = rec();
    const markup = renderCrops(row, { A: wall("A", [wallMove(row, "A", "A")], 5, ["A-04-01-01"]) }) ?? "";
    expect(markup.match(/role="img"/g)).toHaveLength(1);
    expect(markup).toContain(
      `aria-label="From A-04-01-01, aisle A, level 1 → to A-02-01-02, aisle A, level 1, best location"`,
    );
    expect(markup).toContain('data-move-arrow=""');
    expect(markup).toContain('data-lifted="1"');
    expect(markup).toContain('data-move-target="1"');
    expect(markup).toContain('data-move-marker="1"');
    // A crop names the move and draws no end cap, grid, tooltip or tab stop.
    expect(markup).not.toContain("data-end-cap");
    expect(markup).not.toContain('role="grid"');
    // The Key under the crops has its colour buttons (Story 11.3); the crops themselves have none.
    const keyAt = markup.indexOf("data-wall-key");
    expect(keyAt).toBeGreaterThan(-1);
    const crops = markup.slice(0, keyAt);
    expect(crops).not.toMatch(/tabindex="0"|<a |<button/);
    expect(markup).not.toContain("cursor:pointer");
    expect(text(markup)).toContain("Rule 1 · round 1");
    expect(markup.indexOf("data-crop-caption")).toBeGreaterThan(markup.indexOf('role="img"'));
    expect(markup.match(/data-wall-key/g)).toHaveLength(1);
    // Sections 03–05 around the from-cell and 01–03 around the to-cell: one contiguous range.
    expect(markup.match(/data-section="/g)).toHaveLength(5);
  });

  it("fr42_uxdr57_cross_aisle_is_from_over_to_with_the_caption_between_and_no_arrow", () => {
    const row = rec({ from_location: "G-03-02-02", to_location: "A-01-01-01" });
    const move = wallMove(row, "G", "A");
    const markup = renderCrops(row, { G: wall("G", [move], 5, ["G-03-02-02"]), A: wall("A", [move]) }) ?? "";
    const name = cropName(
      { code: "G-03-02-02", aisle: "G", level: "2", best: false },
      { code: "A-01-01-01", aisle: "A", level: "1", best: true },
    );
    expect(name).toBe("From G-03-02-02, aisle G, level 2 → to A-01-01-01, aisle A, level 1, best location");
    expect(markup.match(new RegExp(`role="img" aria-label="${name}"`, "g"))).toHaveLength(2);
    const from = markup.indexOf("From aisle G");
    const caption = markup.indexOf("data-crop-caption");
    const to = markup.indexOf("To aisle A");
    expect(from).toBeGreaterThan(-1);
    expect(caption).toBeGreaterThan(from);
    expect(to).toBeGreaterThan(caption);
    expect(markup).not.toContain("data-move-arrow");
    expect(markup.match(/data-wall-key/g)).toHaveLength(1);
    // Both drawn at scale 1: each panel's width is its natural width.
    expect(markup.match(/viewBox="0 0 [\d.]+ [\d.]+" role="img"/g)).toHaveLength(2);
    for (const match of markup.matchAll(/<svg width="([\d.]+)" height="([\d.]+)" viewBox="0 0 ([\d.]+) ([\d.]+)" role="img"/g)) {
      expect(match[1]).toBe(match[3]);
    }
  });

  it("fr42_uxdr57_applied_crops_around_the_effective_to_with_the_check", () => {
    const row = rec({
      status: "applied",
      applied: { move_number: 7, round: 1, to_location: "A-05-02-01", to_best: false },
    });
    const plan = cropPlan(LAYOUT, row, 3);
    expect(plan?.name).toBe("From A-04-01-01, aisle A, level 1 → to A-05-02-01, aisle A, level 2");
    const markup = renderCrops(row, { A: wall("A", [wallMove(row, "A", "A")], 5, ["A-05-02-01"]) }) ?? "";
    expect(markup).toContain('data-move-marker="applied"');
    expect(markup.match(/data-section="/g)).toHaveLength(3);
  });

  it("fr42_uxdr57_unknown_end_gets_no_crop_and_none_when_both_are_unknown", () => {
    const half = cropPlan(LAYOUT, rec({ from_location: "Z-01-01-01", to_location: "A-02-01-02" }), 3);
    expect(half?.crops.map((crop) => crop.aisle)).toEqual(["A"]);
    expect(half?.name).toBe("From Z-01-01-01 → to A-02-01-02, aisle A, level 1, best location");
    expect(cropPlan(LAYOUT, rec({ from_location: "Z-01-01-01", to_location: "Z-01-01-02" }), 3)).toBeNull();
  });

  it("fr42_ad12_placeholder_until_the_versions_agree", () => {
    const row = rec();
    const stale = renderCrops(row, { A: wall("A", [wallMove(row, "A", "A")], 4) }) ?? "";
    expect(stale).toContain("data-crop-placeholder");
    expect(stale).not.toContain('role="img"');
    expect(stale).not.toContain("data-wall-panel");
    const loading = renderCrops(row, {}) ?? "";
    expect(loading).toContain("data-crop-placeholder");
    // Another aisle's wall (kept while the next loads) is never drawn.
    const other = renderCrops(row, { A: wall("G", []) }) ?? "";
    expect(other).toContain("data-crop-placeholder");
  });

  it("fr42_uxdr58_two_sections_at_1300px", () => {
    const narrow = renderCrops(rec({ from_location: "A-03-01-01", to_location: "A-03-01-02" }), { A: wall("A", []) }, 2) ?? "";
    expect(narrow.match(/data-section="/g)).toHaveLength(2);
    const wide = renderCrops(rec({ from_location: "A-03-01-01", to_location: "A-03-01-02" }), { A: wall("A", []) }, 3) ?? "";
    expect(wide.match(/data-section="/g)).toHaveLength(3);
  });
});

describe("fr42 crop sections per viewport (UX-DR58)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubViewport(width: number) {
    const matchMedia = (query: string) => ({
      matches: query === CROP_NARROW_QUERY && width >= 1280 && width <= 1439,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.stubGlobal("window", { matchMedia });
  }

  it("fr42_uxdr58_mocked_1300px_matchmedia_gives_two_sections", () => {
    stubViewport(1300);
    expect(currentCropSections()).toBe(2);
    stubViewport(1440);
    expect(currentCropSections()).toBe(3);
    stubViewport(1100);
    expect(currentCropSections()).toBe(3);
  });

  it("fr42_uxdr58_server_default_is_three", () => {
    expect(currentCropSections()).toBe(3);
  });
});

describe("fr42 show on the Locations wall and recent moves (UX-DR57)", () => {
  it("fr42_show_on_wall_href_opens_the_from_aisle_with_the_move", () => {
    const row = rec({ id: "run:9", from_location: "G-03-02-02", to_location: "A-01-01-01" });
    expect(showOnWallHref("p1", LAYOUT, row)).toBe("/plans/p1/locations?aisle=G&rec=run%3A9");
    expect(showOnWallHref("p1", LAYOUT, rec({ from_location: "Z-1", to_location: "Z-2" }))).toBeNull();
    const markup = renderToStaticMarkup(<ShowOnWallLinkView href="/plans/p1/locations?aisle=G&rec=run%3A9" />);
    expect(markup).toContain('href="/plans/p1/locations?aisle=G&amp;rec=run%3A9"');
    expect(text(markup)).toContain(SHOW_ON_LOCATIONS_WALL);
  });

  const MOVES: RecentMove[] = [
    { move_number: 3, part: "9723950", rule: "rule_1", round: 1, from_location: "A-03-04-02", to_location: "A-05-01-03" },
    { move_number: 2, part: "1100", rule: "manual", round: 1, from_location: "C-01-01-01", to_location: "A-01-01-03" },
  ];
  const PREVIEW = {
    move_number: 3,
    part: "9723950",
    from_location: "A-03-04-02",
    to_location: "A-05-01-03",
    effect: { kind: "reverts_move" as const, move_number: 3 },
  };

  it("fr42_recent_moves_in_server_order_with_the_undo_line", () => {
    const markup = text(renderToStaticMarkup(<RecentMoves moves={MOVES} undoPreview={PREVIEW} />));
    expect(markup).toContain(RECENT_MOVES_TITLE);
    expect(markup.indexOf("Move 3 · Rule 1 · 9723950 · A-03-04-02 → A-05-01-03")).toBeLessThan(
      markup.indexOf("Move 2 · Manual · 1100 · C-01-01-01 → A-01-01-03"),
    );
    expect(markup).toContain("Undo reverses move 3 first");
  });

  it("fr42_undo_first_line_per_effect_kind", () => {
    const preview = (kind: "reverts_move" | "splits_combined_move" | "restores_removed_move") => ({
      ...PREVIEW,
      effect: { kind, move_number: 4 },
    });
    expect(undoFirstText(preview("reverts_move"))).toBe("Undo reverses move 4 first");
    expect(undoFirstText(preview("splits_combined_move"))).toBe("Undo splits move 4 first");
    expect(undoFirstText(preview("restores_removed_move"))).toBe("Undo restores move 4 first");
  });

  it("fr42_recent_moves_section_is_labelled_by_its_heading", () => {
    const markup = renderToStaticMarkup(<RecentMoves moves={MOVES} undoPreview={null} />);
    const id = /<section aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeDefined();
    expect(markup).toContain(`<h3 id="${id}"`);
    expect(markup).not.toContain("aria-label=");
  });

  it("fr42_recent_moves_empty_without_an_undo_line", () => {
    const markup = text(renderToStaticMarkup(<RecentMoves moves={[]} undoPreview={null} />));
    expect(markup).toContain(NO_RECENT_MOVES);
    expect(markup).not.toContain("Undo reverses");
  });

  function page(row: RecommendationRow | null, noSpace = false, kept = false) {
    const view: RecommendationsView = {
      version: 5,
      run: { id: "run", round: 1, created_at: "2026-11-22T13:05:00Z", created_by: "planner" },
      recommendations: row ? [row] : [],
      no_space: noSpace
        ? [
            {
              part: "1200",
              rule: "rule_1",
              description: "Part",
              movement_class: "fast",
              picks: 3,
              from_location: "A-01-01-01",
              from_best: false,
              reason: null,
              cause: { rule: "rule_1", aisle: null, outside_best: false },
              kept_in_place: false,
            },
          ]
        : [],
      kept_parts: kept
        ? [{ part: "9100", description: "Part", movement_class: "fast", picks: 3, from_location: "A-01-01-01", from_best: false }]
        : [],
      recent_moves: MOVES,
    };
    const summary = { version: 5, current_round: 1, apply_all_count: 1, best_locations: 12, move_count: 2, undo_preview: PREVIEW } as PlanSummary;
    return renderToStaticMarkup(
      <View
        summary={summary}
        view={view}
        tab={kept ? "kept" : noSpace ? "no-space" : row?.status === "outdated" ? "outdated" : "open"}
        onTabChange={() => {}}
        onSend={async () => ({ outcome: "confirmed", events: [] })}
        crops={(r) => <div data-test-crops={r.id} />}
        showOnWall={(r) => <a href={`/wall/${r.id}`}>{SHOW_ON_LOCATIONS_WALL}</a>}
      />,
    );
  }

  it("fr42_detail_shows_crops_link_and_moves_for_a_recommendation_only", () => {
    const markup = page(
      rec({ reason: { kind: "class", movement_class: "fast", picks: 30, threshold: { min_picks: 24, max_picks: null } } }),
    );
    expect(markup).toContain('data-test-crops="run:1"');
    expect(markup).toContain('href="/wall/run:1"');
    expect(markup.indexOf('data-testid="detail-eyebrow"')).toBeLessThan(markup.indexOf('href="/wall/run:1"'));
    expect(text(markup)).toContain("Undo reverses move 3 first");
    // After the reason, before the move line and the action bar: crops, then recent moves.
    expect(markup.indexOf('data-testid="detail-reason"')).toBeLessThan(markup.indexOf("data-test-crops"));
    expect(markup.indexOf("data-test-crops")).toBeLessThan(markup.indexOf("data-recent-moves"));
    expect(markup.indexOf("data-recent-moves")).toBeLessThan(markup.indexOf('type-code text-ink"'));
    expect(markup.indexOf("data-recent-moves")).toBeLessThan(markup.indexOf('aria-keyshortcuts="Alt+A"'));
    const outdated = page(
      rec({
        status: "outdated",
        outdated: { cause: "filled", location: "A-02-01-02", move_number: 2, partner: null, aisle: null },
      }),
    );
    expect(outdated).toContain('data-test-crops="run:1"');
    expect(outdated).toContain('href="/wall/run:1"');
    expect(outdated).toContain("data-recent-moves");
    for (const other of [page(null, true), page(null, false, true)]) {
      expect(other).toContain('data-testid="detail-eyebrow"');
      expect(other).not.toContain("data-test-crops");
      expect(other).not.toContain("/wall/");
      expect(other).not.toContain("data-recent-moves");
    }
  });
});
