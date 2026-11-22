import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test, toasts } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// Story 7.1 (FR-32, UX-DR8, UX-DR37): the planner keeps a part in place from the part panel (UJ-7)
// and from a recommendation with Alt+K (UJ-1), sees the mark on the roster, the overview and the
// Kept in place tab, and removes it again. A mark toast never offers Undo.

type RosterRow = { part: string; kept_in_place: boolean };
type Row = { id: string; number: number; part: string; status: "open" | "applied" | "kept" | "outdated" };
type View = { recommendations: Row[] };

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

const keptToast = (part: string) => `${part} is kept in place. Remove the mark from the part or the Kept in place tab.`;
const removedToast = (part: string) => `${part} is no longer kept in place.`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

test("uj7 keeps a part in place from the part panel", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Keep ${randomUUID().slice(0, 8)}`)).id;
  const rows = (await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${planId}/parts`)).parts;
  const part = rows[0].part;

  await page.goto(`/plans/${planId}/parts`);
  const main = page.getByRole("main");
  const body = main.getByRole("table", { name: "Parts" }).locator("tbody tr");
  await expect(body).toHaveCount(rows.length);
  const row = body.first();
  await expect(row.getByRole("button", { name: "Keep in place" })).toBeVisible();
  await row.locator("td").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`[?&]part=${encodeURIComponent(part)}(&|$)`));

  const panel = page.getByRole("complementary", { name: part });
  await panel.getByRole("button", { name: "Keep in place" }).click();
  await expect(toasts(page).getByText(keptToast(part), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Remove keep in place" })).toBeVisible();
  await expect(panel.getByText("kept in place", { exact: true })).toBeVisible();
  await expect(row.getByText("kept in place", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Remove keep in place" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Overview/ }).click();
  await expect(main.getByText("Parts kept in place", { exact: true })).toBeVisible();
  await expect(main.getByText("Parts kept in place", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("1");

  // Remove from the roster row: a click on the link does not open the part panel.
  await page.goto(`/plans/${planId}/parts`);
  await expect(body).toHaveCount(rows.length);
  await body.first().getByRole("button", { name: "Remove keep in place" }).click();
  await expect(toasts(page).getByText(removedToast(part), { exact: true })).toBeVisible();
  await expect(body.first().getByRole("button", { name: "Keep in place" })).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]part=/);
  const summary = await getJson<{ kept_in_place: number }>(request, `/api/plans/${planId}`);
  expect(summary.kept_in_place).toBe(0);
});

test("uj1 keeps a recommendation in place", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Keep rec ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  const ran = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const openCount = ran.recommendations.filter((row) => row.status === "open").length;
  const before = await getJson<{ apply_all_count: number }>(request, `/api/plans/${planId}`);

  await page.goto(`/plans/${planId}/recommendations?tab=open`);
  const main = page.getByRole("main");
  const openTab = main.getByRole("tab", { name: /^Open, / });
  const keptTab = main.getByRole("tab", { name: /^Kept in place, / });
  await expect(keptTab).toHaveAccessibleName("Kept in place, 0 parts");
  const listbox = main.getByRole("listbox", { name: "Recommendations" });
  const first = listbox.getByRole("option").first();
  await first.click();
  await expect(first).toBeFocused();
  const name = (await first.getAttribute("aria-label")) ?? "";
  const number = Number(/^#(\d+),/.exec(name)?.[1]);
  const rec = ran.recommendations.find((row) => row.number === number)!;
  const detail = main.getByRole("region", { name: "Selected recommendation" });
  await expect(detail.getByRole("button", { name: "Keep in place" })).toHaveAttribute("aria-keyshortcuts", "Alt+K");

  // Alt+K keeps the selected row: it leaves Open and is counted on the Kept in place tab.
  await page.keyboard.press("Alt+KeyK");
  await expect(toasts(page).getByText(keptToast(rec.part), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(openTab).toHaveAccessibleName(`Open, ${plural(openCount - 1, "recommendation", "recommendations")}`);
  await expect(keptTab).toHaveAccessibleName("Kept in place, 1 part");
  await expect(main.getByRole("button", { name: `Apply all (${before.apply_all_count - 1})` })).toBeVisible();

  await keptTab.click();
  await expect(page).toHaveURL(/\?tab=kept$/);
  const kept = listbox.getByRole("option", { name: new RegExp(`^#${rec.number}, ${rec.part}, `) });
  await expect(kept).toHaveAccessibleName(/, Kept in place$/);
  const apply = detail.getByRole("button", { name: "Apply", exact: true });
  await expect(apply).toHaveAttribute("aria-disabled", "true");
  await expect(apply).toHaveAccessibleDescription(`${rec.part} is kept in place.`);

  await detail.getByRole("button", { name: "Remove keep in place" }).click();
  await expect(toasts(page).getByText(removedToast(rec.part), { exact: true })).toBeVisible();
  await expect(main.getByText("Nothing kept in place.", { exact: true })).toBeVisible();
  await expect(keptTab).toHaveAccessibleName("Kept in place, 0 parts");
  await expect(openTab).toHaveAccessibleName(`Open, ${plural(openCount, "recommendation", "recommendations")}`);
  await expect(main.getByRole("button", { name: `Apply all (${before.apply_all_count})` })).toBeVisible();
});
