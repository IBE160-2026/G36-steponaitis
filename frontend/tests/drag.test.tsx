import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DndContext } from "@dnd-kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type WallDrag, WallGrid, wallCells } from "@/components/common/wall";
import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { CommandEvent, MovePreview, TargetPart, WallLocation, WallPart, WallView } from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";
import { CHOOSE_PART_TO_MOVE, CHOOSE_PART_TO_MOVE_BACK, dropPartStats, keptSwapWarning } from "@/lib/copy";
import {
  dragMoveToast,
  draggedPart,
  dragPreviewKey,
  dropAction,
  dropHint,
  lastMoveEvent,
  pointerHalf,
  swapToast,
} from "@/modules/locations/drag/drag";
import { DropDialogBody, dropMoveReason } from "@/modules/locations/drag/drop-dialog";
import { checkedInOrder } from "@/modules/locations/drag/drop-popover";
import {
  chosenParts,
  keptInSwap,
  OccupiedDialogBody,
  putTogetherReason,
  swapReason,
} from "@/modules/locations/drag/occupied-dialog";

// Story 12.2 (FR-51, UX-DR50, NFR-10): drag a bin on the One aisle wall and drop it on an empty
// location. Pure rules and static markup (Vitest has no DOM); the pointer journeys run in a browser
// in e2e/drag.spec.ts.

const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";

function part(number: string, picks = 10, movementClass: WallPart["movement_class"] = "fast"): WallPart {
  return {
    part: number,
    description: `Part ${number}`,
    movement_class: movementClass,
    picks,
    stock: "4",
    kept_in_place: false,
  };
}

