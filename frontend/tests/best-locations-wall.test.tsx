import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AisleTabs, AisleWall, WallGrid, WallTooltip, wallCells } from "@/components/common/wall";
import type { AisleLayout, LayoutCell, LayoutView } from "@/lib/api/imports";
import type { AisleCounts, BestMark, LocationsView, PlanSummary, WallLocation, WallView } from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";
import { markPreviewText } from "@/lib/copy";
import { bestLocationsModeKey } from "@/lib/view-state/storage";
import { BestLocationsView } from "@/modules/best-locations/best-locations-page";
import { cellPreview, levelRowBoxes, markingAisle, MarkingWall, wallMarking } from "@/modules/best-locations/marking-wall";
import { markCommand, markFor, markPreview } from "@/modules/best-locations/marks";

// Story 10.7 (FR-21, FR-29, FR-42, UX-DR14/47): marking best locations on the wall. Static markup
// and pure helpers (Vitest has no DOM); hover, click, `Enter`, the toast and the redraw from the
// refetched view run in a browser in e2e/best-locations-wall.spec.ts.

const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function ref(code: string, aisle: string, level: string, isBest = false) {
  return { code, aisle, level, section: null, position: null, is_best: isBest };
}

function cell(row: number, column: number, code: string, aisle: string, level: string): LayoutCell {
  return { run: 0, row, column, gap: false, location: ref(code, aisle, level) };
}

function aisleLayout(aisle: string): AisleLayout {
  return {
    aisle,
    source: "code",
    walk_path_first: "0",
    walk_path_last: "100",
    runs: [{ levels: ["2", "1"], columns: 2, sections: [{ section: "01", first_column: 0, columns: 2 }] }],
    cells: [
      cell(0, 0, `${aisle}-01-02-01`, aisle, "2"),
      cell(0, 1, `${aisle}-01-02-02`, aisle, "2"),
      cell(1, 0, `${aisle}-01-01-01`, aisle, "1"),
      cell(1, 1, `${aisle}-01-01-02`, aisle, "1"),
    ],
  };
}

const LAYOUT: LayoutView = { aisles: [aisleLayout("A"), aisleLayout("B")] } as LayoutView;

function located(code: string, aisle: string, level: string, marks: BestMark[] = []): WallLocation {
  return {
    location: ref(code, aisle, level, marks.length > 0),
    walk_path: "10",
    occupied: false,
    parts: [],
    top_part: null,
    covering_marks: marks,
  };
}

function counts(aisle: string, marked = false): AisleCounts {
  return {
    aisle,
    locations: 4,
    occupied: 0,
    empty: 4,
    occupied_percent: "0.0",
    best: marked ? 4 : 0,
    empty_best: marked ? 4 : 0,
    moves: 0,
    aisle_marked: marked,
  };
}

const AISLE_A: BestMark = { kind: "aisle", aisle: "A" };
const LEVEL_1_ALL: BestMark = { kind: "level", level: "1", aisle: null };
const LEVEL_1_A: BestMark = { kind: "level", level: "1", aisle: "A" };
const LOC: BestMark = { kind: "location", location: "A-01-01-02" };

const CELL = located("A-01-01-02", "A", "1");

function wall(marks: BestMark[] = [], aisle = "A"): WallView {
  const aisleMarked = marks.some((mark) => mark.kind === "aisle" && mark.aisle === "A");
  return {
    version: 4,
    aisle,
    round: 0,
    locations: aisleLayout(aisle).cells.map((entry) =>
      located(entry.location!.code, aisle, entry.location!.level, aisleMarked && aisle === "A" ? [AISLE_A] : []),
    ),
    rail_levels: aisleMarked && aisle === "A" ? ["2", "1"] : [],
    moves: [],
    marks,
    aisles: [counts("A", aisleMarked), counts("B")],
    warehouse: {
      locations: 8,
      occupied: 0,
      empty: 8,
      occupied_percent: "0.0",
      best: 174,
      empty_best: 7,
    },
  };
}

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  } as unknown as Storage;
}

