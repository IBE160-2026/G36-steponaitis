import { randomUUID } from "node:crypto";

import { expect, test } from "./support/test";

import {
  type Detail,
  getJson,
  locationRows,
  moveFromPanel,
  type Occupancy,
  occupancyLine,
  partDetail,
} from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1, UJ-6 and AD-12: the plan views follow a manual move made from the part panel, and the
// panel only shows a part at the version of the page around it (Story 4.4; FR-13, FR-14, FR-20).

test.skip(({ browserName }) => browserName !== "chromium", "The planning copy journeys run in Chromium.");

type LocationsView = { aisles: (Occupancy & { aisle: string })[] };
type GroupPart = { part: string; aisle: string | null };
type PickGroupsView = { pick_groups: { part_a: GroupPart; part_b: GroupPart; same_aisle: boolean }[] };

test("uj1 locations show the emptied location after a manual move", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Empties ${randomUUID().slice(0, 8)}`)).id;
  const rows = await locationRows(request, planId);
  // A location holding one part that is stored nowhere else: moving it empties the location.
  let detail: Detail | undefined;
  for (const row of rows) {
    if (row.contents.length !== 1) continue;
    const candidate = await partDetail(request, planId, row.contents[0].part);
    if (candidate.other_locations.length === 0 && candidate.current_location?.code === row.location.code) {
      detail = candidate;
      break;
    }
  }
  expect(detail).toBeDefined();
  const part = detail!.part;
  const source = detail!.current_location!;
  const target = rows.find((row) => !row.occupied && row.location.aisle !== source.aisle)!.location.code;
  const before = await getJson<LocationsView>(request, `/api/plans/${planId}/locations`);
  const aisleBefore = before.aisles.find((aisle) => aisle.aisle === source.aisle)!;

  await page.goto(`/plans/${planId}/locations?aisle=${source.aisle}&part=${encodeURIComponent(part)}`);
  const main = page.getByRole("main");
  const line = main.locator(`[data-occupancy-line="${source.aisle}"]`);
  await expect(line).toHaveText(occupancyLine(`Aisle ${source.aisle}`, aisleBefore));
  const body = main.getByRole("table", { name: "Locations" }).locator("tbody tr");
  const sourceRow = body.filter({ has: page.getByRole("cell", { name: source.code, exact: true }) });
  await expect(sourceRow.locator("[data-occupancy]")).toHaveText("Occupied");

  const panel = page.getByRole("complementary", { name: part });
  await moveFromPanel(page, panel, part, source.code, target);

  await expect(sourceRow.locator("[data-occupancy]")).toHaveText("Empty");
  await expect(sourceRow).toContainText("None");
  const after = await getJson<LocationsView>(request, `/api/plans/${planId}/locations`);
  const aisleAfter = after.aisles.find((aisle) => aisle.aisle === source.aisle)!;
  expect(aisleAfter.occupied).toBe(aisleBefore.occupied - 1);
  expect(aisleAfter.empty).toBe(aisleBefore.empty + 1);
  await expect(line).toHaveText(occupancyLine(`Aisle ${source.aisle}`, aisleAfter));
  await expect(panel.locator(`[data-location-chip="${target}"]`)).toBeVisible();
});

test("uj6 a pick group shows same aisle after its part moves into the partner's aisle", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Same aisle ${randomUUID().slice(0, 8)}`)).id;
  const groups = await getJson<PickGroupsView>(request, `/api/plans/${planId}/pick-groups`);
  const rows = await locationRows(request, planId);
  // A row with two different aisles whose mover has one location, and an empty location in the
  // partner's aisle.
  let found: { a: string; b: string; mover: Detail; aisle: string; target: string } | undefined;
  for (const row of groups.pick_groups) {
    const { part_a: a, part_b: b } = row;
    if (a.aisle === null || b.aisle === null || a.aisle === b.aisle) continue;
    for (const [mover, partner] of [
      [a, b],
      [b, a],
    ] as const) {
      const detail = await partDetail(request, planId, mover.part);
      const empty = rows.find((r) => !r.occupied && r.location.aisle === partner.aisle);
      if (detail.other_locations.length === 0 && detail.current_location !== null && empty) {
        found = { a: a.part, b: b.part, mover: detail, aisle: partner.aisle!, target: empty.location.code };
        break;
      }
    }
    if (found) break;
  }
  expect(found).toBeDefined();
  const { a, b, mover, aisle, target } = found!;

  await page.goto(`/plans/${planId}/pick-groups?part=${encodeURIComponent(mover.part)}`);
  const main = page.getByRole("main");
  const groupRow = main
    .getByRole("table", { name: "Pick groups" })
    .locator("tbody tr")
    .filter({ has: page.locator(`[data-open-part="${a}"]`) })
    .filter({ has: page.locator(`[data-open-part="${b}"]`) });
  await expect(groupRow.locator("[data-same-aisle]")).toHaveText("Different aisles");

  const panel = page.getByRole("complementary", { name: mover.part });
  await moveFromPanel(page, panel, mover.part, mover.current_location!.code, target);

  await expect(groupRow.locator("[data-same-aisle]")).toHaveText("Same aisle");
  await expect(groupRow.locator("td:nth-child(4)")).toHaveText(aisle);
  await expect(groupRow.locator("td:nth-child(5)")).toHaveText(aisle);
});

