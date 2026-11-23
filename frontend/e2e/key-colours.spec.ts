import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "./support/test";

import {
  DEFAULT_FAST_RGB,
  DEFAULT_SLOW,
  DEFAULT_SLOW_RGB,
  expectSlowBin,
  printOffenders,
  rootSlow,
  SHADE_6,
  SHADE_6_RGB,
} from "./support/colours";
import { getJson, planVersion, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-4 (FR-42, SM-7, Story 11.2): a Key colour kept in this browser. Slow-moving shade 6
// (`#378CBE`) is stored in `swp:colours` before the first load; the boot script in <head> sets it
// on <html> before first paint, and every wall, the Key swatch, the mini-walls and the crops draw
// slow bins in it, also after a reload. The ▼ glyph does not change, the plan version does not
// change, nothing about colours reaches the server, the print view has no trace of it, and an
// invalid stored value falls back to the default. Story 11.3 (second test) changes the colour from
// the Key's colour popover.

type WallMove = { recommendation_id: string | null; status: string };

/** The slow bins of the recommendation detail's crops: every one in `fill`, fast ones unchanged. */
async function expectCropSlowBins(main: Locator, fill: string, hex: string) {
  const crops = main.getByRole("region", { name: "Selected recommendation" }).locator("[data-crops]");
  await expect(crops.locator("[data-bin]").first()).toBeVisible();
  const drawn = await crops.evaluate((element) => ({
    token: getComputedStyle(element).getPropertyValue("--color-class-slow").trim(),
    bins: [...element.querySelectorAll("[data-bin]")].map((bin) => ({
      movementClass: bin.getAttribute("data-bin"),
      fill: getComputedStyle(bin.querySelector(":scope > rect")!).fill,
    })),
  }));
  expect(drawn.token.toUpperCase()).toBe(hex);
  expect(drawn.bins.length).toBeGreaterThan(0);
  for (const bin of drawn.bins.filter((entry) => entry.movementClass === "slow")) expect(bin.fill).toBe(fill);
  for (const bin of drawn.bins.filter((entry) => entry.movementClass === "fast")) expect(bin.fill).toBe(DEFAULT_FAST_RGB);
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
  await expectCropSlowBins(main, SHADE_6_RGB, SHADE_6);

  // The print view (the applied moves) in print media: nothing visible is drawn in the stored colour.
  expect(await planVersion(request, planId)).toBe(version);
  const applied = await postCommand(request, planId, { type: "apply_all" });
  expect(applied.events[0]?.type).toBe("apply_all_done");
  version = applied.version;
  await page.goto(`/plans/${planId}/print`);
  await expect(main.locator("[data-move-line]").first()).toBeVisible();
  expect(await printOffenders(page, SHADE_6_RGB)).toEqual([]);

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

const SHADE_1 = "#98C6E1";
const SHADE_1_RGB = "rgb(152, 198, 225)";
const SHADE_2 = "#5EB5E9";

async function storedColours(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("swp:colours"));
}

test("uj4 fr42 change Slow-moving to shade 6 from the Key, preview, Esc, Done, reload, reset and blocked storage", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Key colours ${randomUUID().slice(0, 8)}`)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  let version = await planVersion(request, planId);

  const sent: string[] = [];
  page.on("request", (req) => sent.push(`${req.method()} ${req.url()} ${req.postData() ?? ""}`));

  await page.goto(`/plans/${planId}/locations?aisle=A`);
  const main = page.getByRole("main");
  const picture = main.locator('[data-wall-panel="A"]');
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  expect(await storedColours(page)).toBeNull();

  // The Key entry opens a non-modal dialog above it, the default shade checked and focused.
  const entry = main.getByRole("button", { name: "Slow-moving, change colour" });
  await expect(entry).toHaveAttribute("aria-haspopup", "dialog");
  await expect(entry).toHaveAttribute("aria-expanded", "false");
  await entry.click();
  await expect(entry).toHaveAttribute("aria-expanded", "true");
  const dialog = page.getByRole("dialog", { name: "Slow-moving colour" });
  await expect(dialog).toBeVisible();
  const radios = dialog.getByRole("radiogroup").getByRole("radio");
  await expect(radios).toHaveCount(8);
  const fallback = dialog.getByRole("radio", { name: "Default", exact: true });
  await expect(fallback).toBeChecked();
  await expect(fallback).toBeFocused();
  await expect(dialog.getByRole("status")).toHaveText("");
  await expect(dialog).not.toContainText("Colours can't be kept");
  const entryBox = await entry.boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(entryBox!.y);

  // Done with nothing changed keeps nothing: no write, no announcement, focus back on the entry.
  const announcer = main.locator("[data-key-announcer]");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await expect(announcer).toHaveText("");
  expect(await storedColours(page)).toBeNull();

  // Space opens it again.
  await page.keyboard.press("Space");
  await expect(dialog).toBeVisible();
  await expect(fallback).toBeFocused();

  // ArrowRight moves to the next shade (from the last, the first) and previews it on the wall only.
  await page.keyboard.press("ArrowRight");
  const shade1 = dialog.getByRole("radio", { name: "Slow-moving shade 1 of 8" });
  await expect(shade1).toBeChecked();
  await expect(shade1).toBeFocused();
  await expect.poll(() => rootSlow(page)).toBe(SHADE_1);
  await expectSlowBin(picture, SHADE_1_RGB);
  expect(await storedColours(page)).toBeNull();

  // Esc, also from the hex field, restores the colour from when it opened, stores nothing and
  // returns focus to the entry (the field does not take the Esc to clear itself first).
  const hex = dialog.getByRole("textbox", { name: "Colour code" });
  await hex.focus();
  await expect(hex).toHaveValue(SHADE_1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  expect(await rootSlow(page)).toBe(DEFAULT_SLOW);
  await expectSlowBin(picture, DEFAULT_SLOW_RGB);
  expect(await storedColours(page)).toBeNull();

  // Reopen with Enter; the native picker previews (uppercase); pick shade 6; an invalid hex is
  // marked; a dark one warns.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-colour-picker]").fill(SHADE_2.toLowerCase());
  await expect.poll(() => rootSlow(page)).toBe(SHADE_2);
  await expect(hex).toHaveValue(SHADE_2);
  const shade6 = dialog.getByRole("radio", { name: "Slow-moving shade 6 of 8" });
  await shade6.click();
  await expect(shade6).toBeChecked();
  await expect.poll(() => rootSlow(page)).toBe(SHADE_6);
  await expect(hex).toHaveValue(SHADE_6);
  await hex.fill("#12345");
  await expect(hex).toHaveAttribute("aria-invalid", "true");
  await expect(dialog).toContainText("Enter a colour as #RRGGBB");
  expect(await rootSlow(page)).toBe(SHADE_6);
  await hex.fill("#222222");
  await expect(hex).not.toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => rootSlow(page)).toBe("#222222");
  await expect(radios.and(page.locator('[aria-checked="true"]'))).toHaveCount(0);
  const status = dialog.getByRole("status");
  await expect(status).toContainText("Slow-moving on the wall: 1.2:1 (3:1 or more recommended)");
  await expect(status).toContainText("Slow-moving on an open slot: 1.1:1 (3:1 or more recommended)");
  const describedBy = (await hex.getAttribute("aria-describedby")) ?? "";
  expect(describedBy.split(" ")).toContain(await status.getAttribute("id"));

  // A failing colour can still be kept; reopened, no preset is checked and focus starts on the hex field.
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe("#222222");
  await entry.click();
  await expect(dialog).toBeVisible();
  await expect(hex).toBeFocused();
  await expect(hex).toHaveValue("#222222");
  await expect(radios.and(page.locator('[aria-checked="true"]'))).toHaveCount(0);
  await expect(status).toContainText("Slow-moving on the wall: 1.2:1 (3:1 or more recommended)");
  await shade6.click();
  await expect(status).toHaveText("");
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe("#222222");

  // Done keeps and stores it, announces the change and returns focus to the entry.
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await expect(announcer).toHaveText("Slow-moving colour changed");
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe(SHADE_6);
  await expectSlowBin(picture, SHADE_6_RGB);

  // After a reload: the wall, the Key swatch, the mini-walls and the crops draw shade 6, ▼ unchanged.
  await page.reload();
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  expect(await rootSlow(page)).toBe(SHADE_6);
  await expectSlowBin(picture, SHADE_6_RGB);
  await expectSlowBin(main.locator('[data-key-swatch="slow"]'), SHADE_6_RGB);
  await main.getByRole("radiogroup", { name: "Locations view" }).getByRole("radio", { name: "Whole warehouse" }).click();
  await expect(main.locator("[data-aisle-card]")).toHaveCount(9);
  await expect(main.locator('[data-mini-cell="slow"] > rect').first()).toHaveCSS("fill", SHADE_6_RGB);
  const wall = await getJson<{ moves: WallMove[] }>(request, `/api/plans/${planId}/wall?aisle=A`);
  const open = wall.moves.find((move) => move.status === "open" && move.recommendation_id !== null);
  expect(open, "an open recommendation touching aisle A").toBeDefined();
  await page.goto(`/plans/${planId}/recommendations?tab=open&rec=${encodeURIComponent(open!.recommendation_id!)}`);
  await expectCropSlowBins(main, SHADE_6_RGB, SHADE_6);

  // The print preview has no trace of the colour.
  expect(await planVersion(request, planId)).toBe(version);
  const applied = await postCommand(request, planId, { type: "apply_all" });
  expect(applied.events[0]?.type).toBe("apply_all_done");
  version = applied.version;
  await page.goto(`/plans/${planId}/print`);
  await expect(main.locator("[data-move-line]").first()).toBeVisible();
  expect(await printOffenders(page, SHADE_6_RGB)).toEqual([]);

  // Reset this colour and Done bring the default back.
  await page.goto(`/plans/${planId}/locations?aisle=A`);
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  await entry.click();
  await expect(shade6).toBeChecked();
  await dialog.getByRole("button", { name: "Reset this colour" }).click();
  await expect(fallback).toBeChecked();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe(DEFAULT_SLOW);
  await expectSlowBin(picture, DEFAULT_SLOW_RGB);

  // Best location: a kept shade carries a derived paper shade; Reset this colour restores both defaults.
  const best = main.getByRole("button", { name: "Best location, change colour" });
  const bestDialog = page.getByRole("dialog", { name: "Best location colour" });
  await best.click();
  await bestDialog.getByRole("radio", { name: "Best location shade 1 of 8" }).click();
  await bestDialog.getByRole("button", { name: "Done" }).click();
  await expect(bestDialog).toBeHidden();
  let kept = JSON.parse((await storedColours(page)) ?? "{}");
  expect(kept.best).toBe("#9AE0A5");
  expect(kept["best-on-light"]).not.toBe("#267A4B");
  await best.click();
  await bestDialog.getByRole("button", { name: "Reset this colour" }).click();
  await bestDialog.getByRole("button", { name: "Done" }).click();
  await expect(bestDialog).toBeHidden();
  kept = JSON.parse((await storedColours(page)) ?? "{}");
  expect(kept.best).toBe("#3DAE6B");
  expect(kept["best-on-light"]).toBe("#267A4B");
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--colour-best-on-light"))).toBe("#267A4B");

  // A click outside keeps the pick too: stored, announced, focus back on the entry.
  await entry.click();
  await dialog.getByRole("radio", { name: "Slow-moving shade 2 of 8" }).click();
  await expect.poll(() => rootSlow(page)).toBe(SHADE_2);
  await main.getByRole("heading", { level: 1, name: "Locations" }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await expect(announcer).toHaveText("Slow-moving colour changed");
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe(SHADE_2);

  // At 200% zoom (640 × 450) the popover stays inside the viewport.
  await page.setViewportSize({ width: 640, height: 450 });
  await entry.scrollIntoViewIfNeeded();
  await entry.click();
  await expect(dialog).toBeVisible();
  const zoomed = await dialog.boundingBox();
  expect(zoomed!.x).toBeGreaterThanOrEqual(0);
  expect(zoomed!.y).toBeGreaterThanOrEqual(0);
  expect(zoomed!.x + zoomed!.width).toBeLessThanOrEqual(640);
  expect(zoomed!.y + zoomed!.height).toBeLessThanOrEqual(450);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Storage that cannot be written: the change still applies, and the popover says it is not kept.
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "QuotaExceededError");
    };
  });
  await page.reload();
  await expect(picture.locator("[data-cell]").first()).toBeVisible();
  await entry.click();
  await dialog.getByRole("radio", { name: "Slow-moving shade 6 of 8" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  expect(await rootSlow(page)).toBe(SHADE_6);
  await expectSlowBin(picture, SHADE_6_RGB);
  expect(JSON.parse((await storedColours(page)) ?? "{}").slow).toBe(SHADE_2);
  await entry.click();
  await expect(dialog).toContainText(
    "Colours can't be kept in this browser; changes last until you reload or close this page.",
  );
  await page.keyboard.press("Escape");

  // The plan is untouched and nothing about colours went to the server.
  expect(await planVersion(request, planId)).toBe(version);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.filter((line) => /378CBE|98C6E1|5EB5E9|222222|9AE0A5|swp:colours|swp%3Acolours/i.test(line))).toEqual([]);
});
