import { getJson } from "./plan-api";
import type { Locator, Page } from "./test";

// Shared by the journeys that drag a bin on the One aisle wall (drag.spec.ts, user-journeys.spec.ts).

export type Preview = { allowed: boolean; target: "empty" | "occupied" | "none" };

export async function previewOf(page: Page, planId: string, part: string, from: string, to: string): Promise<Preview> {
  const query = new URLSearchParams({ part, from, to });
  return getJson<Preview>(page.request, `/api/plans/${planId}/moves/preview?${query}`);
}

/** The codes among `codes` whose cells are fully in view (wall scroll box and window), nearest to `from` first. */
export async function nearestInView(page: Page, from: string, codes: readonly string[]): Promise<string[]> {
  return page.evaluate(
    ([fromCode, candidates]) => {
      const box = document.querySelector("[data-wall-scroll]")!.getBoundingClientRect();
      const top = Math.max(box.top, 120);
      const bottom = Math.min(box.bottom, window.innerHeight) - 60;
      const origin = document.querySelector(`[data-grid-cell="${fromCode}"]`)!.getBoundingClientRect();
      return candidates
        .map((code) => ({ code, rect: document.querySelector(`[data-grid-cell="${code}"]`)?.getBoundingClientRect() }))
        .filter(
          (entry): entry is { code: string; rect: DOMRect } =>
            entry.rect !== undefined &&
            entry.code !== fromCode &&
            entry.rect.top >= top &&
            entry.rect.bottom <= bottom &&
            entry.rect.left >= box.left &&
            entry.rect.right <= box.right - 20,
        )
        .sort((a, b) => Math.hypot(a.rect.x - origin.x, a.rect.y - origin.y) - Math.hypot(b.rect.x - origin.x, b.rect.y - origin.y))
        .map((entry) => entry.code);
    },
    [from, codes] as const,
  );
}

/** The first of `codes` in view whose preview for (part, from) has `target` and is allowed. */
export async function targetFor(
  page: Page,
  planId: string,
  part: string,
  from: string,
  codes: readonly string[],
  target: Preview["target"],
): Promise<string> {
  for (const code of await nearestInView(page, from, codes)) {
    const preview = await previewOf(page, planId, part, from, code);
    if (preview.allowed && preview.target === target) return code;
  }
  throw new Error(`no ${target} target in view for ${part} from ${from}`);
}

export async function center(cell: Locator, half: "left" | "right" | "middle" = "middle"): Promise<{ x: number; y: number }> {
  const box = (await cell.boundingBox())!;
  const x = half === "left" ? box.x + box.width * 0.25 : half === "right" ? box.x + box.width * 0.75 : box.x + box.width / 2;
  return { x, y: box.y + box.height / 2 };
}

/** Presses on `cell` (at `half`) and moves 6px: past the 4px activation distance, still on the cell. */
export async function startDrag(page: Page, cell: Locator, half: "left" | "right" = "left") {
  const point = await center(cell, half);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + (half === "left" ? 6 : -6), point.y, { steps: 3 });
}

export async function dragOver(page: Page, cell: Locator) {
  const point = await center(cell);
  await page.mouse.move(point.x, point.y, { steps: 8 });
}
