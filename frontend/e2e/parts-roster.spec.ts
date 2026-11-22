import { randomUUID } from "node:crypto";

import { expect, test } from "./support/test";

import { createSamplePlan } from "./support/sample-plan";

// UJ-7: the planner opens the Parts step and reads the roster: class filter, a user sort on Picks
// with ties in server order, and one tab stop with arrow-key row movement (Story 2.3; FR-13,
// AD-14, UX-DR18, UX-DR23, UX-DR24).

const CLASS_LABELS = { fast: "Fast-moving", medium: "Medium-moving", slow: "Slow-moving", dead: "Dead stock" };

type Row = {
  rank: number;
  part: string;
  picks: number;
  movement_class: keyof typeof CLASS_LABELS;
  current_location: { code: string } | null;
};

function whyLine(row: Row): string {
  const where = row.current_location ? row.current_location.code : "No current location (no stock above zero)";
  return `${CLASS_LABELS[row.movement_class]} · ${row.picks.toLocaleString("en-US")} ${row.picks === 1 ? "pick" : "picks"} · ${where}`;
}

test("uj7 reads the parts roster, filters by class, sorts by picks and moves by keyboard", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const planId = (await createSamplePlan(request, `Parts ${randomUUID().slice(0, 8)}`)).id;
  const api = await request.get(`/api/plans/${planId}/parts`);
  expect(api.status()).toBe(200);
  const rows = ((await api.json()) as { parts: Row[] }).parts;

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Parts", level: 1 })).toBeVisible();
  await expect(main.getByText("1,545 parts", { exact: true })).toBeVisible();

  const table = main.getByRole("table", { name: "Parts" });
  const body = table.locator("tbody tr");
  await expect(body).toHaveCount(1_545);
  const first = body.first();
  await expect(first.locator("td").first()).toHaveText("1");
  await expect(first).toContainText(rows[0].part);
  await expect(first.locator("[data-why-line]")).toHaveText(whyLine(rows[0]));

  // A part with no stock above zero reads the no-current-location text.
  const noStock = rows.find((row) => row.current_location === null)!;
  const noStockRow = body.nth(noStock.rank - 1);
  await expect(noStockRow).toContainText(noStock.part);
  await expect(noStockRow.locator("[data-why-line]")).toHaveText(whyLine(noStock));
  await expect(noStockRow.locator("[data-why-line]")).toContainText("No current location (no stock above zero)");

  // Class filter: only Fast-moving rows, rank numbers unchanged.
  const fastChip = main.getByRole("button", { name: "Fast-moving" });
  await fastChip.click();
  await expect(fastChip).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByText("80 of 1,545 parts", { exact: true })).toBeVisible();
  await expect(body).toHaveCount(80);
  const whyLines = await body.locator("[data-why-line]").allTextContents();
  expect(whyLines.every((line) => line.startsWith("Fast-moving"))).toBe(true);
  const fastRanks = rows.filter((row) => row.movement_class === "fast").map((row) => String(row.rank));
  expect(await body.locator("td:first-child").allTextContents()).toEqual(fastRanks);
  await fastChip.click();
  await expect(body).toHaveCount(1_545);

  // Picks ascending: the lowest-pick part first, ties in server order.
  await table.getByRole("button", { name: "Picks" }).click();
  await expect(table.getByRole("columnheader", { name: "Picks" })).toHaveAttribute("aria-sort", "ascending");
  const lowest = Math.min(...rows.map((row) => row.picks));
  const ties = rows.filter((row) => row.picks === lowest).slice(0, 3);
  for (const [index, row] of ties.entries()) {
    await expect(body.nth(index).locator("td").first()).toHaveText(String(row.rank));
  }

  // One tab stop: ArrowDown moves to row 2, Tab reaches only that row's keep link (Story 7.1), the
  // next Tab leaves the table.
  await body.first().focus();
  await expect(body.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(body.nth(1)).toBeFocused();
  await expect(body.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(body.first()).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("Tab");
  await expect(body.nth(1).getByRole("button", { name: "Keep in place" })).toBeFocused();
  await page.keyboard.press("Tab");
  const insideTable = await table.evaluate((element) => element.contains(document.activeElement));
  expect(insideTable).toBe(false);

  // Opening a row after the sort opens the sorted row's part (Enter on row 2, then a click on row 1).
  expect(ties.length).toBeGreaterThan(1);
  await body.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`[?&]part=${encodeURIComponent(ties[1].part)}(&|$)`));
  await body.first().click();
  await expect(page).toHaveURL(new RegExp(`[?&]part=${encodeURIComponent(ties[0].part)}(&|$)`));
});
