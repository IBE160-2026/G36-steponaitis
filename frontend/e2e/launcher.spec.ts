import { randomUUID } from "node:crypto";

import { getJson, planVersion, type RosterRow } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test, toasts } from "./support/test";

// UJ-8 (Story 6.5; UX-DR7, UX-DR8): the planner opens the launcher from the keyboard or the grid
// button, reads the flow map, and jumps to a step, runs an action or opens another saved plan.

const STEPS = [
  "Overview",
  "Parts",
  "Locations",
  "Pick groups",
  "Best locations",
  "Recommendations",
  "Before/after",
  "Move list",
];

function launcher(page: Page) {
  return page.getByRole("dialog", { name: "Launcher" });
}

function searchField(page: Page) {
  return launcher(page).getByPlaceholder("Search features, actions and plans");
}

function gridButton(page: Page) {
  return page.getByRole("button", { name: "Open the launcher" });
}

/** The plan plate shows once the summary has loaded on the client, so the shortcut listener is live. */
async function planReady(page: Page) {
  await expect(page.getByRole("banner").getByText(/^Data as of /)).toBeVisible();
}

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
    timeout: 60_000,
  });
  expect(response.status(), await response.text()).toBe(200);
}

test.describe("uj8 launcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj8 ctrl+k opens the launcher and esc returns focus", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/parts`);
    const field = page.getByRole("main").getByRole("searchbox", { name: "Search parts and locations" });
    await planReady(page);
    await field.focus();
    await expect(field).toBeFocused();

    await page.keyboard.press("Control+k");
    await expect(launcher(page)).toBeVisible();
    await expect(searchField(page)).toBeFocused();
    await expect(searchField(page)).toHaveValue("");
    await expect(page.locator("#content")).toHaveAttribute("inert", "");
    // The toolbar is inert (and hidden from the accessibility tree), so find the button by its label.
    await expect(page.locator('button[aria-label="Open the launcher"]')).toHaveAttribute("aria-expanded", "true");

    for (const name of STEPS) {
      await expect(launcher(page).getByRole("group", { name, exact: true })).toBeVisible();
    }
    const parts = launcher(page).getByRole("group", { name: "Parts", exact: true });
    await expect(parts.getByText("You are here")).toBeVisible();
    await expect(parts.getByText(/^[\d,]+ parts$/)).toBeVisible();
    const cat = launcher(page).getByRole("button", { name: /CAT/ });
    await expect(cat).toHaveAttribute("aria-disabled", "true");
    await expect(cat).toContainText("Coming in stage 2");

    // Stage 2: Enter on CAT does nothing and the drawer stays open.
    await cat.focus();
    await page.keyboard.press("Enter");
    await expect(launcher(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/parts$`));

    await page.keyboard.press("Escape");
    await expect(launcher(page)).toBeHidden();
    await expect(gridButton(page)).toBeFocused();
    await expect(page.locator("#content")).not.toHaveAttribute("inert");
    await expect(gridButton(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("uj8 types mov and opens the move list with the keyboard only", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);

    await page.keyboard.press("Control+k");
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.type("mov");
    const first = launcher(page).getByRole("option").first();
    await expect(first).toContainText("Move list");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(searchField(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/move-list$`));
    await expect(launcher(page)).toBeHidden();
    await expect(page.getByRole("heading", { name: "Move list", level: 1 })).toBeVisible();
  });

  test("uj8 types rec and opens recommendations", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);

    await page.keyboard.press("Control+k");
    await page.keyboard.type("xyz");
    await expect(launcher(page).getByText("No feature or saved plan matches “xyz”.")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(launcher(page)).toBeVisible();

    // Esc closes the drawer even with text in the search field; it opens again with an empty search.
    await page.keyboard.press("Escape");
    await expect(launcher(page)).toBeHidden();
    await expect(gridButton(page)).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(searchField(page)).toHaveValue("");
    await expect(launcher(page).getByRole("group", { name: "Overview", exact: true })).toBeVisible();
    await page.keyboard.type("REC");
    await expect(launcher(page).getByRole("option").first()).toContainText("Recommendations");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/recommendations$`));
    await expect(launcher(page)).toBeHidden();
  });

  test("uj8 tabs to the recommendations column and runs a round", async ({ page, request }) => {
    test.setTimeout(120_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);

    await gridButton(page).click();
    await expect(searchField(page)).toBeFocused();
    const rec = launcher(page).getByRole("group", { name: "Recommendations", exact: true });
    await expect(rec.getByRole("button", { name: "Run round 1" })).toBeVisible();
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("Tab");
    await expect(rec.getByRole("link", { name: /REC/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(rec.getByRole("button", { name: "Run round 1" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/recommendations`));
    await expect(page.getByRole("main").getByTestId("round-chip")).toHaveText("Round 1", { timeout: 30_000 });
    await expect(toasts(page).getByText(/^Recommendations, round 1, /)).toBeVisible();
  });

  test("uj8 opens another saved plan", async ({ page, request }) => {
    test.setTimeout(120_000);
    const suffix = randomUUID().slice(0, 8);
    const open = await createSamplePlan(request, `Open ${suffix}`);
    const other = await createSamplePlan(request, `Other launcher ${suffix}`);
    await page.goto(`/plans/${open.id}/overview`);
    await planReady(page);

    await page.keyboard.press("Control+k");
    await page.keyboard.type(`launcher ${suffix}`);
    const option = launcher(page).getByRole("option", { name: other.name });
    await expect(option).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${other.id}(/|$)`));
    await expect(launcher(page)).toBeHidden();
  });

  test("uj8 ux_dr16 apply all asks first and applies only on confirm", async ({ page, request }) => {
    test.setTimeout(120_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    await command(request, plan.id, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await command(request, plan.id, { type: "run" });
    const before = await planVersion(request, plan.id);
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);

    await page.keyboard.press("Control+k");
    await page.keyboard.type("apply all");
    await expect(launcher(page).getByRole("option").first()).toContainText(/^Apply all \(\d+\)…/);
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("alertdialog", { name: "Apply all" });
    await expect(confirm).toBeVisible();
    await expect(launcher(page)).toHaveCount(0);
    // Ctrl+K is ignored while another modal dialog is open.
    await page.keyboard.press("Control+k");
    await expect(launcher(page)).toHaveCount(0);
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(gridButton(page)).toBeFocused();
    expect(await planVersion(request, plan.id)).toBe(before);

    await page.keyboard.press("Control+k");
    await page.keyboard.type("apply all");
    await page.keyboard.press("Enter");
    await confirm.getByRole("button", { name: "Apply all" }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/recommendations`));
    await expect(toasts(page).getByText(/^Applied \d+ recommendations? from round 1\./)).toBeVisible({ timeout: 30_000 });
  });

  test("uj8 a disabled action does not run from the keyboard", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    const before = await planVersion(request, plan.id);
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);

    await page.keyboard.press("Control+k");
    await page.keyboard.type("apply all");
    const option = launcher(page).getByRole("option").first();
    await expect(option).toContainText("Apply all (0)…");
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await expect(option).toContainText("No open recommendations to apply.");
    await page.keyboard.press("Enter");
    await expect(launcher(page)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/overview$`));
    expect(await planVersion(request, plan.id)).toBe(before);
  });

  test("uj8 ctrl+k is ignored while the manual move dialog is open", async ({ page, request }) => {
    test.setTimeout(90_000);
    const plan = await createSamplePlan(request, `Launcher ${randomUUID().slice(0, 8)}`);
    const roster = await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${plan.id}/parts`);
    const part = roster.parts.find((row) => row.current_location !== null)!.part;
    await page.goto(`/plans/${plan.id}/parts?part=${encodeURIComponent(part)}`);
    await planReady(page);
    await page.getByRole("complementary", { name: part }).getByRole("button", { name: "Manual move…" }).click();
    const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
    await expect(dialog.getByRole("combobox", { name: "To-location" })).toBeFocused();

    await page.keyboard.press("Control+k");
    await expect(launcher(page)).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "To-location" })).toBeFocused();
  });

  test("uj8 off a plan there is no launcher", async ({ page }) => {
    await page.goto("/plans");
    await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await expect(gridButton(page)).toHaveCount(0);
    await page.keyboard.press("Control+k");
    await expect(launcher(page)).toHaveCount(0);
  });
});
