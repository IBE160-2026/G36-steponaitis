import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "./support/test";

import { getJson, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-2 (Story 8.3; FR-38, AD-17, UX-DR52): the planner opens Move list from the flow bar, checks
// the server's lines on the print view and prints. Print fetches the view again and only then
// calls `window.print()` (stubbed here; the paper and the cross-browser print check are 8.4).

/**
 * Replaces `window.print` with a counter, so the test never opens a print dialog. Each call also
 * records the header's generated line as it is on screen at that moment.
 */
async function stubPrint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as { __prints: number; __printedGenerated: string[] };
    target.__prints = 0;
    target.__printedGenerated = [];
    window.print = () => {
      target.__prints += 1;
      target.__printedGenerated.push(document.querySelector("[data-move-list-generated]")?.textContent ?? "");
    };
  });
}

async function printCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __prints: number }).__prints);
}

async function printedGenerated(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __printedGenerated: string[] }).__printedGenerated);
}

const isMoveListGet = (planId: string) => (response: { url(): string; request(): { method(): string } }) =>
  response.url().endsWith(`/api/plans/${planId}/move-list`) && response.request().method() === "GET";

test("uj2 prints the move list", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const name = `Move list ${randomUUID().slice(0, 8)}`;
  const planId = (await createSamplePlan(request, name)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  const applied = await postCommand(request, planId, { type: "apply_all" });
  expect(applied.events[0]?.type).toBe("apply_all_done");
  const summary = await getJson<{ move_count: number }>(request, `/api/plans/${planId}`);
  expect(summary.move_count).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  const mountGet = page.waitForResponse(isMoveListGet(planId));
  await nav.getByRole("link", { name: /^\d*Move list/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/print$`));
  await mountGet;

  const current = nav.locator('[aria-current="step"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAccessibleName(/Move list\s*, step 8$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: `Move list · ${name}`, level: 1 })).toBeVisible();
  await expect(main.locator("[data-move-list-data]")).toContainText("Data as of");
  await expect(main.locator("[data-move-list-data]")).toHaveText(/ · \d+ rounds?$/);
  await expect(main.locator("[data-move-list-generated]")).toContainText("Generated");
  await expect(main.locator("[data-round-band]").filter({ hasText: "ROUND 1" })).toHaveCount(1);
  await expect(main.locator("[data-move-line]")).toHaveCount(summary.move_count);

  const print = main.getByRole("button", { name: "Print", exact: true });
  await expect(print).not.toHaveAttribute("aria-disabled", "true");
  await stubPrint(page);
  // The Print GET answers with a fixed generated time, so the print must see the new data on screen.
  const moveListUrl = `**/api/plans/${planId}/move-list`;
  await page.route(moveListUrl, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { header: { generated_at: string } };
    body.header.generated_at = "2030-01-02T12:00:00Z";
    await route.fulfill({ response, json: body });
  });
  const printGet = page.waitForResponse(isMoveListGet(planId));
  await print.click();
  await printGet;
  await expect.poll(() => printCount(page)).toBe(1);
  await expect(print).not.toHaveAttribute("aria-busy", "true");
  expect(await printCount(page)).toBe(1);
  const printed = await printedGenerated(page);
  expect(printed).toHaveLength(1);
  expect(printed[0]).toContain("2030-01-02");
  await page.unroute(moveListUrl);

  // A failed Print refetch shows the error and does not print.
  await stubPrint(page);
  await page.route(moveListUrl, (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "unavailable", message: "The server is not available right now." } },
    }),
  );
  const failedGet = page.waitForResponse(isMoveListGet(planId));
  await print.click();
  await failedGet;
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(print).not.toHaveAttribute("aria-busy", "true");
  expect(await printCount(page)).toBe(0);
  await page.unroute(moveListUrl);

  // Back on the step with the view cached: the paper waits for the mount fetch (AD-17).
  await main.getByRole("link", { name: "Back to Recommendations", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations$`));
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/plans/${planId}/move-list`, async (route) => {
    await held;
    await route.continue();
  });
  const returnGet = page.waitForResponse(isMoveListGet(planId));
  await nav.getByRole("link", { name: /^\d*Move list/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/print$`));
  await expect(main.getByRole("status")).toBeVisible();
  await expect(main.locator("[data-paper]")).toHaveCount(0);
  release();
  await returnGet;
  await expect(main.locator("[data-move-line]")).toHaveCount(summary.move_count);
});

test("uj2 shows no moves to print", async ({ page, request }) => {
  const planId = (await createSamplePlan(request, `No moves ${randomUUID().slice(0, 8)}`)).id;

  await page.goto(`/plans/${planId}/print`);
  const main = page.getByRole("main");
  await expect(main.locator("[data-move-list-empty]")).toHaveText("There are no moves to print.");
  await expect(main.getByRole("table")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Print", exact: true })).toHaveAttribute("aria-disabled", "true");

  await main.getByRole("link", { name: "Back to Recommendations", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations$`));
});
