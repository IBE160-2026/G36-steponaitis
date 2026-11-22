import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expect, type Page, test } from "./support/test";

import {
  type CreatedPlan as Summary,
  createSamplePlan as createPlan,
  SAMPLE,
  SAMPLE_FILES as FILES,
} from "./support/sample-plan";

// UJ-1: after New Plan the planner lands on the overview, opens the settings and comes back to
// the plan from the saved-plans list at `/` (Story 1.9, Story 6.1; FR-7, FR-8, FR-9, FR-18, AD-12,
// AD-20, UX-DR5/6/21/22). The list itself is covered by saved-plans.spec.ts (UJ-3).

const STEP_COUNT = 8;

async function localDate(page: Page, instant: string): Promise<string> {
  return page.evaluate((value) => {
    const date = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }, instant);
}

function plate(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: /Data as of/ });
}

test.describe("uj1 plan overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("uj1 opens the overview after import", async ({ page, request }) => {
    const name = `Overview ${randomUUID().slice(0, 8)}`;
    await page.goto("/plans/new");
    await page.getByLabel("Plan name").fill(name);
    await page.getByLabel("Locations", { exact: true }).setInputFiles(join(SAMPLE, FILES.locations));
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(join(SAMPLE, FILES.inventory));
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(join(SAMPLE, FILES.transactions));
    await page.getByRole("button", { name: "New Plan", exact: true }).click();

    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    const planId = page.url().split("/").at(-2)!;
    const summary = (await (await request.get(`/api/plans/${planId}`)).json()) as Summary;
    const uploaded = await localDate(page, summary.uploaded_at);

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(main.getByText("Data as of", { exact: true })).toBeVisible();
    await expect(main.getByText("2026-09-30", { exact: true })).toBeVisible();
    await expect(main.getByText(uploaded, { exact: true })).toBeVisible();
    await expect(main.getByText("2025-10-01 to 2026-09-30", { exact: true })).toBeVisible();
    // FR-22: the sample plan has no marks yet, so both best counts are 0.
    for (const term of ["Best locations", "Empty best locations"]) {
      const fact = main.locator("dt", { hasText: new RegExp(`^${term}$`) });
      await expect(fact).toBeVisible();
      await expect(fact.locator("xpath=following-sibling::dd[1]")).toHaveText("0");
    }
    const classes = main.locator("li[data-class]");
    await expect(classes).toHaveCount(4);
    for (const [index, text] of ["Fast-moving80", "Medium-moving249", "Slow-moving580", "Dead stock636"].entries()) {
      await expect(classes.nth(index)).toHaveText(text);
    }
    await expect(main.getByText("24 or more picks")).toBeVisible();
    await expect(main.getByText("5 or more shared jobs")).toBeVisible();

    await expect(plate(page)).toContainText(name);
    await expect(plate(page)).toContainText("Data as of 2026-09-30 · round 0");
    await plate(page).hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(`Uploaded ${uploaded}`);
    await expect(plate(page)).toHaveAttribute("aria-describedby", (await tooltip.getAttribute("id"))!);

    const nav = page.getByRole("navigation", { name: "Plan steps" });
    await expect(nav.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="step"]')).toContainText("Overview");
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(STEP_COUNT);
    for (let index = 0; index < STEP_COUNT; index += 1) {
      const done = index < 4;
      await expect(links.nth(index)).toContainText(done ? ", done" : `, step ${index + 1}`);
      if (!done) await expect(links.nth(index)).not.toContainText(", done");
    }
    await expect(links.nth(1)).toHaveAttribute("href", `/plans/${planId}/parts`);

    await plate(page).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveCount(1);
    await menu.getByRole("menuitem", { name: "New Plan" }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);
  });

  test("uj1 opens settings from the overview", async ({ page, request }) => {
    const plan = await createPlan(request, `Settings ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/overview`);
    await page.getByRole("main").getByRole("link", { name: "Settings", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/settings$`));
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(main.getByText("Changed in the config file, not in the app.")).toBeVisible();
    await expect(main.getByText("6–23 picks")).toBeVisible();
    await expect(plate(page)).toContainText(plan.name);
    await expect(page.getByRole("navigation", { name: "Plan steps" }).locator("[aria-current]")).toHaveCount(0);
  });

  test("uj1 overview shows the error for a malformed plan id", async ({ page }) => {
    await page.goto("/plans/abc/overview");
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/plans\/abc\/overview$/);
  });

  test("uj1 unknown plan shows plan was deleted and opens saved plans", async ({ page }) => {
    await page.goto(`/plans/${randomUUID()}/overview`);
    await expect(page.getByText("This plan was deleted.")).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByRole("main").getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await expect(page.getByText("This plan was deleted.")).toHaveCount(1);
  });

  test("uj1 shows opening text while loading", async ({ page, request }) => {
    const plan = await createPlan(request, `Loading ${randomUUID().slice(0, 8)}`);
    await page.route("**/api/plans", async (route) => {
      const response = await route.fetch();
      const rows = (await response.json()) as { id: string }[];
      await route.fulfill({ response, json: rows.filter((row) => row.id === plan.id) });
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/plans/${plan.id}`, async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/plans");
    await page.getByRole("table", { name: "Saved plans" }).getByRole("row", { name: plan.name }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/overview$`));
    await expect(page.getByRole("main").getByText(`Opening ${plan.name}…`)).toBeVisible();
    await expect(page.getByRole("main").locator("svg")).toHaveCount(0);
    release();
    await expect(page.getByRole("main").getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("uj1 start page lists the plan just created", async ({ page, request }) => {
    const older = await createPlan(request, `Older ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${older.id}/overview`);
    await expect(plate(page)).toBeVisible();

    await plate(page).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "New Plan" }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);
    const name = `Fresh ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Plan name").fill(name);
    await page.getByLabel("Locations", { exact: true }).setInputFiles(join(SAMPLE, FILES.locations));
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(join(SAMPLE, FILES.inventory));
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(join(SAMPLE, FILES.transactions));
    await page.getByRole("button", { name: "New Plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    const createdUrl = page.url();

    await page.getByRole("link", { name: "Smart Warehouse Planner" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    const table = page.getByRole("table", { name: "Saved plans" });
    await table.getByRole("row", { name }).click();
    await expect(page).toHaveURL(createdUrl);
    await expect(plate(page)).toContainText(name);
  });

  test("uj1 opens a step that is not built yet", async ({ page, request }) => {
    const plan = await createPlan(request, `Steps ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/overview`);
    const nav = page.getByRole("navigation", { name: "Plan steps" });
    await nav.getByRole("link", { name: /^\d*Move list/ }).click();

    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/move-list$`));
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Move list", level: 1 })).toBeVisible();
    await expect(main.getByText("This step is not built yet.")).toBeVisible();
    await expect(nav.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="step"]')).toContainText("Move list");

    const response = await page.goto(`/plans/${plan.id}/nope`);
    expect(response?.status()).toBe(404);
  });
});
