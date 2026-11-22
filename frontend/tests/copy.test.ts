import { describe, expect, it } from "vitest";

import type { OutdatedInfo } from "@/lib/api/plans";
import {
  CLASS_LABELS,
  MARKS_CHANGED,
  marksChangedText,
  noSpaceText,
  outdatedText,
  picksLine,
  reasonText,
  sharedJobsText,
  thresholdText,
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