test("ad12 the part panel waits for a version that matches the page", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Panel version ${randomUUID().slice(0, 8)}`)).id;
  const roster = await getJson<{ parts: { part: string; description: string }[] }>(
    request,
    `/api/plans/${planId}/parts`,
  );
  const { part, description } = roster.parts[0];

  let hits = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/plans/${planId}/parts/${encodeURIComponent(part)}`, async (route) => {
    hits += 1;
    if (hits === 1) {
      // The first detail is one version behind the page.
      const response = await route.fetch();
      const body = (await response.json()) as { version: number };
      await route.fulfill({ response, json: { ...body, version: body.version - 1 } });
      return;
    }
    await released;
    await route.fallback();
  });

  await page.goto(`/plans/${planId}/parts?part=${encodeURIComponent(part)}`);
  await expect(page.getByRole("main").getByRole("table", { name: "Parts" }).locator("tbody tr").first()).toBeVisible();
  const panel = page.getByRole("complementary", { name: part });
  // The mismatched detail is refetched; until it agrees, the panel shows no facts.
  await expect.poll(() => hits).toBe(2);
  await expect(panel).toContainText(`Loading part ${part}…`);
  await expect(panel.getByRole("button", { name: "Manual move…" })).toHaveCount(0);
  release();
  await expect(panel).toContainText(description);
  await expect(panel.getByRole("button", { name: "Manual move…" })).toBeVisible();
  expect(hits).toBe(2);
});

test("ad12 best locations repairs a first load with mismatched versions", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `First load ${randomUUID().slice(0, 8)}`)).id;

  let hits = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/plans/${planId}/locations`, async (route) => {
    hits += 1;
    if (hits === 1) {
      // The first locations view is one version behind the summary.
      const response = await route.fetch();
      const body = (await response.json()) as { version: number };
      await route.fulfill({ response, json: { ...body, version: body.version - 1 } });
      return;
    }
    await released;
    await route.fallback();
  });

  await page.goto(`/plans/${planId}/best-locations`);
  const main = page.getByRole("main");
  // The stale locations view is refetched; until the versions agree, the step shows no counts.
  await expect.poll(() => hits).toBe(2);
  await expect(main.getByTestId("best-counts")).toHaveCount(0);
  release();
  await expect(main.getByTestId("best-counts")).toHaveText("0 best · 0 empty");
  expect(hits).toBe(2);
});

test("ad12 best locations stops refetching a view that stays behind", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Stays behind ${randomUUID().slice(0, 8)}`)).id;

  let hits = 0;
  await page.route(`**/api/plans/${planId}/locations`, async (route) => {
    hits += 1;
    // Always one version behind the summary: never consistent.
    const response = await route.fetch();
    const body = (await response.json()) as { version: number };
    await route.fulfill({ response, json: { ...body, version: body.version - 1 } });
  });

  await page.goto(`/plans/${planId}/best-locations`);
  // One load plus MAX_STALE_REFETCHES (2) refetches, then no more.
  await expect.poll(() => hits).toBe(3);
  await page.waitForTimeout(1_500);
  expect(hits).toBe(3);
  await expect(page.getByTestId("best-counts")).toHaveCount(0);
});

test("ad12 switching the panel to another part never shows the previous part's facts", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Panel switch ${randomUUID().slice(0, 8)}`)).id;
  const roster = await getJson<{ parts: { part: string; description: string }[] }>(
    request,
    `/api/plans/${planId}/parts`,
  );
  // The table shows the roster in server order: B is the second row.
  const [a, b] = roster.parts;
  expect(b.description).not.toBe(a.description);

  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/plans/${planId}/parts/${encodeURIComponent(b.part)}`, async (route) => {
    await released;
    await route.fallback();
  });

  await page.goto(`/plans/${planId}/parts?part=${encodeURIComponent(a.part)}`);
  const panelA = page.getByRole("complementary", { name: a.part });
  await expect(panelA).toContainText(a.description);

  const table = page.getByRole("main").getByRole("table", { name: "Parts" });
  const rowB = table.locator("tbody tr").nth(1);
  await expect(rowB).toContainText(b.part);
  await rowB.click();
  const panelB = page.getByRole("complementary", { name: b.part });
  await expect(panelB).toContainText(`Loading part ${b.part}…`);
  await expect(panelB).not.toContainText(a.description);
  release();
  await expect(panelB).toContainText(b.description);
});
