import { randomUUID } from "node:crypto";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test, toasts } from "./support/test";

// UJ-3 step 7: a New Plan from a saved plan's import (Story 6.3; FR-2, UX-DR5, UX-DR17, epic-1
// retro item 6). The plate menu lists other recent plans, All saved plans and New Plan from this
// import, and `Esc` returns focus to the plate. The new plan shares the import but none of the
// chosen plan's marks. Other specs add plans in parallel, so nothing assumes the whole list.

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

async function markCount(request: APIRequestContext, planId: string): Promise<number> {
  return (await getJson<{ marks: unknown[] }>(request, `/api/plans/${planId}/locations`)).marks.length;
}

function plate(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: /Data as of/ });
}

function savedPlans(page: Page) {
  return page.getByRole("main").getByRole("listbox", { name: "Saved plans" });
}

test.describe("uj3 new plan from an import", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj3 plate menu reuses the open plan's import for an empty new plan", async ({ page, request }) => {
    test.setTimeout(120_000);
    await createSamplePlan(request, `Other ${randomUUID().slice(0, 8)}`);
    const plan = await createSamplePlan(request, `Marked ${randomUUID().slice(0, 8)}`);
    await setBestMark(request, plan.id);
    expect(await markCount(request, plan.id)).toBe(1);

    await page.goto(`/plans/${plan.id}/overview`);
    await expect(plate(page)).toContainText(plan.name);

    // Enter opens the menu; Esc closes it and returns focus to the plate (epic-1 retro item 6).
    await plate(page).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(plate(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitem");
    // At least `other` exists, so at least one recent plan is listed; never the open plan.
    await expect(items.first()).toHaveAttribute("href", /^\/plans\/[0-9a-f-]{36}$/);
    await expect(menu.getByRole("menuitem", { name: plan.name })).toHaveCount(0);
    await expect(menu.locator(`[href="/plans/${plan.id}"]`)).toHaveCount(0);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(7);
    await expect(items.nth(count - 2)).toHaveText("All saved plans");
    await expect(items.nth(count - 1)).toHaveText("New Plan from this import");

    await menu.getByRole("menuitem", { name: "New Plan from this import" }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/new\\?from=${plan.id}$`));
    const list = savedPlans(page);
    await expect(list.getByRole("option", { name: new RegExp(plan.name) })).toHaveAttribute("aria-selected", "true");
    await expect(list.getByRole("option", { selected: true })).toHaveCount(1);
    await expect(page.getByLabel("Locations", { exact: true })).toHaveCount(0);

    const name = `Reuse ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Plan name").fill(name);
    await page.getByRole("button", { name: "New Plan", exact: true }).click();
    await expect(toasts(page).getByText(`${name} created. Data as of 2026-09-30.`)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    const newId = /\/plans\/([0-9a-f-]{36})\/overview$/.exec(page.url())![1];
    expect(newId).not.toBe(plan.id);
    await expect(plate(page)).toContainText(name);
    await expect(plate(page)).toContainText("Data as of 2026-09-30 · round 0");

    const created = await getJson<{ import_id: string; current_round: number; version: number }>(
      request,
      `/api/plans/${newId}`,
    );
    const chosen = await getJson<{ import_id: string; version: number }>(request, `/api/plans/${plan.id}`);
    expect(created.import_id).toBe(chosen.import_id);
    expect(created.current_round).toBe(0);
    expect(created.version).toBe(1);
    expect(await markCount(request, newId)).toBe(0);
    // The chosen plan is unchanged.
    expect(await markCount(request, plan.id)).toBe(1);
    expect(chosen.version).toBe(2);
  });

  test("uj3 saved-plans row menu opens new plan with that plan chosen", async ({ page, request }) => {
    test.setTimeout(60_000);
    const plan = await createSamplePlan(request, `Row ${randomUUID().slice(0, 8)}`);

    await page.goto("/plans");
    const row = page.getByRole("main").getByRole("table", { name: "Saved plans" }).getByRole("row", { name: plan.name });
    await row.getByRole("button", { name: `Actions for ${plan.name}` }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "New Plan from this import" }).click();

    await expect(page).toHaveURL(new RegExp(`/plans/new\\?from=${plan.id}$`));
    await expect(savedPlans(page).getByRole("option", { name: new RegExp(plan.name) })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("uj3 new plan switches to the saved-plans listbox and back", async ({ page, request }) => {
    test.setTimeout(60_000);
    await createSamplePlan(request, `Listed ${randomUUID().slice(0, 8)}`);
    await createSamplePlan(request, `Listed ${randomUUID().slice(0, 8)}`);

    await page.goto("/plans/new");
    await expect(page.getByLabel("Locations", { exact: true })).toBeAttached();
    await page.getByRole("button", { name: "Or reuse the import of a saved plan" }).click();
    const list = savedPlans(page);
    await expect(list).toBeVisible();
    // The activated toggle unmounts; focus moves to the other mode's toggle in its place.
    await expect(page.getByRole("button", { name: "Upload three files instead" })).toBeFocused();
    await expect(page.getByLabel("Locations", { exact: true })).toHaveCount(0);

    // Nothing chosen yet: New Plan says so and sends nothing.
    await page.getByLabel("Plan name").fill("Not sent");
    await page.getByRole("button", { name: "New Plan", exact: true }).click();
    await expect(page.getByText("Choose a saved plan.")).toBeVisible();
    await expect(page).toHaveURL(/\/plans\/new$/);

    // One tab stop; ↓ selects the first option, then the next (UX-DR17).
    await list.focus();
    await page.keyboard.press("ArrowDown");
    const first = list.getByRole("option").nth(0);
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(first).toHaveAttribute("aria-selected", "false");
    await expect(list.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(list.getByRole("option", { selected: true })).toHaveCount(1);
    // A click selects too.
    await first.click();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(list.getByRole("option", { selected: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Upload three files instead" }).click();
    await expect(list).toHaveCount(0);
    await expect(page.getByLabel("Locations", { exact: true })).toBeAttached();
    await expect(page.getByRole("button", { name: "Or reuse the import of a saved plan" })).toBeFocused();

    // Files over the upload limit block the file path, but not a reuse (no size check there).
    const session = await getJson<{ max_upload_bytes: number }>(request, "/api/session");
    await page.getByLabel("Locations", { exact: true }).setInputFiles({
      name: "Locations.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(session.max_upload_bytes + 1, "x"),
    });
    const submitButton = page.getByRole("button", { name: "New Plan", exact: true });
    const oversize = page.getByRole("main").locator("p", { hasText: "One New Plan can upload at most" });
    await expect(oversize).toBeVisible();
    await expect(submitButton).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Or reuse the import of a saved plan" }).click();
    await expect(oversize).toHaveCount(0);
    await expect(submitButton).not.toHaveAttribute("aria-disabled", "true");
    await list.getByRole("option").nth(0).click();
    const name = `Reuse big ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Plan name").fill(name);
    await submitButton.click();
    await expect(toasts(page).getByText(new RegExp(`^${name} created\\. Data as of `))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });

    // `?from=` naming no saved plan: reuse mode, nothing selected.
    await page.goto(`/plans/new?from=${randomUUID()}`);
    await expect(list.getByRole("option").first()).toBeVisible();
    await expect(list.getByRole("option", { selected: true })).toHaveCount(0);
    await expect(page.getByLabel("Locations", { exact: true })).toHaveCount(0);
  });
});