function preview(patch: Partial<MovePreview> = {}): MovePreview {
  return {
    version: 3,
    allowed: true,
    refusal_message: null,
    effect: { kind: "new" },
    target: "empty",
    target_parts: [],
    ...patch,
  };
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const MOVE_MADE = (partNumber: string, number: number): CommandEvent => ({
  type: "move_made",
  part: partNumber,
  from_location: "G-14-04-02",
  to_location: "G-14-01-04",
  move_number: number,
  round: 1,
  rule: "manual",
});

describe("fr51 the dragged part", () => {
  it("fr51_dragged_part_one_two_halves_and_three_or_more", () => {
    expect(draggedPart([part("A")], "right")).toBe("A");
    expect(draggedPart([part("A"), part("B")], "left")).toBe("A");
    expect(draggedPart([part("A"), part("B")], "right")).toBe("B");
    expect(draggedPart([part("A", 30), part("B", 20), part("C", 10)], "right")).toBe("A");
    expect(draggedPart([], "left")).toBeUndefined();
  });

  it("fr51_pointer_half_of_the_pressed_bin", () => {
    expect(pointerHalf(100, { left: 90, width: 30 })).toBe("left");
    expect(pointerHalf(105, { left: 90, width: 30 })).toBe("left");
    expect(pointerHalf(106, { left: 90, width: 30 })).toBe("right");
  });
});

describe("uxdr50 drop targets from the server preview", () => {
  it("uxdr50_hint_for_each_target_kind", () => {
    // Empty and allowed: plus glyph + "Move here".
    expect(dropHint(preview(), false)).toBe("move");
    // FR-34: a move back to the first from-location is an allowed move to an empty location.
    expect(dropHint(preview({ effect: { kind: "removes_move", move_number: 2 } }), false)).toBe("move");
    // Occupied: ⇄ + "Swap or put together".
    expect(dropHint(preview({ target: "occupied", target_parts: [] }), false)).toBe("swap");
    // Own slot, virtual / not a location, a refusal, a failed fetch: no target.
    expect(dropHint(undefined, true)).toBe("none");
    expect(dropHint(preview(), true)).toBe("none");
    expect(dropHint(preview({ target: "none" }), false)).toBe("none");
    expect(dropHint(preview({ allowed: false, refusal_message: "No.", effect: null }), false)).toBe("none");
    expect(dropHint(null, false)).toBe("none");
    // While the preview loads, no hint shows.
    expect(dropHint(undefined, false)).toBeUndefined();
  });

  it("fr51_drop_action_for_each_matrix_row", () => {
    expect(dropAction(preview(), 1)).toBe("send");
    expect(dropAction(preview({ effect: { kind: "combines_with", move_number: 4 } }), 1)).toBe("send");
    expect(dropAction(preview(), 2)).toBe("dialog");
    expect(dropAction(preview(), 3)).toBe("dialog");
    // Occupied (Story 12.3): always the occupied dialog, whatever the from-location holds.
    expect(dropAction(preview({ target: "occupied" }), 1)).toBe("occupied");
    expect(dropAction(preview({ target: "occupied" }), 2)).toBe("occupied");
    expect(dropAction(preview({ target: "occupied", allowed: false, effect: null }), 1)).toBe("none");
    expect(dropAction(preview({ target: "none" }), 1)).toBe("none");
    expect(dropAction(preview({ allowed: false, effect: null }), 1)).toBe("none");
    expect(dropAction(null, 1)).toBe("none");
    expect(dropAction(undefined, 1)).toBe("none");
  });

  it("fr51_preview_key_includes_the_plan_version", () => {
    const key = dragPreviewKey(PLAN, "4410281", "G-14-04-02", "G-14-01-04", 7);
    expect(key).toEqual(["plan", PLAN, "move-preview", "4410281", "G-14-04-02", "G-14-01-04", 7]);
    expect(dragPreviewKey(PLAN, "4410281", "G-14-04-02", "G-14-01-04", 8)).not.toEqual(key);
  });
});

describe("fr51 drop toast", () => {
  const drop = { from: "G-14-04-02", to: "G-14-01-04" };

  it("fr51_one_part_uses_the_manual_move_toast", () => {
    expect(dragMoveToast([MOVE_MADE("4410281", 8)], drop)).toBe(
      "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1).",
    );
  });

  it("fr34_combined_and_removed_moves_keep_their_toasts", () => {
    const combined: CommandEvent = {
      type: "moves_combined",
      part: "4410281",
      from_location: "G-14-04-02",
      to_location: "G-14-01-05",
      move_number: 3,
      step_move_number: 9,
      round: 1,
    };
    const removed: CommandEvent = {
      type: "move_removed",
      part: "4410281",
      location: "G-14-04-02",
      move_number: 3,
      step_move_number: 9,
      round: 1,
    };
    expect(dragMoveToast([combined], drop)).toBe("Combined into one move: G-14-04-02 → G-14-01-05 (Manual).");
    expect(dragMoveToast([removed], drop)).toBe("Removed move 3: 4410281 returns to G-14-04-02.");
  });

  it("fr51_several_parts_name_the_count_and_undo_the_last", () => {
    const events = [MOVE_MADE("4410281", 8), MOVE_MADE("4410297", 9)];
    expect(dragMoveToast(events, drop)).toBe("Moved 2 parts: G-14-04-02 → G-14-01-04 (Manual, round 1).");
    expect(lastMoveEvent(events)).toEqual(events[1]);
    expect(lastMoveEvent([])).toBeUndefined();
  });
});

describe("fr51 drop dialog", () => {
  const parts = [part("4410281", 30), part("4410297", 12, "slow")];

  function body(checked: string[], savingReason?: string) {
    return renderToStaticMarkup(
      <DropDialogBody
        titleId="t"
        from="G-14-04-02"
        to="G-14-01-04"
        parts={parts}
        checked={new Set(checked)}
        onToggle={() => {}}
        savingReason={savingReason}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
  }

  it("fr51_dialog_lists_every_part_with_the_dragged_one_checked", () => {
    const markup = body(["4410297"]);
    expect(markup).toContain('<h2 id="t"');
    expect(text(markup)).toContain("Move to G-14-01-04");
    expect(text(markup)).toContain("Parts to move from G-14-04-02");
    expect(text(markup)).toContain("4410281 Part 4410281 Fast-moving · 4");
    expect(text(markup)).toContain("4410297 Part 4410297 Slow-moving · 4");
    expect(markup.match(/type="checkbox"/g)).toHaveLength(2);
    expect(markup.match(/checked=""/g)).toHaveLength(1);
    const dragged = markup.slice(markup.indexOf('data-drop-part="4410297"'));
    expect(dragged.slice(0, dragged.indexOf("</label>"))).toContain('checked=""');
    // Move (primary) and Cancel; Move is enabled with a part checked.
    expect(text(markup)).toMatch(/Cancel .*Move/);
    expect(markup).not.toContain('aria-disabled="true"');
  });

  it("uxdr50_move_disabled_with_its_reason_when_nothing_is_checked", () => {
    const markup = body([]);
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain(CHOOSE_PART_TO_MOVE);
    expect(dropMoveReason(0, undefined)).toBe("Choose at least one part to move.");
    expect(dropMoveReason(1, undefined)).toBeUndefined();
  });

  it("fr10_move_shows_the_saving_reason", () => {
    const markup = body(["4410281"], SAVING_REASON);
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Saving the last change…");
    expect(dropMoveReason(0, SAVING_REASON)).toBe(SAVING_REASON);
  });

  it("fr51_move_sends_checked_parts_in_from_location_order", () => {
    expect(checkedInOrder(parts, new Set(["4410297", "4410281"]))).toEqual(["4410281", "4410297"]);
    expect(checkedInOrder(parts, new Set(["4410297"]))).toEqual(["4410297"]);
  });
});

// Story 12.3 (FR-51, FR-32, FR-33, UX-DR50, UX-DR10): a drop on an occupied location.

function moveMade(partNumber: string, number: number, from: string, to: string): CommandEvent {
  return { type: "move_made", part: partNumber, from_location: from, to_location: to, move_number: number, round: 1, rule: "manual" };
}

function target(number: string, patch: Partial<TargetPart> = {}): TargetPart {
  return {
    part: number,
    description: `Part ${number}`,
    movement_class: "medium",
    picks: 5,
    stock: "6",
    kept_in_place: false,
    ...patch,
  };
}

describe("fr51 swap toast", () => {
  it("fr51_swap_toast_counts_the_swap_moves_and_undoes_the_last", () => {
    const back = moveMade("4410297", 9, "G-14-01-03", "G-14-04-02");
    // The server returns `swap_made` first, then the steps' move events.
    const events: CommandEvent[] = [
      {
        type: "swap_made",
        swap_id: "s",
        from_location: "G-14-04-02",
        to_location: "G-14-01-03",
        move_numbers: [8, 9],
        round: 1,
      },
      MOVE_MADE("4410281", 8),
      back,
    ];
    expect(swapToast(events)).toBe("Swapped G-14-04-02 ↔ G-14-01-03 · 2 manual moves, round 1.");
    // lastMoveEvent skips swap_made: the toast's Undo undoes the back-part's move first (FR-35).
    expect(lastMoveEvent(events)).toEqual(back);
    expect(swapToast([MOVE_MADE("4410281", 8)])).toBeNull();
  });

  it("fr51_fr34_swap_toast_counts_only_legs_that_are_their_own_move", () => {
    const made = (moveNumbers: number[]): CommandEvent => ({
      type: "swap_made",
      swap_id: "s",
      from_location: "G-14-04-02",
      to_location: "G-14-01-03",
      move_numbers: moveNumbers,
      round: 1,
    });
    expect(swapToast([made([8])])).toBe("Swapped G-14-04-02 ↔ G-14-01-03 · 1 manual move, round 1.");
    expect(swapToast([made([])])).toBe("Swapped G-14-04-02 ↔ G-14-01-03 · 0 manual moves, round 1.");
  });

  it("fr33_put_together_toast_reuses_the_drop_wording", () => {
    const drop = { from: "G-14-04-02", to: "G-14-01-03" };
    const one = moveMade("4410281", 8, "G-14-04-02", "G-14-01-03");
    expect(dragMoveToast([one], drop)).toBe("Moved 4410281: G-14-04-02 → G-14-01-03 (Manual, round 1).");
    expect(dragMoveToast([one, moveMade("4410297", 9, "G-14-04-02", "G-14-01-03")], drop)).toBe(
      "Moved 2 parts: G-14-04-02 → G-14-01-03 (Manual, round 1).",
    );
  });
});

describe("uxdr50 occupied drop dialog rules", () => {
  const one = [part("A")];
  const two = [part("A", 30), part("B", 20)];

  it("uxdr50_a_side_with_one_part_moves_it_without_a_checkbox", () => {
    expect(chosenParts(one, new Set())).toEqual(["A"]);
    expect(chosenParts(two, new Set(["B"]))).toEqual(["B"]);
    expect(chosenParts(two, new Set(["B", "A"]))).toEqual(["A", "B"]);
    expect(chosenParts(two, new Set())).toEqual([]);
  });

  it("uxdr10_reasons_for_every_matrix_row_saving_first", () => {
    // Saving: both buttons show the saving reason, before any other.
    expect(swapReason(0, 0, SAVING_REASON)).toBe(SAVING_REASON);
    expect(putTogetherReason(0, SAVING_REASON)).toBe(SAVING_REASON);
    // No part to move: both.
    expect(swapReason(0, 1, undefined)).toBe(CHOOSE_PART_TO_MOVE);
    expect(swapReason(0, 0, undefined)).toBe(CHOOSE_PART_TO_MOVE);
    expect(putTogetherReason(0, undefined)).toBe(CHOOSE_PART_TO_MOVE);
    // No part to move back: Swap only.
    expect(swapReason(1, 0, undefined)).toBe("Choose at least one part to move back.");
    expect(putTogetherReason(1, undefined)).toBeUndefined();
    // Both sides chosen.
    expect(swapReason(1, 1, undefined)).toBeUndefined();
  });

  it("fr32_kept_parts_in_the_swap_one_several_unchecked", () => {
    const from = [part("A"), { ...part("B"), kept_in_place: true }];
    const back = [target("C", { kept_in_place: true }), target("D", { kept_in_place: true })];
    expect(keptInSwap(from, ["A"], back, ["C"])).toEqual(["C"]);
    expect(keptInSwap(from, ["A", "B"], back, ["C", "D"])).toEqual(["B", "C", "D"]);
    // An unchecked kept part is not in the swap.
    expect(keptInSwap(from, ["A"], back, [])).toEqual([]);
    expect(keptSwapWarning(["4410297"])).toBe("4410297 is kept in place. Swap anyway?");
    expect(keptSwapWarning(["4410297", "4410300"])).toBe("4410297 and 4410300 are kept in place. Swap anyway?");
    expect(keptSwapWarning(["A", "B", "C"])).toBe("A, B and C are kept in place. Swap anyway?");
  });

  it("uxdr50_null_class_row_shows_the_stock_alone", () => {
    expect(dropPartStats(null, "6")).toBe("6");
    expect(dropPartStats("medium", "6")).toBe("Medium-moving · 6");
  });
});

describe("fr51 occupied drop dialog", () => {
  function body({
    parts = [part("4410281")],
    targetParts = [target("4410297")],
    checked = ["4410281"],
    checkedBack = targetParts.map((entry) => entry.part),
    savingReason,
  }: {
    parts?: WallPart[];
    targetParts?: TargetPart[];
    checked?: string[];
    checkedBack?: string[];
    savingReason?: string;
  } = {}) {
    return renderToStaticMarkup(
      <OccupiedDialogBody
        titleId="t"
        from="G-14-04-02"
        to="G-14-01-03"
        parts={parts}
        targetParts={targetParts}
        checked={new Set(checked)}
        checkedBack={new Set(checkedBack)}
        onToggle={() => {}}
        onToggleBack={() => {}}
        savingReason={savingReason}
        onSwap={() => {}}
        onPutTogether={() => {}}
        onCancel={() => {}}
      />,
    );
  }

  function button(markup: string, label: string): string {
    const tags = markup.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
    return tags.find((tag) => tag.endsWith(`>${label}</button>`)) ?? "";
  }

  it("fr51_one_part_each_side_has_no_groups_and_three_buttons", () => {
    const markup = body();
    expect(markup).toContain('<h2 id="t"');
    expect(text(markup)).toContain("G-14-01-03 is occupied");
    expect(markup).not.toContain("<fieldset");
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).not.toContain("data-kept-warning");
    // Swap, Put together, Cancel in this order; no primary button, all enabled.
    expect(text(markup)).toMatch(/Swap .*Put together .*Cancel/);
    expect(markup).not.toContain("bg-ink text-surface");
    expect(markup).not.toContain('aria-disabled="true"');
  });

  it("uxdr50_groups_only_when_several_with_all_back_parts_checked", () => {
    const markup = body({
      parts: [part("4410281", 30), part("4410290", 20)],
      targetParts: [target("4410297"), target("4410300", { movement_class: null })],
    });
    expect(text(markup)).toContain("Parts to move from G-14-04-02");
    expect(text(markup)).toContain("Parts to move back to G-14-04-02");
    expect(markup.match(/type="checkbox"/g)).toHaveLength(4);
    // The dragged from-part and both back-parts are checked.
    expect(markup.match(/checked=""/g)).toHaveLength(3);
    const back = markup.slice(markup.indexOf('data-drop-group="back"'));
    expect(back.match(/checked=""/g)).toHaveLength(2);
    // A back-part without a class: no glyph, the stock alone.
    const nullRow = markup.slice(markup.indexOf('data-drop-part="4410300"'));
    const row = nullRow.slice(0, nullRow.indexOf("</label>"));
    expect(row).not.toContain("<svg");
    expect(text(row)).toContain("4410300 Part 4410300 6");
    expect(text(markup)).toContain("4410297 Part 4410297 Medium-moving · 6");

    // Only the target holds several: the back group alone, every back-part checked.
    const backOnly = body({ targetParts: [target("4410297"), target("4410300")] });
    expect(backOnly).toContain('data-drop-group="back"');
    expect(backOnly).not.toContain('data-drop-group="from"');
    expect(backOnly.match(/type="checkbox"/g)).toHaveLength(2);
    expect(backOnly.match(/checked=""/g)).toHaveLength(2);

    // Only the from-side holds several: the back group is not shown.
    const fromOnly = body({ parts: [part("4410281", 30), part("4410290", 20)] });
    expect(fromOnly).toContain('data-drop-group="from"');
    expect(fromOnly).not.toContain('data-drop-group="back"');
  });

  it("uxdr10_reasons_via_aria_describedby", () => {
    const parts = [part("4410281", 30), part("4410290", 20)];
    const targetParts = [target("4410297"), target("4410300")];
    const none = body({ parts, targetParts, checked: [] });
    for (const label of ["Swap", "Put together"]) {
      expect(button(none, label)).toContain('aria-disabled="true"');
      expect(button(none, label)).toContain("aria-describedby=");
    }
    expect(none.match(new RegExp(CHOOSE_PART_TO_MOVE.replace(".", "\\."), "g"))).toHaveLength(2);

    const noBack = body({ parts, targetParts, checkedBack: [] });
    expect(button(noBack, "Swap")).toContain('aria-disabled="true"');
    expect(button(noBack, "Put together")).not.toContain("aria-disabled");
    expect(noBack).toContain(CHOOSE_PART_TO_MOVE_BACK);

    const saving = body({ savingReason: SAVING_REASON });
    expect(button(saving, "Swap")).toContain('aria-disabled="true"');
    expect(button(saving, "Put together")).toContain('aria-disabled="true"');
    expect(saving.match(/Saving the last change…/g)).toHaveLength(2);
  });

  it("fr32_kept_warning_above_the_buttons_and_swap_enabled", () => {
    const markup = body({ targetParts: [target("4410297", { kept_in_place: true })] });
    expect(markup).toContain("data-kept-warning");
    expect(text(markup)).toContain("4410297 is kept in place. Swap anyway?");
    expect(markup.indexOf("data-kept-warning")).toBeLessThan(markup.indexOf("<button"));
    expect(markup).toMatch(/data-kept-warning=""[^>]*>\s*<svg[^>]*aria-hidden="true"/);
    expect(button(markup, "Swap")).not.toContain("aria-disabled");
    // The warning describes Swap, so a keyboard or screen-reader user hears it there.
    const warningId = /<p id="([^"]+)"[^>]*data-kept-warning/.exec(markup)![1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(button(markup, "Swap"))![1];
    expect(describedBy.split(" ")).toContain(warningId);

    // An unchecked kept back-part gives no warning.
    const unchecked = body({
      targetParts: [target("4410297"), target("4410300", { kept_in_place: true })],
      checkedBack: ["4410297"],
    });
    expect(unchecked).not.toContain("data-kept-warning");

    // No swap possible (no part to move, or no back-part): no warning, only the reason.
    const kept = { kept_in_place: true };
    const parts = [part("4410281", 30), part("4410290", 20)];
    expect(body({ parts, targetParts: [target("4410297", kept)], checked: [] })).not.toContain("data-kept-warning");
    const noBack = body({ targetParts: [target("4410297", kept), target("4410300", kept)], checkedBack: [] });
    expect(noBack).not.toContain("data-kept-warning");
    expect(noBack).toContain(CHOOSE_PART_TO_MOVE_BACK);
  });
});

