import { expect, type Page, test } from "./support/test";

// UJ-1: the planner opens the app shell with no plan open (Story 1.4, UX-DR1/2/4/6/57/58).
// `/` redirects to a plan since Story 1.9, so these open New Plan, which has no plan.

const STEPS = [
  "Overview",
  "Parts",
  "Locations",
  "Pick groups",
  "Best locations",
  "Recommendations",
  "Before/after",
  "Move list",
];

function stepNames(texts: string[]): string[] {
  return texts.map((text) => text.replace(/^\d+/, "").replace(/, step \d+(, done)?$/, "").trim());
}

async function toolbarPosition(page: Page): Promise<string> {
  return page.getByRole("banner").evaluate((el) => getComputedStyle(el).position);
}

test.describe("uj1 opens the app shell with the eight-step flow bar", () => {
  test("uj1 shows the toolbar, product name and eight steps with no plan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/plans/new");

    const banner = page.getByRole("banner");
    const box = await banner.boundingBox();
    expect(box?.height).toBe(64);
    const background = await banner.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).toBe("rgb(38, 42, 46)");

    await expect(banner.locator("svg").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Smart Warehouse Planner" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Plan steps" });
    const items = nav.getByRole("listitem");
    await expect(items).toHaveCount(8);
    expect(stepNames(await items.allTextContents())).toEqual(STEPS);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await expect(page.getByText("Data as of")).toHaveCount(0);

    expect(await toolbarPosition(page)).toBe("sticky");
    await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
  });

  test("uj1 loads self-hosted fonts with tabular numbers and no text below 11px", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (!["localhost", "127.0.0.1"].includes(host) && !request.url().startsWith("data:")) {
        external.push(request.url());
      }
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/plans/new");
    await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();

    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      // fonts.check() is true when no face matches at all, so look for loaded faces instead.
      const loaded = (family: string, weight: string) =>
        [...document.fonts].some(
          (face) => face.family.replace(/["']/g, "") === family && face.weight === weight && face.status === "loaded",
        );
      return { barlow: loaded("Barlow Semi Condensed", "700"), figtree: loaded("Figtree", "400") };
    });
    expect(fonts).toEqual({ barlow: true, figtree: true });
    expect(external).toEqual([]);

    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
          if (!ownText) return false;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const visible = rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
          return visible && parseFloat(style.fontSize) < 11;
        })
        .map((el) => `${el.tagName}: ${el.textContent}`),
    );
    expect(tooSmall).toEqual([]);

    const numeric = await page.evaluate(() => getComputedStyle(document.body).fontVariantNumeric);
    expect(numeric).toBe("tabular-nums");
  });

  test("uj1 shows the fixed focus ring on paper and on graphite", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/plans/new");
    await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    expect(await skip.evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
      "rgb(255, 255, 255) 0px 0px 0px 2px, rgb(27, 30, 34) 0px 0px 0px 4px",
    );

    await page.keyboard.press("Tab");
    const home = page.getByRole("link", { name: "Smart Warehouse Planner" });
    await expect(home).toBeFocused();
    expect(await home.evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
      "rgb(20, 23, 25) 0px 0px 0px 2px, rgb(255, 255, 255) 0px 0px 0px 4px",
    );

    await page.keyboard.press("Shift+Tab");
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
  });

  test("uj1 toolbar scrolls with the page on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 450 });
    await page.goto("/plans/new");
    expect(await toolbarPosition(page)).toBe("static");
  });

  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`uj1 flow bar collapses below 1024px (reduced motion: ${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 900, height: 800 });
      await page.goto("/plans/new");

      const nav = page.getByRole("navigation", { name: "Plan steps" });
      await expect(nav.getByRole("list")).toBeHidden();
      const trigger = page.getByRole("button", { name: "Plan steps" });
      await expect(trigger).toBeVisible();

      await trigger.click();
      const popover = page.getByRole("dialog", { name: "Plan steps" });
      await expect(popover).toBeVisible();
      expect(stepNames(await popover.getByRole("listitem").allTextContents())).toEqual(STEPS);

      const timing = await popover.evaluate((el) => {
        const style = getComputedStyle(el);
        const seconds = (value: string) => Math.max(...value.split(",").map((part) => parseFloat(part)));
        return { animation: seconds(style.animationDuration), transition: seconds(style.transitionDuration) };
      });
      const limit = reducedMotion === "reduce" ? 0.01 : 0.2;
      expect(timing.animation).toBeLessThanOrEqual(limit);
      expect(timing.transition).toBeLessThanOrEqual(limit);
    });
  }

  test("uj1 page never scrolls sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/plans/new");
    await expect(page.getByRole("button", { name: "Plan steps" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });
});
