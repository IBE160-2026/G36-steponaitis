import { randomUUID } from "node:crypto";

import { expect, type Page, test, toasts } from "./support/test";

import { enterTarget, getJson, moveFromPanel, partDetail, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1: the Locations step opens the open aisle as a bin wall with its Key (Story 10.2; FR-42,
// FR-14, FR-22, UX-DR40/41/45/48). Aisle tabs, Open as list / Open as wall, the stored aisle and
// the wall following a manual move and its undo. UJ-1 step 3 (Story 10.3) is at the end.

type Counts = {
  aisle: string;
  locations: number;
  occupied: number;
  empty: number;
  occupied_percent: string;
  best: number;
  empty_best: number;
  moves: number;
  aisle_marked: boolean;
};
type WallLocation = {
  location: { code: string; aisle: string; level: string };
  occupied: boolean;
  parts: { part: string }[];
};
type Wall = { version: number; aisle: string; locations: WallLocation[]; rail_levels: string[]; aisles: Counts[] };
type Layout = { aisles: { aisle: string; walk_path_first: string; walk_path_last: string; runs: { levels: string[] }[] }[] };

const n = (value: number | string) => Number(value).toLocaleString("en-US");

async function wallOf(page: Page, planId: string, aisle: string): Promise<Wall> {
  return getJson<Wall>(page.request, `/api/plans/${planId}/wall?aisle=${aisle}`);
}

test("uj1 opens aisle A as a bin wall with rails, its header line and the Key, and switches to the list", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const plan = await createSamplePlan(request, `Wall ${randomUUID().slice(0, 8)}`);
  const planId = plan.id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  const wall = await wallOf(page, planId, "A");
  const summary = await getJson<{ import_id: string }>(request, `/api/plans/${planId}`);
  const layout = (await getJson<Layout>(request, `/api/imports/${summary.import_id}/layout`)).aisles.find(
    (entry) => entry.aisle === "A",
  )!;
  const counts = wall.aisles.find((entry) => entry.aisle === "A")!;
  expect(wall.locations).toHaveLength(223);

  await page.goto(`/plans/${planId}/locations`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Locations", level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Aisle A", level: 2 })).toBeVisible();
  // The SVG is the picture only (aria-hidden); the grid over it names the cells (Story 10.3).
  const picture = main.locator('[data-wall-panel="A"]');
  await expect(picture).toHaveAttribute("aria-hidden", "true");
  await expect(main.getByRole("grid", { name: "Aisle A bin wall" })).toBeVisible();
  await expect(picture).toBeVisible();
  await expect(picture.locator("[data-cell]")).toHaveCount(223);

  // Aisle tabs in server order; A carries the BEST tag of its aisle mark.
  const tabs = main.getByRole("tablist", { name: "Aisles" }).getByRole("tab");
  await expect(tabs).toHaveCount(wall.aisles.length);
  const tabA = tabs.filter({ hasText: /^A/ });
  await expect(tabA).toHaveAttribute("aria-selected", "true");
  await expect(tabA).toContainText(`${counts.occupied_percent}%`);
  await expect(tabA.locator("[data-best-tag]")).toHaveText("BEST");
  await expect(tabs.filter({ hasText: /^B/ }).locator("[data-best-tag]")).toHaveCount(0);

  // A rail and a BEST tag on every level row of every run.
  const rows = layout.runs.reduce((sum, run) => sum + run.levels.length, 0);
  await expect(picture.locator("[data-rail]")).toHaveCount(rows);
  await expect(picture.locator('[data-best-tag="BEST"]')).toHaveCount(rows);
  await expect(picture.locator('[data-best="frame"]')).toHaveCount(0);

  const line = [
    `${counts.occupied_percent}% occupied`,
    `${n(counts.occupied)} of ${n(counts.locations)} locations`,
    `${n(counts.empty)} empty`,
    `${n(counts.best)} best locations (${n(counts.empty_best)} empty)`,
    `Walk Path ${n(layout.walk_path_first)}–${n(layout.walk_path_last)}`,
  ].join(" · ");
  await expect(main.locator("[data-aisle-line]")).toHaveText(line);
  await expect(main.getByText(/^79\.2% whole warehouse · 1,584 of 2,000 · 416 empty · \d[\d,]* best$/)).toBeVisible();
  await expect(picture).toContainText(`End of aisle A · Walk Path ${n(layout.walk_path_last)} →`);

  // The Key, in order.
  const key = main.getByRole("list", { name: "Key" }).getByRole("listitem");
  await expect(key).toHaveText([
    "Fast-moving",
    "Medium-moving",
    "Slow-moving",
    "Dead stock",
    "Empty",
    "Best location",
    "Selected",
    "2 parts",
  ]);

  // A fast bin is drawn in its class colour, not black.
  const fastBody = picture.locator('[data-cell][data-class="fast"][data-occupied="true"] [data-bin="fast"] > rect').first();
  await expect(fastBody).toHaveCSS("fill", "rgb(216, 81, 68)");

  await expect(main.getByRole("link", { name: "Edit best-location marks" })).toHaveAttribute(
    "href",
    `/plans/${planId}/best-locations?aisle=A`,
  );

  // Open as list: the table filtered to the aisle; Open as wall returns.
  await main.getByRole("button", { name: "Open as list" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=A&mode=list$`));
  await expect(main.getByRole("combobox", { name: "Aisle" })).toHaveValue("A");
  await expect(main.getByRole("table", { name: "Locations" }).locator("tbody tr")).toHaveCount(223);
  await main.getByRole("button", { name: "Open as wall" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=A$`));
  await expect(picture.locator("[data-cell]")).toHaveCount(223);
});

