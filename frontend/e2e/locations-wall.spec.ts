import { randomUUID } from "node:crypto";

import { expect, type Page, test, toasts } from "./support/test";

import { getJson, moveFromPanel, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1: the Locations step opens the open aisle as a bin wall with its Key (Story 10.2; FR-42,
// FR-14, FR-22, UX-DR40/41/45/48). Aisle tabs, Open as list / Open as wall, the stored aisle and
// the wall following a manual move and its undo.

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
  const picture = main.getByRole("img", { name: "Bin wall of aisle A. Open as list reads every location as text." });
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
  await expect(main.getByRole("img", { name: /^Bin wall of aisle B\./ }).locator("[data-cell]")).toHaveCount(
    wallB.locations.length,
  );

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
  const picture = page.getByRole("main").getByRole("img", { name: /^Bin wall of aisle A\./ });
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

  await page.goto(`/plans/${planId}/locations?aisle=B&loc=${encodeURIComponent(bCode)}`);
  await main.getByRole("button", { name: "Open as wall" }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=B$`));
  await expect(main.getByRole("img", { name: /^Bin wall of aisle B\./ })).toBeVisible();
});
