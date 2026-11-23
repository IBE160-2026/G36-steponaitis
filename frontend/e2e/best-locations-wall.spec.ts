import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test, toasts } from "./support/test";

import { getJson, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 step 4 (Story 10.7; FR-21, FR-29, FR-42, UX-DR14/47): the Best locations step opens as a
// marking wall. Hover previews the mark, a click or `Enter` sets or removes it, Level mode marks a
// whole level row, and the rails, frames, BEST tags, marks list and counts redraw from the server's
// wall view. Runs in Chromium, Firefox and Edge.

type Wall = {
  version: number;
  aisle: string;
  locations: { location: { code: string; level: string; is_best: boolean } }[];
  rail_levels: string[];
  warehouse: { best: number; empty_best: number };
};
type Layout = { aisles: { aisle: string; runs: { levels: string[] }[] }[] };
type Summary = { import_id: string; best_locations: number; empty_best_locations: number };

const TOAST = "Best-location marks changed.";
const n = (value: number) => value.toLocaleString("en-US");

async function wallOf(page: Page, planId: string, aisle: string): Promise<Wall> {
  return getJson<Wall>(page.request, `/api/plans/${planId}/wall?aisle=${aisle}`);
}

async function levelsOf(page: Page, planId: string, aisle: string): Promise<string[]> {
  const summary = await getJson<Summary>(page.request, `/api/plans/${planId}`);
  const layout = await getJson<Layout>(page.request, `/api/imports/${summary.import_id}/layout`);
  const entry = layout.aisles.find((candidate) => candidate.aisle === aisle)!;
  return [...new Set(entry.runs.flatMap((run) => run.levels))].sort();
}

/** The counts line equals the server's wall view counts, which equal the plan summary's. */
async function expectCounts(main: Locator, page: Page, planId: string) {
  const wall = await wallOf(page, planId, "A");
  const summary = await getJson<Summary>(page.request, `/api/plans/${planId}`);
  expect([wall.warehouse.best, wall.warehouse.empty_best]).toEqual([
    summary.best_locations,
    summary.empty_best_locations,
  ]);
  await expect(main.getByTestId("best-counts")).toHaveText(
    `${n(wall.warehouse.best)} best · ${n(wall.warehouse.empty_best)} empty`,
  );
}

/** Waits for the confirmed change: the toast, and no command still saving. */
async function expectSaved(page: Page) {
  await expect(toasts(page).getByText(TOAST, { exact: true }).last()).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved automatically");
  await expect(page.getByRole("main").getByText("Saving the last change…")).toHaveCount(0);
}

async function railLevels(picture: Locator): Promise<string[]> {
  const values = await picture.locator("[data-rail]").evaluateAll((rails) =>
    rails.map((rail) => rail.getAttribute("data-rail") ?? ""),
  );
  return [...new Set(values)].sort();
}

test("uj1 edit best-location marks opens the marking wall on the same aisle", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall marks ${randomUUID().slice(0, 8)}`)).id;

  await page.goto(`/plans/${planId}/locations?aisle=B`);
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "Edit best-location marks" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations\\?aisle=B$`));
  await expect(main.getByRole("heading", { name: "Best locations", level: 1 })).toBeVisible();
  await expect(main.getByRole("tab", { name: /^B/ })).toHaveAttribute("aria-selected", "true");
  await expect(main.getByRole("grid", { name: "Aisle B bin wall" })).toBeVisible();
  const modes = main.getByRole("radiogroup", { name: "Marking mode" });
  await expect(modes.getByRole("radio")).toHaveText(["Whole aisle", "Level", "Single location"]);
  await expect(main.getByRole("heading", { name: "Marks", level: 2 })).toBeVisible();
  await expect(main.getByTestId("best-counts")).toHaveText("0 best · 0 empty");
  await expect(main.getByRole("button", { name: "Open as list" })).toBeVisible();

  // Open as list keeps the aisle; Open as wall comes back to it. An unknown aisle opens the first.
  await main.getByRole("button", { name: "Open as list" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations\\?aisle=B&mode=list$`));
  await expect(main.getByRole("combobox", { name: "Aisle" })).toHaveValue("B");
  await main.getByRole("button", { name: "Open as wall" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations\\?aisle=B$`));
  await expect(main.getByRole("grid", { name: "Aisle B bin wall" })).toBeVisible();
  await page.goto(`/plans/${planId}/best-locations?aisle=ZZ`);
  await expect(main.getByRole("grid", { name: "Aisle A bin wall" })).toBeVisible();
});

