import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createSamplePlan } from "./support/sample-plan";

// UJ-1: the planner opens the Locations step, reads the occupancy lines, filters by aisle and
// occupancy, and opens a location from a `?aisle=&loc=` URL (Story 2.4; FR-14, UX-DR9, UX-DR27,
// UX-DR57).

test.skip(({ browserName }) => browserName !== "chromium", "The locations journey runs in Chromium.");

type Occupancy = { locations: number; occupied: number; empty: number; occupied_percent: string };
type Row = {
  location: { code: string; aisle: string };
  occupied: boolean;
  contents: { part: string }[];
};
type View = { locations: Row[]; aisles: (Occupancy & { aisle: string })[]; warehouse: Occupancy };

function occupancyLine(label: string, occupancy: Occupancy): string {
  const n = (value: number) => value.toLocaleString("en-US");
  const noun = occupancy.locations === 1 ? "location" : "locations";
  return `${label} · ${occupancy.occupied_percent}% occupied · ${n(occupancy.occupied)} of ${n(occupancy.locations)} ${noun} · ${n(occupancy.empty)} empty`;
}

test("uj1 reads the locations table with occupancy, filters it and opens a location from the URL", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const planId = (await createSamplePlan(request, `Locations ${randomUUID().slice(0, 8)}`)).id;
  const api = await request.get(`/api/plans/${planId}/locations`);
  expect(api.status()).toBe(200);
  const view = (await api.json()) as View;

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations$`));

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Locations", level: 1 })).toBeVisible();
  await expect(main.getByText("Whole warehouse · 79.2% occupied · 1,584 of 2,000 locations · 416 empty")).toBeVisible();
  await expect(main.getByText("2,000 locations", { exact: true })).toBeVisible();

  const aisleSelect = main.getByRole("combobox", { name: "Aisle" });
  const table = main.getByRole("table", { name: "Locations" });
  const body = table.locator("tbody tr");
  await expect(body).toHaveCount(2_000);

  // Aisle A: the URL carries the filter; the rows and the aisle line match the API.
  const aisleA = view.aisles.find((aisle) => aisle.aisle === "A")!;
  await aisleSelect.selectOption("A");
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=A$`));
  await expect(body).toHaveCount(aisleA.locations);
  expect(aisleA.locations).toBe(223);
  await expect(main.getByText(occupancyLine("Aisle A", aisleA), { exact: true })).toBeVisible();

  // Empty: only aisle A's empty locations, each in words.
  const emptyButton = main.getByRole("group", { name: "Filter by occupancy" }).getByRole("button", { name: "Empty" });
  await emptyButton.click();
  await expect(emptyButton).toHaveAttribute("aria-pressed", "true");
  await expect(body).toHaveCount(aisleA.empty);
  const occupancyCells = await body.locator("[data-occupancy]").allTextContents();
  expect(occupancyCells.every((cell) => cell === "Empty")).toBe(true);

  // An empty location reads Empty and None. The API leaves zero-stock rows out of `contents`, so
  // a zero-stock-row location cannot be told apart here; the domain tests cover that case.
  const emptyRow = view.locations.find((row) => !row.occupied)!;
  await aisleSelect.selectOption(emptyRow.location.aisle);
  const emptyRowLine = body.filter({ hasText: emptyRow.location.code });
  await expect(emptyRowLine).toHaveCount(1);
  await expect(emptyRowLine.locator("[data-occupancy]")).toHaveText("Empty");
  await expect(emptyRowLine).toContainText("None");

  // A `?aisle=B&loc=` link: aisle filter B, that row focused and in view.
  const aisleB = view.locations.filter((row) => row.location.aisle === "B");
  const target = aisleB[Math.floor(aisleB.length / 2)].location.code;
  await page.goto(`/plans/${planId}/locations?aisle=B&loc=${encodeURIComponent(target)}`);
  await expect(aisleSelect).toHaveValue("B");
  await expect(body).toHaveCount(aisleB.length);
  const targetRow = body.filter({ has: page.getByRole("cell", { name: target, exact: true }) });
  await expect(targetRow).toBeFocused();
  await expect(targetRow).toHaveAttribute("tabindex", "0");
  await expect(targetRow).toBeInViewport();

  // The focus happens once per `loc`: a filter that keeps the row shown leaves focus on the button.
  const allOccupancy = main.getByRole("group", { name: "Filter by occupancy" }).getByRole("button", { name: "All" });
  await allOccupancy.click();
  await expect(allOccupancy).toBeFocused();

  // Unknown aisle and location: all aisles, nothing focused.
  await page.goto(`/plans/${planId}/locations?aisle=Z&loc=nope`);
  await expect(aisleSelect).toHaveValue("");
  await expect(body).toHaveCount(2_000);
  const focusedInTable = await table.evaluate((element) => element.contains(document.activeElement));
  expect(focusedInTable).toBe(false);
});
