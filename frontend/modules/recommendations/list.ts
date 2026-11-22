// Recommendations list helpers (Story 5.7, UX-DR31, UX-DR32): which rows a tab shows, the rule
// bands, the 5-per-rule limit, the "no space" collapse, the option names and the list's keys. Pure:
// every status, order, class and BEST flag comes from the server view (AD-3, AD-14); nothing here
// reorders rows.

import type { NoSpaceRow, RecommendationRow, RecommendationsView } from "@/lib/api/plans";
import { appliedText, noSpaceText, outdatedText } from "@/lib/copy";
import { formatNumber } from "@/lib/format";
import type { RecommendationsTab } from "@/lib/view-state/urls";

export type Rule = RecommendationRow["rule"];

/** The rule bands in rule order: tag, name and how the rule orders its rows. */
export const RULE_BANDS: readonly { rule: Rule; tag: string; name: string; note: string }[] = [
  {
    rule: "rule_1",
    tag: "Rule 1",
    name: "Fast-moving parts into best locations",
    note: "Most picks first · best locations in location-code order",
  },
  {
    rule: "rule_2",
    tag: "Rule 2",
    name: "Slow-moving and dead parts out of best locations",
    note: "Fewest picks first · locations in location-code order",
  },
  {
    rule: "rule_3",
    tag: "Rule 3",
    name: "Pick groups into one aisle",
    note: "Most shared jobs first · the part with fewer picks moves",
  },
];

/** "1", "2" or "3". */
export function ruleNumber(rule: Rule): string {
  return rule.slice("rule_".length);
}

export const TABS: readonly { value: RecommendationsTab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "applied", label: "Applied" },
  { value: "outdated", label: "Outdated" },
  { value: "no-space", label: "No space" },
];

export const EMPTY_TAB: Record<RecommendationsTab, string> = {
  open: "No open recommendations.",
  applied: "No applied recommendations.",
  outdated: "No outdated recommendations.",
  "no-space": "No “no space” parts in this run.",
};

/** How many rows each rule shows before "Show N more under rule X". */
export const ROWS_PER_RULE = 5;

export type ListItem = { kind: "rec"; row: RecommendationRow } | { kind: "no-space"; row: NoSpaceRow };

/** The id selection is kept by: the recommendation id, or `nospace:{part}`. */
export function itemId(item: ListItem): string {
  return item.kind === "rec" ? item.row.id : `nospace:${item.row.part}`;
}

/** The rows of one tab, in server order. */
export function tabItems(view: RecommendationsView, tab: RecommendationsTab): ListItem[] {
  if (tab === "no-space") return view.no_space.map((row) => ({ kind: "no-space", row }));
  return view.recommendations.filter((row) => row.status === tab).map((row) => ({ kind: "rec", row }));
}

export function tabCounts(view: RecommendationsView): Record<RecommendationsTab, number> {
  const count = (status: RecommendationRow["status"]) => view.recommendations.filter((r) => r.status === status).length;
  return { open: count("open"), applied: count("applied"), outdated: count("outdated"), "no-space": view.no_space.length };
}

/** A tab's accessible name: "Open, 13 recommendations" / "No space, 31 parts" (singular for 1). */
export function tabName(tab: RecommendationsTab, count: number): string {
  const label = TABS.find((candidate) => candidate.value === tab)?.label ?? tab;
  const noun = tab === "no-space" ? (count === 1 ? "part" : "parts") : count === 1 ? "recommendation" : "recommendations";
  return `${label}, ${formatNumber(count)} ${noun}`;
}

/** The items of one rule, in server order; only rules with rows, in rule order 1, 2, 3. */
export function groupByRule(items: readonly ListItem[]): { rule: Rule; items: ListItem[] }[] {
  return RULE_BANDS.flatMap(({ rule }) => {
    const ruleItems = items.filter((item) => item.row.rule === rule);
    return ruleItems.length > 0 ? [{ rule, items: ruleItems }] : [];
  });
}

/** One collapsed "no space" line: the first row of a run of identical lines plus the rest. */
export type NoSpaceRun = { first: ListItem; rest: ListItem[] };

