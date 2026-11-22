import { randomUUID } from "node:crypto";

import { planVersion } from "./support/plan-api";
import { type CreatedPlan, createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test } from "./support/test";

// UJ-3: the saved-plans list is the start page (Story 6.1; FR-8, FR-9, AD-20, UX-DR18, UX-DR30,
// epic-1 retro item 5). Other specs add plans in parallel, so the tests compare row positions
// rather than assume the whole list.

async function setBestMark(request: APIRequestContext, planId: string) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: {
      type: "set_best_mark",
      command_id: randomUUID(),
      base_version: await planVersion(request, planId),
      mark: { kind: "aisle", aisle: "A" },
    },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

function table(page: Page) {
  return page.getByRole("main").getByRole("table", { name: "Saved plans" });
}

function row(page: Page, plan: CreatedPlan) {
  return table(page).getByRole("row", { name: plan.name });
}

async function rowIndex(page: Page, plan: CreatedPlan): Promise<number> {
  return Number(await row(page, plan).getAttribute("data-row-index"));
}

test.describe("uj3 saved plans", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj3 start page lists plans most recently edited first and opens them", async ({ page, request }) => {
    test.setTimeout(90_000);
    const edited = await createSamplePlan(request, `Edited ${randomUUID().slice(0, 8)}`);
    const other = await createSamplePlan(request, `Other ${randomUUID().slice(0, 8)}`);
    // Opening or reading a plan is not a change (FR-9); only the command moves the older plan up.
    await request.get(`/api/plans/${other.id}`);
    await setBestMark(request, edited.id);

    await page.goto("/");
    await expect(page).toHaveURL(/\/plans$/);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await expect(row(page, edited)).toBeVisible();
    await expect(row(page, other)).toBeVisible();
    for (const header of ["Name", "Data as of", "Uploaded", "Created by", "Created", "Last edited by", "Last edited"]) {
      await expect(table(page).getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    }
    expect(await rowIndex(page, edited)).toBeLessThan(await rowIndex(page, other));
    await expect(row(page, edited)).toContainText("2026-09-30");
    // New Plan is the one primary button.
    await expect(main.getByRole("link", { name: "New Plan", exact: true })).toHaveCount(1);

    // Keyboard: the active row is the tab stop; ↓ moves, ↑ comes back, Enter opens.
    const editedIndex = await rowIndex(page, edited);
    await row(page, edited).focus();
    await page.keyboard.press("ArrowDown");
    await expect(table(page).locator(`tr[data-row-index="${editedIndex + 1}"]`)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(row(page, edited)).toBeFocused();
    // Opening goes through the bare `/plans/<id>` (Story 6.2), which replaces itself with the
    // plan's last view in this browser: the overview, since this browser never opened it.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${edited.id}/overview$`));
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

    // A click opens a plan.
    await page.goto("/plans");
    await row(page, other).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${other.id}/overview$`));
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

    // Tab from the active row reaches that row's menu button; Esc returns to it; Open opens.
    await page.goto("/plans");
    await row(page, edited).focus();
    await page.keyboard.press("Tab");
    const menuButton = row(page, edited).getByRole("button", { name: `Actions for ${edited.name}` });
    await expect(menuButton).toBeFocused();
    await expect(table(page).locator('button[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(menuButton).toBeFocused();
    await expect(page).toHaveURL(/\/plans$/);
    // ArrowDown on the menu button opens the menu and never moves the row (the trigger handled it).
    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();
    await expect(row(page, edited)).not.toBeFocused();
    await expect(table(page).locator("tr:focus")).toHaveCount(0);
    // Keys inside the open (portaled) menu never move or open rows.
    const open = menu.getByRole("menuitem", { name: "Open" });
    // Opening with ArrowDown focuses the first item; wait for it so the keys below land in order.
    await expect(open).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "New Plan from this import" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu).toBeVisible();
    await expect(table(page).locator("tr:focus")).toHaveCount(0);
    await expect(page).toHaveURL(/\/plans$/);
    // Open, chosen with the keyboard; it links to the bare plan URL (Story 6.2).
    await expect(open).toBeFocused();
    await expect(open).toHaveAttribute("href", `/plans/${edited.id}`);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${edited.id}/overview$`));
  });

  test("uj3 empty list explains where plans come from", async ({ page }) => {
    await page.route("**/api/plans", (route) => route.fulfill({ json: [] }));
    await page.goto("/plans");
    const main = page.getByRole("main");
    await expect(
      main.getByText(
        "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.",
      ),
    ).toBeVisible();
    await expect(main.getByText("Demo files: data/sample/")).toBeVisible();
    await expect(main.getByRole("table")).toHaveCount(0);
    const newPlan = main.getByRole("link", { name: "New Plan", exact: true });
    await expect(newPlan).toHaveCount(1);
    await newPlan.click();
    await expect(page).toHaveURL(/\/plans\/new$/);
  });

  test("uj3 failed list offers try again and new plan", async ({ page, request }) => {
    const plan = await createSamplePlan(request, `Retry ${randomUUID().slice(0, 8)}`);
    await page.route("**/api/plans", (route) => route.abort());
    await page.goto("/plans");
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("Something went wrong. Try again.");
    await expect(alert.getByRole("link", { name: "New Plan" })).toHaveAttribute("href", "/plans/new");
    await expect(page).toHaveURL(/\/plans$/);

    await page.unroute("**/api/plans");
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(row(page, plan)).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    await page.route("**/api/plans", (route) => route.abort());
    await page.reload();
    await page.getByRole("main").getByRole("alert").getByRole("link", { name: "New Plan" }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);
  });
});