function cell(row: number, column: number, code: string): LayoutCell {
  return {
    run: 0,
    row,
    column,
    gap: false,
    location: { code, aisle: "A", level: String(2 - row), section: "01", position: null, is_best: false },
  };
}

const LAYOUT: AisleLayout = {
  aisle: "A",
  source: "code",
  walk_path_first: "0",
  walk_path_last: "100",
  runs: [{ levels: ["2", "1"], columns: 2, sections: [{ section: "01", first_column: 0, columns: 2 }] }],
  cells: [cell(0, 0, "A-01-02-01"), cell(0, 1, "A-01-02-02"), cell(1, 0, "A-01-01-01"), cell(1, 1, "A-01-01-02")],
};

function located(code: string, parts: WallPart[] = []): WallLocation {
  return {
    location: { code, aisle: "A", level: code.slice(5, 7) === "02" ? "2" : "1", section: "01", position: null, is_best: false },
    walk_path: "10",
    occupied: parts.length > 0,
    parts,
    top_part: parts[0] ?? null,
    covering_marks: [],
  };
}

const VIEW = {
  version: 3,
  aisle: "A",
  round: 0,
  rail_levels: [],
  locations: [
    located("A-01-02-01", [part("4410281")]),
    located("A-01-02-02"),
    located("A-01-01-01"),
    located("A-01-01-02", [part("4410297")]),
  ],
} as unknown as WallView;

