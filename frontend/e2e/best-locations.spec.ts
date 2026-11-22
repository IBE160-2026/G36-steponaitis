import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, type Locator, type Page, test, toasts } from "./support/test";

import { createSamplePlan } from "./support/sample-plan";

// UJ-1: the planner opens the Best locations step, marks a whole aisle and a level in all aisles,
// marks and unmarks a single location, reloads, removes a mark and sees the counts on Overview
// (Story 3.4; FR-21, FR-22, FR-10, UX-DR: segmented control, marks list, toast, save status).

type Row = { location: { code: string; aisle: string; level: string; is_best: boolean } };
type View = { locations: Row[]; levels: string[]; marks: unknown[] };
type Summary = { best_locations: number; empty_best_locations: number };

const TOAST = "Best-location marks changed.";
const n = (value: number) => value.toLocaleString("en-US");

async function apiSummary(request: APIRequestContext, planId: string): Promise<Summary> {
  return (await (await request.get(`/api/plans/${planId}`)).json()) as Summary;
}

async function apiView(request: APIRequestContext, planId: string): Promise<View> {
  return (await (await request.get(`/api/plans/${planId}/locations`)).json()) as View;
}

/** The counts line equals the server summary. */
async function expectCounts(page: Page, request: APIRequestContext, planId: string): Promise<Summary> {
  const summary = await apiSummary(request, planId);
  await expect(page.getByTestId("best-counts")).toHaveText(
    `${n(summary.best_locations)} best · ${n(summary.empty_best_locations)} empty`,
  );
  return summary;
}

/** Waits for the confirmed change: the toast and the "Saved automatically" status. */
async function expectSaved(page: Page) {
  // A replaced toast may still be leaving while the new one shows.
  await expect(toasts(page).getByText(TOAST, { exact: true }).last()).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved automatically");
  // The plan plate's tooltip in the toolbar says so too (shown on hover; read without hovering).
  await expect(page.getByRole("banner").locator('[role="tooltip"]')).toContainText("Saved automatically");
  await expect(page.getByRole("main").getByText("Saving the last change…")).toHaveCount(0);
}

/** The Best column (6th) of each shown row, keyed by its Level (3rd). */
async function bestByLevel(body: Locator): Promise<[string, string][]> {
  return body.evaluateAll((rows) =>
    rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return [cells[2]?.textContent ?? "", cells[5]?.textContent ?? ""] as [string, string];
    }),
  );
}

