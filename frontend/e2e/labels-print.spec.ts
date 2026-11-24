import { randomUUID } from "node:crypto";

import { expect, test } from "./support/test";

import { getJson } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-2 / NFR-9 (Story 14.1, FR-48): the location labels of one aisle printed in every Playwright
// project. The page is checked in emulated print media: only the label grid shows, black on white,
// in rows of 3 that never break across pages. Chromium-based projects attach a real PDF (A4) and
// Firefox, which has no `page.pdf`, a full-page screenshot in print media, for the manual check
// (scanning a printed QR code with a phone camera awaits the author's hand check).

type Labels = { aisles: { aisle: string; locations: { code: string }[] }[] };

test("uj2 nfr9 fr48 prints location labels for an aisle on A4 in black and white", async (
  { page, request, browserName },
  testInfo,
) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Labels print ${randomUUID().slice(0, 8)}`)).id;
  const summary = await getJson<{ import_id: string }>(request, `/api/plans/${planId}`);
  const labels = await getJson<Labels>(request, `/api/imports/${summary.import_id}/labels`);
  const aisle = labels.aisles[0];
  const codes = aisle.locations.map((location) => location.code);
  expect(codes.length).toBeGreaterThan(3);

  await page.goto(`/plans/${planId}/labels?aisle=${encodeURIComponent(aisle.aisle)}`);
  const main = page.getByRole("main");
  const cards = main.locator("[data-label]");
  await expect(cards).toHaveCount(codes.length);
  // The server's aisles and order, exactly.
  const picker = main.getByLabel("Aisle", { exact: true });
  await expect(picker.locator("option")).toHaveText(labels.aisles.map((entry) => entry.aisle));
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-label")))).toEqual(
    codes,
  );
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
  await expect(cards.first().getByRole("img")).toHaveAttribute("aria-label", `QR code ${codes[0]}`);
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
  expect(Math.abs(height - (36 * 96) / 25.4)).toBeLessThan(1);
  await expect(card).toHaveCSS("border-top-width", "1px");
  await expect(card).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  const code = card.locator("span").first();
  await expect(code).toHaveText(codes[0]);
  await expect(code).toHaveCSS("font-weight", "700");
  await expect(code).toHaveCSS("font-family", /Barlow/);
  await expect(code).toHaveCSS("white-space", "nowrap");
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
  const summary = await getJson<{ import_id: string }>(request, `/api/plans/${planId}`);
  const labels = await getJson<Labels>(request, `/api/imports/${summary.import_id}/labels`);
  const first = labels.aisles[0];

  await page.goto(`/plans/${planId}/labels?aisle=ZZ`);
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/labels\\?aisle=${first.aisle}$`));
  const main = page.getByRole("main");
  await expect(main.getByLabel("Aisle", { exact: true })).toHaveValue(first.aisle);
  await expect(main.locator("[data-label]").first()).toHaveAttribute("data-label", first.locations[0].code);
});