test("uj1 chooses aisle B by tab and reopens on it after a reload and another step", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const planId = (await createSamplePlan(request, `Wall tabs ${randomUUID().slice(0, 8)}`)).id;
  const wallB = await wallOf(page, planId, "B");

  await page.goto(`/plans/${planId}/locations`);
  const main = page.getByRole("main");
  const tabs = main.getByRole("tablist", { name: "Aisles" });
  await expect(main.getByRole("heading", { name: "Aisle A", level: 2 })).toBeVisible();
  const tabA = tabs.getByRole("tab").filter({ hasText: /^A/ });
  await tabA.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=B$`));
  const tabB = tabs.getByRole("tab").filter({ hasText: /^B/ });
  await expect(tabB).toBeFocused();
  await expect(tabB).toHaveAttribute("aria-selected", "true");
  await expect(tabB).toHaveAttribute("tabindex", "0");
  await expect(tabA).toHaveAttribute("tabindex", "-1");
  await expect(main.getByRole("heading", { name: "Aisle B", level: 2 })).toBeVisible();
  await expect(main.locator('[data-wall-panel="B"] [data-cell]')).toHaveCount(wallB.locations.length);

  await page.reload();
  await expect(main.getByRole("heading", { name: "Aisle B", level: 2 })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await nav.getByRole("link", { name: /^\d*Locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations$`));
  await expect(main.getByRole("heading", { name: "Aisle B", level: 2 })).toBeVisible();
  await expect(tabs.getByRole("tab", { selected: true })).toContainText("B");

  // A click works too.
  await tabs.getByRole("tab").filter({ hasText: /^C/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=C$`));
  await expect(main.getByRole("heading", { name: "Aisle C", level: 2 })).toBeVisible();
});

test("uj1 the wall follows a manual move and its undo from the part panel", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall move ${randomUUID().slice(0, 8)}`)).id;
  const wall = await wallOf(page, planId, "A");
  // A part held at exactly one location of aisle A, alone there, and an empty slot in A.
  let source: WallLocation | undefined;
  for (const entry of wall.locations.filter((row) => row.parts.length === 1)) {
    const detail = await getJson<{ current_location: { code: string } | null; other_locations: unknown[] }>(
      request,
      `/api/plans/${planId}/parts/${encodeURIComponent(entry.parts[0].part)}`,
    );
    if (detail.other_locations.length === 0 && detail.current_location?.code === entry.location.code) {
      source = entry;
      break;
    }
  }
  expect(source).toBeDefined();
  const part = source!.parts[0].part;
  const from = source!.location.code;
  const to = wall.locations.find((row) => !row.occupied)!.location.code;

  await page.goto(`/plans/${planId}/locations?aisle=A&part=${encodeURIComponent(part)}`);
  const picture = page.getByRole("main").locator('[data-wall-panel="A"]');
  const fromCell = picture.locator(`[data-cell="${from}"]`);
  const toCell = picture.locator(`[data-cell="${to}"]`);
  await expect(fromCell).toHaveAttribute("data-occupied", "true");
  await expect(toCell).toHaveAttribute("data-occupied", "false");

  const panel = page.getByRole("complementary", { name: part });
  await moveFromPanel(page, panel, part, from, to);
  await expect(fromCell).toHaveAttribute("data-occupied", "false");
  await expect(toCell).toHaveAttribute("data-occupied", "true");

  await toasts(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(fromCell).toHaveAttribute("data-occupied", "true");
  await expect(toCell).toHaveAttribute("data-occupied", "false");
});

