import { describe, expect, it } from "vitest";

import type { OutdatedInfo, RecommendationReason, RunMeta, StepUndoneEvent, UndoPreview } from "@/lib/api/plans";
import {
  appliedText,
  appliedToast,
  applyAllQuestion,
  applyAllToast,
  CLASS_LABELS,
  keepRemovedToast,
  keptApplyReason,
  LOADING_LOCATIONS,
  noOtherLocationText,
  OTHER_LOCATION_LABEL,
  otherLocationBestText,
  otherLocationOptionMeta,
  otherLocationOptionName,
  keptToast,
  MARKS_CHANGED,
  marksChangedText,
  noSpaceText,
  outdatedText,
  picksLine,
  reasonSegments,
  reasonText,
  RESET_CONFIRM,
  RESET_ITEM,
  RESET_TITLE,
  resetQuestion,
  resetToast,
  MORE_ACTIONS,
  runAnnouncement,
  runLine,
  sharedJobsText,
  thresholdText,
  undoLabel,
  undoneToast,
} from "@/lib/copy";

// Story 5.5 (AD-11, UX-DR39): lib/copy is the one place reasons, "no space" causes, outdated
// causes and the marks toast are worded.

function outdated(cause: OutdatedInfo["cause"], fields: Partial<OutdatedInfo> = {}): OutdatedInfo {
  return { cause, location: null, move_number: null, partner: null, aisle: null, ...fields };
}

describe("fr28 reasons", () => {
  it("fr28_class_reason", () => {
    expect(
      reasonText({ kind: "class", movement_class: "fast", picks: 61, threshold: { min_picks: 24, max_picks: null } }),
    ).toBe("Fast-moving: 61 picks in the period (24 or more)");
    expect(
      reasonText({ kind: "class", movement_class: "dead", picks: 0, threshold: { min_picks: 0, max_picks: 0 } }),
    ).toBe("Dead stock: 0 picks in the period (0)");
    expect(
      reasonText({ kind: "class", movement_class: "slow", picks: 1, threshold: { min_picks: 1, max_picks: 5 } }),
    ).toBe("Slow-moving: 1 pick in the period (1–5)");
  });

  it("fr28_pick_group_reason", () => {
    expect(
      reasonText({ kind: "pick_group", partner: "2007060", partner_aisle: "D", shared_jobs: 12, min_shared_jobs: 5 }),
    ).toBe("Pick group with 2007060 (aisle D): 12 shared jobs (5 or more)");
    expect(
      reasonText({ kind: "pick_group", partner: "8200", partner_aisle: "C", shared_jobs: 1, min_shared_jobs: 1 }),
    ).toBe("Pick group with 8200 (aisle C): 1 shared job (1 or more)");
  });

  it("fr28_no_space_causes", () => {
    expect(noSpaceText({ rule: "rule_1", aisle: null, outside_best: false })).toBe("No space · no empty best location");
    expect(noSpaceText({ rule: "rule_2", aisle: null, outside_best: true })).toBe(
      "No space · no empty location outside best locations",
    );
    expect(noSpaceText({ rule: "rule_3", aisle: "D", outside_best: true })).toBe(
      "No space · no empty location in aisle D outside best locations",
    );
    expect(noSpaceText({ rule: "rule_3", aisle: "D", outside_best: false })).toBe(
      "No space · no empty location in aisle D",
    );
  });

  it("fr28_shared_words", () => {
    expect(CLASS_LABELS).toEqual({
      fast: "Fast-moving",
      medium: "Medium-moving",
      slow: "Slow-moving",
      dead: "Dead stock",
    });
    expect(thresholdText({ min_picks: 6, max_picks: 23 })).toBe("6–23");
    expect(picksLine(61, { min_picks: 24, max_picks: null })).toBe("61 picks in the period (24 or more)");
    expect(sharedJobsText(1)).toBe("1 shared job");
  });
});

describe("fr29 outdated causes and the marks toast", () => {
  it("fr29_outdated_causes", () => {
    expect(outdatedText("4410281", outdated("filled", { location: "A-11-02-02", move_number: 3 }))).toBe(
      "A-11-02-02 was filled by a manual move.",
    );
    expect(outdatedText("4410281", outdated("moved"))).toBe("4410281 has been moved.");
    expect(outdatedText("4410281", outdated("marks"))).toBe("The best-location marks changed.");
    expect(outdatedText("4410281", outdated("partner_aisle", { partner: "2007060", aisle: "D" }))).toBe(
      "Partner 2007060 is no longer in aisle D.",
    );
    expect(outdatedText("4410281", outdated("moved_back", { move_number: 16 }))).toBe(
      "4410281 was moved back, so move 16 was removed.",
    );
  });

  it("fr29_marks_toast_singular_and_plural", () => {
    expect(marksChangedText(3)).toBe("Best-location marks changed · 3 recommendations are now outdated");
    expect(marksChangedText(1)).toBe("Best-location marks changed · 1 recommendation is now outdated");
    expect(marksChangedText(0)).toBe("Best-location marks changed.");
    expect(MARKS_CHANGED).toBe("Best-location marks changed.");
    expect(marksChangedText(1200)).toBe("Best-location marks changed · 1,200 recommendations are now outdated");
  });
});