test("uj1 step 4 marks aisle A and level 1 in all aisles on the wall, then a single location", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall UJ-1 ${randomUUID().slice(0, 8)}`)).id;
  const levelsA = await levelsOf(page, planId, "A");

  await page.goto(`/plans/${planId}/best-locations?aisle=A`);
  const main = page.getByRole("main");
  const grid = main.getByRole("grid", { name: "Aisle A bin wall" });
  const picture = main.locator('[data-wall-panel="A"]');
  const preview = main.locator("[data-mark-preview]");
  await expect(grid).toBeVisible();
  await expect(preview).toHaveText("");

  // Whole aisle: hover previews, a click marks. No pinned dialog on the marking wall.
  const cell = grid.locator("[data-grid-cell]").first();
  await cell.hover();
  await expect(preview).toHaveText("Mark aisle A");
  await expect(page.locator("[data-tip-mark-preview]")).toHaveText("Mark aisle A");
  await cell.click();
  await expectSaved(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(preview).toHaveText("Unmark aisle A");
  await expect.poll(() => railLevels(picture)).toEqual(levelsA);
  await expect(main.getByRole("tab", { name: /^A/ }).locator("[data-best-tag]")).toHaveText("BEST");

  // Level, in all aisles: the level 1 button, by keyboard. The pointer leaves the wall and `Esc`
  // dismisses the focused cell's tooltip (WCAG 1.4.13), which sits above the run.
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-wall-tooltip]")).toHaveCount(0);
  const modes = main.getByRole("radiogroup", { name: "Marking mode" });
  await modes.getByRole("radio", { name: "Level", exact: true }).click();
  await main.getByRole("radiogroup", { name: "Level scope" }).getByRole("radio", { name: "in all aisles" }).click();
  const level1 = main.locator('[data-level-mark="1"]').first();
  await expect(level1).toHaveAccessibleName("Mark level 1 in all aisles");
  const box = await level1.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(38);
  await level1.focus();
  await expect(preview).toHaveText("Mark level 1 in all aisles");
  await page.keyboard.press("Enter");
  await expectSaved(page);
  await expect(level1).toHaveAccessibleName("Unmark level 1 in all aisles");

  // The marking mode is remembered: a reload opens in Level mode (the scope starts at "in this aisle").
  await page.reload();
  await expect(grid).toBeVisible();
  await expect(modes.getByRole("radio", { name: "Level", exact: true })).toHaveAttribute("aria-checked", "true");

  // A pointer click on a level row's label (no cell there) marks that level in aisle A; then remove it.
  const marks = main.getByRole("list", { name: "Best-location marks" });
  const level2 = main.locator('[data-level-mark="2"]').first();
  await expect(level2).toHaveAccessibleName("Mark level 2 in aisle A");
  const level2Box = await level2.boundingBox();
  await level2.click({ position: { x: 10, y: level2Box!.height / 2 } });
  await expectSaved(page);
  await expect(marks.getByText("Level 2 in aisle A", { exact: true })).toBeVisible();
  await main.getByRole("button", { name: "Remove mark Level 2 in aisle A" }).click();
  await expectSaved(page);
  await expect(marks.getByText("Level 2 in aisle A", { exact: true })).toHaveCount(0);

  await expect(marks.getByRole("listitem")).toHaveText(["Aisle A", "Level 1 in all aisles"]);
  await expectCounts(main, page, planId);
  for (const remove of await main.getByRole("button", { name: /^Remove mark / }).all()) {
    const size = await remove.boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(24);
    expect(size!.height).toBeGreaterThanOrEqual(24);
  }

  // Tab B: a rail on L1 with its BEST tag, nothing else railed.
  await main.getByRole("tab", { name: /^B/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations\\?aisle=B$`));
  const pictureB = main.locator('[data-wall-panel="B"]');
  await expect.poll(() => railLevels(pictureB)).toEqual(["1"]);
  await expect(pictureB.locator('[data-level="1"] [data-best-tag="BEST"]').first()).toBeAttached();

  // Single location: Enter twice on one level-2 cell of B frames it ("BEST 1"), then clears it.
  await modes.getByRole("radio", { name: "Single location" }).click();
  const wallB = await wallOf(page, planId, "B");
  const target = wallB.locations.find((row) => row.location.level !== "1" && !row.location.is_best)!.location;
  const gridB = main.getByRole("grid", { name: "Aisle B bin wall" });
  const targetCell = gridB.locator(`[data-grid-cell="${target.code}"]`);
  await targetCell.focus();
  await expect(preview).toHaveText(`Mark ${target.code}`);
  await page.keyboard.press("Enter");
  await expectSaved(page);
  await expect(pictureB.locator(`[data-cell="${target.code}"]`)).toHaveAttribute("data-best", "frame");
  await expect(pictureB.locator(`[data-level="${target.level}"] [data-best-tag="BEST 1"]`).first()).toBeAttached();
  await expect(marks.getByText(`Location ${target.code}`, { exact: true })).toBeVisible();
  await expect(preview).toHaveText(`Unmark ${target.code}`);
  await page.keyboard.press("Enter");
  await expectSaved(page);
  await expect(pictureB.locator(`[data-cell="${target.code}"]`)).toHaveAttribute("data-best", "none");
  await expect(pictureB.locator('[data-best-tag="BEST 1"]')).toHaveCount(0);
  await expect(marks.getByRole("listitem")).toHaveText(["Aisle A", "Level 1 in all aisles"]);
  await expectCounts(main, page, planId);
});

