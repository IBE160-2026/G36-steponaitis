import { randomUUID } from "node:crypto";

import { expect, test } from "./support/test";

import { createSamplePlan } from "./support/sample-plan";

// UJ-7 and UJ-6: the planner finds a part or a location with the search field, opens a part's
// panel from a search result, a roster row or the pick groups table, and follows a location chip
// to the Locations table (Story 2.6; FR-13, FR-15, FR-20, UX-DR8, UX-DR11, UX-DR24, UX-DR25).

type Ref = { code: string; aisle: string };
type Threshold = { min_picks: number; max_picks: number | null };
type Detail = {
  part: string;
  picks: number;
  class_threshold: Threshold;
  current_location: Ref | null;
  pick_groups: { partner: { part: string }; shared_jobs: number }[];
};
type Search = {
  parts: { part: string }[];
  locations: { location: Ref }[];
};

function picksLine(detail: Detail): string {
  const { min_picks: min, max_picks: max } = detail.class_threshold;
  const threshold = max === null ? `${min} or more` : min === max ? `${min}` : `${min}–${max}`;
  const noun = detail.picks === 1 ? "pick" : "picks";
  return `${detail.picks.toLocaleString("en-US")} ${noun} in the period (${threshold})`;
}

test("uj7 searches for a part, opens its panel and closes it with Esc", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Panel ${randomUUID().slice(0, 8)}`)).id;
  const search = (await (await request.get(`/api/plans/${planId}/search?q=oil%20filter`)).json()) as Search;
  expect(search.parts.length).toBeGreaterThan(0);
  const firstPart = search.parts[0].part;
  const detail = (await (await request.get(`/api/plans/${planId}/parts/${encodeURIComponent(firstPart)}`)).json()) as Detail;

  await page.goto(`/plans/${planId}/parts`);
  const main = page.getByRole("main");
  await expect(main.getByRole("table", { name: "Parts" }).locator("tbody tr").first()).toBeVisible();

  // Ctrl+/ focuses the field; a plain "/" never does.
  const field = main.getByRole("searchbox", { name: "Search parts and locations" });
  await main.getByRole("heading", { name: "Parts", level: 1 }).click();
  await page.keyboard.press("/");
  await expect(field).not.toBeFocused();
  await page.keyboard.press("Control+/");
  await expect(field).toBeFocused();

  await page.keyboard.type("oil filter");
  const results = main.getByRole("region", { name: "Search results" });
  await expect(results.getByRole("heading", { name: "Parts" })).toBeVisible();
  await expect(results.getByRole("heading", { name: "Locations" })).toBeVisible();
  const partButton = results.locator(`[data-search-part="${firstPart}"]`);
  await expect(partButton).toBeVisible();
  // Opening the panel is client view state: it never waits on a server render of the page.
  const pageRenders: string[] = [];
  const onRequest = (req: { url(): string }) => {
    if (req.url().includes("_rsc=") && req.url().includes(`/plans/${planId}/parts`)) pageRenders.push(req.url());
  };
  page.on("request", onRequest);
  await partButton.click();

  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts\\?part=${encodeURIComponent(firstPart)}$`));
  await expect(results).toHaveCount(0);
  await expect(field).toHaveValue("oil filter");
  const panel = page.getByRole("complementary", { name: firstPart });
  const heading = panel.getByRole("heading", { name: firstPart, level: 2 });
  await expect(heading).toBeFocused();
  await expect(panel.locator("[data-picks-line]")).toHaveText(picksLine(detail));
  if (detail.current_location) {
    await expect(panel.locator(`[data-location-chip="${detail.current_location.code}"]`)).toBeVisible();
  } else {
    await expect(panel).toContainText("No current location (no stock above zero)");
  }

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await expect(field).toBeFocused();
  page.off("request", onRequest);
  expect(pageRenders).toEqual([]);

  // Esc clears the field, then blurs it.
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(field).not.toBeFocused();

  // No match.
  await field.fill("zzzz");
  await expect(main.getByText("No part or location matches “zzzz”.", { exact: true })).toBeVisible();
  await field.fill("");

  // A roster row click opens a panel; its chip opens the Locations table with that row focused.
  const rows = main.getByRole("table", { name: "Parts" }).locator("tbody tr");
  const roster = (await (await request.get(`/api/plans/${planId}/parts`)).json()) as {
    parts: { part: string; current_location: Ref | null }[];
  };
  const stocked = roster.parts.find((row) => row.current_location !== null)!;
  const index = roster.parts.indexOf(stocked);
  await rows.nth(index).locator("td").first().click();
  await expect(page).toHaveURL(new RegExp(`\\?part=${encodeURIComponent(stocked.part)}$`));
  const rowPanel = page.getByRole("complementary", { name: stocked.part });
  await expect(rowPanel.getByRole("heading", { name: stocked.part, level: 2 })).toBeFocused();
  const location = stocked.current_location!;
  await rowPanel.locator(`[data-location-chip="${location.code}"]`).click();
  await expect(page).toHaveURL(
    new RegExp(`/plans/${planId}/locations\\?aisle=${location.aisle}&loc=${encodeURIComponent(location.code)}$`),
  );
  const locationRows = page.getByRole("main").getByRole("table", { name: "Locations" }).locator("tbody tr");
  await expect(locationRows.filter({ hasText: location.code }).first()).toBeFocused();

  // A location search on the Locations page opens the table at that aisle with the row focused.
  const locationsSearch = (await (await request.get(`/api/plans/${planId}/search?q=a-01-01`)).json()) as Search;
  const target = locationsSearch.locations[0].location;
  const locField = page.getByRole("main").getByRole("searchbox", { name: "Search parts and locations" });
  await page.keyboard.press("Control+/");
  await expect(locField).toBeFocused();
  await page.keyboard.type("a-01-01");
  await page.locator(`[data-search-location="${target.code}"]`).click();
  await expect(page).toHaveURL(
    new RegExp(`/plans/${planId}/locations\\?aisle=${target.aisle}&loc=${encodeURIComponent(target.code)}$`),
  );
  const targetRow = locationRows.filter({ has: page.getByText(target.code, { exact: true }) }).first();
  await expect(targetRow).toBeFocused();

  // The part panel on the Locations page: opened from a part result, kept across an aisle change,
  // closed with Esc back to the search field.
  await locField.fill("oil filter");
  await page.locator(`[data-search-part="${firstPart}"]`).click();
  // Opening keeps the view state already in the URL.
  await expect(page).toHaveURL(
    new RegExp(
      `/plans/${planId}/locations\\?aisle=${target.aisle}&loc=${encodeURIComponent(target.code)}&part=${encodeURIComponent(firstPart)}$`,
    ),
  );
  const locPanel = page.getByRole("complementary", { name: firstPart });
  await expect(locPanel).toBeVisible();
  const otherAisle = (await (await request.get(`/api/plans/${planId}/locations`)).json()) as {
    aisles: { aisle: string }[];
  };
  const nextAisle = otherAisle.aisles.find((entry) => entry.aisle !== target.aisle)!.aisle;
  await page.getByRole("main").getByLabel("Aisle", { exact: true }).selectOption(nextAisle);
  await expect(page).toHaveURL(new RegExp(`aisle=${nextAisle}&mode=list&part=${encodeURIComponent(firstPart)}$`));
  await expect(locPanel).toBeVisible();
  await locPanel.getByRole("heading", { name: firstPart, level: 2 }).focus();
  await page.keyboard.press("Escape");
  await expect(locPanel).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=${nextAisle}&mode=list$`));
  await expect(locField).toBeFocused();
});

test("uj6 opens a pick-group part's panel", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Panel groups ${randomUUID().slice(0, 8)}`)).id;
  const groups = (await (await request.get(`/api/plans/${planId}/pick-groups`)).json()) as {
    pick_groups: { part_a: { part: string }; part_b: { part: string } }[];
  };
  const part = groups.pick_groups[0].part_a.part;
  const detail = (await (await request.get(`/api/plans/${planId}/parts/${encodeURIComponent(part)}`)).json()) as Detail;
  expect(detail.pick_groups.length).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/pick-groups`);
  const main = page.getByRole("main");
  const opener = main.getByRole("table", { name: "Pick groups" }).locator(`[data-open-part="${part}"]`).first();
  await opener.click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/pick-groups\\?part=${encodeURIComponent(part)}$`));
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeFocused();
  const partners = panel.locator("[data-partner]");
  await expect(partners).toHaveCount(detail.pick_groups.length);
  await expect(partners.first()).toHaveAttribute("data-partner", detail.pick_groups[0].partner.part);
  await expect(partners.first()).toContainText(`${detail.pick_groups[0].shared_jobs} shared jobs`);

  await panel.getByRole("button", { name: "Close part panel" }).click();
  await expect(panel).toHaveCount(0);
  await expect(opener).toBeFocused();

  // Browser Back closes a panel opened in the page, without reloading it.
  await page.evaluate(() => Object.assign(window, { __samePage: true }));
  await opener.click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/pick-groups\\?part=${encodeURIComponent(part)}$`));
  await expect(panel).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/pick-groups$`));
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __samePage?: boolean }).__samePage)).toBe(true);

  // A direct load of `?part=` shows the panel.
  await page.goto(`/plans/${planId}/pick-groups?part=${encodeURIComponent(part)}`);
  await main.getByRole("table", { name: "Pick groups" }).waitFor();
  await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeVisible();
  await expect(panel.locator("[data-partner]")).toHaveCount(detail.pick_groups.length);
});