// Story 5.7 (UX-DR31–35): the detail reason with bold numbers, and the run, apply and apply all lines.

describe("fr28 reason segments", () => {
  const reasons: RecommendationReason[] = [
    { kind: "class", movement_class: "fast", picks: 1_061, threshold: { min_picks: 24, max_picks: null } },
    { kind: "class", movement_class: "dead", picks: 0, threshold: { min_picks: 0, max_picks: 0 } },
    { kind: "class", movement_class: "slow", picks: 1, threshold: { min_picks: 1, max_picks: 5 } },
    { kind: "pick_group", partner: "2007060", partner_aisle: "D", shared_jobs: 1, min_shared_jobs: 5 },
    { kind: "pick_group", partner: "2007060", partner_aisle: null, shared_jobs: 12, min_shared_jobs: 5 },
  ];

  it("fr28_reason_segments_join_to_the_reason_text", () => {
    for (const reason of reasons) {
      expect(reasonSegments(reason).map((segment) => segment.text).join("")).toBe(reasonText(reason));
    }
  });

  it("ux_dr33_reason_numbers_are_strong", () => {
    const strong = (reason: RecommendationReason) =>
      reasonSegments(reason)
        .filter((segment) => segment.strong)
        .map((segment) => segment.text);
    expect(strong(reasons[0])).toEqual(["1,061", "24"]);
    expect(strong(reasons[2])).toEqual(["1", "1–5"]);
    expect(strong(reasons[3])).toEqual(["1", "5"]);
  });
});

describe("fr30 run, apply and apply all copy", () => {
  it("ux_dr33_applied_text_and_toast", () => {
    expect(appliedText({ move_number: 16, round: 1 })).toBe("Applied · move 16, round 1");
    expect(
      appliedToast({
        type: "move_made",
        part: "1100",
        from_location: "C-01-01-01",
        to_location: "A-01-01-03",
        move_number: 16,
        round: 1,
        rule: "rule_1",
      } as Parameters<typeof appliedToast>[0]),
    ).toBe("Applied · move 16, round 1 · 1100 C-01-01-01 → A-01-01-03");
  });

  it("fr30_apply_all_question_and_toast", () => {
    expect(applyAllQuestion(4, 2)).toBe("Apply 4 recommendations from round 2? Undo reverses them one move at a time.");
    expect(applyAllQuestion(1, 1)).toBe("Apply 1 recommendation from round 1? Undo reverses them one move at a time.");
    expect(applyAllToast({ type: "apply_all_done", applied: [1, 2, 3, 4], skipped: [] }, 2)).toBe(
      "Applied 4 recommendations from round 2.",
    );
    expect(
      applyAllToast({ type: "apply_all_done", applied: [1], skipped: [{ number: 2, cause: "kept" }] }, 1),
    ).toBe("Applied 1 recommendation from round 1. 1 skipped.");
  });

  it("fr23_run_line_and_announcement", () => {
    const run: RunMeta = { id: "r", round: 1, created_at: "2026-11-22T13:05:00Z", created_by: "planner" };
    expect(runLine(run, 13, 1)).toBe("Run 2026-11-22 14:05 by planner · 13 recommendations · 1 no space");
    expect(runLine(run, 1, 0)).toBe("Run 2026-11-22 14:05 by planner · 1 recommendation · 0 no space");
    expect(runAnnouncement({ type: "run_done", round: 1, recommendations: 1_200, no_space: 4 })).toBe(
      "Recommendations, round 1, 1,200 recommendations, 4 no space",
    );
  });
});

describe("fr32 keep in place copy", () => {
  it("fr32_keep_toasts_and_apply_reason", () => {
    expect(keptToast("0500")).toBe("0500 is kept in place. Remove the mark from the part or the Kept in place tab.");
    expect(keepRemovedToast("0500")).toBe("0500 is no longer kept in place.");
    expect(keptApplyReason("0500")).toBe("0500 is kept in place.");
  });
});

