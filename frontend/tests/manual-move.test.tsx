import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CHECKING,
  confirmReason,
  effectLine,
  ENTER_TO,
  fromChoices,
  locationCode,
  matchLocations,
  moveToast,
  ToLocationField,
} from "@/components/common/manual-move-dialog";
import { MANUAL_MOVE_LABEL, ManualMoveButton, manualMoveReason, NO_CURRENT_LOCATION } from "@/components/common/part-panel";
import type { CommandEvent, LocationRef, MovePreview, PartDetail, TargetPart } from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";

// Story 4.3: the manual move dialog and the part panel's Manual move… (FR-15, FR-33, FR-34,
// UX-DR24, UX-DR26). Pure helpers plus static markup; Vitest has no DOM, keyboard journeys are in
// e2e/manual-move.spec.ts.

function ref(code: string): LocationRef {
  return { code, aisle: code.slice(0, 1), level: "1", section: "1", position: "1", is_best: false };
}

function detail(current: string | null, others: string[] = []): Pick<PartDetail, "current_location" | "other_locations"> {
  return {
    current_location: current === null ? null : ref(current),
    other_locations: others.map((code) => ({ location: ref(code), stock: "1" })),
  };
}

function target(part: string): TargetPart {
  return { part, description: `Part ${part}`, movement_class: "fast", picks: 3, stock: "2", kept_in_place: false };
}

function preview(patch: Partial<MovePreview>): MovePreview {
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

describe("fr33 from-location choices", () => {
  it("fr33_from_choices_current_first_then_others", () => {
    expect(fromChoices(detail("B-01-03-02"))).toEqual(["B-01-03-02"]);
    expect(fromChoices(detail("B-01-03-02", ["A-01-01-01", "C-02-01-01"]))).toEqual([
      "B-01-03-02",
      "A-01-01-01",
      "C-02-01-01",
    ]);
    expect(fromChoices(detail(null))).toEqual([]);
  });
});

describe("uxdr26 to-location autocomplete", () => {
  const CODES = ["A-01-01-01", "A-01-01-02", "A-02-01-01", "B-01-03-02", "C-01-01-01"];

  it("uxdr26_match_locations_prefix_in_server_order", () => {
    expect(matchLocations(CODES, "a-01")).toEqual(["A-01-01-01", "A-01-01-02"]);
    expect(matchLocations(CODES, "  A ")).toEqual(["A-01-01-01", "A-01-01-02", "A-02-01-01"]);
    expect(matchLocations(CODES, "")).toEqual([]);
    expect(matchLocations(CODES, "   ")).toEqual([]);
    expect(matchLocations(CODES, "01")).toEqual([]);
    expect(matchLocations(CODES, "A", 2)).toEqual(["A-01-01-01", "A-01-01-02"]);
    const many = Array.from({ length: 20 }, (_, i) => `D-${String(i).padStart(2, "0")}`);
    expect(matchLocations(many, "d")).toHaveLength(8);
  });

  it("fr33_location_code_uses_the_exact_code_for_a_case_insensitive_match", () => {
    expect(locationCode(CODES, " c-01-01-01 ")).toBe("C-01-01-01");
    expect(locationCode(CODES, "C-01-01-01")).toBe("C-01-01-01");
    expect(locationCode(CODES, " zz-99 ")).toBe("zz-99");
    expect(locationCode(CODES, "c-01")).toBe("c-01");
  });

  it("uxdr26_combobox_markup", () => {
    const markup = renderToStaticMarkup(
      <ToLocationField
        value="A-01"
        onChange={() => {}}
        matches={["A-01-01-01", "A-01-01-02"]}
        listOpen
        highlight={1}
        onPick={() => {}}
      />,
    );
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toMatch(/aria-controls="[^"]+"/);
    const active = markup.match(/aria-activedescendant="([^"]+)"/)?.[1];
    expect(active).toBeDefined();
    expect(markup).toMatch(new RegExp(`id="${active}" role="option" aria-selected="true"[^>]*data-location-option="A-01-01-02"`));
    expect(markup).toContain("bg-selected-tint");
    expect(text(markup)).toContain("To-location");
  });

  it("uxdr26_closed_list_is_not_expanded", () => {
    const markup = renderToStaticMarkup(
      <ToLocationField value="" onChange={() => {}} matches={[]} listOpen={false} highlight={-1} onPick={() => {}} />,
    );
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("aria-activedescendant");
    expect(markup).not.toContain('role="option"');
  });
});

