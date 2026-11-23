import { randomUUID } from "node:crypto";

import { type Detail, getJson, locationRows, moveFromPanel, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test } from "./support/test";

// UJ-3: a saved plan reopens on the view it was left on (Story 6.2; FR-9, AD-20). The last
// flow-step view lives only in this browser (`swp:plan:<id>:view`); with storage blocked the plan
// opens on its overview, and a reopened plan stays editable (no locking).

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** From any page: the product link to the saved-plans list, then the plan's row. */
async function reopenFromList(page: Page, name: string) {
  await page.getByRole("link", { name: "Smart Warehouse Planner" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await page.getByRole("main").getByRole("table", { name: "Saved plans" }).getByRole("row", { name }).click();
}

test.describe("uj3 reopen a plan", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj3 reopens locations with its aisle and part panel and stays editable", async ({ page, request }) => {
    test.setTimeout(120_000);
    const plan = await createSamplePlan(request, `Reopen ${randomUUID().slice(0, 8)}`);
    const rows = await locationRows(request, plan.id);
    const source = rows.find((row) => row.location.aisle === "B" && row.contents.length > 0)!;
    const part = source.contents[0].part;
    const detail = await getJson<Detail>(request, `/api/plans/${plan.id}/parts/${encodeURIComponent(part)}`);
    const target = rows.find((row) => !row.occupied)!.location.code;

    await page.goto(`/plans/${plan.id}/overview`);
    const main = page.getByRole("main");
    await page.getByRole("navigation", { name: "Plan steps" }).getByRole("link", { name: /Locations/ }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/locations$`));
    await main.getByRole("button", { name: "Open as list" }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/locations\\?aisle=A&mode=list$`));
    const aisleSelect = main.getByRole("combobox", { name: "Aisle" });
    await aisleSelect.selectOption("B");
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/locations\\?aisle=B&mode=list$`));
    const opener = main.getByRole("table", { name: "Locations" }).locator(`[data-open-part="${part}"]`).first();
    await opener.focus();
    await page.keyboard.press("Enter");
    const viewUrl = new RegExp(`/plans/${plan.id}/locations\\?aisle=B&mode=list&part=${encodeURIComponent(part)}$`);
    await expect(page).toHaveURL(viewUrl);
    await expect(page.getByRole("complementary", { name: part })).toBeVisible();

    await reopenFromList(page, plan.name);

    await expect(page).toHaveURL(viewUrl);
    await expect(aisleSelect).toHaveValue("B");
    const panel = page.getByRole("complementary", { name: part });
    await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeVisible();

    // A reopened plan is not locked: a manual move from the restored panel is saved.
    const before = await planVersion(request, plan.id);
    await moveFromPanel(page, panel, part, detail.current_location!.code, target);
    expect(await planVersion(request, plan.id)).toBe(before + 1);
  });

  test("uj3 reopens recommendations on the outdated tab", async ({ page, request }) => {
    test.setTimeout(120_000);
    const plan = await createSamplePlan(request, `Reopen tab ${randomUUID().slice(0, 8)}`);
    await command(request, plan.id, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await command(request, plan.id, { type: "run" });

    await page.goto(`/plans/${plan.id}/recommendations`);
    const main = page.getByRole("main");
    await main.getByRole("tab", { name: /^Outdated, / }).click();
    const tabUrl = new RegExp(`/plans/${plan.id}/recommendations\\?tab=outdated$`);
    await expect(page).toHaveURL(tabUrl);

    await reopenFromList(page, plan.name);

    await expect(page).toHaveURL(tabUrl);
    await expect(main.getByRole("tab", { name: /^Outdated, / })).toHaveAttribute("aria-selected", "true");
  });

  test("uj3 opens the overview without error when storage is blocked", async ({ page, request }) => {
    const plan = await createSamplePlan(request, `Blocked ${randomUUID().slice(0, 8)}`);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // A view visited first cannot be remembered, so reopening still lands on the overview.
    await page.goto(`/plans/${plan.id}/parts`);
    await expect(page.getByRole("main").getByRole("heading", { name: "Parts", level: 1 })).toBeVisible();
    await reopenFromList(page, plan.name);

    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/overview$`));
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(main.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