function grid(drag?: WallDrag) {
  const markup = (
    <WallGrid layout={LAYOUT} cells={wallCells(LAYOUT, VIEW)} locations={VIEW.locations} scale={1} drag={drag} />
  );
  return renderToStaticMarkup(drag ? <DndContext>{markup}</DndContext> : markup);
}

/** Every gridcell's opening tag, without the drag-only attributes and classes. */
function cellTags(markup: string): string[] {
  return (markup.match(/<div[^>]*role="gridcell"[^>]*>/g) ?? []).map((tag) =>
    tag
      .replace(/ class="[^"]*"/, "")
      .replace(/ data-drop-target="[^"]*"| data-drag-vacated=""/g, "")
      .replace(/_R_[^-"]*_/g, "id"),
  );
}

describe("nfr10 drag only on the One aisle wall, never on the keyboard path", () => {
  const idle: WallDrag = { activeCode: null, over: null, canDrag: (location) => location.parts.length > 0 };

  it("nfr10_drag_binding_keeps_the_grid_roles_names_and_tab_stop", () => {
    const plain = grid();
    const bound = grid(idle);
    expect(cellTags(bound)).toEqual(cellTags(plain));
    // dnd-kit's attributes are never spread: no button role, roledescription or extra tab stops.
    expect(bound).not.toContain("aria-roledescription");
    expect(bound).not.toContain('role="button"');
    expect(bound.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it("uxdr50_vacated_slot_and_target_hints", () => {
    const moving = grid({ ...idle, activeCode: "A-01-02-01", over: { code: "A-01-02-02", hint: "move" } });
    expect(moving).toMatch(/data-grid-cell="A-01-02-01"[^>]*data-drag-vacated=""/);
    expect(moving).toContain("data-vacated");
    expect(moving).toMatch(/data-grid-cell="A-01-02-02"[^>]*data-drop-target="move"/);
    expect(moving).toContain('data-drop-hint="move"');
    expect(text(moving)).toContain("Move here");

    const swapping = grid({ ...idle, activeCode: "A-01-02-01", over: { code: "A-01-01-02", hint: "swap" } });
    expect(swapping).toMatch(/data-grid-cell="A-01-01-02"[^>]*data-drop-target="swap"/);
    expect(text(swapping)).toContain("Swap or put together");

    const own = grid({ ...idle, activeCode: "A-01-02-01", over: { code: "A-01-02-01", hint: "none" } });
    expect(own).toMatch(/data-grid-cell="A-01-02-01"[^>]*data-drop-target="none"[^>]*class="[^"]*cursor-not-allowed/);
    expect(own).not.toContain("data-drop-hint");

    const loading = grid({ ...idle, activeCode: "A-01-02-01", over: { code: "A-01-02-02", hint: undefined } });
    expect(loading).not.toContain("data-drop-target");
  });

  it("nfr10_marking_wall_warehouse_and_crops_pass_no_drag", () => {
    const root = join(__dirname, "..");
    for (const file of [
      "modules/best-locations/marking-wall.tsx",
      "modules/locations/warehouse-view.tsx",
      "modules/locations/mini-wall.tsx",
      "modules/recommendations/crops.tsx",
    ]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/\bdrag[=:]/);
      expect(source).not.toContain("WallDragProvider");
    }
    // The marking grid (no binding) carries no drag markup.
    const marking = renderToStaticMarkup(
      <WallGrid
        layout={LAYOUT}
        cells={wallCells(LAYOUT, VIEW)}
        locations={VIEW.locations}
        scale={1}
        marking={{ preview: () => "Mark aisle A", onMark: () => {} }}
      />,
    );
    expect(marking).not.toContain("data-drop-target");
    expect(marking).not.toContain("data-drag-vacated");
    expect(marking).not.toContain("cursor-grabbing");
  });
});