describe("fr33 preview drives the dialog", () => {
  it("fr33_refusal_is_an_input_error_with_the_server_sentence", () => {
    const sentence = "This is the from-location. Choose another.";
    const markup = renderToStaticMarkup(
      <ToLocationField
        value="B-01-03-02"
        onChange={() => {}}
        matches={[]}
        listOpen={false}
        highlight={-1}
        onPick={() => {}}
        error={sentence}
      />,
    );
    expect(markup).toContain('aria-invalid="true"');
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeDefined();
    expect(markup).toContain(`<p id="${describedBy}"`);
    expect(text(markup)).toContain(sentence);
  });

  it("fr33_effect_line_for_each_effect_and_target", () => {
    expect(effectLine(preview({}), "9300", "C-01-01-01")).toBe("to an empty location");
    expect(
      effectLine(preview({ target: "occupied", target_parts: [target("9100")] }), "9200", "C-01-01-01"),
    ).toBe("to an occupied location: 9100 stays there too");
    expect(
      effectLine(preview({ target: "occupied", target_parts: [target("9100"), target("9150")] }), "9200", "C-01-01-01"),
    ).toBe("to an occupied location: 9100, 9150 stay there too");
    expect(
      effectLine(preview({ effect: { kind: "adds_to_stock" }, target: "occupied", target_parts: [target("0100")] }), "0100", "X"),
    ).toBe("to an occupied location: stock is added together");
    expect(effectLine(preview({ effect: { kind: "combines_with", move_number: 3 } }), "0100", "X")).toBe(
      "This combines with move 3 into one move.",
    );
    expect(effectLine(preview({ effect: { kind: "removes_move", move_number: 4 } }), "4410281", "G-14-04-02")).toBe(
      "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed.",
    );
    expect(
      effectLine(preview({ allowed: false, refusal_message: "No.", effect: null, target: "none" }), "1", "X"),
    ).toBeNull();
  });

  it("fr33_effect_line_is_linked_to_the_field", () => {
    const markup = renderToStaticMarkup(
      <ToLocationField
        value="C-01-01-01"
        onChange={() => {}}
        matches={[]}
        listOpen={false}
        highlight={-1}
        onPick={() => {}}
        effect="to an empty location"
      />,
    );
    expect(markup).not.toContain("aria-invalid");
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(markup).toMatch(new RegExp(`<p id="${describedBy}"[^>]*>to an empty location</p>`));
  });

  it("fr33_confirm_reason_first_that_applies", () => {
    const allowed = preview({});
    const refused = preview({ allowed: false, refusal_message: "ZZ-99 is not in the Locations file.", effect: null });
    expect(confirmReason({ savingReason: SAVING_REASON, to: "", preview: null })).toBe(SAVING_REASON);
    expect(confirmReason({ savingReason: undefined, to: "  ", preview: allowed })).toBe(ENTER_TO);
    expect(ENTER_TO).toBe("Enter a to-location.");
    expect(confirmReason({ savingReason: undefined, to: "C", preview: null })).toBe(CHECKING);
    expect(CHECKING).toBe("Checking the move…");
    expect(confirmReason({ savingReason: undefined, to: "ZZ-99", preview: refused })).toBe(
      "ZZ-99 is not in the Locations file.",
    );
    expect(confirmReason({ savingReason: undefined, to: "C-01-01-01", preview: allowed })).toBeUndefined();
  });
});

describe("fr34 move toasts", () => {
  const made: CommandEvent = {
    type: "move_made",
    move_number: 1,
    part: "9300",
    from_location: "B-01-03-02",
    to_location: "C-01-01-01",
    rule: "manual",
    round: 0,
  };
  const combined: CommandEvent = {
    type: "moves_combined",
    move_number: 2,
    part: "0100",
    from_location: "G-14-04-02",
    to_location: "A-02-01-01",
    round: 0,
    step_move_number: 3,
  };
  const removed: CommandEvent = {
    type: "move_removed",
    move_number: 1,
    part: "9300",
    location: "B-01-03-02",
    round: 0,
    step_move_number: 2,
  };

  it("fr33_move_made_toast", () => {
    expect(moveToast([made])).toBe("Moved 9300: B-01-03-02 → C-01-01-01 (Manual, round 0).");
  });

  it("fr34_moves_combined_toast", () => {
    expect(moveToast([combined])).toBe("Combined into one move: G-14-04-02 → A-02-01-01 (Manual).");
  });

  it("fr34_move_removed_toast", () => {
    expect(moveToast([removed])).toBe("Removed move 1: 9300 returns to B-01-03-02.");
  });

  it("fr33_no_move_event_no_toast", () => {
    expect(moveToast([])).toBeNull();
    expect(moveToast([{ type: "mark_set", mark: { kind: "aisle", aisle: "A" } }])).toBeNull();
    expect(moveToast([{ type: "mark_set", mark: { kind: "aisle", aisle: "A" } }, made])).toBe(
      "Moved 9300: B-01-03-02 → C-01-01-01 (Manual, round 0).",
    );
  });
});

describe("uxdr24 part panel Manual move…", () => {
  it("uxdr24_manual_move_disabled_without_current_location", () => {
    const markup = renderToStaticMarkup(<ManualMoveButton detail={detail(null)} onClick={() => {}} />);
    expect(markup).toContain('aria-disabled="true"');
    expect(text(markup)).toContain(MANUAL_MOVE_LABEL);
    expect(MANUAL_MOVE_LABEL).toBe("Manual move…");
    expect(text(markup)).toContain(NO_CURRENT_LOCATION);
    expect(NO_CURRENT_LOCATION).toBe("No current location (no stock above zero)");
    expect(markup).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("uxdr24_manual_move_reason_order", () => {
    expect(manualMoveReason(detail(null), SAVING_REASON)).toBe(NO_CURRENT_LOCATION);
    expect(manualMoveReason(detail("B-01-03-02"), SAVING_REASON)).toBe(SAVING_REASON);
    expect(manualMoveReason(detail("B-01-03-02"))).toBeUndefined();
    const enabled = renderToStaticMarkup(<ManualMoveButton detail={detail("B-01-03-02")} onClick={() => {}} />);
    expect(enabled).not.toContain("aria-disabled");
  });
});
