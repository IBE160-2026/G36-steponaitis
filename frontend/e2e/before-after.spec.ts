import { randomUUID } from "node:crypto";

import { expect, type Locator, test } from "./support/test";

import { type Detail, getJson, locationRows, moveFromPanel, partDetail } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 climax (Story 4.6, FR-37, UX-DR51): the Before/after page shows what a manual move changes,
// per aisle; the flow bar never checks the Before/after step.

type Count = { before: number; after: number };
type BeforeAfter = { aisles: { aisle: string; occupied: Count }[] };

const NO_MOVES = "No moves yet: before and after are the same.";
const n = (value: number) => value.toLocaleString("en-US");

function aisleRow(table: Locator, aisle: string): Locator {
  return table.locator("tbody tr").filter({ has: table.page().getByRole("cell", { name: aisle, exact: true }) });
}

test("uj1 before/after shows a manual move", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Before after ${randomUUID().slice(0, 8)}`)).id;
  const rows = await locationRows(request, planId);
  // A part stored at one location only, and an empty location in another aisle.
  let detail: Detail | undefined;
  for (const row of rows) {
    if (row.contents.length !== 1) continue;
    const candidate = await partDetail(request, planId, row.contents[0].part);
    if (candidate.other_locations.length === 0 && candidate.current_location?.code === row.location.code) {
      detail = candidate;
      break;
    }
  }
  expect(detail).toBeDefined();
  const part = detail!.part;
  const source = detail!.current_location!;
  const target = rows.find((row) => !row.occupied && row.location.aisle !== source.aisle)!.location;
  const fresh = await getJson<BeforeAfter>(request, `/api/plans/${planId}/before-after`);
  const occupied = (aisle: string) => fresh.aisles.find((row) => row.aisle === aisle)!.occupied.before;

  await page.goto(`/plans/${planId}/before-after`);
  const main = page.getByRole("main");
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  const step = nav.getByRole("link", { name: /Before\/after\s*, step 7$/ });
  await expect(main.getByRole("heading", { name: "Before/after" })).toBeVisible();
  await expect(main.getByText(NO_MOVES, { exact: true })).toBeVisible();
  await expect(step).toBeVisible();
  await expect(step).not.toHaveAccessibleName(/, done$/);
  const table = main.getByRole("table", { name: "Before/after" });
  await expect(aisleRow(table, source.aisle).locator('[data-count="occupied"]')).toHaveText(
    `${n(occupied(source.aisle))} → ${n(occupied(source.aisle))}`,
  );

  // Client-side navigation keeps the cached Before/after query, so it must refetch after the move.
  await nav.getByRole("link", { name: /Parts\s*, step 2/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  const field = main.getByRole("searchbox", { name: "Search parts and locations" });
  await field.click();
  await page.keyboard.type(part);
  await main.locator(`[data-search-part="${part}"]`).click();
  const panel = page.getByRole("complementary", { name: part });
  await moveFromPanel(page, panel, part, source.code, target.code);

  await step.click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/before-after$`));
  await expect(table).toBeVisible();
  await expect(main.getByText(NO_MOVES, { exact: true })).toHaveCount(0);
  const sourceRow = aisleRow(table, source.aisle);
  const targetRow = aisleRow(table, target.aisle);
  await expect(sourceRow.locator("td").nth(2)).toContainText(part);
  await expect(targetRow.locator("td").nth(1)).toContainText(part);
  await expect(sourceRow.locator('[data-count="occupied"]')).toHaveText(
    `${n(occupied(source.aisle))} → ${n(occupied(source.aisle) - 1)}`,
  );
  await expect(targetRow.locator('[data-count="occupied"]')).toHaveText(
    `${n(occupied(target.aisle))} → ${n(occupied(target.aisle) + 1)}`,
  );
  await expect(step).not.toHaveAccessibleName(/, done$/);

  // One tab stop; ↑/↓ move between rows.
  const first = table.locator("tbody tr").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(table.locator("tbody tr").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(first).toBeFocused();
  await expect(table.locator('tbody tr[tabindex="0"]')).toHaveCount(1);
});
