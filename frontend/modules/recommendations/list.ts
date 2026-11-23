// Recommendations list helpers (Story 5.7, UX-DR31, UX-DR32): which rows a tab shows, the rule
// bands, the 5-per-rule limit, the "no space" collapse, the option names and the list's keys. The
// Kept in place tab (Story 7.1, FR-32) shows each kept part once: its kept recommendation, its kept
// "no space" row, or a row of the trailing "Kept" band (`kept_parts`). Pure:
// every status, order, class and BEST flag comes from the server view (AD-3, AD-14); nothing here
// reorders rows.

import type { KeptPartRow, NoSpaceRow, RecommendationRow, RecommendationsView } from "@/lib/api/plans";
import { appliedText, KEPT_BAND, KEPT_IN_PLACE, noSpaceText, NOTHING_KEPT, outdatedText } from "@/lib/copy";
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

/** A band of the list: a rule band, or the Kept tab's trailing "Kept" band. */
export type BandKey = Rule | "kept";

/** The tag, name and note of a band. */
export function bandMeta(key: BandKey): { tag: string; name: string; note: string } {
  if (key === "kept") return KEPT_BAND;
  return RULE_BANDS.find((band) => band.rule === key) ?? RULE_BANDS[0];
}

/** "1", "2" or "3". */
export function ruleNumber(rule: Rule): string {
  return rule.slice("rule_".length);
}

export const TABS: readonly { value: RecommendationsTab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "applied", label: "Applied" },
  { value: "kept", label: KEPT_IN_PLACE },
  { value: "outdated", label: "Outdated" },
  { value: "no-space", label: "No space" },
];

export const EMPTY_TAB: Record<RecommendationsTab, string> = {
  open: "No open recommendations.",
  applied: "No applied recommendations.",
  kept: NOTHING_KEPT,
  outdated: "No outdated recommendations.",
  "no-space": "No “no space” parts in this run.",
};

/** How many rows each rule shows before "Show N more under rule X". */
export const ROWS_PER_RULE = 5;

export type ListItem =
  | { kind: "rec"; row: RecommendationRow }
  | { kind: "no-space"; row: NoSpaceRow }
  | { kind: "kept-part"; row: KeptPartRow };

/** The id selection is kept by: the recommendation id, `nospace:{part}` or `kept:{part}`. */
export function itemId(item: ListItem): string {
  if (item.kind === "rec") return item.row.id;
  return item.kind === "no-space" ? `nospace:${item.row.part}` : `kept:${item.row.part}`;
}

/** Whether the item's part is kept in place (the server's status and flags). */
export function isKept(item: ListItem): boolean {
  if (item.kind === "rec") return item.row.status === "kept";
  return item.kind === "no-space" ? item.row.kept_in_place : true;
}

/** Whether the item shows the Keep in place link: an open or kept recommendation, any "no space"
 * row or kept part; never an applied or outdated recommendation. */
export function showsKeepLink(item: ListItem): boolean {
  return item.kind !== "rec" || item.row.status === "open" || item.row.status === "kept";
}

/** The rows of one tab, in server order (Kept: kept recommendations, kept "no space" rows, then
 * the kept parts without either, in part-number order). */
export function tabItems(view: RecommendationsView, tab: RecommendationsTab): ListItem[] {
  const noSpace = (kept: boolean): ListItem[] =>
    view.no_space.filter((row) => row.kept_in_place === kept).map((row) => ({ kind: "no-space", row }));
  if (tab === "no-space") return noSpace(false);
  const recs: ListItem[] = view.recommendations.filter((row) => row.status === tab).map((row) => ({ kind: "rec", row }));
  if (tab !== "kept") return recs;
  return [...recs, ...noSpace(true), ...view.kept_parts.map((row): ListItem => ({ kind: "kept-part", row }))];
}

/** Each tab's count; Kept counts all three sources, so it equals the number of kept parts. */
export function tabCounts(view: RecommendationsView): Record<RecommendationsTab, number> {
  const count = (status: RecommendationRow["status"]) => view.recommendations.filter((r) => r.status === status).length;
  const keptNoSpace = view.no_space.filter((row) => row.kept_in_place).length;
  return {
    open: count("open"),
    applied: count("applied"),
    kept: count("kept") + keptNoSpace + view.kept_parts.length,
    outdated: count("outdated"),
    "no-space": view.no_space.length - keptNoSpace,
  };
}

/** A tab's accessible name: "Open, 13 recommendations" / "No space, 31 parts" / "Kept in place,
 * 1 part" (singular for 1). */
export function tabName(tab: RecommendationsTab, count: number): string {
  const label = TABS.find((candidate) => candidate.value === tab)?.label ?? tab;
  const parts = tab === "no-space" || tab === "kept";
  const noun = parts ? (count === 1 ? "part" : "parts") : count === 1 ? "recommendation" : "recommendations";
  return `${label}, ${formatNumber(count)} ${noun}`;
}