test("uj1 tabs and Open as list keep the open part; Open as wall drops a location link", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall part ${randomUUID().slice(0, 8)}`)).id;
  const wallA = await wallOf(page, planId, "A");
  const wallB = await wallOf(page, planId, "B");
  const part = wallA.locations.find((row) => row.parts.length > 0)!.parts[0].part;
  const bCode = wallB.locations[0].location.code;
  const encoded = encodeURIComponent(part);

  await page.goto(`/plans/${planId}/locations?aisle=A&part=${encoded}`);
  const main = page.getByRole("main");
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel).toBeVisible();
  await main.getByRole("tablist", { name: "Aisles" }).getByRole("tab").filter({ hasText: /^B/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=B&part=${encoded}$`));
  await expect(panel).toBeVisible();
  await expect(main.getByRole("heading", { name: "Aisle B", level: 2 })).toBeVisible();
  await main.getByRole("button", { name: "Open as list" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=B&mode=list&part=${encoded}$`));

  await page.goto(`/plans/${planId}/locations?aisle=B&mode=list&loc=${encodeURIComponent(bCode)}`);
  await main.getByRole("button", { name: "Open as wall" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=B$`));
  await expect(main.getByRole("grid", { name: "Aisle B bin wall" })).toBeVisible();
});

// UJ-1 step 3 (Story 10.3; FR-42, UX-DR42, UX-DR43): the wall as a keyboard grid with tooltips,
// its pinned dialog, location links and recommendation links.

type WallPartFull = {
  part: string;
  description: string;
  movement_class: string;
  picks: number;
  stock: string;
  kept_in_place: boolean;
};
type WallLocationFull = {
  location: { code: string; aisle: string; level: string };
  occupied: boolean;
  parts: WallPartFull[];
};

async function fullWall(page: Page, planId: string, aisle: string) {
  return getJson<{ version: number; locations: WallLocationFull[] }>(page.request, `/api/plans/${planId}/wall?aisle=${aisle}`);
}

function occupancy(entry: WallLocationFull): string {
  if (!entry.occupied) return "Empty";
  return `Occupied · ${entry.parts.length} ${entry.parts.length === 1 ? "part" : "parts"}`;
}

async function focusedCode(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("data-grid-cell") ?? null);
}

test("uj1 navigates the wall by keyboard with one tab stop and reads each cell's tooltip", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall keys ${randomUUID().slice(0, 8)}`)).id;
  const wall = await fullWall(page, planId, "A");
  const byCode = new Map(wall.locations.map((entry) => [entry.location.code, entry]));
  const summary = await getJson<{ import_id: string }>(request, `/api/plans/${planId}`);
  const layout = (await getJson<Layout>(request, `/api/imports/${summary.import_id}/layout`)).aisles.find(
    (entry) => entry.aisle === "A",
  )!;
  const topLevels = layout.runs[0].levels.length;

  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  const grid = main.getByRole("grid", { name: "Aisle A bin wall" });
  await expect(grid).toBeVisible();
  const tabStops = grid.locator('[tabindex="0"]');
  await expect(tabStops).toHaveCount(1);
  const firstCode = await grid.locator("[data-grid-cell]").first().getAttribute("data-grid-cell");

  // Tab from Edit best-location marks lands on the wall's one tab stop: the first location.
  await main.getByRole("link", { name: "Edit best-location marks" }).focus();
  await page.keyboard.press("Tab");
  expect(await focusedCode(page)).toBe(firstCode);

  async function expectTooltip(code: string) {
    const entry = byCode.get(code)!;
    const tip = page.locator(`[data-wall-tooltip="${code}"]`);
    await expect(tip).toBeVisible();
    await expect(tip).toHaveAttribute("aria-hidden", "true");
    await expect(tip).toContainText(code);
    await expect(tip).toContainText(`Level ${entry.location.level}`);
    await expect(tip.locator("[data-tip-occupancy]")).toHaveText(occupancy(entry));
    for (const part of entry.parts) await expect(tip.locator(`[data-tip-part="${part.part}"]`)).toBeVisible();
    await expect(tabStops).toHaveCount(1);
    await expect(grid.locator(`[data-grid-cell="${code}"]`)).toHaveAttribute("tabindex", "0");
  }
  await expectTooltip(firstCode!);

  await page.keyboard.press("ArrowRight");
  const right = (await focusedCode(page))!;
  expect(right).not.toBe(firstCode);
  await expectTooltip(right);

  // ↓ past L1 of the top run lands in the bottom run.
  for (let step = 0; step < topLevels; step += 1) await page.keyboard.press("ArrowDown");
  const down = (await focusedCode(page))!;
  await expect(grid.locator(`[data-grid-run="1"] [data-grid-cell="${down}"]`)).toHaveCount(1);
  await expectTooltip(down);

  await page.keyboard.press("PageUp");
  const up = (await focusedCode(page))!;
  await expect(grid.locator(`[data-grid-run="0"] [data-grid-cell="${up}"]`)).toHaveCount(1);
  await expectTooltip(up);

  await page.keyboard.press("End");
  const end = (await focusedCode(page))!;
  const lastInRow = await grid
    .locator(`[data-grid-cell="${end}"]`)
    .evaluate((element) => {
      const row = element.closest('[role="row"]')!;
      const cells = row.querySelectorAll("[data-grid-cell]");
      return cells[cells.length - 1].getAttribute("data-grid-cell");
    });
  expect(end).toBe(lastInRow);
  await expectTooltip(end);

  await page.keyboard.press("Control+Home");
  expect(await focusedCode(page)).toBe(firstCode);
  await expectTooltip(firstCode!);

  // Tab leaves the wall: only one wall cell is in the tab order, and the tooltip goes with it.
  await page.keyboard.press("Tab");
  expect(await focusedCode(page)).toBeNull();
  await expect(page.locator("[data-wall-tooltip]")).toHaveCount(0);
});

test("uj1 a kept part's cell, Esc and Enter on a cell, and its dialog's part line", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall tip ${randomUUID().slice(0, 8)}`)).id;
  const before = await fullWall(page, planId, "A");
  const entry = before.locations.find((row) => row.parts.length === 1)!;
  const code = entry.location.code;
  const part = entry.parts[0].part;
  await postCommand(request, planId, { type: "set_keep", part });

  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  const grid = main.getByRole("grid", { name: "Aisle A bin wall" });
  const cell = grid.locator(`[data-grid-cell="${code}"]`);
  await cell.focus();
  const tip = page.locator(`[data-wall-tooltip="${code}"]`);
  await expect(tip).toBeVisible();
  const line = tip.locator(`[data-tip-part="${part}"]`);
  await expect(line).toContainText("kept in place");
  await expect(line.locator("[data-kept-in-place] svg")).toBeVisible();
  await expect(cell).toHaveAccessibleDescription(/, kept in place\./);
  await expect(cell).toHaveAccessibleName(new RegExp(`^${code}, level ${entry.location.level}, .*occupied`));

  // Esc hides the tooltip; focus stays on the cell.
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(cell).toBeFocused();

  // Enter pins it as a dialog named by the code, focus on its first action; Esc returns to the cell.
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: code });
  await expect(dialog).toBeVisible();
  await expect(cell).toHaveAttribute("aria-expanded", "true");
  const partButton = dialog.locator(`[data-tip-part="${part}"] button`);
  await expect(partButton).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Manual move…" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(cell).toBeFocused();

  // A part line opens the part panel; closing it returns focus to the cell.
  await page.keyboard.press("Enter");
  await expect(partButton).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeFocused();
  await expect(dialog).toHaveCount(0);
  await expect(cell).toHaveAttribute("data-selected", "");
  await expect(cell).toHaveAccessibleName(/, selected$/);
  await panel.getByRole("button", { name: "Close part panel" }).click();
  await expect(panel).toHaveCount(0);
  await expect(cell).toBeFocused();
});