test("uj1 marks aisle A and level 1 in all aisles, removes a mark and keeps the marks after a reload", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Best ${randomUUID().slice(0, 8)}`)).id;
  const initial = await apiView(request, planId);
  expect(initial.levels).toContain("1");

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Best locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations$`));

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Best locations", level: 1 })).toBeVisible();
  await expect(
    main.getByText("No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations."),
  ).toBeVisible();
  await expect(main.getByTestId("best-counts")).toHaveText("0 best · 0 empty");

  const modes = main.getByRole("radiogroup", { name: "Marking mode" });
  await expect(modes.getByRole("radio", { name: "Whole aisle" })).toHaveAttribute("aria-checked", "true");
  const marks = main.getByRole("list", { name: "Best-location marks" });
  const aisleSelect = main.getByRole("combobox", { name: "Aisle" });
  const body = main.getByRole("table", { name: "Locations" }).locator("tbody tr");

  // No aisle chosen: the Mark button explains why it is disabled.
  const markAisle = main.getByRole("button", { name: "Mark aisle", exact: true });
  await expect(markAisle).toHaveAttribute("aria-disabled", "true");
  await expect(markAisle).toHaveAccessibleDescription("Choose an aisle in the aisle filter.");

  // Whole aisle A.
  await aisleSelect.selectOption("A");
  await main.getByRole("button", { name: "Mark aisle A", exact: true }).click();
  await expectSaved(page);
  await expect(marks.getByText("Aisle A", { exact: true })).toBeVisible();
  const aisleRows = initial.locations.filter((row) => row.location.aisle === "A").length;
  await expect(body).toHaveCount(aisleRows);
  await expect.poll(async () => (await bestByLevel(body)).every(([, best]) => best === "Best")).toBe(true);
  const afterAisle = await expectCounts(page, request, planId);
  expect(afterAisle.best_locations).toBe(aisleRows);
  await expect(main.getByRole("button", { name: "Mark aisle A", exact: true })).toHaveAccessibleDescription(
    "Aisle A is already marked.",
  );

  // Level 1 in all aisles (keyboard: the radio group selects with the arrow keys).
  await modes.getByRole("radio", { name: "Whole aisle" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(modes.getByRole("radio", { name: "Level" })).toHaveAttribute("aria-checked", "true");
  await expect(modes.getByRole("radio", { name: "Level" })).toBeFocused();
  await main.getByRole("combobox", { name: "Level" }).selectOption("1");
  await main.getByRole("radiogroup", { name: "Level scope" }).getByRole("radio", { name: "in all aisles" }).click();
  await main.getByRole("button", { name: "Mark level 1 in all aisles", exact: true }).click();
  await expectSaved(page);
  await expect(marks.getByText("Level 1 in all aisles", { exact: true })).toBeVisible();
  const counts = await expectCounts(page, request, planId);
  expect(counts.best_locations).toBeGreaterThan(afterAisle.best_locations);

  // The flow bar checks the Best locations step.
  await expect(nav.getByRole("link", { name: /Best locations.*step 5.*done/ })).toBeVisible();

  // Single location: mark, then unmark, one location that is not best.
  const marked = await apiView(request, planId);
  const target = marked.locations.find((row) => !row.location.is_best)!.location;
  await modes.getByRole("radio", { name: "Single location" }).click();
  await aisleSelect.selectOption(target.aisle);
  await main.getByRole("button", { name: `Mark ${target.code}`, exact: true }).click();
  await expectSaved(page);
  await expect(marks.getByText(`Location ${target.code}`, { exact: true })).toBeVisible();
  await main.getByRole("button", { name: `Unmark ${target.code}`, exact: true }).click();
  await expect(main.getByRole("button", { name: `Mark ${target.code}`, exact: true })).toBeVisible();
  await expectSaved(page);
  await expect(marks.getByText(`Location ${target.code}`, { exact: true })).toHaveCount(0);
  await expectCounts(page, request, planId);

  // Back to Level mode, then reload: both marks, the same counts and the mode are kept.
  await modes.getByRole("radio", { name: "Level" }).click();
  await page.reload();
  await expect(marks.getByRole("listitem")).toHaveText(["Aisle A", "Level 1 in all aisles"]);
  await expect(main.getByTestId("best-counts")).toHaveText(
    `${n(counts.best_locations)} best · ${n(counts.empty_best_locations)} empty`,
  );
  await expect(modes.getByRole("radio", { name: "Level" })).toHaveAttribute("aria-checked", "true");

  // The remove buttons are at least 24 × 24px.
  const removeBox = await main.getByRole("button", { name: "Remove mark Aisle A" }).boundingBox();
  expect(removeBox!.width).toBeGreaterThanOrEqual(24);
  expect(removeBox!.height).toBeGreaterThanOrEqual(24);

  // Remove "Aisle A": aisle A's level-1 rows stay best through the level mark, the rest are not best.
  await main.getByRole("button", { name: "Remove mark Aisle A" }).click();
  await expectSaved(page);
  await expect(marks.getByRole("listitem")).toHaveText(["Level 1 in all aisles"]);
  await aisleSelect.selectOption("A");
  await expect(body).toHaveCount(aisleRows);
  await expect
    .poll(async () => (await bestByLevel(body)).every(([level, best]) => best === (level === "1" ? "Best" : "")))
    .toBe(true);
  expect((await bestByLevel(body)).some(([level]) => level === "1")).toBe(true);
  const final = await expectCounts(page, request, planId);

  // The Locations step's best column and filter show the same server data.
  const bestInA = (await apiView(request, planId)).locations.filter(
    (row) => row.location.aisle === "A" && row.location.is_best,
  ).length;
  expect(bestInA).toBeGreaterThan(0);
  await page.goto(`/plans/${planId}/locations?aisle=A`);
  await expect(main.getByRole("heading", { name: "Locations", level: 1 })).toBeVisible();
  await main.getByRole("group", { name: "Filter by best location" }).getByRole("button", { name: "Best", exact: true }).click();
  await expect(body).toHaveCount(bestInA);
  expect((await bestByLevel(body)).every(([, best]) => best === "Best")).toBe(true);

  // Overview shows the same counts.
  await nav.getByRole("link", { name: /^\d*Overview/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/overview$`));
  for (const [term, value] of [
    ["Best locations", final.best_locations],
    ["Empty best locations", final.empty_best_locations],
  ] as const) {
    const fact = main.locator("dt", { hasText: new RegExp(`^${term}$`) });
    await expect(fact.locator("xpath=following-sibling::dd[1]")).toHaveText(n(value));
  }
});
