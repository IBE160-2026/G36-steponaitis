import { randomUUID } from "node:crypto";

import { expect, type Locator, test } from "./support/test";

import { getJson, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1: the Locations wall's Whole warehouse scope (Story 10.6; FR-42, UX-DR45/58, AD-15). The
// One aisle | Whole warehouse control, four figures, nine aisle cards with mini-walls, the selected
// move as one route across cards, the stored scope, a card opening its aisle and the responsive grid.

type Counts = { aisle: string; aisle_marked: boolean };
type Warehouse = {
  run: { round: number; recommendations: number } | null;
  moves: {
    kind: string;
    recommendation_id: string | null;
    part: string;
    from_location: { code: string; aisle: string };
    to_location: { code: string; aisle: string };
  }[];
  aisles: Counts[];
  warehouse: { empty: number; occupied_percent: string; best: number; empty_best: number };
};

const n = (value: number | string) => Number(value).toLocaleString("en-US");

/** The number of distinct card rows' columns: cards sharing the first card's top edge. */
async function columns(cards: Locator): Promise<number> {
  const tops = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  return tops.filter((top) => Math.abs(top - tops[0]) < 1).length;
}

test("uj1 whole warehouse shows four figures, nine aisle cards and the selected move as one route", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Warehouse ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  const view = await getJson<Warehouse>(request, `/api/plans/${planId}/warehouse`);
  expect(view.run?.round).toBe(1);
  const found = view.moves.find(
    (move) => move.kind === "recommendation" && move.from_location.aisle !== move.to_location.aisle,
  );
  expect(found).toBeDefined();
  if (found === undefined || found.recommendation_id === null) throw new Error("no cross-aisle recommendation");
  const cross = found;
  const recId = found.recommendation_id;

  await page.goto(`/plans/${planId}/locations?aisle=${cross.from_location.aisle}&rec=${cross.recommendation_id}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("grid", { name: `Aisle ${cross.from_location.aisle} bin wall` })).toBeVisible();
  const control = main.getByRole("radiogroup", { name: "Locations view" });
  const oneAisle = control.getByRole("radio", { name: "One aisle" });
  await expect(oneAisle).toHaveAttribute("aria-checked", "true");
  await oneAisle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(control.getByRole("radio", { name: "Whole warehouse" })).toHaveAttribute("aria-checked", "true");

  // The four figures, as the API counts them.
  const figures = main.locator("[data-warehouse-figure]");
  await expect(figures).toHaveText([
    `${view.warehouse.occupied_percent}% occupied`,
    `${n(view.warehouse.empty)} empty locations`,
    `${n(view.warehouse.best)} best locations · ${n(view.warehouse.empty_best)} of them empty`,
    `${n(view.run!.recommendations)} recommendations in round ${view.run!.round}`,
  ]);
  // Nine cards A–I in three columns; A carries its BEST tag; each has a decorative mini-wall.
  const cards = main.locator("[data-aisle-card]");
  await expect(cards).toHaveCount(9);
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-aisle-card")))).toEqual(
    [..."ABCDEFGHI"],
  );
  expect(await columns(cards)).toBe(3);
  await expect(main.locator('[data-aisle-card="A"] [data-best-tag]')).toHaveText("BEST");
  await expect(main.locator('[data-aisle-card="B"] [data-best-tag]')).toHaveCount(0);
  await expect(main.locator('[data-aisle-card="A"] [data-mini-wall]')).toHaveAttribute("aria-hidden", "true");
  // The selected cross-aisle move: one route, named in text.
  await expect(main.locator("[data-warehouse-route]")).toHaveCount(1);
  await expect(main.locator("[data-warehouse-route]")).toHaveAttribute("aria-hidden", "true");
  await expect(main.locator("[data-selected-move]")).toHaveText(
    `Selected move: ${cross.part} · ${cross.from_location.code} → ${cross.to_location.code}`,
  );
  await expect(page).toHaveURL(new RegExp(`/locations\\?rec=${encodeURIComponent(recId)}$`));

  // The scope is stored: a reload without `?aisle=` stays on Whole warehouse.
  await page.reload();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await expect(control.getByRole("radio", { name: "Whole warehouse" })).toHaveAttribute("aria-checked", "true");

  // A card opens its aisle and keeps `?rec=`; the whole-warehouse figure button returns.
  const toAisle = cross.to_location.aisle;
  await main.locator(`[data-aisle-card="${toAisle}"]`).click();
  await expect(main.locator(`[data-aisle-tab="${toAisle}"]`)).toHaveAttribute("aria-selected", "true");
  await expect(main.getByRole("grid", { name: `Aisle ${toAisle} bin wall` })).toBeVisible();
  await expect(oneAisle).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(new RegExp(`[?&]aisle=${toAisle}(&|$)`));
  await expect(page).toHaveURL(new RegExp(`[?&]rec=${encodeURIComponent(recId)}(&|$)`));
  await main.locator("[data-whole-warehouse]").click();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await expect(control.getByRole("radio", { name: "Whole warehouse" })).toBeFocused();

  // Leaving through the header control: ArrowLeft opens One aisle, focus stays on the control,
  // and a reload stays on One aisle.
  await control.getByRole("radio", { name: "Whole warehouse" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(main.getByRole("grid", { name: `Aisle ${toAisle} bin wall` })).toBeVisible();
  await expect(page).toHaveURL(/[?&]aisle=/);
  await expect(oneAisle).toBeFocused();
  await page.reload();
  await expect(main.getByRole("grid", { name: `Aisle ${toAisle} bin wall` })).toBeVisible();
  await expect(oneAisle).toHaveAttribute("aria-checked", "true");

  // A deep link with `?aisle=` wins over a stored Whole warehouse and stores One aisle.
  await main.locator("[data-whole-warehouse]").click();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await page.goto(`/plans/${planId}/locations?aisle=C`);
  await expect(main.getByRole("grid", { name: "Aisle C bin wall" })).toBeVisible();
  await page.goto(`/plans/${planId}/locations`);
  await expect(main.getByRole("grid", { name: "Aisle C bin wall" })).toBeVisible();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(0);

  // An unknown `?rec=` in Whole warehouse: no route and no selected-move line.
  await main.locator("[data-whole-warehouse]").click();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await page.goto(`/plans/${planId}/locations?rec=nope`);
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await expect(main.locator("[data-warehouse-route]")).toHaveCount(0);
  await expect(main.locator("[data-selected-move]")).toHaveCount(0);

  // Two columns at 1100px, one at 900px, and never a sideways page scroll.
  for (const [width, expected] of [
    [1100, 2],
    [900, 1],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => columns(cards)).toBe(expected);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test("uj1 whole warehouse shows a load error when the warehouse view fails", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Warehouse error ${randomUUID().slice(0, 8)}`)).id;
  await page.route(`**/api/plans/${planId}/warehouse`, (route) =>
    route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }),
  );

  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  await expect(main.getByRole("grid", { name: "Aisle A bin wall" })).toBeVisible();
  await main.locator("[data-whole-warehouse]").click();
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(0);
});