test("uj1 a location link pins its dialog and Show recommendation opens that row", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall recs ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  const recs = await getJson<{
    recommendations: {
      id: string;
      number: number;
      status: string;
      rule: string;
      from_location: string;
      to_location: string;
    }[];
  }>(request, `/api/plans/${planId}/recommendations`);
  // A row past the first five of its rule on the Open tab: its band starts collapsed, so `?rec=`
  // must expand it and select that row rather than the first one.
  const open = recs.recommendations.filter((candidate) => candidate.status === "open");
  const row = open.find(
    (candidate) => open.filter((other) => other.rule === candidate.rule).indexOf(candidate) >= 5,
  )!;
  expect(row).toBeDefined();
  expect(open.indexOf(row)).toBeGreaterThan(0);
  const from = row.from_location;
  const fromAisle = (await getJson<{ locations: { location: { code: string; aisle: string } }[] }>(
    request,
    `/api/plans/${planId}/locations`,
  )).locations.find((candidate) => candidate.location.code === from)!.location.aisle;

  await page.goto(`/plans/${planId}/locations?aisle=${fromAisle}&loc=${encodeURIComponent(from)}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: `Aisle ${fromAisle}`, level: 2 })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: from });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("button, a[href]").first()).toBeFocused();
  const link = dialog.getByRole("link", { name: `Show recommendation #${row.number}` });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations\\?tab=open&rec=${encodeURIComponent(row.id)}$`));
  const option = page.getByRole("main").locator(`[role="option"][data-item-id="${row.id}"]`);
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await expect(option).toBeFocused();
  await expect(page.getByRole("main").locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
});

test("uj1 a location chip and a search location result open the wall with the dialog pinned", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall chip ${randomUUID().slice(0, 8)}`)).id;
  const wallC = await fullWall(page, planId, "C");
  const entry = wallC.locations.find((row) => row.parts.length > 0)!;
  const part = entry.parts[0].part;
  const detail = await getJson<{ current_location: { code: string; aisle: string } }>(
    request,
    `/api/plans/${planId}/parts/${encodeURIComponent(part)}`,
  );
  const target = detail.current_location;

  await page.goto(`/plans/${planId}/parts?part=${encodeURIComponent(part)}`);
  const panel = page.getByRole("complementary", { name: part });
  await panel.locator(`[data-location-chip="${target.code}"]`).click();
  await expect(page).toHaveURL(
    new RegExp(`/plans/${planId}/locations\\?aisle=${target.aisle}&loc=${encodeURIComponent(target.code)}$`),
  );
  const main = page.getByRole("main");
  await expect(main.getByRole("grid", { name: `Aisle ${target.aisle} bin wall` })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: target.code });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("button, a[href]").first()).toBeFocused();

  // A search location result in another aisle.
  const other = (await fullWall(page, planId, "D")).locations[0].location.code;
  const field = main.getByRole("searchbox", { name: "Search parts and locations" });
  await field.fill(other);
  await page.locator(`[data-search-location="${other}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=D&loc=${encodeURIComponent(other)}$`));
  await expect(main.getByRole("heading", { name: "Aisle D", level: 2 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: other })).toBeVisible();

  // A part opened from the search field: the wall follows it to its aisle, its cell Selected.
  expect(target.aisle).not.toBe("D");
  await field.fill(part);
  await page.locator(`[data-search-part="${part}"]`).click();
  await expect(page).toHaveURL(
    new RegExp(`/plans/${planId}/locations\\?aisle=${target.aisle}&part=${encodeURIComponent(part)}$`),
  );
  await expect(main.getByRole("heading", { name: `Aisle ${target.aisle}`, level: 2 })).toBeVisible();
  const selected = main.getByRole("grid").locator(`[data-grid-cell="${target.code}"]`);
  await expect(selected).toHaveAttribute("data-selected", "");
  await expect(selected).toHaveAttribute("tabindex", "0");
  await expect(main.locator(`[data-cell="${target.code}"] [data-selected-frame]`)).toHaveCount(1);
});

test("uj1 a deep-linked aisle and Open as wall are remembered across steps", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const planId = (await createSamplePlan(request, `Wall memory ${randomUUID().slice(0, 8)}`)).id;
  const main = page.getByRole("main");
  const nav = page.getByRole("navigation", { name: "Plan steps" });

  await page.goto(`/plans/${planId}/locations?aisle=C`);
  await expect(main.getByRole("heading", { name: "Aisle C", level: 2 })).toBeVisible();
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await nav.getByRole("link", { name: /^\d*Locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations$`));
  await expect(main.getByRole("heading", { name: "Aisle C", level: 2 })).toBeVisible();

  await page.goto(`/plans/${planId}/locations?aisle=D&mode=list`);
  await main.getByRole("button", { name: "Open as wall" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=D$`));
  await expect(main.getByRole("heading", { name: "Aisle D", level: 2 })).toBeVisible();
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await nav.getByRole("link", { name: /^\d*Locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations$`));
  await expect(main.getByRole("heading", { name: "Aisle D", level: 2 })).toBeVisible();
});

test("uj1 hover shows a cell's tooltip and the pinned Manual move… starts from that cell", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall hover ${randomUUID().slice(0, 8)}`)).id;
  const wall = await fullWall(page, planId, "A");
  // A location whose top part also has stock elsewhere and is not its current location, so the
  // move dialog has a From choice and must start on this cell rather than on the first choice.
  let code: string | undefined;
  let part: string | undefined;
  for (const entry of wall.locations.filter((row) => row.parts.length > 0)) {
    const detail = await partDetail(request, planId, entry.parts[0].part);
    const others = detail.other_locations.map((other) => other.location.code);
    if (detail.current_location?.code !== entry.location.code && others.includes(entry.location.code)) {
      code = entry.location.code;
      part = entry.parts[0].part;
      break;
    }
  }
  expect(code).toBeDefined();
  const empty = wall.locations.find((row) => !row.occupied)!.location.code;

  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  const cell = main.getByRole("grid", { name: "Aisle A bin wall" }).locator(`[data-grid-cell="${code}"]`);
  const tip = page.locator(`[data-wall-tooltip="${code}"]`);
  await cell.hover();
  await expect(tip).toBeVisible();
  // The tooltip is hoverable: the pointer can move onto it without it closing.
  await tip.hover();
  await expect(tip).toBeVisible();
  await main.getByRole("heading", { name: "Locations", level: 1 }).hover();
  await expect(tip).toHaveCount(0);

  await cell.click();
  const dialog = page.getByRole("dialog", { name: code });
  await expect(dialog).toBeVisible();
  const pinned = page.locator(`[data-wall-tooltip="${code}"][data-pinned]`);
  await dialog.getByRole("button", { name: "Manual move…" }).click();
  const move = page.getByRole("dialog", { name: `Manual move · ${part}` });
  await expect(move.getByRole("combobox", { name: "To-location" })).toBeFocused();
  await expect(move.getByLabel("From-location")).toHaveValue(code!);
  // The pinned dialog stays behind the move dialog; closing the move dialog returns to the cell.
  await expect(pinned).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(move).toHaveCount(0);
  await expect(cell).toBeFocused();
  await expect(pinned).toHaveCount(1);

  // A confirmed move started from the pinned dialog returns focus to the source cell.
  await dialog.getByRole("button", { name: "Manual move…" }).click();
  await expect(move.getByRole("combobox", { name: "To-location" })).toBeFocused();
  await expect(move.getByLabel("From-location")).toHaveValue(code!);
  await enterTarget(page, move, empty, "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(`Moved ${part}: ${code} → ${empty} (Manual, round 0).`, { exact: true })).toBeVisible();
  await expect(move).toHaveCount(0);
  await expect(cell).toBeFocused();
});

// UJ-1 with moves on the wall (Story 10.4; FR-42, UX-DR44, UX-DR46): lifted bins, targets, markers,
// the selected move's arrow and hover note, and the "Moves touching aisle" drawer.

type LocRef = { code: string; aisle: string; is_best: boolean };
type Move = {
  kind: "recommendation" | "manual";
  recommendation_id: string | null;
  number: number | null;
  move_number: number | null;
  part: string;
  status: "open" | "kept" | "applied" | "outdated" | "manual";
  from_location: LocRef;
  to_location: LocRef;
};
type MovesWall = Wall & { round: number; moves: Move[] };

async function movesWall(page: Page, planId: string, aisle: string): Promise<MovesWall> {
  return getJson<MovesWall>(page.request, `/api/plans/${planId}/wall?aisle=${aisle}`);
}

/** The first aisle with at least two open recommendations moving within it, and those moves. */
async function aisleWithInnerMoves(page: Page, planId: string): Promise<{ aisle: string; inner: Move[]; wall: MovesWall }> {
  const first = await movesWall(page, planId, "A");
  for (const { aisle } of first.aisles) {
    const wall = aisle === "A" ? first : await movesWall(page, planId, aisle);
    const inner = wall.moves.filter(
      (move) => move.status === "open" && move.from_location.aisle === aisle && move.to_location.aisle === aisle,
    );
    if (inner.length >= 2) return { aisle, inner, wall };
  }
  throw new Error("no aisle with two open moves inside it");
}

const movesDrawer = (page: Page) => page.getByRole("main").locator("[data-moves-drawer]");

test("uj1 moves on the wall: lifted bins, the drawer, linked selection and the drawer's actions", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall moves ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "level", level: "1", aisle: null } });
  await postCommand(request, planId, { type: "run" });
  const { aisle, inner, wall } = await aisleWithInnerMoves(page, planId);
  const counts = wall.aisles.find((entry) => entry.aisle === aisle)!;
  expect(counts.moves).toBe(wall.moves.length);
  const [first, second] = inner;

  await page.goto(`/plans/${planId}/locations?aisle=${aisle}`);
  const main = page.getByRole("main");
  const picture = main.locator(`[data-wall-panel="${aisle}"]`);
  const markers = main.locator("[data-wall-markers]");
  await expect(main.getByRole("grid", { name: `Aisle ${aisle} bin wall` })).toBeVisible();

  // Every open move from this wall lifts its bin with its number; its target has the same number.
  await expect(picture.locator(`[data-lifted="${first.number}"]`)).toHaveCount(1);
  await expect(picture.locator(`[data-move-target="${first.number}"]`)).toHaveCount(1);
  await expect(markers.locator(`[data-move-marker="${first.number}"]`)).toHaveCount(2);
  await expect(picture.locator("[data-move-arrow]")).toHaveCount(0);
  await expect(main.locator("[data-hover-note]")).toHaveCount(0);

  // The tab and the drawer count the same moves.
  const tab = main.getByRole("tablist", { name: "Aisles" }).getByRole("tab").filter({ hasText: new RegExp(`^${aisle}`) });
  const noun = counts.moves === 1 ? "move" : "moves";
  await expect(tab).toContainText(`${n(counts.moves)} ${noun}`);
  const drawer = movesDrawer(page);
  const toDecide = wall.moves.filter((move) => move.status === "open").length;
  await expect(drawer.getByRole("heading")).toHaveText(
    `Moves touching aisle ${aisle} · Round 1 · ${n(counts.moves)} ${noun} · ${n(toDecide)} to decide`,
  );
  await expect(drawer).toContainText("No move selected. Select a move on the wall or show all.");

  // Show all, then Enter on a row selects that move everywhere.
  await drawer.getByRole("button", { name: `Show all ${n(counts.moves)}` }).click();
  const table = drawer.getByRole("table", { name: `Moves touching aisle ${aisle}` });
  await expect(table).toBeVisible();
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(wall.moves.length);
  const index = wall.moves.indexOf(wall.moves.find((move) => move.recommendation_id === first.recommendation_id)!);
  await rows.nth(index).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`[?&]rec=${encodeURIComponent(first.recommendation_id!)}(&|$)`));
  await expect(picture.locator("[data-move-arrow]")).toHaveCount(1);
  await expect(main.locator("[data-hover-note]")).toBeVisible();
  await expect(main.locator("[data-hover-note]")).toContainText(`${first.part}`);
  await expect(rows.nth(index)).toHaveAttribute("data-selected", "");
  const grid = main.getByRole("grid", { name: `Aisle ${aisle} bin wall` });
  await expect(grid.locator(`[data-grid-cell="${first.from_location.code}"]`)).toHaveAttribute(
    "aria-label",
    new RegExp(`move ${first.number}, selected, leaves here`),
  );
  await expect(grid.locator(`[data-grid-cell="${first.to_location.code}"]`)).toHaveAttribute(
    "aria-label",
    new RegExp(`move ${first.number}, selected, arrives here`),
  );
  await expect(grid.locator("[aria-selected]")).toHaveCount(0);

  // Clicking another lifted bin selects its move in the drawer.
  await grid.locator(`[data-grid-cell="${second.from_location.code}"]`).click();
  await expect(page).toHaveURL(new RegExp(`[?&]rec=${encodeURIComponent(second.recommendation_id!)}(&|$)`));
  await expect(drawer.locator("[data-selected-move]")).toHaveAttribute("data-selected-move", second.recommendation_id!);
  await page.keyboard.press("Escape");

  // Clicking a target marker selects its move in the URL and the drawer.
  const firstMarkers = markers.locator(`[data-move-marker="${first.number}"]`);
  await expect(firstMarkers).toHaveCount(2);
  await firstMarkers.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`[?&]rec=${encodeURIComponent(first.recommendation_id!)}(&|$)`));
  await expect(drawer.locator("[data-selected-move]")).toHaveAttribute("data-selected-move", first.recommendation_id!);
  const secondIndex = wall.moves.findIndex((move) => move.recommendation_id === second.recommendation_id);
  await rows.nth(secondIndex).click();
  await expect(drawer.locator("[data-selected-move]")).toHaveAttribute("data-selected-move", second.recommendation_id!);

  // Apply from the drawer: the marker becomes the applied check at the target, with Undo in the toast.
  await drawer.locator("[data-drawer-apply]").click();
  await expect(toasts(page).getByText(new RegExp(`^Applied · move \\d+, round 1 · ${second.part} `))).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
  await expect(drawer.locator("[data-move-status]")).toHaveText(/^Applied · move \d+$/);
  await expect(grid.locator(`[data-grid-cell="${second.to_location.code}"]`)).toHaveAttribute(
    "aria-label",
    new RegExp(`move ${second.number} applied, selected, arrived here`),
  );
  await expect(picture.locator(`[data-lifted="${second.number}"]`)).toHaveCount(0);
  await expect(markers.locator('[data-move-marker="applied"][data-selected]')).toHaveCount(1);

  // Keep in place from the drawer on the first move.
  await rows.nth(index).click();
  await expect(page).toHaveURL(new RegExp(`[?&]rec=${encodeURIComponent(first.recommendation_id!)}(&|$)`));
  await drawer.getByRole("button", { name: "Keep in place" }).click();
  await expect(toasts(page).getByText(`${first.part} is kept in place.`, { exact: false })).toBeVisible();
  await expect(drawer.locator("[data-move-status]")).toHaveText("Kept in place");
  await drawer.getByRole("button", { name: "Remove keep in place" }).click();
  await expect(drawer.locator("[data-move-status]")).toHaveText("To decide");

  // Other location ▾ from the drawer applies to the chosen location.
  await drawer.getByRole("button", { name: "Other location" }).click();
  const listbox = page.getByRole("listbox", { name: "Other locations" });
  await expect(listbox).toBeFocused();
  await expect(listbox.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(new RegExp(`^Applied · move \\d+, round 1 · ${first.part} `))).toBeVisible();
  await expect(drawer.locator("[data-move-status]")).toHaveText(/^Applied · move \d+$/);

  // Apply in the open table's row of another move still open now applies that move.
  const now = await movesWall(page, planId, aisle);
  const third = now.moves.find(
    (move) =>
      move.status === "open" &&
      move.part !== first.part &&
      move.part !== second.part &&
      move.recommendation_id !== first.recommendation_id &&
      move.recommendation_id !== second.recommendation_id,
  )!;
  expect(third).toBeDefined();
  const thirdRow = rows.nth(now.moves.indexOf(third));
  await thirdRow.getByRole("button", { name: "Apply" }).click();
  await expect(toasts(page).getByText(new RegExp(`^Applied · move \\d+, round 1 · ${third.part} `))).toBeVisible();
  await expect(thirdRow).toContainText(/Applied · move \d+/);
});

