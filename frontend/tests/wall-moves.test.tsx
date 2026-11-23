import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import {
  arrowPath,
  cellGeometry,
  cellMoveSelection,
  crossAisleLines,
  liftedRect,
  marksByCode,
  moveKey,
  moveMarks,
  placeNote,
  type Rect,
  rectsOverlap,
  WallGrid,
  WallHoverNote,
  WallMoveMarkers,
  WallPanel,
  wallCells,
  wallNaturalSize,
} from "@/components/common/wall";
import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { RecommendationRow, WallLocation, WallMove, WallView } from "@/lib/api/plans";
import { applyReason } from "@/lib/commands/apply";
import {
  cellMoveText,
  cellName,
  hoverNoteLines,
  moveArrivesFromText,
  moveFromOtherAisleText,
  movesDrawerHeading,
  moveStatusText,
  NO_MOVE_SELECTED,
  noMovesTouchText,
} from "@/lib/copy";
import {
  isSelectedWallMove,
  parseLocationParams,
  planStepHref,
  VIEW_QUERY_KEYS,
  wallMoveQuery,
} from "@/lib/view-state/urls";
import { drawerCounts, drawerStatusText, hasActions, joinedRow, MovesDrawer } from "@/modules/locations/moves-drawer";

// Story 10.4 (FR-42, UX-DR44, UX-DR46): moves on the wall. Static markup and pure helpers (Vitest
// has no DOM); clicks, URL changes and commands in a browser are in e2e/locations-wall.spec.ts.

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function ref(code: string, level: string, aisle = "A", isBest = false) {
  return { code, aisle, level, section: null, position: null, is_best: isBest };
}

function cell(run: number, row: number, column: number, code: string, level: string): LayoutCell {
  return { run, row, column, gap: false, location: ref(code, level) };
}

const LAYOUT: AisleLayout = {
  aisle: "A",
  source: "code",
  walk_path_first: "0",
  walk_path_last: "100",
  runs: [
    {
      levels: ["2", "1"],
      columns: 4,
      sections: [
        { section: "01", first_column: 0, columns: 2 },
        { section: "02", first_column: 2, columns: 2 },
      ],
    },
  ],
  cells: [
    cell(0, 0, 0, "A-01-02-01", "2"),
    cell(0, 0, 1, "A-01-02-02", "2"),
    cell(0, 0, 2, "A-02-02-01", "2"),
    cell(0, 0, 3, "A-02-02-02", "2"),
    cell(0, 1, 0, "A-01-01-01", "1"),
    cell(0, 1, 1, "A-01-01-02", "1"),
    cell(0, 1, 2, "A-02-01-01", "1"),
    cell(0, 1, 3, "A-02-01-02", "1"),
  ],
};

function located(code: string, level: string, occupied: boolean): WallLocation {
  const parts = occupied
    ? [{ part: `${code}-p`, description: "Part", movement_class: "fast" as const, picks: 9, stock: "1", kept_in_place: false }]
    : [];
  return { location: ref(code, level), walk_path: "10", occupied, parts, top_part: parts[0] ?? null, covering_marks: [] };
}

function move(patch: Partial<WallMove> & Pick<WallMove, "status">): WallMove {
  return {
    kind: "recommendation",
    recommendation_id: "run:1",
    number: 1,
    move_number: null,
    rule: "rule_1",
    part: "8044172",
    description: "Oil filter - Toyota Corolla",
    movement_class: "fast",
    picks: 33,
    from_location: ref("A-01-01-01", "1"),
    to_location: ref("A-02-02-02", "2", "A", true),
    ...patch,
  };
}

const OPEN = move({ status: "open" });
const CROSS = move({
  status: "open",
  recommendation_id: "run:2",
  number: 2,
  from_location: ref("G-14-04-02", "4", "G"),
  to_location: ref("A-02-02-01", "2"),
});
const APPLIED = move({
  status: "applied",
  recommendation_id: "run:3",
  number: 3,
  move_number: 5,
  from_location: ref("A-01-02-01", "2"),
  to_location: ref("A-02-01-01", "1"),
});
const MANUAL = move({
  kind: "manual",
  status: "manual",
  recommendation_id: null,
  number: null,
  move_number: 6,
  rule: "manual",
  from_location: ref("A-01-02-02", "2"),
  to_location: ref("A-02-01-02", "1"),
});
const OUTDATED = move({
  status: "outdated",
  recommendation_id: "run:4",
  number: 4,
  from_location: ref("A-01-01-02", "1"),
  to_location: ref("B-01-01-01", "1", "B"),
});
const MOVES = [OPEN, CROSS, APPLIED, MANUAL, OUTDATED];