describe("fr31 other location copy", () => {
  it("fr31_other_location_strings", () => {
    expect(OTHER_LOCATION_LABEL).toBe("Other location");
    expect(LOADING_LOCATIONS).toBe("Loading locations…");
    expect(noOtherLocationText("rule_1")).toBe("No other location fits rule 1 right now.");
    expect(noOtherLocationText("rule_3")).toBe("No other location fits rule 3 right now.");
    expect(otherLocationOptionMeta({ aisle: "A", level: "1" })).toBe("Aisle A · Level 1");
    expect(otherLocationBestText(true)).toBe("BEST");
    expect(otherLocationBestText(false)).toBe("not best");
    expect(
      otherLocationOptionName({
        code: "A-01-01-04",
        aisle: "A",
        level: "1",
        section: "1",
        position: "4",
        is_best: true,
      }),
    ).toBe("A-01-01-04, Aisle A · Level 1, BEST");
  });

  it("fr31_applied_toast_names_the_chosen_location", () => {
    expect(
      appliedToast({
        type: "move_made",
        move_number: 3,
        part: "4400",
        from_location: "A-01-03-02",
        to_location: "C-01-03-02",
        rule: "rule_2",
        round: 1,
      }),
    ).toBe("Applied · move 3, round 1 · 4400 A-01-03-02 → C-01-03-02");
  });
});

// Story 7.3 (FR-35, UX-DR38): the undo preview and the undone toast are worded only here.

function preview(kind: UndoPreview["effect"]["kind"], fields: Partial<UndoPreview> = {}): UndoPreview {
  return {
    move_number: 3,
    part: "9723950",
    from_location: "A-03-04-02",
    to_location: "A-05-01-03",
    effect: { kind, move_number: 3 },
    ...fields,
  };
}

function undone(kind: UndoPreview["effect"]["kind"], moveNumber = 3): StepUndoneEvent {
  return { type: "step_undone", undone: preview(kind, { effect: { kind, move_number: moveNumber } }) };
}

describe("fr35 undo copy", () => {
  it("uxdr38_undo_label_per_effect", () => {
    expect(undoLabel(preview("reverts_move"))).toBe("Undo move 3: 9723950 A-03-04-02 → A-05-01-03");
    expect(
      undoLabel(preview("splits_combined_move", { move_number: 8, from_location: "A-05-01-03", to_location: "B-01-01-01" })),
    ).toBe("Undo splits move 3: 9723950 returns to A-05-01-03");
    expect(
      undoLabel({
        move_number: 9,
        part: "4410281",
        from_location: "A-02-01-01",
        to_location: "G-14-04-02",
        effect: { kind: "restores_removed_move", move_number: 4 },
      }),
    ).toBe("Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01");
  });

  it("uxdr38_undone_toast_first_sentence_per_effect", () => {
    expect(undoneToast(undone("reverts_move"), 0, 1)).toBe("Undid move 3.");
    expect(undoneToast(undone("splits_combined_move"), 0, 1)).toBe("Split move 3.");
    expect(undoneToast(undone("restores_removed_move", 4), 0, 1)).toBe("Restored move 4.");
  });

  it("uxdr38_undone_toast_with_outdated", () => {
    const tail = " Unapplied recommendations of round 1 are now outdated. Run recommendations to continue.";
    expect(undoneToast(undone("reverts_move"), 4, 1)).toBe(`Undid move 3.${tail}`);
    expect(undoneToast(undone("splits_combined_move"), 1, 1)).toBe(`Split move 3.${tail}`);
    expect(undoneToast(undone("restores_removed_move", 4), 2, 2)).toBe(
      "Restored move 4. Unapplied recommendations of round 2 are now outdated. Run recommendations to continue.",
    );
  });

  it("fr35_outdated_text_for_undo", () => {
    expect(outdatedText("1200", outdated("undo"))).toBe("Outdated after undo.");
  });
});

// Story 7.4 (FR-35, UX-DR38): the reset confirm and toast, worded from the server's move count.
describe("fr35 reset copy", () => {
  const tail = "the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1.";

  it("uxdr38_reset_labels", () => {
    expect([RESET_ITEM, RESET_TITLE, RESET_CONFIRM, MORE_ACTIONS]).toEqual(["Reset…", "Reset plan", "Reset plan", "More actions"]);
  });

  it("uxdr38_reset_question_for_0_1_and_18_moves", () => {
    expect(resetQuestion(18)).toBe(`Reset removes all 18 moves, ${tail}`);
    expect(resetQuestion(1)).toBe(`Reset removes 1 move, ${tail}`);
    expect(resetQuestion(0)).toBe(`Reset removes ${tail}`);
  });

  it("uxdr38_reset_toast_for_0_1_and_18_moves", () => {
    expect(resetToast(18)).toBe("Plan reset. 18 moves removed; marks kept. The next run is round 1.");
    expect(resetToast(1)).toBe("Plan reset. 1 move removed; marks kept. The next run is round 1.");
    expect(resetToast(0)).toBe("Plan reset. 0 moves removed; marks kept. The next run is round 1.");
  });
});
