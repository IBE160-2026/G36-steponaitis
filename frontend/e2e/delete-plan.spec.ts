import { randomUUID } from "node:crypto";

import { type CreatedPlan, createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test, toasts } from "./support/test";

// UJ-3: delete a plan from the saved-plans list (Story 6.4; FR-12, FR-2, UX-DR16, UX-DR18). The
// confirm puts Cancel first with the focus; Cancel or `Esc` return focus to the row's menu
// button; after a delete focus moves to the next row, or to New Plan when the list is empty.
// Other specs add and delete plans in parallel, so the real-backend test narrows the saved-plans
// list reply to its own two plans (`ownPlansOnly`); the backend still serves and deletes them.

const QUESTION = (name: string) =>
  `Delete “${name}”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.`;

function table(page: Page) {
  return page.getByRole("main").getByRole("table", { name: "Saved plans" });
}

function row(page: Page, plan: { name: string }) {
  return table(page).getByRole("row", { name: plan.name });
}

function menuButton(page: Page, plan: { name: string }) {
  return row(page, plan).getByRole("button", { name: `Actions for ${plan.name}` });
}

async function deleteViaApi(request: APIRequestContext, planId: string) {
  const response = await request.delete(`/api/plans/${planId}`, { headers: { "Sec-Fetch-Site": "same-origin" } });
  expect(response.status(), await response.text()).toBe(204);
}

/** A saved-plans row for routed `/api/plans` replies. */
function mockedPlan(prefix: string) {
  return {
    id: randomUUID(),
    name: `${prefix} ${randomUUID().slice(0, 8)}`,
    import_id: randomUUID(),
    data_as_of: "2026-09-30",
    uploaded_at: "2026-11-20T10:00:00Z",
    created_by: "planner",
    created_at: "2026-11-20T10:00:00Z",
    last_edited_by: "planner",
    last_edited_at: "2026-11-20T10:00:00Z",
  };
}

type ListedPlan = { id: string };

/**
 * Narrows every saved-plans list reply to `ids` (in the server's order), so plans that parallel
 * specs create or delete never change this page's rows. Only the list GET is routed: the DELETE,
 * the plan pages and everything else reach the real backend.
 */
async function ownPlansOnly(page: Page, ids: string[]) {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const plans = (await response.json()) as ListedPlan[];
    await route.fulfill({ response, json: plans.filter((plan) => ids.includes(plan.id)) });
  });
}

/** Opens the row menu from the keyboard (row → Tab → Enter) and chooses Delete…. */
async function openDeleteWithKeyboard(page: Page, plan: CreatedPlan) {
  await row(page, plan).focus();
  await page.keyboard.press("Tab");
  await expect(menuButton(page, plan)).toBeFocused();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await menu.getByRole("menuitem", { name: "Delete…" }).focus();
  await page.keyboard.press("Enter");
}