const WALL: WallView = {
  version: 3,
  aisle: "A",
  round: 1,
  marks: [],
  moves: MOVES,
  rail_levels: [],
  locations: [
    located("A-01-02-01", "2", false),
    located("A-01-02-02", "2", false),
    located("A-02-02-01", "2", false),
    located("A-02-02-02", "2", false),
    located("A-01-01-01", "1", true),
    located("A-01-01-02", "1", true),
    located("A-02-01-01", "1", true),
    located("A-02-01-02", "1", true),
  ],
  aisles: [],
  warehouse: { locations: 8, occupied: 4, empty: 4, occupied_percent: "50.0", best: 1, empty_best: 1 },
};

const CELLS = wallCells(LAYOUT, WALL);
const GEOMETRY = cellGeometry(LAYOUT, CELLS);
const onWall = (code: string) => GEOMETRY.has(code);

function rec(patch: Partial<RecommendationRow> = {}): RecommendationRow {
  return {
    id: "run:1",
    number: 1,
    rule: "rule_1",
    part: "8044172",
    description: "Oil filter - Toyota Corolla",
    movement_class: "fast",
    picks: 33,
    from_location: "A-01-01-01",
    to_location: "A-02-02-02",
    from_best: false,
    to_best: true,
    status: "open",
    applied: null,
    outdated: null,
    reason: { kind: "class", movement_class: "fast", picks: 33, threshold: { min_picks: 24, max_picks: null } },
    ...patch,
  };
}

describe("fr42 wall moves: marks", () => {
  it("fr42_wall_moves_draw_each_status_on_its_own_end", () => {
    const marks = moveMarks(MOVES, onWall, undefined);
    expect(marks.map((mark) => [mark.kind, mark.code, mark.number])).toEqual([
      ["lift", "A-01-01-01", 1],
      ["target", "A-02-02-02", 1],
      // A move from another aisle: only its target is drawn here.
      ["target", "A-02-02-01", 2],
      ["applied", "A-02-01-01", 3],
      ["manual", "A-02-01-02", null],
      // Outdated: on the from-cell, no target (its target is in aisle B anyway).
      ["outdated", "A-01-01-02", 4],
    ]);
    expect(marks.every((mark) => !mark.selected)).toBe(true);
  });

  it("fr42_wall_moves_applied_to_another_aisle_marks_its_from_cell", () => {
    const away = move({ status: "applied", move_number: 7, to_location: ref("B-01-01-01", "1", "B") });
    expect(moveMarks([away], onWall, undefined).map((mark) => [mark.kind, mark.end, mark.code])).toEqual([
      ["applied", "from", "A-01-01-01"],
    ]);
    expect(cellMoveText({ kind: "applied", number: 1, selected: false, end: "from" })).toBe(
      "move 1 applied, left here",
    );
  });

  it("fr42_wall_moves_manual_to_another_aisle_marks_its_from_cell", () => {
    const away = { ...MANUAL, to_location: ref("B-01-01-01", "1", "B") };
    expect(moveMarks([away], onWall, undefined).map((mark) => [mark.kind, mark.end, mark.code])).toEqual([
      ["manual", "from", "A-01-02-02"],
    ]);
    expect(cellMoveText({ kind: "manual", number: null, selected: true, end: "from" })).toBe(
      "manual move, selected, left here",
    );
  });

  it("fr42_wall_moves_outdated_from_another_aisle_marks_its_to_cell", () => {
    const away = { ...OUTDATED, from_location: ref("G-01-01-01", "1", "G"), to_location: ref("A-02-01-01", "1") };
    expect(moveMarks([away], onWall, undefined).map((mark) => [mark.kind, mark.end, mark.code])).toEqual([
      ["outdated", "to", "A-02-01-01"],
    ]);
  });

  it("fr42_wall_moves_kept_is_drawn_like_open", () => {
    const kept = moveMarks([move({ status: "kept" })], onWall, undefined);
    expect(kept.map((mark) => mark.kind)).toEqual(["lift", "target"]);
  });

  it("fr42_wall_moves_selected_key_marks_only_its_ends", () => {
    const marks = moveMarks(MOVES, onWall, moveKey(OPEN));
    expect(marks.filter((mark) => mark.selected).map((mark) => mark.kind)).toEqual(["lift", "target"]);
    expect(moveKey(MANUAL)).toBe("move:6");
    expect(moveKey(OPEN)).toBe("run:1");
  });

  it("fr42_wall_moves_cell_click_selects_its_first_move_unless_one_is_selected", () => {
    const shared = [move({ status: "open" }), move({ status: "open", recommendation_id: "run:9", number: 9 })];
    const byCode = marksByCode(moveMarks(shared, onWall, undefined));
    expect(cellMoveSelection(byCode.get("A-01-01-01"), undefined)).toBe("run:1");
    const selected = marksByCode(moveMarks(shared, onWall, "run:9"));
    expect(cellMoveSelection(selected.get("A-01-01-01"), "run:9")).toBeUndefined();
    expect(cellMoveSelection(undefined, undefined)).toBeUndefined();
  });
});