function renderWall(props: { marks?: BestMark[]; mode?: string; disabledReason?: string } = {}) {
  vi.stubGlobal("localStorage", storage(props.mode ? { [bestLocationsModeKey(PLAN)]: props.mode } : {}));
  return renderToStaticMarkup(
    <MarkingWall
      planId={PLAN}
      view={wall(props.marks)}
      layout={LAYOUT}
      selected="A"
      onSelect={() => {}}
      onOpenList={() => {}}
      disabledReason={props.disabledReason}
      onSend={async () => ({ outcome: "confirmed", events: [] })}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fr21 mark per mode", () => {
  it("fr21_mark_for_each_mode_and_scope", () => {
    const location = CELL.location;
    expect(markFor("aisle", "aisle", location)).toEqual(AISLE_A);
    expect(markFor("level", "aisle", location)).toEqual(LEVEL_1_A);
    expect(markFor("level", "all", location)).toEqual(LEVEL_1_ALL);
    expect(markFor("single", "all", location)).toEqual(LOC);
  });

  it("uxdr47_preview_texts", () => {
    expect(markPreview(AISLE_A, []).text).toBe("Mark aisle A");
    expect(markPreview(LEVEL_1_A, []).text).toBe("Mark level 1 in aisle A");
    expect(markPreview(LEVEL_1_ALL, []).text).toBe("Mark level 1 in all aisles");
    expect(markPreview(LOC, []).text).toBe("Mark A-01-01-02");
    expect(markPreviewText(AISLE_A, true)).toBe("Unmark aisle A");
    expect(markPreview(LEVEL_1_ALL, [LEVEL_1_ALL]).text).toBe("Unmark level 1 in all aisles");
  });

  it("fr21_exact_mark_removes_else_sets", () => {
    expect(markCommand(cellPreview("aisle", "aisle", CELL, []))).toEqual({ type: "set_best_mark", mark: AISLE_A });
    expect(markCommand(cellPreview("aisle", "aisle", CELL, [AISLE_A]))).toEqual({
      type: "remove_best_mark",
      mark: AISLE_A,
    });
    // A level mark in all aisles is not the same mark as the level in aisle A.
    expect(markCommand(cellPreview("level", "aisle", CELL, [LEVEL_1_ALL]))).toEqual({
      type: "set_best_mark",
      mark: LEVEL_1_A,
    });
  });

  it("fr21_covered_but_not_exact_sets_the_location_mark", () => {
    const covered = located("A-01-01-02", "A", "1", [AISLE_A]);
    const preview = cellPreview("single", "aisle", covered, [AISLE_A]);
    expect(preview.text).toBe("Mark A-01-01-02");
    expect(markCommand(preview)).toEqual({ type: "set_best_mark", mark: LOC });
  });
});

