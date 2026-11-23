// Demo front page copy (Story 9.6, FR-50, UX-DR54). English, sentence case, no exclamation marks.
// The demo part 4410281 is followed from its export row to its printed move-list line; every
// number here is illustrative and matches the static pictures, not a plan.

import type { MovementClass } from "@/lib/copy";

export const PRODUCT_NAME = "Smart Warehouse Planner";
export const HOW_IT_WORKS = "How it works";
export const HOW_IT_WORKS_ID = "how-it-works";
export const LOG_IN = "Log in";
export const CREATE_ACCOUNT = "Create account";

export const HEADLINE = "Every move comes with a reason.";
export const LEAD =
  "Smart Warehouse Planner reads your warehouse exports and suggests which parts to move where. You decide each one.";
export const DEMO_CAPTION = "Demo version skips the login and opens the app with a demo account.";

/** The three-letter code in a large bin's label window (DESIGN.md "Bin"). */
export const CLASS_CODES: Record<MovementClass, string> = {
  fast: "FST",
  medium: "MED",
  slow: "SLW",
  dead: "DED",
};

export const WALL_LABEL =
  "A shelf wall in aisle G, section 14: part 4410281 lifted out of level 4 and moved to an empty best location on level 1.";
export const WALL_SECTION = "Aisle G · Section 14";
export const BEST_TAG = "BEST";

export const DEMO_PART = { number: "4410281", description: "Brake pads, front" } as const;
export const DEMO_FROM = "G-14-04-02";
export const DEMO_TO = "G-14-01-04";

export const REASON_CARD = {
  rule: "RULE 1 · MOVE 1",
  picks: "61 picks in 12 months",
  where: "sits on L4, not best",
  target: `→ ${DEMO_TO}, best location`,
} as const;

export const FLOW_TITLE = "One part, start to finish";

export type FlowPanel = { title: string; subtitle: string };

export const FLOW_PANELS: readonly [FlowPanel, FlowPanel, FlowPanel, FlowPanel] = [
  { title: "In your export", subtitle: "The row you already have" },
  { title: "Classified fast", subtitle: "24 picks or more is fast" },
  { title: "You decide", subtitle: "Apply it, or keep in place" },
  { title: "On the move list", subtitle: "Printed, one walk per round" },
];

export const EXPORT_HEADERS = ["Part", "Location", "Picks"] as const;

export type ExportRow = { part: string; location: string; picks: number; highlighted?: boolean };

export const EXPORT_ROWS: readonly ExportRow[] = [
  { part: "3301877", location: "B-07-04-03", picks: 9 },
  { part: DEMO_PART.number, location: DEMO_FROM, picks: 61, highlighted: true },
  { part: "5520114", location: "C-03-03-01", picks: 33 },
  { part: "6612040", location: "D-11-04-01", picks: 2 },
];

export const CLASSIFIED_PICKS = "61";
export const CLASSIFIED_CAPTION = "picks in the last 12 months";

export const DECIDE_APPLY = "Apply";
export const DECIDE_KEEP = "Keep in place";
export const DECIDE_CAPTION = "Nothing changes until you apply it.";

export const MOVE_LIST_TITLE = "Move list · Spring re-slot 2026";
export const MOVE_LIST_ROUND = "ROUND 1";
export const MOVE_LIST_ROUND_NOTE = "one walk";

export type MoveListLine = { part: string; from: string; to: string };

export const MOVE_LIST_LINES: readonly MoveListLine[] = [
  { part: DEMO_PART.number, from: DEMO_FROM, to: DEMO_TO },
  { part: "5520114", from: "C-03-03-01", to: "A-02-01-02" },
  { part: "3301877", from: "B-07-04-03", to: "A-03-02-01" },
];