describe("uxdr44 wall moves: drawing", () => {
  const marks = moveMarks(MOVES, onWall, undefined);

  it("uxdr44_wall_lifts_open_bins_and_dashes_targets_without_an_arrow", () => {
    const markup = renderToStaticMarkup(<WallPanel layout={LAYOUT} cells={CELLS} railLevels={[]} marks={marks} />);
    expect(markup).toContain('data-lifted="1"');
    expect(markup).toContain('data-vacated="1"');
    expect(markup).toContain('data-move-target="1"');
    expect(markup).toContain('data-move-target="2"');
    expect(markup).toContain("drop-shadow(0 6px 10px rgba(0,0,0,0.45))");
    expect(markup).toContain('stroke-dasharray="3 2.5"');
    expect(markup).toContain("data-move-plus");
    expect(markup).toContain('data-move-outdated="4"');
    expect(markup).not.toContain('data-lifted="4"');
    expect(markup).not.toContain('data-lifted="3"');
    expect(markup).not.toContain("data-move-arrow");
    expect(markup.match(/data-lifted=/g)).toHaveLength(1);
  });

  it("uxdr44_wall_markers_by_status", () => {
    const markup = renderToStaticMarkup(
      <WallMoveMarkers marks={marks} geometry={GEOMETRY} size={wallNaturalSize(LAYOUT)} scale={1} />,
    );
    const markers = [...markup.matchAll(/data-move-marker="([^"]*)" data-marker-kind="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(markers).toEqual([
      ["1", "recommended"],
      ["1", "recommended"],
      ["2", "recommended"],
      ["applied", "applied"],
      ["M", "manual"],
      ["4", "outdated"],
    ]);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("tabindex");
    expect(markup).toContain('stroke="var(--color-outdated)"');
  });

  it("uxdr44_wall_only_the_selected_move_draws_its_arrow_and_frames", () => {
    const selected = moveMarks(MOVES, onWall, moveKey(OPEN));
    const markup = renderToStaticMarkup(
      <WallPanel
        layout={LAYOUT}
        cells={CELLS}
        railLevels={[]}
        marks={selected}
        selectedEnds={{ from: OPEN.from_location.code, to: OPEN.to_location.code }}
      />,
    );
    expect(markup.match(/data-move-arrow/g)).toHaveLength(1);
    expect(markup).toContain('data-lift-frame="1"');
    expect(markup).toContain('stroke="var(--color-accent)"');
    expect(markup).toContain('fill="rgba(255,255,255,0.16)"');
    const markers = renderToStaticMarkup(
      <WallMoveMarkers marks={selected} geometry={GEOMETRY} size={wallNaturalSize(LAYOUT)} scale={1} />,
    );
    expect(markers.match(/data-marker-kind="selected"/g)).toHaveLength(2);
    // A move from another aisle has no arrow on this wall.
    const cross = renderToStaticMarkup(
      <WallPanel
        layout={LAYOUT}
        cells={CELLS}
        railLevels={[]}
        marks={moveMarks(MOVES, onWall, moveKey(CROSS))}
        selectedEnds={{ from: CROSS.from_location.code, to: CROSS.to_location.code }}
      />,
    );
    expect(cross).not.toContain("data-move-arrow");
  });

  it("uxdr44_wall_arrow_runs_from_the_lifted_bin_to_the_target", () => {
    const from = liftedRect(GEOMETRY.get("A-01-01-01")!.rect);
    const to = GEOMETRY.get("A-02-02-02")!.rect;
    const { d, head } = arrowPath(from, to);
    const [x, y] = d.slice(1).split(" ").map(Number);
    expect(x).toBeCloseTo(from.x + from.width / 2);
    expect(y).toBeCloseTo(from.y + from.height / 2);
    expect(d).toContain("Q");
    expect(head.endsWith("Z")).toBe(true);
  });

  it("uxdr44_wall_hover_note_is_hidden_with_two_lines", () => {
    const markup = renderToStaticMarkup(<WallHoverNote lines={["a", "b"]} x={4} y={5} />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("data-hover-note");
    expect(markup.match(/<p /g)).toHaveLength(2);
  });
});

describe("uxdr44 wall moves: note placement", () => {
  const box = { width: 600, height: 300 };
  const size = { width: 200, height: 40 };

  function assertClear(place: { x: number; y: number }, avoid: Rect[]) {
    const note = { ...place, ...size };
    expect(note.x).toBeGreaterThanOrEqual(0);
    expect(note.y).toBeGreaterThanOrEqual(0);
    expect(note.x + note.width).toBeLessThanOrEqual(box.width);
    expect(note.y + note.height).toBeLessThanOrEqual(box.height);
    for (const rect of avoid) expect(rectsOverlap(note, rect)).toBe(false);
  }

  it("uxdr44_note_goes_right_of_the_target_and_flips_at_the_edge", () => {
    const target = { x: 100, y: 100, width: 27, height: 29 };
    const from = { x: 40, y: 100, width: 27, height: 29 };
    const right = placeNote(target, [from, target], box, size);
    expect(right.side).toBe("right");
    assertClear(right, [from, target]);
    const edge = { x: 500, y: 100, width: 27, height: 29 };
    const flipped = placeNote(edge, [from, edge], box, size);
    expect(flipped.side).toBe("left");
    assertClear(flipped, [from, edge]);
  });

  it("uxdr44_note_never_overlaps_the_from_or_to_cell", () => {
    // Every pair of cells on a grid, including corners and neighbours.
    for (let tx = 0; tx <= 573; tx += 63) {
      for (let ty = 0; ty <= 271; ty += 38) {
        const to = { x: tx, y: ty, width: 27, height: 29 };
        for (const [dx, dy] of [
          [30, 0],
          [-30, 0],
          [0, 38],
          [0, -38],
          [210, 0],
          [-210, 0],
        ]) {
          const from = { x: tx + dx, y: ty + dy, width: 33, height: 34 };
          assertClear(placeNote(to, [from, to], box, size), [from, to]);
        }
      }
    }
  });
});

describe("uxdr42 wall moves: names and tooltip", () => {
  it("uxdr42_cell_move_texts", () => {
    expect(cellMoveText({ kind: "lift", number: 1, selected: false })).toBe("move 1, leaves here");
    expect(cellMoveText({ kind: "lift", number: 1, selected: true })).toBe("move 1, selected, leaves here");
    expect(cellMoveText({ kind: "target", number: 2, selected: false })).toBe("move 2, arrives here");
    expect(cellMoveText({ kind: "applied", number: 3, selected: true })).toBe("move 3 applied, selected, arrived here");
    expect(cellMoveText({ kind: "manual", number: null, selected: false })).toBe("manual move, arrived here");
    expect(cellMoveText({ kind: "outdated", number: 4, selected: true })).toBe("move 4 outdated, selected");
    expect(
      cellName({ code: "A-01-01-01", level: "1", best: false, occupied: true, topClass: "fast", moves: ["move 1, leaves here"] }),
    ).toBe("A-01-01-01, level 1, occupied, fast-moving, move 1, leaves here");
  });

  it("uxdr42_grid_names_cells_with_their_moves_never_aria_selected", () => {
    const marks = moveMarks(MOVES, onWall, moveKey(OPEN));
    const markup = renderToStaticMarkup(
      <WallGrid layout={LAYOUT} cells={CELLS} locations={WALL.locations} scale={1} moves={MOVES} marks={marks} />,
    );
    expect(markup).toContain('aria-label="A-01-01-01, level 1, occupied, fast-moving, move 1, selected, leaves here"');
    expect(markup).toContain('aria-label="A-02-02-02, level 2, empty, move 1, selected, arrives here"');
    expect(markup).toContain('aria-label="A-02-02-01, level 2, empty, move 2, arrives here"');
    expect(markup).toContain("move 3 applied, arrived here");
    expect(markup).toContain("manual move, arrived here");
    expect(markup).toContain("move 4 outdated");
    expect(markup).not.toContain("aria-selected");
    // The cross-aisle target's hidden description says where it comes from.
    expect(text(markup)).toContain("Recommendation 2 arrives here from G-14-04-02.");
  });

  it("uxdr42_cross_aisle_target_lines", () => {
    const marks = marksByCode(moveMarks(MOVES, onWall, undefined));
    expect(crossAisleLines(marks.get("A-02-02-01") ?? [], MOVES, "A")).toEqual([
      { tip: "From G-14-04-02 (aisle G)", description: "Recommendation 2 arrives here from G-14-04-02" },
    ]);
    expect(crossAisleLines(marks.get("A-02-02-02") ?? [], MOVES, "A")).toEqual([]);
    expect(moveFromOtherAisleText({ code: "G-14-04-02", aisle: "G" })).toBe("From G-14-04-02 (aisle G)");
    expect(moveArrivesFromText(2, "G-14-04-02")).toBe("Recommendation 2 arrives here from G-14-04-02");
  });

  it("uxdr44_hover_note_lines", () => {
    const reason = rec().reason;
    expect(hoverNoteLines(OPEN, reason)).toEqual([
      "Rule 1 · 8044172 Oil filter - Toyota Corolla",
      "33 picks (24 or more) · A-01-01-01 → A-02-02-02",
    ]);
    expect(hoverNoteLines(OPEN)).toEqual([
      "Rule 1 · 8044172 Oil filter - Toyota Corolla",
      "33 picks · A-01-01-01 → A-02-02-02",
    ]);
    const rule3 = move({ status: "open", rule: "rule_3" });
    expect(
      hoverNoteLines(rule3, { kind: "pick_group", partner: "4410281", partner_aisle: "A", shared_jobs: 14, min_shared_jobs: 5 })[1],
    ).toBe("Partner 4410281 · 14 shared jobs · A-01-01-01 → A-02-02-02");
    expect(hoverNoteLines(MANUAL, reason)).toEqual([
      "Manual · 8044172 Oil filter - Toyota Corolla",
      "33 picks · A-01-02-02 → A-02-01-02",
    ]);
  });
});

describe("fr42 wall moves: url", () => {
  it("fr42_wall_moves_url_round_trip", () => {
    expect(VIEW_QUERY_KEYS).toContain("rec");
    expect(VIEW_QUERY_KEYS).toContain("move");
    expect(wallMoveQuery(OPEN)).toEqual({ rec: "run:1" });
    expect(wallMoveQuery(APPLIED)).toEqual({ rec: "run:3" });
    expect(wallMoveQuery(MANUAL)).toEqual({ move: "6" });
    const href = planStepHref("p1", "locations", { aisle: "A", ...wallMoveQuery(OPEN) });
    expect(href).toBe("/plans/p1/locations?aisle=A&rec=run%3A1");
    const params = parseLocationParams(new URLSearchParams(href.split("?")[1]));
    expect(params).toEqual({ aisle: "A", rec: "run:1" });
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, params))).toEqual([OPEN]);
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, { move: "6" }))).toEqual([MANUAL]);
    // An id not among the aisle's entries selects nothing.
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, { rec: "other:1" }))).toEqual([]);
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, { move: "99" }))).toEqual([]);
    // `?move=` names only manual moves: an applied recommendation's move number selects nothing.
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, { move: "5" }))).toEqual([]);
    expect(MOVES.filter((candidate) => isSelectedWallMove(candidate, {}))).toEqual([]);
  });
});