describe("fr21 marking on the wall", () => {
  it("fr21_click_or_enter_sends_the_mode_body", () => {
    const send = vi.fn();
    wallMarking({ mode: "aisle", scope: "aisle", marks: [], send }).onMark(CELL);
    wallMarking({ mode: "level", scope: "all", marks: [], send }).onMark(CELL);
    wallMarking({ mode: "single", scope: "aisle", marks: [LOC], send }).onMark(CELL);
    expect(send.mock.calls).toEqual([
      [{ type: "set_best_mark", mark: AISLE_A }],
      [{ type: "set_best_mark", mark: LEVEL_1_ALL }],
      [{ type: "remove_best_mark", mark: LOC }],
    ]);
  });

  it("fr10_no_send_while_saving", () => {
    const send = vi.fn();
    const marking = wallMarking({ mode: "aisle", scope: "aisle", marks: [], disabledReason: SAVING_REASON, send });
    marking.onMark(CELL);
    expect(send).not.toHaveBeenCalled();
    expect(marking.disabledReason).toBe(SAVING_REASON);
  });

  it("uxdr14_marking_grid_has_no_dialog_and_describes_the_preview_first", () => {
    const layout = aisleLayout("A");
    const view = wall();
    const marking = wallMarking({ mode: "aisle", scope: "aisle", marks: [], send: () => {} });
    const markup = renderToStaticMarkup(
      <WallGrid layout={layout} cells={wallCells(layout, view)} locations={view.locations} scale={1} marking={marking} />,
    );
    expect(markup).not.toContain("aria-haspopup");
    expect(markup).not.toContain("aria-expanded");
    expect(markup).toMatch(/<div id="[^"]+" hidden=""><p data-mark-preview-line="">Mark aisle A\.<\/p>/);
    // Without marking the cell still pins a dialog (the Locations wall is unchanged).
    const plain = renderToStaticMarkup(
      <WallGrid layout={layout} cells={wallCells(layout, view)} locations={view.locations} scale={1} />,
    );
    expect(plain).toContain('aria-haspopup="dialog"');
    expect(plain).not.toContain("data-mark-preview-line");
  });

  it("uxdr47_tooltip_shows_the_preview_as_its_first_line", () => {
    const markup = renderToStaticMarkup(
      <WallTooltip location={CELL} pinned={false} labelId="t" preview="Mark level 1 in aisle A" />,
    );
    expect(markup).toMatch(/^<div[^>]*><p[^>]*data-tip-mark-preview="">Mark level 1 in aisle A<\/p>/);
    expect(renderToStaticMarkup(<WallTooltip location={CELL} pinned={false} labelId="t" />)).not.toContain(
      "data-tip-mark-preview",
    );
  });

  it("fr42_marking_wall_draws_no_moves", () => {
    const view = {
      ...wall(),
      moves: [
        {
          kind: "manual" as const,
          recommendation_id: null,
          number: null,
          move_number: 1,
          rule: "manual" as const,
          part: "P1",
          description: "Part",
          movement_class: "fast" as const,
          picks: 3,
          from_location: ref("A-01-01-01", "A", "1"),
          to_location: ref("A-01-02-02", "A", "2"),
          status: "manual" as const,
        },
      ],
    };
    const shown = renderToStaticMarkup(<AisleWall layout={aisleLayout("A")} wall={view} />);
    const hidden = renderToStaticMarkup(<AisleWall layout={aisleLayout("A")} wall={view} showMoves={false} />);
    expect(shown).toContain("data-wall-moves");
    expect(hidden).not.toContain("data-wall-moves");
  });
});