test("uj1 a manual move carries M on the wall and counts on its tab", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall manual ${randomUUID().slice(0, 8)}`)).id;
  const wall = await wallOf(page, planId, "A");
  let source: WallLocation | undefined;
  for (const entry of wall.locations.filter((row) => row.parts.length === 1)) {
    const detail = await partDetail(request, planId, entry.parts[0].part);
    if (detail.other_locations.length === 0 && detail.current_location?.code === entry.location.code) {
      source = entry;
      break;
    }
  }
  expect(source).toBeDefined();
  const part = source!.parts[0].part;
  const from = source!.location.code;
  const to = wall.locations.find((row) => !row.occupied)!.location.code;

  await page.goto(`/plans/${planId}/locations?aisle=A&part=${encodeURIComponent(part)}`);
  const main = page.getByRole("main");
  const tab = main.getByRole("tablist", { name: "Aisles" }).getByRole("tab").filter({ hasText: /^A/ });
  await expect(tab).toContainText("0 moves");
  await expect(movesDrawer(page)).toContainText("No moves touch aisle A.");
  await moveFromPanel(page, page.getByRole("complementary", { name: part }), part, from, to);

  const markers = main.locator("[data-wall-markers]");
  await expect(markers.locator('[data-move-marker="M"]')).toHaveCount(1);
  await expect(tab).toContainText("1 move");
  await expect(movesDrawer(page).getByRole("heading")).toHaveText("Moves touching aisle A · Round 0 · 1 move · 0 to decide");
  const grid = main.getByRole("grid", { name: "Aisle A bin wall" });
  await expect(grid.locator(`[data-grid-cell="${to}"]`)).toHaveAttribute("aria-label", /manual move, arrived here$/);

  // Selecting it by its row links `?move=`.
  await movesDrawer(page).getByRole("button", { name: "Show all 1" }).click();
  await movesDrawer(page).locator("tbody tr").first().click();
  await expect(page).toHaveURL(/[?&]move=1(&|$)/);
  await expect(markers.locator('[data-move-marker="M"][data-selected]')).toHaveCount(1);
});

test("uj1 an outdated recommendation shows the grey marker and no lift", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Wall outdated ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "level", level: "1", aisle: null } });
  await postCommand(request, planId, { type: "run" });
  const { aisle, inner, wall } = await aisleWithInnerMoves(page, planId);
  const rec = inner[0];
  // Fill its target with another part of the aisle by a manual move: the recommendation outdates.
  const filler = wall.locations.find(
    (row) =>
      row.parts.length === 1 &&
      row.parts[0].part !== rec.part &&
      !wall.moves.some((move) => move.from_location.code === row.location.code),
  )!;
  await postCommand(request, planId, {
    type: "manual_move",
    part: filler.parts[0].part,
    from: filler.location.code,
    to: rec.to_location.code,
  });
  const after = await movesWall(page, planId, aisle);
  expect(after.moves.find((move) => move.recommendation_id === rec.recommendation_id)!.status).toBe("outdated");

  await page.goto(`/plans/${planId}/locations?aisle=${aisle}&rec=${encodeURIComponent(rec.recommendation_id!)}`);
  const main = page.getByRole("main");
  const picture = main.locator(`[data-wall-panel="${aisle}"]`);
  await expect(main.getByRole("grid", { name: `Aisle ${aisle} bin wall` })).toBeVisible();
  await expect(picture.locator(`[data-move-outdated="${rec.number}"]`)).toHaveCount(1);
  await expect(picture.locator(`[data-lifted="${rec.number}"]`)).toHaveCount(0);
  await expect(picture.locator(`[data-move-target="${rec.number}"]`)).toHaveCount(0);
  await expect(main.locator(`[data-wall-markers] [data-move-marker="${rec.number}"]`)).toHaveAttribute(
    "data-marker-kind",
    "selected",
  );
  // With its row at the same version, the status names the cause.
  await expect(movesDrawer(page).locator("[data-move-status]")).toHaveText(
    `Outdated · ${rec.to_location.code} was filled by a manual move.`,
  );
  await expect(movesDrawer(page).locator("[data-drawer-apply]")).toHaveCount(0);
  await expect(
    main.getByRole("grid").locator(`[data-grid-cell="${rec.from_location.code}"]`),
  ).toHaveAttribute("aria-label", new RegExp(`move ${rec.number} outdated, selected$`));

  // An unknown `?rec=` selects nothing.
  await page.goto(`/plans/${planId}/locations?aisle=${aisle}&rec=nope`);
  await expect(main.getByRole("grid", { name: `Aisle ${aisle} bin wall` })).toBeVisible();
  await expect(picture.locator("[data-move-arrow]")).toHaveCount(0);
  await expect(movesDrawer(page)).toContainText("No move selected.");
});