describe("uxdr46 moves drawer", () => {
  const props = {
    planId: "p1",
    aisle: "A",
    round: 1,
    moves: MOVES,
    onSelect: () => {},
    version: 3,
    savingReason: undefined,
    onSend: async () => ({ outcome: "dropped" as const, events: [] }),
  };

  it("uxdr46_drawer_heading_counts_entries_and_open_ones", () => {
    expect(drawerCounts(MOVES)).toEqual({ moves: 5, toDecide: 2 });
    expect(movesDrawerHeading("A", 1, 7, 4)).toBe("Moves touching aisle A · Round 1 · 7 moves · 4 to decide");
    const markup = renderToStaticMarkup(<MovesDrawer {...props} selectedKey={undefined} rows={[rec()]} />);
    expect(text(markup)).toContain("Moves touching aisle A · Round 1 · 5 moves · 2 to decide");
    expect(text(markup)).toContain(NO_MOVE_SELECTED);
    expect(text(markup)).toContain("Show all 5");
    expect(text(markup)).toContain("Open round 1");
    expect(markup).toContain('aria-expanded="false"');
  });

  it("uxdr46_drawer_collapsed_shows_the_selected_move_with_actions", () => {
    const markup = renderToStaticMarkup(<MovesDrawer {...props} selectedKey={moveKey(OPEN)} rows={[rec()]} />);
    const words = text(markup);
    expect(words).toContain("Rule 1");
    expect(words).toContain("8044172");
    expect(words).toContain("Oil filter - Toyota Corolla");
    expect(words).toContain("Fast-moving · 33 picks");
    expect(words).toContain("A-01-01-01");
    expect(words).toContain("A-02-02-02 BEST");
    expect(words).toContain("To decide");
    expect(markup).toContain("data-drawer-apply");
    expect(markup).toContain("Keep in place");
    // Folded: the table is hidden until Show all.
    expect(markup).toMatch(/<div id="[^"]+" hidden="" class="overflow-x-auto"><table/);
  });

  it("uxdr46_drawer_table_lists_every_move_and_marks_the_selected_row", () => {
    const markup = renderToStaticMarkup(<MovesDrawer {...props} selectedKey={moveKey(APPLIED)} rows={[rec()]} />);
    const heads = [...markup.matchAll(/<th [^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual(["Rule", "Part", "Class · picks", "From", "To", "Status", "Action"]);
    const rows = [...markup.matchAll(/<tr data-row-index="(\d)"( data-selected="")?/g)];
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row[2] !== undefined).map((row) => row[1])).toEqual(["2"]);
    expect(text(markup)).toContain("Rule 1 , selected");
    // Action: Apply only for the open move with a matching row.
    expect(markup.match(/>Apply<\/button>/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Moves touching aisle A"');
  });

  it("uxdr46_drawer_without_matching_rows_has_no_actions", () => {
    const markup = renderToStaticMarkup(<MovesDrawer {...props} selectedKey={moveKey(OPEN)} rows={undefined} />);
    expect(markup).not.toContain("data-drawer-apply");
    expect(markup).not.toContain("Keep in place");
    expect(text(markup)).toContain("8044172");
    expect(joinedRow(OPEN, undefined)).toBeUndefined();
    expect(hasActions(OPEN, rec())).toBe(true);
    expect(hasActions(APPLIED, rec({ id: "run:3", status: "applied" }))).toBe(false);
    expect(hasActions(MANUAL, undefined)).toBe(false);
  });

  it("uxdr46_drawer_kept_apply_says_why", () => {
    expect(applyReason(rec({ status: "kept" }), undefined)).toBe("8044172 is kept in place.");
  });

  it("uxdr46_drawer_empty", () => {
    const markup = renderToStaticMarkup(
      <MovesDrawer {...props} round={0} moves={[]} selectedKey={undefined} rows={undefined} />,
    );
    expect(text(markup)).toContain(noMovesTouchText("A"));
    expect(text(markup)).toContain("Moves touching aisle A · Round 0 · 0 moves · 0 to decide");
    expect(markup).not.toContain("Show all");
    expect(markup).not.toContain("Open round");
  });

  it("uxdr46_drawer_outdated_status_says_why_when_its_row_agrees", () => {
    const row = rec({
      id: "run:4",
      status: "outdated",
      outdated: { cause: "marks", location: null, move_number: null, partner: null, aisle: null },
    });
    expect(drawerStatusText(OUTDATED, [row])).toBe("Outdated · The best-location marks changed.");
    expect(drawerStatusText(OUTDATED, undefined)).toBe("Outdated");
  });

  it("uxdr46_drawer_status_words", () => {
    expect(moveStatusText(OPEN)).toBe("To decide");
    expect(moveStatusText(move({ status: "kept" }))).toBe("Kept in place");
    expect(moveStatusText(APPLIED)).toBe("Applied · move 5");
    expect(moveStatusText(OUTDATED)).toBe("Outdated");
    expect(moveStatusText(MANUAL)).toBe("Manual · move 6");
  });
});
