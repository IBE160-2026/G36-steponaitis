// Copy (AD-11, UX-DR39): the one place that words recommendation reasons, "no space" causes,
// outdated causes, the marks toast, and the run, apply and apply all lines and toasts (Story
// 5.7). The server sends them as structured data; nothing else in the frontend turns that data
// into sentences. Class names and pick lines live here too, so the part panel and the
// recommendations say them the same way.

import type {
  AppliedInfo,
  ApplyAllDoneEvent,
  ClassThreshold,
  CommandEvent,
  NoSpaceCause,
  OutdatedInfo,
  RecommendationReason,
  RunMeta,
} from "@/lib/api/plans";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

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

type MoveMadeEvent = Extract<CommandEvent, { type: "move_made" }>;
type RunDoneEvent = Extract<CommandEvent, { type: "run_done" }>;

/** "1 recommendation" / "13 recommendations". */
export function recommendationsCount(count: number): string {
  return plural(count, "recommendation", "recommendations");
}

/** "Applied · move 16, round 1": an applied recommendation's row and detail line. */
export function appliedText(applied: AppliedInfo): string {
  return `Applied · move ${formatNumber(applied.move_number)}, round ${formatNumber(applied.round)}`;
}

/** The toast after Apply (UX-DR33): "Applied · move 16, round 1 · 1100 C-01-01-01 → A-01-01-03". */
export function appliedToast(event: MoveMadeEvent): string {
  return `${appliedText(event)} · ${event.part} ${event.from_location} → ${event.to_location}`;
}

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