function noSpaceLine(item: ListItem): string {
  return item.kind === "no-space" ? `${item.row.rule}|${noSpaceText(item.row.cause)}` : itemId(item);
}

/** Consecutive rows with the same rule and cause sentence collapse into their first row (order kept). */
export function collapseNoSpace(items: readonly ListItem[]): NoSpaceRun[] {
  const runs: NoSpaceRun[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && noSpaceLine(last.first) === noSpaceLine(item)) last.rest.push(item);
    else runs.push({ first: item, rest: [] });
  }
  return runs;
}

/** What one rule band shows. `more` is the button under the band (null when nothing is hidden). */
export type BandView = {
  rule: Rule;
  /** Visible rows, each with the "N more like this" button after it (no space only). */
  rows: { item: ListItem; moreLikeThis: { key: string; count: number } | null }[];
  more: { count: number } | null;
};

/**
 * The bands of a tab with their visible rows. Open/Applied/Outdated: 5 rows per rule unless the
 * rule is in `expandedRules`. No space: each collapsed run shows its first row, or all of it when
 * its first row's id is in `expandedRuns`.
 */
export function bandViews(
  tab: RecommendationsTab,
  items: readonly ListItem[],
  expandedRules: ReadonlySet<Rule>,
  expandedRuns: ReadonlySet<string>,
): BandView[] {
  return groupByRule(items).map(({ rule, items: ruleItems }) => {
    if (tab === "no-space") {
      const rows = collapseNoSpace(ruleItems).flatMap(({ first, rest }): BandView["rows"] => {
        const key = itemId(first);
        if (rest.length === 0) return [{ item: first, moreLikeThis: null }];
        if (expandedRuns.has(key)) return [first, ...rest].map((item) => ({ item, moreLikeThis: null }));
        return [{ item: first, moreLikeThis: { key, count: rest.length } }];
      });
      return { rule, rows, more: null };
    }
    const shown = expandedRules.has(rule) ? ruleItems : ruleItems.slice(0, ROWS_PER_RULE);
    const hidden = ruleItems.length - shown.length;
    return { rule, rows: shown.map((item) => ({ item, moreLikeThis: null })), more: hidden > 0 ? { count: hidden } : null };
  });
}

export function showMoreText(count: number, rule: Rule): string {
  return `Show ${formatNumber(count)} more under rule ${ruleNumber(rule)}`;
}

export function moreLikeThisText(count: number): string {
  return `${formatNumber(count)} more like this`;
}

/** An option's accessible name: number, part, from, to and its state words. */
export function optionName(item: ListItem): string {
  if (item.kind === "no-space") {
    const from =
      item.row.from_location === null
        ? "no current location"
        : `${item.row.from_location}${item.row.from_best ? " BEST" : ""}`;
    return `${item.row.part}, from ${from}, ${noSpaceText(item.row.cause)}`;
  }
  const row = item.row;
  const to = `${row.to_location}${row.to_best ? " BEST" : ""}`;
  const from = `${row.from_location}${row.from_best ? " BEST" : ""}`;
  const base = `#${formatNumber(row.number)}, ${row.part}, from ${from} to ${to}`;
  if (row.status === "applied" && row.applied) return `${base}, ${appliedText(row.applied)}`;
  if (row.status === "outdated" && row.outdated) return `${base}, outdated, ${outdatedText(row.part, row.outdated)}`;
  return base;
}

/** The index ↑/↓/Home/End moves to, clamped to the list; null for any other key. */
export function nextOptionIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return Math.min(index + 1, count - 1);
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

type TargetLike = { tagName?: string; isContentEditable?: boolean } | null;

/** True for a field the planner types into (input, textarea, select, contenteditable). */
export function isTextEntry(target: TargetLike): boolean {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
}

/** `Alt+A` / `⌥A` (by key code, so ⌥A's "å" counts), never from a text field. */
export function isApplyShortcut(event: { altKey: boolean; code: string; target: TargetLike }): boolean {
  return event.altKey && event.code === "KeyA" && !isTextEntry(event.target);
}
