import { randomUUID } from "node:crypto";

import { expect, type Locator, test } from "./support/test";

import { aislePairs, cardPairs, labelsOf } from "./support/labels";
import { createSamplePlan } from "./support/sample-plan";

// UJ-2 / NFR-9 (Story 14.1, FR-48): the location labels of one aisle printed in every Playwright
// project. A label is one (location, part) the plan stocks: the location code large, a QR code of
// the part number and the part number small (decided 2026-11-28). The page is checked in emulated
// print media: only the label grid shows, black on white, in rows of 3 that never break across
// pages, and nothing overflows its label. Chromium-based projects attach a real PDF (A4) and
// Firefox, which has no `page.pdf`, a full-page screenshot in print media, for the manual check
// (scanning a printed QR code with a phone camera, which must give the part number, awaits the
// author's hand check).

/** CSS px per mm. */
const MM = 96 / 25.4;

/**
 * The labels with something clipped, as messages (none when every label fits): in a label the code
 * line, the QR code and the part line lie one under the other inside the card's border, and the
 * card has nothing to scroll.
 */
function clippedLabels(cards: Locator): Promise<string[]> {
  return cards.evaluateAll((elements) => {
    const offenders: string[] = [];
    for (const element of elements) {
      const name = `${element.getAttribute("data-label")} ${element.getAttribute("data-label-part")}`;
      const card = element.getBoundingClientRect();
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        offenders.push(`${name}: scrolls`);
      }
      const children = [...element.children].map((child) => child.getBoundingClientRect());
      if (children.length !== 3) offenders.push(`${name}: ${children.length} children`);
      children.forEach((box, index) => {
        const inside =
          box.top >= card.top - 0.5 &&
          box.bottom <= card.bottom + 0.5 &&
          box.left >= card.left - 0.5 &&
          box.right <= card.right + 0.5;
        if (!inside) offenders.push(`${name}: child ${index} leaves the card`);
        if (box.width === 0 || box.height === 0) offenders.push(`${name}: child ${index} is empty`);
        if (index > 0 && box.top < children[index - 1].bottom - 0.5) offenders.push(`${name}: child ${index} overlaps`);
      });
    }
    return offenders;
  });
}

