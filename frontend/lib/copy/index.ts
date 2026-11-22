// Copy (AD-11, UX-DR39): the one place that words recommendation reasons, "no space" causes,
// outdated causes and the marks toast. The server sends them as structured data; nothing else in
// the frontend turns that data into sentences. Class names and pick lines live here too, so the
// part panel and the recommendations say them the same way.

import type {
  ClassThreshold,
  NoSpaceCause,
  OutdatedInfo,
  RecommendationReason,
} from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";

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
