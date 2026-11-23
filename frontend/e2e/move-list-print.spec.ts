import { randomUUID } from "node:crypto";

import { expect, test } from "./support/test";

import { getJson, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-2 / NFR-9 (Story 8.4; UX-DR52, FR-38, AD-17): the move list printed in every Playwright
// project. The page is checked in emulated print media: only the paper shows, black on white, with
// the DESIGN.md rules and type. Chromium-based projects attach a real PDF (A4, page numbers) and
// Firefox, which has no `page.pdf`, a full-page screenshot in print media, for the manual check.

const BLACK = "rgb(0, 0, 0)";
/**
 * The 1.5px rules (DESIGN.md print-move-list): Chromium and Firefox snap a border width to whole
 * CSS pixels in the computed value (1.5px reads back as 1px at any device scale), so the test checks
 * the declared class and a computed width of 1px or 1.5px.
 */
const RULE_1_5 = /^1(\.5)?px$/;

test("uj2 nfr9 prints the move list on A4 in black and white", async ({ page, request, browserName }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const name = `Print ${randomUUID().slice(0, 8)}`;
  const planId = (await createSamplePlan(request, name)).id;
  await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await postCommand(request, planId, { type: "run" });
  const applied = await postCommand(request, planId, { type: "apply_all" });
  expect(applied.events[0]?.type).toBe("apply_all_done");
  const summary = await getJson<{ move_count: number }>(request, `/api/plans/${planId}`);
  expect(summary.move_count).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/print`);
  const main = page.getByRole("main");
  const lines = main.locator("[data-move-line]");
  await expect(lines).toHaveCount(summary.move_count);
  const toolbar = page.locator('header[data-surface="graphite"]');
  const print = main.getByRole("button", { name: "Print", exact: true });
  const back = main.getByRole("link", { name: "Back to Recommendations", exact: true });
  await expect(toolbar).toBeVisible();
  await expect(print).toBeVisible();
  await expect(back).toBeVisible();

  await page.emulateMedia({ media: "print" });

  // Only the paper prints.
  await expect(toolbar).toBeHidden();
  await expect(toolbar).toHaveCSS("display", "none");
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(print).toBeHidden();
  await expect(back).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveCSS("display", "none");
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: `Move list · ${name}`, level: 1 })).toBeVisible();
  const dataLine = main.locator("[data-move-list-data]");
  await expect(dataLine).toBeVisible();
  await expect(dataLine).toContainText("Data as of");
  await expect(main.locator("[data-move-list-generated]")).toBeVisible();
  await expect(main.locator("[data-move-list-generated]")).toContainText("Generated");

  // Bands and lines: exactly the plan's rounds and moves.
  const rounds = Number(/ · (\d+) rounds?$/.exec((await dataLine.textContent()) ?? "")?.[1]);
  expect(rounds).toBeGreaterThan(0);
  await expect(main.locator("[data-round-band]")).toHaveCount(rounds);
  await expect(lines).toHaveCount(summary.move_count);

  // Pure black on white: every glyph and rule in the paper is black, no fill other than white.
  const colours = await page.evaluate(() => {
    const paper = document.querySelector("[data-paper]");
    if (!paper) return { elements: 0, offenders: ["no paper"], body: "", html: "" };
    const offenders: string[] = [];
    const clear = new Set(["rgba(0, 0, 0, 0)", "transparent", "rgb(255, 255, 255)"]);
    const elements = [paper, ...paper.querySelectorAll("*")];
    for (const element of elements) {
      const style = getComputedStyle(element);
      const label = `${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`;
      if (style.color !== "rgb(0, 0, 0)") offenders.push(`${label} color ${style.color}`);
      if (!clear.has(style.backgroundColor)) offenders.push(`${label} background ${style.backgroundColor}`);
      if (style.backgroundImage !== "none") offenders.push(`${label} background-image ${style.backgroundImage}`);
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const width = parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`));
        const borderColour = style.getPropertyValue(`border-${side.toLowerCase()}-color`);
        if (width > 0 && style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" && borderColour !== "rgb(0, 0, 0)")
          offenders.push(`${label} border-${side} ${borderColour}`);
      }
    }
    return {
      elements: elements.length,
      offenders,
      body: getComputedStyle(document.body).backgroundColor,
      html: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
  expect(colours.elements).toBeGreaterThan(summary.move_count);
  expect(colours.offenders).toEqual([]);
  expect(colours.body).toBe("rgb(255, 255, 255)");
  expect(colours.html).toBe("rgb(255, 255, 255)");
  const paper = main.locator("[data-paper]");
  // Tailwind's shadow-none leaves a stack of fully transparent shadows: nothing is painted.
  const shadow = await paper.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(shadow === "none" || shadow.split(/,(?![^(]*\))/).every((s) => s.includes("rgba(0, 0, 0, 0)"))).toBe(true);
  await expect(paper).toHaveCSS("padding-top", "0px");
  const wrapper = paper.locator("..");
  await expect(wrapper).toHaveCSS("padding-left", "0px");
  await expect(wrapper).toHaveCSS("padding-top", "0px");

  // Rules, tick box and type (DESIGN.md print-move-list).
  const band = main.locator("[data-round-band]").first();
  await expect(band).toHaveCSS("border-top-width", "2px");
  await expect(band).toHaveCSS("border-bottom-width", "2px");
  await expect(band).toHaveCSS("border-top-color", BLACK);
  await expect(band).toHaveCSS("break-after", "avoid");
  await expect(band).toHaveCSS("break-inside", "avoid");
  const tag = band.locator("span").first();
  await expect(tag).toHaveText(/^ROUND \d+$/);
  await expect(tag).toHaveClass(/(^|\s)border-\[1\.5px\](\s|$)/);
  await expect(tag).toHaveCSS("border-top-width", RULE_1_5);
  await expect(tag).toHaveCSS("border-left-width", RULE_1_5);
  await expect(tag).toHaveCSS("border-top-color", BLACK);
  const line = lines.first();
  await expect(line).toHaveCSS("border-bottom-width", "1px");
  await expect(line).toHaveCSS("border-bottom-color", BLACK);
  await expect(line).toHaveCSS("break-inside", "avoid");
  const tick = line.locator("td").nth(0).locator("span");
  await expect(tick).toHaveCSS("width", "14px");
  await expect(tick).toHaveCSS("height", "14px");
  await expect(tick).toHaveClass(/(^|\s)border-\[1\.5px\](\s|$)/);
  await expect(tick).toHaveCSS("border-top-width", RULE_1_5);
  const part = line.locator("td").nth(2);
  await expect(part).toHaveCSS("font-weight", "700");
  await expect(part).toHaveCSS("font-size", "16px");
  await expect(part).toHaveCSS("font-family", /Barlow/);
  const description = line.locator("td").nth(3);
  await expect(description).toHaveCSS("font-size", "13.5px");
  await expect(description).toHaveCSS("font-family", /Figtree/);
  await expect(main.locator("[data-paper] thead")).toHaveCSS("display", "table-header-group");

  // The printed artifact for the manual check.
  if (browserName === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const raw = pdf.toString("latin1");
    // A4 portrait (595 x 842 pt), and the sample list spans more than one page.
    expect(raw).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/);
    expect(raw.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    await testInfo.attach("move-list.pdf", { body: pdf, contentType: "application/pdf" });
  } else {
    const png = await page.screenshot({ fullPage: true });
    await testInfo.attach("move-list-print.png", { body: png, contentType: "image/png" });
  }

  await page.emulateMedia({ media: "screen" });
  await expect(print).toBeVisible();
  await expect(toolbar).toBeVisible();
});
