// Copy (AD-11, UX-DR39): the one place that words recommendation reasons, "no space" causes,
// outdated causes, the marks toast, and the run, apply and apply all lines and toasts (Story
// 5.7). The server sends them as structured data; nothing else in the frontend turns that data
// into sentences. Class names and pick lines live here too, so the part panel and the
// recommendations say them the same way.

import type {
  AisleCounts,
  AppliedInfo,
  ApplyAllDoneEvent,
  ClassThreshold,
  CommandEvent,
  LocationRef,
  MoveListHeader,
  MoveListLine,
  MoveListRound,
  NoSpaceCause,
  OutdatedInfo,
  RecommendationReason,
  RecommendationRow,
  RunMeta,
  StepUndoneEvent,
  UndoPreview,
  WarehouseCounts,
} from "@/lib/api/plans";
import { formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format";

/** The saved-plans list's title, also the label of New Plan's list of saved plans (FR-2, FR-8). */
export const SAVED_PLANS_TITLE = "Saved plans";
export const LOADING_SAVED_PLANS = "Loading saved plans…";
/** The plate menu and saved-plans row menu item that opens New Plan reusing a plan's import (FR-2). */
export const NEW_PLAN_FROM_IMPORT = "New Plan from this import";
/** The saved-plans row menu item, the confirm's title and its destructive action (FR-12, UX-DR16). */
export const DELETE_PLAN_ITEM = "Delete…";
export const DELETE_PLAN_TITLE = "Delete plan";
export const DELETE_PLAN_CONFIRM = "Delete plan";

/** The delete confirm's question (FR-12): permanent, for everyone, with no archive. */
export function deletePlanQuestion(name: string): string {
  return `Delete “${name}”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.`;
}

export type MovementClass = "fast" | "medium" | "slow" | "dead";

/** Glossary names of the movement classes. */
export const CLASS_LABELS: Record<MovementClass, string> = {
  fast: "Fast-moving",
  medium: "Medium-moving",
  slow: "Slow-moving",
  dead: "Dead stock",
};

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** The three-letter code in a bin's label window, shown only when the bin is drawn ≥56px wide (DESIGN.md "Bin"). */
export const CLASS_CODES: Record<MovementClass, string> = {
  fast: "FST",
  medium: "MED",
  slow: "SLW",
  dead: "DED",
};

/** "24 or more", "6–23", "1–5" or "0", from the server's limits (never hard-coded). */
export function thresholdText(threshold: ClassThreshold): string {
  const min = formatNumber(threshold.min_picks);
  if (threshold.max_picks === null) return `${min} or more`;
  if (threshold.max_picks === threshold.min_picks) return min;
  return `${min}–${formatNumber(threshold.max_picks)}`;
}

/** "61 picks in the period (24 or more)"; singular "pick" for 1. */
export function picksLine(picks: number, threshold: ClassThreshold): string {
  return `${plural(picks, "pick", "picks")} in the period (${thresholdText(threshold)})`;
}

/** "8 shared jobs" (singular "1 shared job"). */
export function sharedJobsText(count: number): string {
  return plural(count, "shared job", "shared jobs");
}

/**
 * The reason of a recommendation or "no space" entry (FR-28):
 * "Fast-moving: 61 picks in the period (24 or more)" or
 * "Pick group with 2007060 (aisle D): 12 shared jobs (5 or more)".
 */
export function reasonText(reason: RecommendationReason): string {
  if (reason.kind === "class") {
    return `${CLASS_LABELS[reason.movement_class]}: ${picksLine(reason.picks, reason.threshold)}`;
  }
  const where = reason.partner_aisle === null ? "" : ` (aisle ${reason.partner_aisle})`;
  const minimum = formatNumber(reason.min_shared_jobs);
  return `Pick group with ${reason.partner}${where}: ${sharedJobsText(reason.shared_jobs)} (${minimum} or more)`;
}

/** A piece of a sentence; `strong` pieces are the numbers shown in bold. */
export type TextSegment = { text: string; strong?: boolean };

function thresholdSegments(threshold: ClassThreshold): TextSegment[] {
  const min = formatNumber(threshold.min_picks);
  if (threshold.max_picks === null) return [{ text: min, strong: true }, { text: " or more" }];
  if (threshold.max_picks === threshold.min_picks) return [{ text: min, strong: true }];
  return [{ text: `${min}–${formatNumber(threshold.max_picks)}`, strong: true }];
}

/**
 * `reasonText` as segments with its numbers marked `strong` (the detail panel bolds them, UX-DR33).
 * The segments joined are exactly `reasonText(reason)`.
 */
export function reasonSegments(reason: RecommendationReason): TextSegment[] {
  if (reason.kind === "class") {
    return [
      { text: `${CLASS_LABELS[reason.movement_class]}: ` },
      { text: formatNumber(reason.picks), strong: true },
      { text: ` ${reason.picks === 1 ? "pick" : "picks"} in the period (` },
      ...thresholdSegments(reason.threshold),
      { text: ")" },
    ];
  }
  const where = reason.partner_aisle === null ? "" : ` (aisle ${reason.partner_aisle})`;
  return [
    { text: `Pick group with ${reason.partner}${where}: ` },
    { text: formatNumber(reason.shared_jobs), strong: true },
    { text: ` ${reason.shared_jobs === 1 ? "shared job" : "shared jobs"} (` },
    { text: formatNumber(reason.min_shared_jobs), strong: true },
    { text: " or more)" },
  ];
}

/** The plain cause of a "no space" entry, e.g. "No space · no empty location in aisle D". */
export function noSpaceText(cause: NoSpaceCause): string {
  if (cause.rule === "rule_1") return "No space · no empty best location";
  if (cause.rule === "rule_2") return "No space · no empty location outside best locations";
  const aisle = cause.aisle === null ? "the partner's aisle" : `aisle ${cause.aisle}`;
  return `No space · no empty location in ${aisle}${cause.outside_best ? " outside best locations" : ""}`;
}

/** Why a recommendation of `part` is outdated (FR-29), as one sentence. */
export function outdatedText(part: string, outdated: OutdatedInfo): string {
  switch (outdated.cause) {
    case "moved":
      return `${part} has been moved.`;
    case "filled":
      return `${outdated.location ?? "The target"} was filled by a manual move.`;
    case "marks":
      return "The best-location marks changed.";
    case "partner_aisle":
      return `Partner ${outdated.partner ?? ""} is no longer in aisle ${outdated.aisle ?? ""}.`;
    case "moved_back":
      return `${part} was moved back, so move ${outdated.move_number ?? ""} was removed.`;
    case "undo":
      return "Outdated after undo.";
  }
}

export const MARKS_CHANGED = "Best-location marks changed.";
export const VIEW_LABEL = "View";

/**
 * The toast after a mark change (UX-DR14, UX-DR28): "Best-location marks changed · 3
 * recommendations are now outdated" (singular for 1); the plain sentence when none are.
 */
export function marksChangedText(outdatedCount: number): string {
  if (outdatedCount <= 0) return MARKS_CHANGED;
  const verb = outdatedCount === 1 ? "is" : "are";
  return `Best-location marks changed · ${plural(outdatedCount, "recommendation", "recommendations")} ${verb} now outdated`;
}

/** A move's rule as words: "Rule 1", "Rule 2", "Rule 3" or "Manual" (the move toast, the move list). */
export const RULE_LABELS: Record<MoveListLine["rule"], string> = {
  rule_1: "Rule 1",
  rule_2: "Rule 2",
  rule_3: "Rule 3",
  manual: "Manual",
};

type MoveMadeEvent = Extract<CommandEvent, { type: "move_made" }>;
type RunDoneEvent = Extract<CommandEvent, { type: "run_done" }>;

/** "1 recommendation" / "13 recommendations". */
export function recommendationsCount(count: number): string {
  return plural(count, "recommendation", "recommendations");
}

/** "Applied · move 16, round 1": an applied recommendation's row and detail line. */
export function appliedText(applied: Pick<AppliedInfo, "move_number" | "round">): string {
  return `Applied · move ${formatNumber(applied.move_number)}, round ${formatNumber(applied.round)}`;
}

/** The toast after Apply (UX-DR33): "Applied · move 16, round 1 · 1100 C-01-01-01 → A-01-01-03". */
export function appliedToast(event: MoveMadeEvent): string {
  return `${appliedText(event)} · ${event.part} ${event.from_location} → ${event.to_location}`;
}

/** Why Apply all is disabled when the latest run has nothing open to apply (FR-30). */
export const NO_OPEN_TO_APPLY = "No open recommendations to apply.";

/** The Apply all confirm question (UX-DR34). */
export function applyAllQuestion(count: number, round: number): string {
  return `Apply ${recommendationsCount(count)} from round ${formatNumber(round)}? Undo reverses them one move at a time.`;
}

/** The toast after Apply all: "Applied 4 recommendations from round 2." plus " 1 skipped." when any were. */
export function applyAllToast(event: ApplyAllDoneEvent, round: number): string {
  const applied = `Applied ${recommendationsCount(event.applied.length)} from round ${formatNumber(round)}.`;
  return event.skipped.length > 0 ? `${applied} ${formatNumber(event.skipped.length)} skipped.` : applied;
}

/** The polite announcement after a run: "Recommendations, round 1, 13 recommendations, 4 no space". */
export function runAnnouncement(event: RunDoneEvent): string {
  return `Recommendations, round ${formatNumber(event.round)}, ${recommendationsCount(event.recommendations)}, ${formatNumber(event.no_space)} no space`;
}

/** The header's run line: "Run 2026-11-22 14:05 by planner · 13 recommendations · 4 no space". */
export function runLine(run: RunMeta, recommendations: number, noSpace: number): string {
  const when = `${formatDate(run.created_at)} ${formatTime(run.created_at)}`;
  return `Run ${when} by ${run.created_by} · ${recommendationsCount(recommendations)} · ${formatNumber(noSpace)} no space`;
}

// Keep in place (Story 7.1, FR-32, UX-DR37): the link, its state words and its toasts. A mark toast
// never offers Undo.

/** The link that sets the mark, and the one that removes it. */
export const KEEP_IN_PLACE = "Keep in place";
export const REMOVE_KEEP_IN_PLACE = "Remove keep in place";
/** The roster's and part panel's state words beside the pin glyph. */
export const KEPT_IN_PLACE_STATE = "kept in place";
/** A kept recommendation's row and detail line, the Kept tab label and the roster column head. */
export const KEPT_IN_PLACE = "Kept in place";
/** The Kept tab when no part is kept. */
export const NOTHING_KEPT = "Nothing kept in place.";
/** The overview fact's term. */
export const PARTS_KEPT_IN_PLACE = "Parts kept in place";
/** The Kept tab's trailing band: kept parts without an open recommendation in this run. */
export const KEPT_BAND = { tag: "Kept", name: "No open recommendation in this run", note: "Part-number order" } as const;

/** The toast after Keep in place: "0500 is kept in place. Remove the mark from the part or the Kept in place tab." */
export function keptToast(part: string): string {
  return `${part} is kept in place. Remove the mark from the part or the Kept in place tab.`;
}

/** The toast after Remove keep in place. */
export function keepRemovedToast(part: string): string {
  return `${part} is no longer kept in place.`;
}

/** Why Apply is disabled on a kept recommendation (the server's rejection, said first). */
export function keptApplyReason(part: string): string {
  return `${part} is kept in place.`;
}

// Other location (Story 7.2, FR-31, UX-DR36): the listbox of the server's allowed set. There is no
// free-text entry; the toast after an apply is `appliedToast`.

/** The detail action's label (the trigger shows a "▾" glyph after it). */
export const OTHER_LOCATION_LABEL = "Other location";
/** The listbox's accessible name. */
export const OTHER_LOCATIONS_LIST = "Other locations";
/** While the allowed set loads. */
export const LOADING_LOCATIONS = "Loading locations…";
/** When the allowed set could not be loaded. */
export const LOCATIONS_LOAD_FAILED = "Could not load the locations. Try again.";

/** The empty allowed set: "No other location fits rule 1 right now." */
export function noOtherLocationText(rule: RecommendationRow["rule"]): string {
  return `No other location fits rule ${rule.slice("rule_".length)} right now.`;
}

/** An option's second line: "Aisle A · Level 1". */
export function otherLocationOptionMeta(location: Pick<LocationRef, "aisle" | "level">): string {
  return `Aisle ${location.aisle} · Level ${location.level}`;
}

/** An option's best tag: "BEST" or "not best". */
export function otherLocationBestText(isBest: boolean): string {
  return isBest ? "BEST" : "not best";
}

/** An option's accessible name: "A-01-01-03, Aisle A · Level 1, BEST". */
export function otherLocationOptionName(location: LocationRef): string {
  return `${location.code}, ${otherLocationOptionMeta(location)}, ${otherLocationBestText(location.is_best)}`;
}

// Undo last move (Story 7.3, FR-35, UX-DR38): every Undo surface words the server's `undo_preview`
// and `step_undone` here, and nothing else (AD-3). Mark, run, keep and Apply all toasts never offer
// Undo.

/** The control's label, the launcher action's label when there is nothing to undo. */
export const UNDO_LAST_MOVE = "Undo last move";
/** Why Undo last move is disabled when the plan has no steps. */
export const NO_MOVES_TO_UNDO = "No moves to undo";
/** The toast action that undoes the move the toast is about. */
export const UNDO_ACTION = "Undo";

/**
 * What Undo last move would do (UX-DR38): "Undo move 3: 9723950 A-03-04-02 → A-05-01-03",
 * "Undo splits move 3: 9723950 returns to A-05-01-03" or
 * "Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01" (a move-back step reversed).
 */
export function undoLabel(preview: UndoPreview): string {
  const number = formatNumber(preview.effect.move_number);
  switch (preview.effect.kind) {
    case "reverts_move":
      return `Undo move ${number}: ${preview.part} ${preview.from_location} → ${preview.to_location}`;
    case "splits_combined_move":
      return `Undo splits move ${number}: ${preview.part} returns to ${preview.from_location}`;
    case "restores_removed_move":
      return `Undo restores move ${number}: ${preview.part} ${preview.to_location} → ${preview.from_location}`;
  }
}

/**
 * The toast after an undo (UX-DR38): "Undid move 3.", "Split move 3." or "Restored move 4.", plus
 * " Unapplied recommendations of round 1 are now outdated. Run recommendations to continue." when
 * the undo outdated any.
 */
export function undoneToast(event: StepUndoneEvent, outdatedCount: number, round: number): string {
  const number = formatNumber(event.undone.effect.move_number);
  const first = {
    reverts_move: `Undid move ${number}.`,
    splits_combined_move: `Split move ${number}.`,
    restores_removed_move: `Restored move ${number}.`,
  }[event.undone.effect.kind];
  if (outdatedCount <= 0) return first;
  return `${first} Unapplied recommendations of round ${formatNumber(round)} are now outdated. Run recommendations to continue.`;
}

// Reset the planning copy (Story 7.4, FR-35, UX-DR38): the "⋯" menu, the launcher action, the
// confirm dialog and the toast. The move count is the server's `move_count` and `moves_removed`
// (effective moves), never counted in the client (AD-3). A reset toast never offers Undo.

/** The aria-label of the Recommendations header's "⋯" menu button. */
export const MORE_ACTIONS = "More actions";
/** The menu item and the launcher action. */
export const RESET_ITEM = "Reset…";
/** The confirm dialog's title. */
export const RESET_TITLE = "Reset plan";
/** The confirm dialog's destructive button. */
export const RESET_CONFIRM = "Reset plan";

/**
 * The confirm question (UX-DR38): "Reset removes all 18 moves, the recommendations and the
 * no-space parts. …", "Reset removes 1 move, …" or, with no moves, "Reset removes the
 * recommendations and the no-space parts. …".
 */
export function resetQuestion(moveCount: number): string {
  const moves = moveCount === 0 ? "" : moveCount === 1 ? "1 move, " : `all ${formatNumber(moveCount)} moves, `;
  return `Reset removes ${moves}the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1.`;
}

/** The toast after a reset: "Plan reset. 18 moves removed; marks kept. The next run is round 1." */
export function resetToast(movesRemoved: number): string {
  return `Plan reset. ${plural(movesRemoved, "move", "moves")} removed; marks kept. The next run is round 1.`;
}

// Move list (Story 8.3, FR-38, UX-DR52): the print view's header, round bands, rule cells and
// footnotes. Rounds, lines, their order and swap marks are the server's (AD-3, AD-17); only the
// words are made here.

export const MOVE_LIST_TITLE = "Move list";
/** The only primary button of the print view. */
export const PRINT_LABEL = "Print";
/** Why Print is disabled while it fetches the latest move list before printing. */
export const PRINT_BUSY = "Getting the latest moves…";
export const BACK_TO_RECOMMENDATIONS = "Back to Recommendations";
/** A failed move-list fetch without a server message. */
export const MOVE_LIST_LOAD_FAILED = "The move list could not be loaded.";
/** The empty move list, also why Print is disabled then. */
export const NO_MOVES_TO_PRINT = "There are no moves to print.";
/** The tick-box column: "✓" on paper, "Done" for screen readers. */
export const TICK_HEAD = "✓";
export const TICK_HEAD_SR = "Done";
/** The column heads after the tick box, in order. */
export const MOVE_LIST_COLUMNS = ["Round", "Part", "Description", "From", "To", "Rule", "Note"] as const;
/** The band of a round with moves made by a run: "one walk · from-location before to-location". */
export const ROUND_BAND_NOTE = "one walk · from-location before to-location";
export const WALK_PATH_FOOTNOTE =
  "Lines follow Walk Path; moves out of a location come before moves into it, except in a swap.";
export const SWAP_FOOTNOTE = "Swap: set one bin aside, move the other into its place, then put the first one in.";

/** "Move list · Plan A". */
export function moveListTitle(name: string): string {
  return `${MOVE_LIST_TITLE} · ${name}`;
}

/** "1 round" / "3 rounds". */
export function roundsCount(count: number): string {
  return plural(count, "round", "rounds");
}

/** "Data as of 2026-10-30 · uploaded 2026-11-22 · 2 rounds" (the upload date in the viewer's zone). */
export function moveListDataLine(header: Pick<MoveListHeader, "data_as_of" | "uploaded_at" | "rounds">): string {
  return `Data as of ${formatDate(header.data_as_of)} · uploaded ${formatDate(header.uploaded_at)} · ${roundsCount(header.rounds)}`;
}

/** "Generated 2026-11-23 14:05 · Smart Warehouse Planner" (in the viewer's zone). */
export function moveListGeneratedLine(generatedAt: string): string {
  return `Generated ${formatDateTime(generatedAt)} · Smart Warehouse Planner`;
}

/** A round band's tag: "ROUND 2". */
export function roundBandTag(round: number): string {
  return `ROUND ${formatNumber(round)}`;
}

/** A round band's words after the tag: the server's label (round 0) or the one-walk note. */
export function roundBandNote(round: Pick<MoveListRound, "label">): string {
  return round.label ?? ROUND_BAND_NOTE;
}

/** A line's rule cell: "Rule 1", or "Manual · Swap 1/2" for a swap line. */
export function ruleCellText(line: Pick<MoveListLine, "rule" | "swap">): string {
  const label = RULE_LABELS[line.rule];
  if (!line.swap) return label;
  return `${label} · Swap ${formatNumber(line.swap.index)}/${formatNumber(line.swap.size)}`;
}

/** The swap's locations under the rule cell: "A-02-01-01 ↔ G-14-04-02"; null for an ordinary line. */
export function swapLocationsText(line: Pick<MoveListLine, "swap">): string | null {
  return line.swap ? `${line.swap.locations[0]} ↔ ${line.swap.locations[1]}` : null;
}

// The Locations wall (Story 10.2, FR-42, UX-DR40/41/45/48). Every count comes from the server.

export const BEST_TAG = "BEST";
export const OPEN_AS_LIST = "Open as list";
export const OPEN_AS_WALL = "Open as wall";
export const EDIT_BEST_MARKS = "Edit best-location marks";
export const AISLE_TABS_LABEL = "Aisles";
export const KEY_TITLE = "Key";

/** The Key's entries, in their fixed order: glossary names, never colour words (UX-DR45). */
export const KEY_LABELS = {
  fast: CLASS_LABELS.fast,
  medium: CLASS_LABELS.medium,
  slow: CLASS_LABELS.slow,
  dead: CLASS_LABELS.dead,
  empty: "Empty",
  best: "Best location",
  selected: "Selected",
  twoParts: "2 parts",
} as const;

export type KeyEntry = keyof typeof KEY_LABELS;

export const KEY_ORDER: readonly KeyEntry[] = ["fast", "medium", "slow", "dead", "empty", "best", "selected", "twoParts"];

/** "Aisle A": the open aisle's heading. */
export function aisleHeading(aisle: string): string {
  return `Aisle ${aisle}`;
}

/** The wall picture's accessible name. */
export function wallImageLabel(aisle: string): string {
  return `Bin wall of aisle ${aisle}. Open as list reads every location as text.`;
}

/** The wall's scroll box: a keyboard user tabs to it to scroll a wall wider than the page. */
export function wallScrollLabel(aisle: string): string {
  return `Aisle ${aisle} wall, scrollable`;
}

/** "L1": a level's label on the wall. */
export function levelLabel(level: string): string {
  return `L${level}`;
}

/** "BEST 3": a level label's count of single best locations in that level of one run. */
export function bestCountTag(count: number): string {
  return `${BEST_TAG} ${formatNumber(count)}`;
}

/** "7 moves" / "1 move": the latest run's moves touching an aisle, on its tab. */
export function aisleTabMoves(count: number): string {
  return plural(count, "move", "moves");
}

/** "86.8%": an occupied percent from the server. */
export function percentText(percent: string): string {
  return `${percent}%`;
}

/** "79.2% whole warehouse · 1,584 of 2,000 · 416 empty · 174 best". */
export function wholeWarehouseFigure(counts: WarehouseCounts): string {
  return [
    `${percentText(counts.occupied_percent)} whole warehouse`,
    `${formatNumber(counts.occupied)} of ${formatNumber(counts.locations)}`,
    `${formatNumber(counts.empty)} empty`,
    `${formatNumber(counts.best)} best`,
  ].join(" · ");
}

/**
 * "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270":
 * the open aisle's line, its Walk Path range from the layout.
 */
export function wallAisleLine(counts: AisleCounts, walkPathFirst: string, walkPathLast: string): string {
  return [
    `${percentText(counts.occupied_percent)} occupied`,
    `${formatNumber(counts.occupied)} of ${plural(counts.locations, "location", "locations")}`,
    `${formatNumber(counts.empty)} empty`,
    `${plural(counts.best, "best location", "best locations")} (${formatNumber(counts.empty_best)} empty)`,
    `Walk Path ${formatNumber(walkPathFirst)}–${formatNumber(walkPathLast)}`,
  ].join(" · ");
}

/** "End of aisle A · Walk Path 2,270 →": the wall's end cap. */
export function endCapLabel(aisle: string, walkPathLast: string): string {
  return `End of aisle ${aisle} · Walk Path ${formatNumber(walkPathLast)} →`;
}