test("uj1 unmarking an aisle on the wall outdates recommendations with View and no Undo", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall outdated ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });

  await page.goto(`/plans/${planId}/best-locations?aisle=A`);
  const main = page.getByRole("main");
  const modes = main.getByRole("radiogroup", { name: "Marking mode" });
  await modes.getByRole("radio", { name: "Whole aisle" }).click();
  const cell = main.getByRole("grid", { name: "Aisle A bin wall" }).locator("[data-grid-cell]").first();
  await cell.hover();
  await expect(main.locator("[data-mark-preview]")).toHaveText("Unmark aisle A");
  await cell.click();

  const toast = toasts(page).getByText(/^Best-location marks changed · /);
  await expect(toast).toBeVisible();
  const after = await getJson<{ recommendations: { outdated?: { cause: string } | null }[] }>(
    request,
    `/api/plans/${planId}/recommendations`,
  );
  const outdated = after.recommendations.filter((rec) => rec.outdated?.cause === "marks").length;
  expect(outdated).toBeGreaterThan(0);
  const noun = outdated === 1 ? "recommendation is" : "recommendations are";
  await expect(toast).toHaveText(`Best-location marks changed · ${n(outdated)} ${noun} now outdated`);
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
  await expect(main.getByText("No best locations yet.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations\\?tab=outdated$`));
});

test("uj1 the marking wall shows a load error when the wall view fails", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall error ${randomUUID().slice(0, 8)}`)).id;
  await page.route(`**/api/plans/${planId}/wall?*`, (route) =>
    route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }),
  );

  await page.goto(`/plans/${planId}/best-locations?aisle=A`);
  const main = page.getByRole("main");
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.getByRole("grid")).toHaveCount(0);
  await expect(main.getByTestId("best-counts")).toHaveCount(0);
});

test("uj1 the marking wall shows a load error when the layout fails", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall layout error ${randomUUID().slice(0, 8)}`)).id;
  await page.route("**/api/imports/*/layout", (route) =>
    route.fulfill({ status: 500, json: { code: "internal", message: "The layout could not be read." } }),
  );

  await page.goto(`/plans/${planId}/best-locations?aisle=A`);
  const main = page.getByRole("main");
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.getByRole("grid")).toHaveCount(0);
});
