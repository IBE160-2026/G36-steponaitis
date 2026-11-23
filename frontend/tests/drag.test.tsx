import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DndContext } from "@dnd-kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type WallDrag, WallGrid, wallCells } from "@/components/common/wall";
import type { AisleLayout, LayoutCell } from "@/lib/api/imports";
import type { CommandEvent, MovePreview, WallLocation, WallPart, WallView } from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";
import { CHOOSE_PART_TO_MOVE } from "@/lib/copy";
import {
  dragMoveToast,
  draggedPart,
  dragPreviewKey,
  dropAction,
  dropHint,
  lastMoveEvent,
  pointerHalf,
} from "@/modules/locations/drag/drag";
import { checkedInOrder, DropDialogBody, dropMoveReason } from "@/modules/locations/drag/drop-dialog";

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
    // Occupied: the hint only, nothing sent in this story.
    expect(dropAction(preview({ target: "occupied" }), 1)).toBe("none");
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
