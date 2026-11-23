import { expect, type Locator, type Page } from "./test";

// Shared by the journeys that change a Key colour (key-colours.spec.ts, user-journeys.spec.ts).

export const SHADE_6 = "#378CBE";
export const SHADE_6_RGB = "rgb(55, 140, 190)";
export const DEFAULT_SLOW = "#417DDC";
export const DEFAULT_SLOW_RGB = "rgb(65, 125, 220)";
export const DEFAULT_FAST_RGB = "rgb(216, 81, 68)";
const GLYPH_RGB = "rgb(27, 30, 34)";
const SLOW_GLYPH_PATH = "M5 9.2 L9.6 0.8 H0.4 Z";

/** The fill of the first slow bin body under `scope`, and its ▼ glyph (unchanged by any colour). */
export async function expectSlowBin(scope: Locator, fill: string) {
  const bin = scope.locator('[data-bin="slow"]').first();
  await expect(bin.locator("> rect").first()).toHaveCSS("fill", fill);
  const glyph = bin.locator('svg[data-class="slow"]').first();
  await expect(glyph).toHaveCSS("color", GLYPH_RGB);
  await expect(glyph.locator("path")).toHaveAttribute("d", SLOW_GLYPH_PATH);
}

/** The Slow-moving colour set on <html> (empty when the default is used). */
export async function rootSlow(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.style.getPropertyValue("--colour-slow"));
}

/** In print media, every visible element of the page that is drawn in `rgb` (none expected). */
export async function printOffenders(page: Page, rgb: string): Promise<string[]> {
  await page.emulateMedia({ media: "print" });
  const found = await page.evaluate((colour) => {
    const offenders: string[] = [];
    for (const element of document.querySelectorAll("*")) {
      if (!element.checkVisibility()) continue;
      const style = getComputedStyle(element);
      const values = [style.color, style.backgroundColor, style.fill, style.stroke, style.borderTopColor, style.borderBottomColor];
      if (values.includes(colour)) offenders.push(`${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`);
    }
    return offenders;
  }, rgb);
  await page.emulateMedia({ media: "screen" });
  return found;
}
