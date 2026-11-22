import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nextRadioIndex, SegmentedControl } from "@/components/common/segmented-control";
import type { BestMark, CommandEvent, LocationRow, LocationsView, PlanSummary } from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";
import { MARKS_CHANGED } from "@/lib/copy";
import { recommendationsTabHref } from "@/lib/view-state/urls";
import { bestLocationsModeKey, readStored, writeStored } from "@/lib/view-state/storage";
import {
  aisleAction,
  BestLocationsView,
  CHOOSE_AISLE,
  levelAction,
  NO_MARKS,
  outdatedCount,
  readMode,
  sendMarkChange,
} from "@/modules/best-locations/best-locations-page";
import { bestCountsLine, hasLocationMark, levelsInAisle, markLabel, sameMark } from "@/modules/best-locations/marks";

// Story 3.4: the Best locations step (FR-21, FR-22, UX-DR: segmented control, marks list, counts,
// remembered mode). Rendered to static markup; Vitest has no DOM, so keyboard logic is a pure helper.

const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";

function row(code: string, aisle: string, level: string, covering: BestMark[] = []): LocationRow {
  return {
    location: { code, aisle, level, section: "1", position: "1", is_best: covering.length > 0 },
    walk_path: "10",
    occupied: true,
    contents: [],
    covering_marks: covering,
  };
}

const AISLE_A: BestMark = { kind: "aisle", aisle: "A" };
const LEVEL_1_ALL: BestMark = { kind: "level", level: "1", aisle: null };
const LEVEL_1_A: BestMark = { kind: "level", level: "1", aisle: "A" };
const LOC_B: BestMark = { kind: "location", location: "B-01-02" };

function view(marks: BestMark[] = [], locations?: LocationRow[]): LocationsView {
  return {
    version: 4,
    locations: locations ?? [row("A-01-01", "A", "1"), row("A-01-02", "A", "2"), row("B-01-02", "B", "2")],
    aisles: [
      { aisle: "A", locations: 2, occupied: 2, empty: 0, occupied_percent: "100.0" },
      { aisle: "B", locations: 1, occupied: 1, empty: 0, occupied_percent: "100.0" },
    ],
    warehouse: { locations: 3, occupied: 3, empty: 0, occupied_percent: "100.0" },
    marks,
    levels: ["1", "2", "10"],
  };
}

const SUMMARY = { version: 4, best_locations: 1_234, empty_best_locations: 7 } as unknown as PlanSummary;

function render(props: { marks?: BestMark[]; locations?: LocationRow[]; disabledReason?: string } = {}) {
  return renderToStaticMarkup(
    <BestLocationsView
      planId={PLAN}
      summary={SUMMARY}
      view={view(props.marks, props.locations)}
      disabledReason={props.disabledReason}
      onSend={async () => ({ outcome: "confirmed", events: [] })}
    />,
  );
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  } as unknown as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fr21 mark helpers", () => {
  it("fr21_mark_labels", () => {
    expect(markLabel(AISLE_A)).toBe("Aisle A");
    expect(markLabel(LEVEL_1_A)).toBe("Level 1 in aisle A");
    expect(markLabel(LEVEL_1_ALL)).toBe("Level 1 in all aisles");
    expect(markLabel({ kind: "level", level: "1" })).toBe("Level 1 in all aisles");
    expect(markLabel({ kind: "location", location: "A-01-01-01" })).toBe("Location A-01-01-01");
  });

  it("fr21_same_mark", () => {
    expect(sameMark(AISLE_A, { kind: "aisle", aisle: "A" })).toBe(true);
    expect(sameMark(AISLE_A, { kind: "aisle", aisle: "a" })).toBe(false);
    expect(sameMark(LEVEL_1_ALL, { kind: "level", level: "1" })).toBe(true);
    expect(sameMark(LEVEL_1_ALL, LEVEL_1_A)).toBe(false);
    expect(sameMark(LOC_B, { kind: "location", location: "B-01-02" })).toBe(true);
    expect(sameMark(AISLE_A, LOC_B)).toBe(false);
  });

  it("fr21_has_location_mark_reads_covering_marks", () => {
    expect(hasLocationMark(row("B-01-02", "B", "2", [LOC_B]))).toBe(true);
    expect(hasLocationMark(row("B-01-02", "B", "2", [AISLE_A]))).toBe(false);
    expect(hasLocationMark(row("A-01-01", "A", "1", [LOC_B]))).toBe(false);
  });

  it("fr22_best_counts_line", () => {
    expect(bestCountsLine(174, 7)).toBe("174 best · 7 empty");
    expect(bestCountsLine(1_234, 0)).toBe("1,234 best · 0 empty");
  });

  it("fr21_levels_in_aisle_keep_server_order", () => {
    const rows = [row("A-10", "A", "10"), row("A-1", "A", "1"), row("B-2", "B", "2")];
    expect(levelsInAisle(["1", "2", "10"], rows, "A")).toEqual(["1", "10"]);
    expect(levelsInAisle(["1", "2", "10"], rows, "B")).toEqual(["2"]);
    expect(levelsInAisle(["1", "2", "10"], rows, "")).toEqual(["1", "2", "10"]);
  });
});

