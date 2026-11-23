import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "./support/test";

import { getJson, planVersion, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-4 (FR-42, SM-7, Story 11.2): a Key colour kept in this browser. Slow-moving shade 6
// (`#378CBE`) is stored in `swp:colours` before the first load; the boot script in <head> sets it
// on <html> before first paint, and every wall, the Key swatch, the mini-walls and the crops draw
// slow bins in it, also after a reload. The ▼ glyph does not change, the plan version does not
// change, nothing about colours reaches the server, the print view has no trace of it, and an
// invalid stored value falls back to the default. Story 11.3 adds the Key buttons and popover.

const SHADE_6 = "#378CBE";
const SHADE_6_RGB = "rgb(55, 140, 190)";
const DEFAULT_SLOW_RGB = "rgb(65, 125, 220)";
const DEFAULT_FAST_RGB = "rgb(216, 81, 68)";
const GLYPH_RGB = "rgb(27, 30, 34)";
const SLOW_GLYPH_PATH = "M5 9.2 L9.6 0.8 H0.4 Z";

type WallMove = { recommendation_id: string | null; status: string };

/** The fill of the first slow bin body under `scope`, and its ▼ glyph. */
async function expectSlowBin(scope: Locator, fill: string) {
  const bin = scope.locator('[data-bin="slow"]').first();
  await expect(bin.locator("> rect").first()).toHaveCSS("fill", fill);
  const glyph = bin.locator('svg[data-class="slow"]').first();
  await expect(glyph).toHaveCSS("color", GLYPH_RGB);
  await expect(glyph.locator("path")).toHaveAttribute("d", SLOW_GLYPH_PATH);
}

async function rootSlow(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.style.getPropertyValue("--colour-slow"));
}

test("uj4 fr42 a stored Slow-moving colour paints every wall from first load, survives a reload and stays in the browser", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Colours ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  let version = await planVersion(request, planId);

  // The served HTML carries the boot script in <head>.
  const html = await (await request.get(`/plans/${planId}/locations?aisle=A`)).text();
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toContain('localStorage.getItem("swp:colours")');
  expect(head).toContain("--colour-");

  // Every request the browser sends from here on; none may carry the colour or its storage key.
  const sent: string[] = [];
  page.on("request", (req) => sent.push(`${req.method()} ${req.url()} ${req.postData() ?? ""}`));

  // Stored once, before the first load (a reload keeps what is stored, it does not store again).
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
      // What the boot script set by the time <body> is parsed, before any app script runs.
      // The init script runs before <html> exists, so watch the document itself.
      const observer = new MutationObserver(() => {
        if (document.body === null) return;
        const slow = document.documentElement.style.getPropertyValue("--colour-slow");
        (window as unknown as { slowAtBody?: string }).slowAtBody = slow;
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    },
    ["swp:colours", JSON.stringify({ slow: SHADE_6 })],
  );

  // The Locations wall: slow bins and the Key swatch in shade 6, ▼ unchanged, fast unchanged.
  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  const picture = main.locator('[data-wall-panel="A"]');
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  expect(await rootSlow(page)).toBe(SHADE_6);
  expect(await page.evaluate(() => (window as unknown as { slowAtBody?: string }).slowAtBody)).toBe(SHADE_6);
  await expectSlowBin(picture, SHADE_6_RGB);
  await expect(picture.locator('[data-bin="fast"] > rect').first()).toHaveCSS("fill", DEFAULT_FAST_RGB);
  await expectSlowBin(main.locator('[data-key-swatch="slow"]'), SHADE_6_RGB);

  // A reload keeps it.
  await page.reload();
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  expect(await rootSlow(page)).toBe(SHADE_6);
  await expectSlowBin(picture, SHADE_6_RGB);
  await expectSlowBin(main.locator('[data-key-swatch="slow"]'), SHADE_6_RGB);

  // The whole-warehouse mini-walls.
  await main.getByRole("radiogroup", { name: "Locations view" }).getByRole("radio", { name: "Whole warehouse" }).click();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await expect(main.locator('[data-mini-cell="slow"] > rect').first()).toHaveCSS("fill", SHADE_6_RGB);

  // The wall crops in the recommendation detail: every slow bin in shade 6, the rest unchanged.
  const wall = await getJson<{ moves: WallMove[] }>(request, `/api/plans/${planId}/wall?aisle=A`);
  const open = wall.moves.find((move) => move.status === "open" && move.recommendation_id !== null);
  expect(open, "an open recommendation touching aisle A").toBeDefined();
  await page.goto(`/plans/${planId}/recommendations?tab=open&rec=${encodeURIComponent(open!.recommendation_id!)}`);
  const crops = main.getByRole("region", { name: "Selected recommendation" }).locator("[data-crops]");
  await expect(crops.locator("[data-bin]").first()).toBeVisible();
  const drawn = await crops.evaluate((element) => ({
    token: getComputedStyle(element).getPropertyValue("--color-class-slow").trim(),
    bins: [...element.querySelectorAll("[data-bin]")].map((bin) => ({
      movementClass: bin.getAttribute("data-bin"),
      fill: getComputedStyle(bin.querySelector(":scope > rect")!).fill,
    })),
  }));
  expect(drawn.token.toUpperCase()).toBe(SHADE_6);
  expect(drawn.bins.length).toBeGreaterThan(0);
  for (const bin of drawn.bins.filter((entry) => entry.movementClass === "slow")) expect(bin.fill).toBe(SHADE_6_RGB);
  for (const bin of drawn.bins.filter((entry) => entry.movementClass === "fast")) expect(bin.fill).toBe(DEFAULT_FAST_RGB);

  // The print view (the applied moves) in print media: nothing visible is drawn in the stored colour.
  expect(await planVersion(request, planId)).toBe(version);
  const applied = await postCommand(request, planId, { type: "apply_all" });
  expect(applied.events[0]?.type).toBe("apply_all_done");
  version = applied.version;
  await page.goto(`/plans/${planId}/print`);
  await expect(main.locator("[data-move-line]").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const offenders = await page.evaluate((rgb) => {
    const found: string[] = [];
    for (const element of document.querySelectorAll("*")) {
      if (!element.checkVisibility()) continue;
      const style = getComputedStyle(element);
      const values = [style.color, style.backgroundColor, style.fill, style.stroke, style.borderTopColor, style.borderBottomColor];
      if (values.includes(rgb)) found.push(`${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`);
    }
    return found;
  }, SHADE_6_RGB);
  expect(offenders).toEqual([]);
  await page.emulateMedia({ media: "screen" });

  // An invalid stored value is ignored: the default slow comes back.
  await page.evaluate(() => window.localStorage.setItem("swp:colours", JSON.stringify({ slow: "blue", fast: "#D8514" })));
  await page.goto(`/plans/${planId}/locations?aisle=A`);
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  expect(await rootSlow(page)).toBe("");
  await expectSlowBin(picture, DEFAULT_SLOW_RGB);
  await expect(picture.locator('[data-bin="fast"] > rect').first()).toHaveCSS("fill", DEFAULT_FAST_RGB);

  // The plan is untouched and nothing about colours went to the server.
  expect(await planVersion(request, planId)).toBe(version);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.filter((line) => /378CBE|swp:colours|swp%3Acolours/i.test(line))).toEqual([]);
});