describe("fr21 marking wall step", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage({}));
  });

  it("fr21_wall_has_tabs_modes_marks_counts_and_open_as_list", () => {
    const markup = renderWall({ marks: [AISLE_A, LEVEL_1_ALL] });
    expect(markup).toContain('role="tablist"');
    expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>Whole aisle</);
    expect(text(markup)).toContain("Level");
    expect(text(markup)).toContain("Single location");
    expect(markup).not.toContain('aria-label="Level scope"');
    expect(markup).toContain("Open as list");
    expect(markup).toMatch(/data-testid="best-counts"[^>]*>174 best · 7 empty</);
    expect(markup).toContain('aria-label="Remove mark Aisle A"');
    expect(markup).toContain('aria-label="Remove mark Level 1 in all aisles"');
    expect(markup).toMatch(/data-aisle-tab="A"[\s\S]*?data-best-tag=""/);
    expect(markup).toMatch(/<p[^>]*data-mark-preview=""><\/p>/);
    expect(markup).toContain('data-grid-cell="A-01-01-01"');
    expect(markup).not.toContain("data-level-mark");
  });

  it("uxdr47_level_buttons_only_in_level_mode_with_their_names", () => {
    const markup = renderWall({ mode: "level" });
    expect(markup).toContain('aria-label="Level scope"');
    expect(markup).toMatch(/<button[^>]*aria-label="Mark level 2 in aisle A"[^>]*data-level-mark="2"/);
    expect(markup).toMatch(/<button[^>]*aria-label="Mark level 1 in aisle A"[^>]*data-level-mark="1"/);
    expect(markup).toContain('data-surface="graphite" data-level-marks=""');
    // The buttons are drawn before (under) the grid.
    expect(markup.indexOf("data-level-mark=")).toBeLessThan(markup.indexOf('role="grid"'));
    expect(renderWall({ mode: "level", marks: [LEVEL_1_A] })).toContain('aria-label="Unmark level 1 in aisle A"');
    expect(renderWall({ mode: "single" })).not.toContain("data-level-mark");
  });

  it("uxdr47_level_row_hit_area_covers_label_and_row", () => {
    const boxes = levelRowBoxes(aisleLayout("A"), 1.25);
    expect(boxes.map((box) => box.level)).toEqual(["2", "1"]);
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(38);
      expect(box.left).toBeCloseTo(10 * 1.25);
    }
    expect(boxes[1].top - boxes[0].top).toBeCloseTo(38 * 1.25);
  });

  it("fr10_saving_disables_remove_and_level_buttons", () => {
    const markup = renderWall({ mode: "level", marks: [AISLE_A], disabledReason: SAVING_REASON });
    expect(markup).toMatch(/aria-label="Remove mark Aisle A"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Remove mark Aisle A"/);
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-level-mark="1"/);
  });

  it("fr21_no_marking_while_the_chosen_aisle_loads", () => {
    vi.stubGlobal("localStorage", storage({ [bestLocationsModeKey(PLAN)]: "level" }));
    const markup = renderToStaticMarkup(
      <MarkingWall
        planId={PLAN}
        view={wall()}
        layout={LAYOUT}
        selected="B"
        onSelect={() => {}}
        onOpenList={() => {}}
        onSend={async () => ({ outcome: "confirmed", events: [] })}
      />,
    );
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-level-mark="1"/);
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-level-mark="2"/);
    expect(renderWall({ mode: "level" })).not.toMatch(/aria-disabled="true"[^>]*data-level-mark/);
  });

  it("fr21_unknown_aisle_opens_the_first_layout_aisle", () => {
    expect(markingAisle("ZZ", ["A", "B"])).toBe("A");
    expect(markingAisle(undefined, ["A", "B"])).toBe("A");
    expect(markingAisle("B", ["A", "B"])).toBe("B");
    expect(markingAisle("A", [])).toBeUndefined();
  });

  it("fr42_aisle_tabs_shared_from_components_common_wall", () => {
    const markup = renderToStaticMarkup(
      <AisleTabs aisles={[counts("A", true), counts("B")]} selected="B" onSelect={() => {}} idPrefix="p" panelId="x" />,
    );
    expect(markup).toMatch(/data-aisle-tab="B"/);
    expect(markup).toMatch(/aria-selected="true"[^>]*data-aisle-tab="B"|data-aisle-tab="B"[^>]*aria-selected="true"/);
  });
});

describe("fr21 list mode", () => {
  const SUMMARY = { version: 4, best_locations: 1, empty_best_locations: 0 } as unknown as PlanSummary;
  const VIEW: LocationsView = {
    version: 4,
    locations: [],
    aisles: [
      { aisle: "A", locations: 2, occupied: 2, empty: 0, occupied_percent: "100.0" },
      { aisle: "B", locations: 1, occupied: 1, empty: 0, occupied_percent: "100.0" },
    ],
    warehouse: { locations: 3, occupied: 3, empty: 0, occupied_percent: "100.0" },
    marks: [],
    levels: ["1"],
  };

  function renderList(initialAisle: string | undefined) {
    return renderToStaticMarkup(
      <BestLocationsView
        planId={PLAN}
        summary={SUMMARY}
        view={VIEW}
        initialAisle={initialAisle}
        onOpenWall={() => {}}
        onSend={async () => ({ outcome: "confirmed", events: [] })}
      />,
    );
  }

  it("fr21_list_mode_table_with_aisle_filter_and_open_as_wall", () => {
    const markup = renderList("A");
    expect(markup).toContain("Open as wall");
    expect(markup).toMatch(/<option value="A" selected="">/);
    expect(markup).not.toContain('role="grid"');
    expect(renderList("ZZ")).not.toMatch(/<option value="A" selected="">/);
  });
});