describe("uxdr segmented control", () => {
  it("uxdr_segmented_control_arrow_keys_wrap", () => {
    expect(nextRadioIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextRadioIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextRadioIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextRadioIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextRadioIndex("Home", 2, 3)).toBe(0);
    expect(nextRadioIndex("End", 0, 3)).toBe(2);
    expect(nextRadioIndex("Enter", 0, 3)).toBeNull();
    expect(nextRadioIndex("ArrowRight", 0, 0)).toBeNull();
  });

  it("uxdr_segmented_control_is_a_radio_group", () => {
    const markup = renderToStaticMarkup(
      <SegmentedControl
        label="Marking mode"
        options={[
          { value: "a", label: "One" },
          { value: "b", label: "Two" },
        ]}
        value="b"
        onChange={() => {}}
      />,
    );
    expect(markup).toContain('role="radiogroup" aria-label="Marking mode"');
    expect(markup).toMatch(/role="radio" aria-checked="false" tabindex="-1"[^>]*>One</);
    expect(markup).toMatch(/role="radio" aria-checked="true" tabindex="0"[^>]*>Two</);
  });
});

describe("uxdr best locations step", () => {
  it("fr21_empty_state_and_counts", () => {
    vi.stubGlobal("localStorage", storage({}));
    const plain = text(render());
    expect(plain).toContain("Best locations");
    expect(plain).toContain(NO_MARKS);
    expect(NO_MARKS).toBe(
      "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations.",
    );
    expect(plain).toContain("1,234 best · 7 empty");
    expect(MARKS_CHANGED).toBe("Best-location marks changed.");
  });

  it("fr21_marks_list_labels_and_remove_buttons", () => {
    vi.stubGlobal("localStorage", storage({}));
    const markup = render({ marks: [AISLE_A, LEVEL_1_ALL, LEVEL_1_A, LOC_B] });
    expect(text(markup)).not.toContain(NO_MARKS);
    for (const label of ["Aisle A", "Level 1 in all aisles", "Level 1 in aisle A", "Location B-01-02"]) {
      expect(markup).toContain(`<span>${label}</span>`);
      expect(markup).toContain(`aria-label="Remove mark ${label}"`);
    }
    expect(markup.match(/data-icon="close"/g)).toHaveLength(4);
    expect(markup).toContain("w-control-sm");
  });

  it("fr21_mark_aisle_needs_an_aisle", () => {
    vi.stubGlobal("localStorage", storage({}));
    const markup = render();
    expect(markup).toMatch(/aria-disabled="true"[^>]*>Mark aisle</);
    expect(markup).toContain(CHOOSE_AISLE);
    expect(CHOOSE_AISLE).toBe("Choose an aisle in the aisle filter.");
  });

  it("fr21_mark_button_actions_and_already_marked", () => {
    expect(aisleAction("A", [])).toEqual({ mark: AISLE_A, text: "Mark aisle A", reason: undefined });
    expect(aisleAction("A", [AISLE_A]).reason).toBe("Aisle A is already marked.");
    expect(aisleAction("", [])).toEqual({ mark: null, text: "Mark aisle", reason: CHOOSE_AISLE });
    expect(levelAction("1", "all", "", [])).toEqual({
      mark: LEVEL_1_ALL,
      text: "Mark level 1 in all aisles",
      reason: undefined,
    });
    expect(levelAction("1", "all", "B", [LEVEL_1_ALL]).reason).toBe("Level 1 in all aisles is already marked.");
    expect(levelAction("2", "aisle", "B", [])).toEqual({
      mark: { kind: "level", level: "2", aisle: "B" },
      text: "Mark level 2 in aisle B",
      reason: undefined,
    });
    expect(levelAction("1", "aisle", "A", [LEVEL_1_ALL]).reason).toBeUndefined();
    expect(levelAction("1", "aisle", "", []).reason).toBe(CHOOSE_AISLE);
  });

  it("fr10_saving_disables_every_mark_control", () => {
    vi.stubGlobal("localStorage", storage({ [bestLocationsModeKey(PLAN)]: "single" }));
    const markup = render({ marks: [AISLE_A], disabledReason: SAVING_REASON });
    expect(markup).toMatch(/aria-disabled="true"[^>]*aria-label="Remove mark Aisle A"/);
    expect(markup).toMatch(/aria-disabled="true"[^>]*aria-label="Mark A-01-01"/);
    expect(markup).toContain(SAVING_REASON);
    expect(markup).not.toMatch(/<button(?![^>]*aria-disabled)[^>]*aria-label="(Mark|Unmark|Remove mark) /);
  });

  it("fr21_single_mode_shows_mark_and_unmark", () => {
    vi.stubGlobal("localStorage", storage({ [bestLocationsModeKey(PLAN)]: "single" }));
    const locations = [row("A-01-01", "A", "1", [AISLE_A]), row("B-01-02", "B", "2", [LOC_B])];
    const markup = render({ marks: [AISLE_A, LOC_B], locations });
    expect(markup).toMatch(/aria-label="Mark A-01-01"[^>]*>Mark</);
    expect(markup).toMatch(/aria-label="Unmark B-01-02"[^>]*>Unmark</);
    expect(markup).not.toContain("aria-disabled");
    expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>Single location</);
  });

  it("fr21_level_mode_lists_server_levels", () => {
    vi.stubGlobal("localStorage", storage({ [bestLocationsModeKey(PLAN)]: "level" }));
    const markup = render();
    expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>Level</);
    expect(markup).toContain('aria-label="Level scope"');
    expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>in this aisle</);
    expect(markup).toMatch(/<option value="1"[^>]*>1<\/option><option value="2">2<\/option><option value="10">10</);
    expect(markup).toMatch(/aria-disabled="true"[^>]*>Mark level 1 in this aisle</);
    expect(markup).toContain(CHOOSE_AISLE);
  });

  it("uxdr_mode_read_from_a_throwing_storage_defaults_to_whole_aisle", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStored("x")).toBeNull();
    expect(() => writeStored("x", "y")).not.toThrow();
    expect(readMode(PLAN)).toBe("aisle");
    expect(render()).toMatch(/role="radio" aria-checked="true"[^>]*>Whole aisle</);
  });

  it("uxdr_mode_is_remembered_per_plan", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));
    expect(bestLocationsModeKey(PLAN)).toBe(`swp:best-locations-mode:${PLAN}`);
    writeStored(bestLocationsModeKey(PLAN), "level");
    expect(readMode(PLAN)).toBe("level");
    expect(readMode("other")).toBe("aisle");
    values[bestLocationsModeKey(PLAN)] = "wall";
    expect(readMode(PLAN)).toBe("aisle");
  });

  it("fr21_toast_only_after_a_confirmed_change", async () => {
    const body = { type: "set_best_mark", mark: AISLE_A } as const;
    const event: CommandEvent = { type: "mark_set", mark: AISLE_A };
    for (const [outcome, events, toasts] of [
      ["confirmed", [event], [MARKS_CHANGED]],
      // Retro 24: a confirmed no-op (no events) changed nothing, so no toast.
      ["confirmed", [], []],
      ["dropped", [], []],
      ["busy", [], []],
    ] as const) {
      const notify = vi.fn();
      const result = { outcome, events: [...events] };
      const send = vi.fn(async () => result);
      expect(await sendMarkChange(send, body, notify)).toBe(result);
      expect(send).toHaveBeenCalledWith(body);
      expect(notify.mock.calls.map(([message]) => message)).toEqual(toasts);
    }
  });

  it("fr29_toast_counts_outdated_recommendations_with_view", async () => {
    const body = { type: "remove_best_mark", mark: AISLE_A } as const;
    const removed: CommandEvent = { type: "mark_removed", mark: AISLE_A };
    const marks: CommandEvent = { type: "recommendations_outdated", count: 2, cause: "marks" };
    const filled: CommandEvent = { type: "recommendations_outdated", count: 1, cause: "filled" };
    expect(outdatedCount([removed, marks, filled])).toBe(3);
    expect(outdatedCount([removed])).toBe(0);

    const onView = vi.fn();
    for (const [events, message, hasView] of [
      [[removed, marks, filled], "Best-location marks changed · 3 recommendations are now outdated", true],
      [[removed, { ...marks, count: 1 }], "Best-location marks changed · 1 recommendation is now outdated", true],
      [[removed], MARKS_CHANGED, false],
    ] as const) {
      const notify = vi.fn();
      const send = vi.fn(async () => ({ outcome: "confirmed" as const, events: [...events] }));
      await sendMarkChange(send, body, notify, onView);
      expect(notify).toHaveBeenCalledTimes(1);
      const [text, options] = notify.mock.calls[0];
      expect(text).toBe(message);
      if (hasView) {
        expect(options.action.label).toBe("View");
        options.action.onClick();
      } else {
        expect(options).toBeUndefined();
      }
    }
    expect(onView).toHaveBeenCalledTimes(2);
    expect(recommendationsTabHref(PLAN, "outdated")).toBe(`/plans/${PLAN}/recommendations?tab=outdated`);
  });
});