test.describe("uj3 delete a plan", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj3 delete asks first, cancel keeps the plan, confirm deletes it", async ({ page, request }) => {
    test.setTimeout(120_000);
    const b = await createSamplePlan(request, `Keep ${randomUUID().slice(0, 8)}`);
    const a = await createSamplePlan(request, `Delete ${randomUUID().slice(0, 8)}`);
    // Newest first: the list is a, then b.
    await ownPlansOnly(page, [a.id, b.id]);

    await page.goto("/plans");
    await expect(row(page, a)).toBeVisible();
    await expect(row(page, b)).toBeVisible();
    const dialog = page.getByRole("alertdialog");

    // Esc closes the confirm: nothing is deleted and focus returns to the row's menu button.
    await openDeleteWithKeyboard(page, a);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Delete plan" })).toBeVisible();
    await expect(dialog).toContainText(QUESTION(a.name));
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await expect(cancel).toBeFocused();
    const buttons = dialog.getByRole("button");
    await expect(buttons.nth(0)).toHaveText("Cancel");
    await expect(buttons.nth(1)).toHaveText("Delete plan");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row(page, a)).toBeVisible();
    await expect(menuButton(page, a)).toBeFocused();

    // Cancel: the same.
    await openDeleteWithKeyboard(page, a);
    await expect(cancel).toBeFocused();
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    await expect(row(page, a)).toBeVisible();
    await expect(menuButton(page, a)).toBeFocused();
    expect((await request.get(`/api/plans/${a.id}`)).status()).toBe(200);

    // Delete plan: the row goes, focus moves to the row that followed it (b).
    await expect(table(page).locator("tbody tr")).toHaveCount(2);
    await openDeleteWithKeyboard(page, a);
    await dialog.getByRole("button", { name: "Delete plan" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row(page, a)).toHaveCount(0);
    const focused = table(page).locator("tr:focus");
    await expect(focused).toHaveCount(1);
    await expect(focused.locator(`#plan-actions-${b.id}`)).toHaveCount(1);
    expect((await request.get(`/api/plans/${a.id}`)).status()).toBe(404);
    // The other plan is still there.
    expect((await request.get(`/api/plans/${b.id}`)).status()).toBe(200);
  });

  test("uj3 deleting the last listed plan focuses new plan", async ({ page }) => {
    const plan = mockedPlan("Only");
    let deleted = false;
    await page.route("**/api/plans", (route) => route.fulfill({ json: deleted ? [] : [plan] }));
    await page.route(`**/api/plans/${plan.id}`, (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deleted = true;
      return route.fulfill({ status: 204 });
    });

    await page.goto("/plans");
    await menuButton(page, plan).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(QUESTION(plan.name));
    await dialog.getByRole("button", { name: "Delete plan" }).click();

    const main = page.getByRole("main");
    await expect(main.getByRole("table")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "New Plan", exact: true })).toBeFocused();
    expect(deleted).toBe(true);
  });

  test("uj3 a busy delete keeps the row and returns focus to its menu button", async ({ page }) => {
    const plan = mockedPlan("Busy");
    await page.route("**/api/plans", (route) => route.fulfill({ json: [plan] }));
    await page.route(`**/api/plans/${plan.id}`, (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      return route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", message: "The plan is busy. Try again.", details: [] } },
      });
    });

    await page.goto("/plans");
    await menuButton(page, plan).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Delete plan" }).click();

    await expect(toasts(page).getByText("The plan is busy. Try again.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(row(page, plan)).toBeVisible();
    await expect(menuButton(page, plan)).toBeFocused();
  });

  test("uj3 a plan already deleted counts as deleted without a toast", async ({ page }) => {
    const plan = mockedPlan("Gone");
    let deleted = false;
    await page.route("**/api/plans", (route) => route.fulfill({ json: deleted ? [] : [plan] }));
    await page.route(`**/api/plans/${plan.id}`, (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deleted = true;
      return route.fulfill({
        status: 404,
        json: { error: { code: "plan_not_found", message: "This plan does not exist.", details: [] } },
      });
    });

    await page.goto("/plans");
    await menuButton(page, plan).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Delete…" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete plan" }).click();

    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "New Plan", exact: true })).toBeFocused();
    await expect(main.getByRole("table")).toHaveCount(0);
    expect(deleted).toBe(true);
    await expect(toasts(page).locator("li")).toHaveCount(0);
  });

  test("uj3 plan deleted in another tab sends that tab to saved plans", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Elsewhere ${randomUUID().slice(0, 8)}`);

    const other = await page.context().newPage();
    await other.setViewportSize({ width: 1440, height: 900 });
    await other.goto(`/plans/${plan.id}/overview`);
    await expect(other.getByRole("main").getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

    await deleteViaApi(request, plan.id);
    await other
      .getByRole("navigation", { name: "Plan steps" })
      .getByRole("link", { name: /Parts\s*, step 2/ })
      .click();
    await expect(toasts(other).getByText("This plan was deleted.")).toBeVisible();
    await expect(other).toHaveURL(/\/plans$/);
    await other.close();
  });

  test("uj3 reuse of a plan deleted meanwhile says the import is gone and reloads the list", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    // Alone on its import (each sample plan uploads its own), so its delete deletes the import.
    const plan = await createSamplePlan(request, `Gone ${randomUUID().slice(0, 8)}`);

    await page.goto(`/plans/new?from=${plan.id}`);
    const list = page.getByRole("main").getByRole("listbox", { name: "Saved plans" });
    const option = list.getByRole("option", { name: new RegExp(plan.name) });
    await expect(option).toHaveAttribute("aria-selected", "true");

    await deleteViaApi(request, plan.id);
    await page.getByLabel("Plan name").fill(`Reuse ${randomUUID().slice(0, 8)}`);
    await page.getByRole("button", { name: "New Plan", exact: true }).click();

    await expect(page.getByText("This import no longer exists. Choose another saved plan.")).toBeVisible();
    await expect(option).toHaveCount(0);
    await expect(page).toHaveURL(/\/plans\/new/);
  });
});
