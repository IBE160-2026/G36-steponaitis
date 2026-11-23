import type { Page } from "./test";

// Shared by the journeys that print the move list (move-list.spec.ts, user-journeys.spec.ts).

/**
 * Replaces `window.print` with a counter, so the test never opens a print dialog. Each call also
 * records the header's generated line as it is on screen at that moment.
 */
export async function stubPrint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as { __prints: number; __printedGenerated: string[] };
    target.__prints = 0;
    target.__printedGenerated = [];
    window.print = () => {
      target.__prints += 1;
      target.__printedGenerated.push(document.querySelector("[data-move-list-generated]")?.textContent ?? "");
    };
  });
}

export async function printCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __prints: number }).__prints);
}

export async function printedGenerated(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __printedGenerated: string[] }).__printedGenerated);
}

/** A predicate for `page.waitForResponse`: the plan's move-list GET. */
export const isMoveListGet = (planId: string) => (response: { url(): string; request(): { method(): string } }) =>
  response.url().endsWith(`/api/plans/${planId}/move-list`) && response.request().method() === "GET";
