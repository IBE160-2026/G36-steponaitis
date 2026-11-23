import { getJson } from "./plan-api";
import { type APIRequestContext, expect, type Locator } from "./test";

// Shared by the journeys that read the Recommendations view (recommendations-page.spec.ts,
// user-journeys.spec.ts).

export const RULES = ["rule_1", "rule_2", "rule_3"] as const;
export type Rule = (typeof RULES)[number];

export type RecReason =
  | { kind: "class"; movement_class: string; picks: number }
  | { kind: "pick_group"; partner: string; partner_aisle: string | null; shared_jobs: number; min_shared_jobs: number };

export type RecRow = {
  id: string;
  number: number;
  rule: Rule;
  part: string;
  picks: number;
  from_location: string;
  to_location: string;
  status: "open" | "applied" | "outdated" | "kept";
  reason: RecReason | null;
  applied: { to_location: string } | null;
};
export type RecView = {
  run: { round: number } | null;
  recommendations: RecRow[];
  no_space: { part: string }[];
  kept_parts: { part: string }[];
};

export async function recommendationsOf(request: APIRequestContext, planId: string): Promise<RecView> {
  return getJson<RecView>(request, `/api/plans/${planId}/recommendations`);
}

/** The open rows the page shows first: rule order, server order within a rule, 5 per rule. */
export function visibleOpen<R extends Pick<RecRow, "rule" | "status">>(view: { recommendations: R[] }): R[] {
  const open = view.recommendations.filter((row) => row.status === "open");
  return RULES.flatMap((rule) => open.filter((row) => row.rule === rule).slice(0, 5));
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** The listbox option of `row` ("#12, 4410281, from … to …"). */
export function recOption(main: Locator, row: Pick<RecRow, "number" | "part">): Locator {
  return main
    .getByRole("listbox", { name: "Recommendations" })
    .getByRole("option", { name: new RegExp(`^#${row.number.toLocaleString("en-US")}, ${row.part}, `) });
}

/**
 * Selects `row` in the open tab's listbox with a click, first showing the rest of its rule's band
 * ("Show N more under rule X") when the row is not among the five shown.
 */
export async function selectRecommendation(main: Locator, row: Pick<RecRow, "number" | "part" | "rule">) {
  const option = recOption(main, row);
  if ((await option.count()) === 0) {
    await main
      .getByRole("listbox", { name: "Recommendations" })
      .getByRole("button", { name: new RegExp(`^Show \\d+ more under rule ${row.rule.slice(-1)}$`) })
      .click();
  }
  await option.click();
  await expect(option).toHaveAttribute("aria-selected", "true");
}
