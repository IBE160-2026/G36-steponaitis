// Copy (AD-11, UX-DR39): the one place that words recommendation reasons, "no space" causes,
// outdated causes, the marks toast, and the run, apply and apply all lines and toasts (Story
// 5.7). The server sends them as structured data; nothing else in the frontend turns that data
// into sentences. Class names and pick lines live here too, so the part panel and the
// recommendations say them the same way.

import type {
  AisleCounts,
  AppliedInfo,
  ApplyAllDoneEvent,
  BestMark,
  ClassThreshold,
  CommandEvent,
  LocationRef,
  MoveListHeader,
  MoveListLine,
  MoveListRound,
  NoSpaceCause,
  OutdatedInfo,
  RecentMove,
  RecommendationReason,
  RecommendationRow,
  RunMeta,
  StepUndoneEvent,
  UndoPreview,
  WallMove,
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

/** The wall's scroll box: it scrolls a wall wider than the page; the grid inside is its tab stop. */
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

/** "7 moves" / "1 move": the moves touching an aisle (latest-run recommendations and this round's manual moves), on its tab. */
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

// The wall's keyboard grid and tooltips (Story 10.3, FR-42, UX-DR42/43). Every fact comes from the
// server's wall view and recommendations; only the words are made here.

/** "Aisle A", "Level 1 in aisle A", "Level 1 in all aisles", "Location A-01-01-01". */
export function markLabel(mark: BestMark): string {
  switch (mark.kind) {
    case "aisle":
      return `Aisle ${mark.aisle}`;
    case "level":
      return mark.aisle == null ? `Level ${mark.level} in all aisles` : `Level ${mark.level} in aisle ${mark.aisle}`;
    case "location":
      return `Location ${mark.location}`;
  }
}

/** The wall grid's accessible name: "Aisle A bin wall". */
export function wallGridLabel(aisle: string): string {
  return `Aisle ${aisle} bin wall`;
}

/** "Level 1": a level row's header and the tooltip's level line. */
export function levelName(level: string): string {
  return `Level ${level}`;
}

/** A class name inside a sentence: "fast-moving", "dead stock". */
function classInSentence(movementClass: MovementClass): string {
  return CLASS_LABELS[movementClass].toLowerCase();
}

/** "N picks" (singular "1 pick"). */
function picksText(picks: number): string {
  return plural(picks, "pick", "picks");
}

/**
 * A wall cell's accessible name: "A-07-01-02, level 1, best location, occupied, fast-moving"
 * (the top part's class), ", selected" while its part's panel is open, then its moves
 * ("move 1, selected, leaves here").
 */
export function cellName(cell: {
  code: string;
  level: string;
  best: boolean;
  occupied: boolean;
  topClass?: MovementClass;
  selected?: boolean;
  /** The cell's move texts (`cellMoveText`), in drawer order (Story 10.4). */
  moves?: readonly string[];
}): string {
  const words = [cell.code, `level ${cell.level}`];
  if (cell.best) words.push("best location");
  words.push(cell.occupied ? "occupied" : "empty");
  if (cell.occupied && cell.topClass !== undefined) words.push(classInSentence(cell.topClass));
  if (cell.selected) words.push("selected");
  words.push(...(cell.moves ?? []));
  return words.join(", ");
}

type WallPartLike = {
  part: string;
  description: string;
  movement_class: MovementClass;
  picks: number;
  stock: string;
  kept_in_place: boolean;
};

/** One line of a cell's description: "4410281 Oil filter, fast-moving, 33 picks, stock 4[, kept in place]". */
export function cellPartLine(part: WallPartLike): string {
  const line = `${part.part} ${part.description}, ${classInSentence(part.movement_class)}, ${picksText(part.picks)}, stock ${formatNumber(part.stock)}`;
  return part.kept_in_place ? `${line}, ${KEPT_IN_PLACE_STATE}` : line;
}

/** "Occupied · 3 parts", "Occupied · 1 part" or "Empty" (never a colour). */
export function occupancyText(occupied: boolean, parts: number): string {
  return occupied ? `Occupied · ${plural(parts, "part", "parts")}` : "Empty";
}

/** A covering mark in the tooltip: "Level 1 in aisle A (best-location mark)". */
export function markSourceText(mark: BestMark): string {
  return `${markLabel(mark)} (best-location mark)`;
}

/** "Walk Path 2,270". */
export function walkPathText(walkPath: string): string {
  return `Walk Path ${formatNumber(walkPath)}`;
}

/** A part line's facts in the tooltip: "Fast-moving · 33 picks · stock 4". */
export function partStatsText(part: Pick<WallPartLike, "movement_class" | "picks" | "stock">): string {
  return `${CLASS_LABELS[part.movement_class]} · ${picksText(part.picks)} · stock ${formatNumber(part.stock)}`;
}

/** A rule 3 recommendation touching a cell: "Partner 4410281 · 14 shared jobs · recommendation #2". */
export function partnerStripText(partner: string, sharedJobs: number, number: number): string {
  return `Partner ${partner} · ${sharedJobsText(sharedJobs)} · recommendation #${formatNumber(number)}`;
}

/** The pinned tooltip's link to a recommendation: "Show recommendation #2". */
export function showRecommendationLabel(number: number): string {
  return `Show recommendation #${formatNumber(number)}`;
}

/** A line of a wall cell's description, ended with a period so screen readers pause between lines. */
export function descriptionLine(line: string): string {
  return `${line}.`;
}

/** A wall gap cell's name: a section position with no location. */
export const GAP_CELL_LABEL = "No location";

/** Why the pinned tooltip's Manual move… is disabled on an empty location. */
export const EMPTY_LOCATION_REASON = "This location is empty.";

/** Why a Manual move… waits: its part is still loading. */
export const LOADING_PART = "Loading the part…";

// Moves on the wall (Story 10.4, FR-42, UX-DR44/46): the cell names' move texts, the cross-aisle
// target lines, the selected move's hover note and the "Moves touching aisle" drawer. Every entry,
// status and count is the server's wall view; only the words are made here.

/** How one end of a move is drawn on a cell (and named in its accessible name). */
export type MoveMarkKind = "lift" | "target" | "applied" | "manual" | "outdated";

/** Which end of its move a mark is drawn on. */
export type MoveMarkEnd = "from" | "to";

/**
 * A cell's move text, appended to its accessible name: "move 1, leaves here", "move 2, selected,
 * arrives here", "move 3 applied, arrived here", "manual move, arrived here", "move 4 outdated".
 * An applied or manual move drawn on its from-cell (its to-cell is in another aisle) "left here".
 */
export function cellMoveText(mark: {
  kind: MoveMarkKind;
  number: number | null;
  selected: boolean;
  end?: MoveMarkEnd;
}): string {
  const number = mark.number === null ? "" : formatNumber(mark.number);
  const selected = mark.selected ? ", selected" : "";
  switch (mark.kind) {
    case "lift":
      return `move ${number}${selected}, leaves here`;
    case "target":
      return `move ${number}${selected}, arrives here`;
    case "applied":
      return `move ${number} applied${selected}, ${mark.end === "from" ? "left here" : "arrived here"}`;
    case "manual":
      return `manual move${selected}, ${mark.end === "from" ? "left here" : "arrived here"}`;
    case "outdated":
      return `move ${number} outdated${selected}`;
  }
}

/** A target's tooltip line when its move comes from another aisle: "From G-14-04-02 (aisle G)". */
export function moveFromOtherAisleText(from: Pick<LocationRef, "code" | "aisle">): string {
  return `From ${from.code} (aisle ${from.aisle})`;
}

/** The same in the cell's hidden description: "Recommendation 2 arrives here from G-14-04-02". */
export function moveArrivesFromText(number: number, from: string): string {
  return `Recommendation ${formatNumber(number)} arrives here from ${from}`;
}

/** "A-12-04-02 → A-14-02-01". */
export function moveRouteText(move: Pick<WallMove, "from_location" | "to_location">): string {
  return `${move.from_location.code} → ${move.to_location.code}`;
}

/** The joined recommendation's reason, when the versions agree (AD-12). */
type MoveReason = RecommendationRow["reason"];

/**
 * The selected move's hover note (UX-DR44), two lines:
 * "Rule 1 · 8044172 Oil filter - Toyota Corolla" ("Manual · …" for a manual move) and
 * "33 picks (24 or more) · A-12-04-02 → A-14-02-01" (rule 3: "Partner 4410281 · 14 shared jobs ·
 * from → to"; without a joined reason: "33 picks · from → to").
 */
export function hoverNoteLines(move: WallMove, reason?: MoveReason | null): [string, string] {
  const first = `${RULE_LABELS[move.rule]} · ${move.part} ${move.description}`.trimEnd();
  const route = moveRouteText(move);
  let facts = picksText(move.picks);
  if (move.kind === "recommendation" && reason) {
    facts =
      reason.kind === "class"
        ? `${picksText(move.picks)} (${thresholdText(reason.threshold)})`
        : `Partner ${reason.partner} · ${sharedJobsText(reason.shared_jobs)}`;
  }
  return [first, `${facts} · ${route}`];
}

/** "Moves touching aisle A". */
export function movesDrawerTitle(aisle: string): string {
  return `Moves touching aisle ${aisle}`;
}

/** The drawer heading: "Moves touching aisle A · Round 1 · 7 moves · 4 to decide". */
export function movesDrawerHeading(aisle: string, round: number, moves: number, toDecide: number): string {
  return [
    movesDrawerTitle(aisle),
    `Round ${formatNumber(round)}`,
    plural(moves, "move", "moves"),
    `${formatNumber(toDecide)} to decide`,
  ].join(" · ");
}

/** The drawer with no entries: "No moves touch aisle A." */
export function noMovesTouchText(aisle: string): string {
  return `No moves touch aisle ${aisle}.`;
}

/** The collapsed drawer with nothing selected. */
export const NO_MOVE_SELECTED = "No move selected. Select a move on the wall or show all.";

/** The drawer's toggle: "Show all 7". */
export function showAllMovesText(count: number): string {
  return `Show all ${formatNumber(count)}`;
}

/** The drawer's link to the Recommendations step: "Open round 1". */
export function openRoundText(round: number): string {
  return `Open round ${formatNumber(round)}`;
}

/** The drawer table's accessible name. */
export function movesTableLabel(aisle: string): string {
  return movesDrawerTitle(aisle);
}

/** The drawer table's column heads, in order. */
export const MOVES_TABLE_COLUMNS = {
  rule: "Rule",
  part: "Part",
  classPicks: "Class · picks",
  from: "From",
  to: "To",
  status: "Status",
  action: "Action",
} as const;

/** "Fast-moving · 33 picks". */
export function moveClassPicksText(move: Pick<WallMove, "movement_class" | "picks">): string {
  return `${CLASS_LABELS[move.movement_class]} · ${picksText(move.picks)}`;
}

/** A move's marker text for screen readers in the drawer: "Move 1" (its server number) or "Manual move". */
export function moveLabel(move: Pick<WallMove, "kind" | "number">): string {
  if (move.kind === "manual" || move.number === null) return "Manual move";
  return `Move ${formatNumber(move.number)}`;
}

/** A move's status in the drawer: "To decide", "Kept in place", "Applied · move 3", "Outdated", "Manual · move 5". */
export function moveStatusText(move: Pick<WallMove, "status" | "move_number">): string {
  const number = move.move_number === null ? "" : ` · move ${formatNumber(move.move_number)}`;
  switch (move.status) {
    case "open":
      return "To decide";
    case "kept":
      return KEPT_IN_PLACE;
    case "applied":
      return `Applied${number}`;
    case "outdated":
      return "Outdated";
    case "manual":
      return `Manual${number}`;
  }
}

/** An outdated move's status with its cause, when its recommendation row agrees: "Outdated · The best-location marks changed." */
export function moveOutdatedStatusText(part: string, outdated: OutdatedInfo): string {
  return `Outdated · ${outdatedText(part, outdated)}`;
}

/** The selected drawer row's extra word for screen readers. */
export const SELECTED_ROW_TEXT = "selected";

/** Between a route's from- and to-location, for screen readers (the arrow is decorative). */
export const ROUTE_TO_TEXT = "to";

/** The drawer's Apply. */
export const APPLY_LABEL = "Apply";

// Wall crops in the recommendation detail (Story 10.5, FR-42, UX-DR34/57): the crops' names and
// headings, the rule caption, the link to the Locations wall and "Moves in the planning copy".
// Every location's aisle and level come from the import layout, every move from the server.

/** One end of a move in a crop's name: its code, and its aisle and level when the layout has it. */
export type CropEnd = { code: string; aisle?: string; level?: string; best: boolean };

function cropEndText(end: CropEnd): string {
  const words = [end.code];
  if (end.aisle !== undefined) words.push(`aisle ${end.aisle}`);
  if (end.level !== undefined) words.push(`level ${end.level}`);
  if (end.best) words.push("best location");
  return words.join(", ");
}

/** A crop's accessible name: "From G-14-04-02, aisle G, level 4 → to A-02-01-01, aisle A, level 1, best location". */
export function cropName(from: CropEnd, to: CropEnd): string {
  return `From ${cropEndText(from)} → to ${cropEndText(to)}`;
}

/** The heading over a cross-aisle move's first crop: "From aisle G". */
export function cropFromHeading(aisle: string): string {
  return `From aisle ${aisle}`;
}

/** The heading over a cross-aisle move's second crop: "To aisle A". */
export function cropToHeading(aisle: string): string {
  return `To aisle ${aisle}`;
}

/** The caption between (or under) the crops: "Rule 1 · round 1". */
export function cropCaption(rule: RecommendationRow["rule"], round: number): string {
  return `${RULE_LABELS[rule]} · round ${formatNumber(round)}`;
}

/** The detail's link that opens the Locations wall with the move selected. */
export const SHOW_ON_LOCATIONS_WALL = "Show on the Locations wall";

/** The heading of the planning copy's last moves under the crops. */
export const RECENT_MOVES_TITLE = "Moves in the planning copy";

/** "Moves in the planning copy" with no moves. */
export const NO_RECENT_MOVES = "No moves in the planning copy yet.";

/** One recent move: "Move 3 · Rule 1 · 9723950 · A-03-04-02 → A-05-01-03" ("Manual" for a manual move). */
export function recentMoveText(move: RecentMove): string {
  return `Move ${formatNumber(move.move_number)} · ${RULE_LABELS[move.rule]} · ${move.part} · ${move.from_location} → ${move.to_location}`;
}

/**
 * Under the recent moves, from the undo preview's `effect`: "Undo reverses move 3 first",
 * "Undo splits move 3 first" or "Undo restores move 4 first".
 */
export function undoFirstText(preview: UndoPreview): string {
  const number = formatNumber(preview.effect.move_number);
  switch (preview.effect.kind) {
    case "reverts_move":
      return `Undo reverses move ${number} first`;
    case "splits_combined_move":
      return `Undo splits move ${number} first`;
    case "restores_removed_move":
      return `Undo restores move ${number} first`;
  }
}