/** The items of each band, in server order: rule bands with rows in rule order 1, 2, 3, then the
 * "Kept" band of kept parts (Kept tab only). */
export function groupByRule(items: readonly ListItem[]): { rule: BandKey; items: ListItem[] }[] {
  const rules = RULE_BANDS.flatMap(({ rule }) => {
    const ruleItems = items.filter((item) => item.kind !== "kept-part" && item.row.rule === rule);
    return ruleItems.length > 0 ? [{ rule: rule as BandKey, items: ruleItems }] : [];
  });
  const kept = items.filter((item) => item.kind === "kept-part");
  return kept.length > 0 ? [...rules, { rule: "kept", items: kept }] : rules;
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
  rule: BandKey;
  /** Visible rows, each with the "N more like this" button after it (no space only). */
  rows: { item: ListItem; moreLikeThis: { key: string; count: number } | null }[];
  more: { count: number } | null;
};

/**
 * The bands of a tab with their visible rows. Open/Applied/Kept/Outdated: 5 rows per rule unless
 * the rule is in `expandedRules`; the "Kept" band shows all its rows. No space: each collapsed run
 * shows its first row, or all of it when its first row's id is in `expandedRuns`.
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
    if (rule === "kept") return { rule, rows: ruleItems.map((item) => ({ item, moreLikeThis: null })), more: null };
    const shown = expandedRules.has(rule) ? ruleItems : ruleItems.slice(0, ROWS_PER_RULE);
    const hidden = ruleItems.length - shown.length;
    return { rule, rows: shown.map((item) => ({ item, moreLikeThis: null })), more: hidden > 0 ? { count: hidden } : null };
  });
}

/**
 * The expanded rule bands a page opened on `?rec=<id>` starts with: the row's band on `tab` when
 * the row would sit past the first rows of its rule, so the selected row is shown; none otherwise.
 */
export function expandedForRow(items: readonly ListItem[], tab: RecommendationsTab, id: string | undefined): Set<string> {
  const item = id === undefined ? undefined : items.find((candidate) => candidate.kind === "rec" && itemId(candidate) === id);
  if (item === undefined || item.kind !== "rec" || tab === "no-space") return new Set();
  const rule = item.row.rule;
  const index = items.filter((candidate) => candidate.kind !== "kept-part" && candidate.row.rule === rule).indexOf(item);
  return index >= ROWS_PER_RULE ? new Set([`${tab}:${rule}`]) : new Set();
}

export function showMoreText(count: number, rule: Rule): string {
  return `Show ${formatNumber(count)} more under rule ${ruleNumber(rule)}`;
}

export function moreLikeThisText(count: number): string {
  return `${formatNumber(count)} more like this`;
}

/** Where the row's move goes: the applied move's to-location (FR-31: it may be another allowed
 * location than the suggested one), else the suggested one, with BEST as the server judged it. */
export function effectiveTo(row: RecommendationRow): { location: string; best: boolean } {
  if (row.status === "applied" && row.applied) return { location: row.applied.to_location, best: row.applied.to_best };
  return { location: row.to_location, best: row.to_best };
}

/** An option's accessible name: number, part, from, to and its state words. */
export function optionName(item: ListItem): string {
  if (item.kind !== "rec") {
    const from =
      item.row.from_location === null
        ? "no current location"
        : `${item.row.from_location}${item.row.from_best ? " BEST" : ""}`;
    if (item.kind === "kept-part") return `${item.row.part}, at ${from}, ${KEPT_IN_PLACE}`;
    const kept = item.row.kept_in_place ? `, ${KEPT_IN_PLACE}` : "";
    return `${item.row.part}, from ${from}, ${noSpaceText(item.row.cause)}${kept}`;
  }
  const row = item.row;
  const target = effectiveTo(row);
  const to = `${target.location}${target.best ? " BEST" : ""}`;
  const from = `${row.from_location}${row.from_best ? " BEST" : ""}`;
  const base = `#${formatNumber(row.number)}, ${row.part}, from ${from} to ${to}`;
  if (row.status === "applied" && row.applied) return `${base}, ${appliedText(row.applied)}`;
  if (row.status === "outdated" && row.outdated) return `${base}, outdated, ${outdatedText(row.part, row.outdated)}`;
  if (row.status === "kept") return `${base}, ${KEPT_IN_PLACE}`;
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

/** `Alt+O` / `⌥O` (by key code, so ⌥O's "ø" counts), never from a text field. */
export function isOtherLocationShortcut(event: { altKey: boolean; code: string; target: TargetLike }): boolean {
  return event.altKey && event.code === "KeyO" && !isTextEntry(event.target);
}

/** `Alt+K` / `⌥K` (by key code, so ⌥K's "˚" counts), never from a text field. */
export function isKeepShortcut(event: { altKey: boolean; code: string; target: TargetLike }): boolean {
  return event.altKey && event.code === "KeyK" && !isTextEntry(event.target);
}