test("uj2 nfr9 fr48 prints location labels for an aisle on A4 in black and white", async (
  { page, request, browserName },
  testInfo,
) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Labels print ${randomUUID().slice(0, 8)}`)).id;
  const labels = await labelsOf(request, planId);
  const aisle = labels.aisles[0];
  const pairs = aislePairs(labels, aisle.aisle);
  const codes = pairs.map(([code]) => code);
  const parts = pairs.map(([, part]) => part);
  expect(pairs.length).toBeGreaterThan(3);

  await page.goto(`/plans/${planId}/labels?aisle=${encodeURIComponent(aisle.aisle)}`);
  const main = page.getByRole("main");
  const cards = main.locator("[data-label]");
  await expect(cards).toHaveCount(codes.length);
  // The server's aisles and order, exactly.
  const picker = main.getByLabel("Aisle", { exact: true });
  await expect(picker.locator("option")).toHaveText(labels.aisles.map((entry) => entry.aisle));
  expect(await cardPairs(cards)).toEqual(pairs);
  await expect(main.locator("[data-labels-count]")).toHaveText(`${pairs.length} labels`);
  await expect(main.locator("[data-labels-empty]")).toHaveCount(0);
  // The screen preview is as wide as the printed A4 page: no label overflows its card there.
  expect(await clippedLabels(cards)).toEqual([]);
  const toolbar = page.locator('header[data-surface="graphite"]');
  const print = main.getByRole("button", { name: "Print", exact: true });
  const heading = main.getByRole("heading", { name: `Location labels · Aisle ${aisle.aisle}`, level: 1 });
  await expect(toolbar).toBeVisible();
  await expect(print).toBeVisible();
  await expect(picker).toBeVisible();
  await expect(heading).toBeVisible();

  await page.emulateMedia({ media: "print" });

  // Only the paper prints.
  await expect(toolbar).toBeHidden();
  await expect(toolbar).toHaveCSS("display", "none");
  await expect(print).toBeHidden();
  await expect(picker).toBeHidden();
  await expect(heading).toBeHidden();
  await expect(main.getByRole("link", { name: "Back to Overview", exact: true })).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveCSS("display", "none");
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(0);

  // Pure black on white: every glyph, rule and QR module in the paper is black or white.
  const colours = await page.evaluate(() => {
    const paper = document.querySelector("[data-paper]");
    if (!paper) return { elements: 0, offenders: ["no paper"], body: "", hidden: ["no paper"] };
    const offenders: string[] = [];
    const clear = new Set(["rgba(0, 0, 0, 0)", "transparent", "rgb(255, 255, 255)"]);
    const fills = new Set(["rgb(0, 0, 0)", "rgb(255, 255, 255)", "none"]);
    const elements = [paper, ...paper.querySelectorAll("*")];
    for (const element of elements) {
      const style = getComputedStyle(element);
      const label = `${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`;
      if (style.color !== "rgb(0, 0, 0)") offenders.push(`${label} color ${style.color}`);
      if (!clear.has(style.backgroundColor)) offenders.push(`${label} background ${style.backgroundColor}`);
      if (style.backgroundImage !== "none") offenders.push(`${label} background-image ${style.backgroundImage}`);
      if (!fills.has(style.fill)) offenders.push(`${label} fill ${style.fill}`);
      for (const side of ["top", "right", "bottom", "left"] as const) {
        const width = parseFloat(style.getPropertyValue(`border-${side}-width`));
        const borderColour = style.getPropertyValue(`border-${side}-color`);
        if (width > 0 && style.getPropertyValue(`border-${side}-style`) !== "none" && borderColour !== "rgb(0, 0, 0)")
          offenders.push(`${label} border-${side} ${borderColour}`);
      }
    }
    // Every QR code is drawn.
    const hidden = [...paper.querySelectorAll("svg")]
      .filter((svg) => {
        const box = svg.getBoundingClientRect();
        return !svg.checkVisibility() || box.width === 0 || box.height === 0;
      })
      .map((svg) => svg.getAttribute("aria-label") ?? "");
    return { elements: elements.length, offenders, body: getComputedStyle(document.body).backgroundColor, hidden };
  });
  expect(colours.elements).toBeGreaterThan(codes.length);
  expect(colours.offenders).toEqual([]);
  expect(colours.body).toBe("rgb(255, 255, 255)");
  expect(colours.hidden).toEqual([]);
  await expect(main.locator("[data-paper] svg")).toHaveCount(codes.length);
  // Every QR code is named after the part number of its own label, never the location code.
  const named = await cards.evaluateAll((elements) =>
    elements.map((element) => element.querySelector("svg")?.getAttribute("aria-label") ?? null),
  );
  expect(named).toEqual(parts.map((part) => `QR code ${part}`));
  await expect(cards.first().getByRole("img")).toBeVisible();
  // Dark modules on a light ground: the background rect is white and the modules are black.
  const qr = cards.first().locator("svg");
  await expect(qr.locator("rect")).toHaveCSS("fill", "rgb(255, 255, 255)");
  await expect(qr.locator("path")).toHaveCSS("fill", "rgb(0, 0, 0)");

  // The fixed grid: rows of 3 that never break, labels 36mm tall with a 1px black cut border.
  const rows = main.locator("[data-label-row]");
  await expect(rows).toHaveCount(Math.ceil(codes.length / 3));
  const breaks = await rows.evaluateAll((elements) => [...new Set(elements.map((row) => getComputedStyle(row).breakInside))]);
  expect(breaks).toEqual(["avoid"]);
  await expect(rows.first()).toHaveCSS("grid-template-columns", /^\S+ \S+ \S+$/);
  const card = cards.first();
  const height = parseFloat(await card.evaluate((element) => getComputedStyle(element).height));
  expect(Math.abs(height - 36 * MM)).toBeLessThan(1);
  await expect(card).toHaveCSS("border-top-width", "1px");
  await expect(card).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  const code = card.locator("span").first();
  await expect(code).toHaveText(codes[0]);
  await expect(code).toHaveCSS("font-weight", "700");
  await expect(code).toHaveCSS("font-family", /Barlow/);
  await expect(code).toHaveCSS("white-space", "nowrap");
  // The part number in small code text under the QR code, which is at least 20mm wide and square.
  const part = card.locator("[data-label-part-text]");
  await expect(part).toHaveText(parts[0]);
  await expect(part).toHaveCSS("font-family", /Barlow/);
  await expect(part).toHaveCSS("white-space", "nowrap");
  expect(parseFloat(await part.evaluate((element) => getComputedStyle(element).fontSize))).toBeCloseTo(12, 1);
  const qrBox = await qr.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(qrBox.width).toBeGreaterThanOrEqual(20 * MM - 0.5);
  expect(Math.abs(qrBox.width - qrBox.height)).toBeLessThan(0.5);
  // Nothing is clipped in print either (the paper is wider here than the screen's A4 preview).
  expect(await clippedLabels(cards)).toEqual([]);
  const paper = main.locator("[data-paper]");
  await expect(paper).toHaveCSS("padding-top", "0px");

  // The printed artifact for the manual check (scan a QR code with a phone camera).
  if (browserName === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const raw = pdf.toString("latin1");
    // A4 portrait (595 x 842 pt).
    expect(raw).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/);
    await testInfo.attach("location-labels.pdf", { body: pdf, contentType: "application/pdf" });
  } else {
    const png = await page.screenshot({ fullPage: true });
    await testInfo.attach("location-labels-print.png", { body: png, contentType: "image/png" });
  }

  await page.emulateMedia({ media: "screen" });
  await expect(print).toBeVisible();
  await expect(toolbar).toBeVisible();
});

test("uj2 fr48 an unknown aisle shows the first server aisle and replaces the URL", async ({ page, request }) => {
  test.setTimeout(90_000);
  const planId = (await createSamplePlan(request, `Labels aisle ${randomUUID().slice(0, 8)}`)).id;
  const labels = await labelsOf(request, planId);
  const first = labels.aisles[0];

  await page.goto(`/plans/${planId}/labels?aisle=ZZ`);
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/labels\\?aisle=${first.aisle}$`));
  const main = page.getByRole("main");
  await expect(main.getByLabel("Aisle", { exact: true })).toHaveValue(first.aisle);
  const card = main.locator("[data-label]").first();
  await expect(card).toHaveAttribute("data-label", first.labels[0].location.code);
  await expect(card).toHaveAttribute("data-label-part", first.labels[0].part);
});

test("uj2 fr48 location labels show a load error when the labels request fails", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Labels error ${randomUUID().slice(0, 8)}`)).id;
  await page.route(`**/api/plans/${planId}/labels`, (route) =>
    route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }),
  );

  await page.goto(`/plans/${planId}/labels`);
  const main = page.getByRole("main");
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.locator("[data-paper]")).toHaveCount(0);
});
