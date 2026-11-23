import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test, toasts } from "./support/test";

import { getJson, partDetail, planVersion, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 (Story 12.2; FR-51, UX-DR50, NFR-10): drag a bin on the One aisle wall with the mouse and
// drop it on an empty location. A short press stays a click; the target hints come from the server
// preview; `Esc` cancels; a one-part drop sends `move_parts` at once; several parts open the drop
// dialog; a drop on an occupied location changes nothing in this story; the Best locations wall and
// Whole warehouse never start a drag.

type WallPart = { part: string };
type WallLocation = { location: { code: string; aisle: string }; occupied: boolean; parts: WallPart[] };
type Wall = { version: number; locations: WallLocation[] };
type Preview = { allowed: boolean; target: "empty" | "occupied" | "none" };

const AISLE = "A";

async function wallOf(page: Page, planId: string): Promise<Wall> {
  return getJson<Wall>(page.request, `/api/plans/${planId}/wall?aisle=${AISLE}`);
}

async function previewOf(page: Page, planId: string, part: string, from: string, to: string): Promise<Preview> {
  const query = new URLSearchParams({ part, from, to });
  return getJson<Preview>(page.request, `/api/plans/${planId}/moves/preview?${query}`);
}

function grid(page: Page): Locator {
  return page.getByRole("main").getByRole("grid", { name: `Aisle ${AISLE} bin wall` });
}

function cellOf(page: Page, code: string): Locator {
  return grid(page).locator(`[data-grid-cell="${code}"]`);
}

/** The codes among `codes` whose cells are fully in view (wall scroll box and window), nearest to `from` first. */
async function nearestInView(page: Page, from: string, codes: readonly string[]): Promise<string[]> {
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
async function targetFor(
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

async function center(cell: Locator, half: "left" | "right" | "middle" = "middle"): Promise<{ x: number; y: number }> {
  const box = (await cell.boundingBox())!;
  const x = half === "left" ? box.x + box.width * 0.25 : half === "right" ? box.x + box.width * 0.75 : box.x + box.width / 2;
  return { x, y: box.y + box.height / 2 };
}

/** Presses on `cell` (at `half`) and moves 6px: past the 4px activation distance, still on the cell. */
async function startDrag(page: Page, cell: Locator, half: "left" | "right" = "left") {
  const point = await center(cell, half);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + (half === "left" ? 6 : -6), point.y, { steps: 3 });
}

async function dragOver(page: Page, cell: Locator) {
  const point = await center(cell);
  await page.mouse.move(point.x, point.y, { steps: 8 });
}

/** A location of the aisle holding exactly one part, alone there. */
function onePartLocations(wall: Wall): WallLocation[] {
  return wall.locations.filter((entry) => entry.parts.length === 1);
}

test("uj1 drags a bin on the One aisle wall to an empty location", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Drag ${randomUUID().slice(0, 8)}`)).id;
  const wall = await wallOf(page, planId);

  await page.goto(`/plans/${planId}/locations?aisle=${AISLE}`);
  await expect(grid(page)).toBeVisible();
  const source = onePartLocations(wall)[0];
  const from = source.location.code;
  const part = source.parts[0].part;
  const fromCell = cellOf(page, from);
  await fromCell.scrollIntoViewIfNeeded();
  const empties = wall.locations.filter((entry) => !entry.occupied).map((entry) => entry.location.code);
  const occupied = wall.locations.filter((entry) => entry.occupied).map((entry) => entry.location.code);
  const to = await targetFor(page, planId, part, from, empties, "empty");
  const full = await targetFor(page, planId, part, from, occupied, "occupied");
  const toCell = cellOf(page, to);
  const fullCell = cellOf(page, full);
  // A second one-part location and empty target, for the drop before its preview has arrived.
  const onePart = onePartLocations(wall).map((entry) => entry.location.code);
  const from2 = (await nearestInView(page, from, onePart)).find((code) => code !== full)!;
  const part2 = wall.locations.find((entry) => entry.location.code === from2)!.parts[0].part;
  const to2 = await targetFor(page, planId, part2, from2, empties.filter((code) => code !== to), "empty");

  // A short press (no movement) is still a click: it pins the tooltip.
  await fromCell.click();
  await expect(page.locator(`[data-wall-tooltip="${from}"][data-pinned]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-wall-tooltip][data-pinned]")).toHaveCount(0);

  // A press that moves more than 4px lifts the bin; the hover tooltip hides and the slot shows vacated.
  const before = await planVersion(request, planId);
  // The pointer leaves the wall and comes back: the cell's hover tooltip shows (unpinned).
  await page.getByRole("main").getByRole("heading", { name: "Locations", level: 1 }).hover();
  await fromCell.hover();
  await expect(page.locator(`[data-wall-tooltip="${from}"]`)).toBeVisible();
  await startDrag(page, fromCell);
  await expect(page.locator("[data-drag-lifted]")).toBeVisible();
  await expect(fromCell).toHaveAttribute("data-drag-vacated", "");
  await expect(page.locator("[data-wall-tooltip]")).toHaveCount(0);
  // The own slot is no target: no hint, the not-allowed cursor.
  await expect(fromCell).toHaveAttribute("data-drop-target", "none");
  await expect(fromCell).toHaveCSS("cursor", "not-allowed");
  await expect(fromCell.locator("[data-drop-label]")).toHaveCount(0);

  // An empty location: plus glyph and "Move here".
  await dragOver(page, toCell);
  await expect(toCell).toHaveAttribute("data-drop-target", "move");
  await expect(toCell.locator("[data-drop-label]")).toHaveText("Move here");
  await expect(toCell.locator('[data-drop-hint="move"]')).toHaveCount(1);
  // No tooltip shows while dragging over other cells (longer than the hover delay).
  await page.waitForTimeout(300);
  await expect(page.locator("[data-wall-tooltip]")).toHaveCount(0);

  // An occupied location: ⇄ and "Swap or put together".
  await dragOver(page, fullCell);
  await expect(fullCell).toHaveAttribute("data-drop-target", "swap");
  await expect(fullCell.locator("[data-drop-label]")).toHaveText("Swap or put together");
  await expect(toCell).not.toHaveAttribute("data-drop-target", /.*/);

  // `Esc` cancels: nothing is sent, nothing changes.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  await expect(fromCell).not.toHaveAttribute("data-drag-vacated", /.*/);
  await page.mouse.up();
  expect(await planVersion(request, planId)).toBe(before);

  // A drop outside the grid (on an aisle tab) cancels: nothing is sent.
  await startDrag(page, fromCell);
  await expect(page.locator("[data-drag-lifted]")).toBeVisible();
  await dragOver(page, page.getByRole("main").getByRole("tablist", { name: "Aisles" }).getByRole("tab").filter({ hasText: /^B/ }));
  await page.mouse.up();
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Aisles" }).getByRole("tab").filter({ hasText: /^A/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await planVersion(request, planId)).toBe(before);

  // A drop on an occupied location changes nothing in this story.
  await startDrag(page, fromCell);
  await dragOver(page, fullCell);
  await expect(fullCell).toHaveAttribute("data-drop-target", "swap");
  await page.mouse.up();
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await planVersion(request, planId)).toBe(before);

  // A one-part drop on an empty location sends one `move_parts`.
  await startDrag(page, fromCell);
  await dragOver(page, toCell);
  await expect(toCell).toHaveAttribute("data-drop-target", "move");
  await page.mouse.up();
  const toast = toasts(page).getByText(`Moved ${part}: ${from} → ${to} (Manual, round 0).`, { exact: true });
  await expect(toast).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  expect(await planVersion(request, planId)).toBe(before + 1);
  const detail = await partDetail(request, planId, part);
  const locations = [detail.current_location?.code, ...detail.other_locations.map((other) => other.location.code)];
  expect(locations).toContain(to);
  expect(locations).not.toContain(from);
  // The wall follows: the bin at its new slot with the "M" marker.
  await expect(toCell).toHaveAttribute("aria-label", /occupied.*manual move, arrived here/);
  await expect(fromCell).toHaveAttribute("aria-label", /empty/);
  await expect(page.locator('[data-wall-markers] [data-move-marker="M"]')).toHaveCount(1);

  // A drop before the target's preview has arrived waits for it, then sends.
  await page.route("**/moves/preview**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  const from2Cell = cellOf(page, from2);
  await startDrag(page, from2Cell);
  await dragOver(page, cellOf(page, to2));
  await page.mouse.up();
  await expect(
    toasts(page).getByText(`Moved ${part2}: ${from2} → ${to2} (Manual, round 0).`, { exact: true }),
  ).toBeVisible();
  expect(await planVersion(request, planId)).toBe(before + 2);
  await page.unroute("**/moves/preview**");
});

test("uj1 drags from a location with two parts and chooses the parts to move", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Drag parts ${randomUUID().slice(0, 8)}`)).id;
  // The sample data has no location with two parts: put one part together with another.
  const [donor, host] = onePartLocations(await wallOf(page, planId));
  await postCommand(request, planId, {
    type: "put_together",
    from: donor.location.code,
    to: host.location.code,
    parts: [donor.parts[0].part],
  });
  const wall = await wallOf(page, planId);
  const from = host.location.code;
  const parts = wall.locations.find((entry) => entry.location.code === from)!.parts.map((entry) => entry.part);
  expect(parts).toHaveLength(2);
  // The press on the right half lifts `parts[1]`.
  const [stays, dragged] = parts;

  await page.goto(`/plans/${planId}/locations?aisle=${AISLE}`);
  await expect(grid(page)).toBeVisible();
  const fromCell = cellOf(page, from);
  await fromCell.scrollIntoViewIfNeeded();
  const empties = wall.locations.filter((entry) => !entry.occupied).map((entry) => entry.location.code);
  const to = await targetFor(page, planId, dragged, from, empties, "empty");
  const toCell = cellOf(page, to);
  const before = await planVersion(request, planId);

  // Drop: the dialog opens anchored to the target; `Esc` closes it, nothing is sent, focus on the cell.
  await startDrag(page, fromCell, "right");
  await dragOver(page, toCell);
  await expect(toCell).toHaveAttribute("data-drop-target", "move");
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: `Move to ${to}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: `Parts to move from ${from}` })).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  await expect(dialog.getByRole("checkbox", { name: new RegExp(dragged) })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: new RegExp(stays) })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(toCell).toBeFocused();
  expect(await planVersion(request, planId)).toBe(before);

  // Again: unchecking all disables Move with its reason; Cancel closes with nothing sent.
  await startDrag(page, fromCell, "right");
  await dragOver(page, toCell);
  await expect(toCell).toHaveAttribute("data-drop-target", "move");
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  const draggedBox = dialog.getByRole("checkbox", { name: new RegExp(dragged) });
  // By keyboard: focus is in the dialog; Space toggles the focused checkbox.
  await draggedBox.focus();
  await page.keyboard.press("Space");
  await expect(draggedBox).not.toBeChecked();
  const move = dialog.getByRole("button", { name: "Move", exact: true });
  await expect(move).toHaveAttribute("aria-disabled", "true");
  await expect(move).toHaveAccessibleDescription("Choose at least one part to move.");
  // Pressing the disabled Move sends nothing.
  await move.focus();
  await page.keyboard.press("Enter");
  expect(await planVersion(request, planId)).toBe(before);
  await expect(dialog).toBeVisible();
  await draggedBox.focus();
  await page.keyboard.press("Space");
  await expect(draggedBox).toBeChecked();
  await expect(move).not.toHaveAttribute("aria-disabled", /.*/);

  // Move sends only the checked part; the other part stays.
  await move.focus();
  await page.keyboard.press("Enter");
  await expect(
    toasts(page).getByText(`Moved ${dragged}: ${from} → ${to} (Manual, round 0).`, { exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(await planVersion(request, planId)).toBe(before + 1);
  const after = await wallOf(page, planId);
  expect(after.locations.find((entry) => entry.location.code === to)!.parts.map((entry) => entry.part)).toEqual([dragged]);
  expect(after.locations.find((entry) => entry.location.code === from)!.parts.map((entry) => entry.part)).toEqual([stays]);
});

test("uj1 no drag starts on the Best locations wall or in Whole warehouse", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Drag none ${randomUUID().slice(0, 8)}`)).id;
  const wall = await wallOf(page, planId);
  const before = await planVersion(request, planId);
  const from = onePartLocations(wall)[0].location.code;

  // Best locations: a press that moves lifts nothing; releasing on another cell marks nothing.
  await page.goto(`/plans/${planId}/best-locations?aisle=${AISLE}`);
  await expect(grid(page)).toBeVisible();
  const fromCell = cellOf(page, from);
  await fromCell.scrollIntoViewIfNeeded();
  const other = (await nearestInView(page, from, wall.locations.map((entry) => entry.location.code)))[0];
  await startDrag(page, fromCell);
  await dragOver(page, cellOf(page, other));
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  await expect(grid(page).locator("[data-drop-target]")).toHaveCount(0);
  await page.mouse.up();
  expect(await planVersion(request, planId)).toBe(before);

  // Whole warehouse: the mini-walls are pictures; a press that moves lifts nothing.
  await page.goto(`/plans/${planId}/locations`);
  const main = page.getByRole("main");
  await main.getByRole("radio", { name: "Whole warehouse" }).click();
  const card = main.locator(`[data-aisle-card="${AISLE}"] [data-mini-wall]`);
  await expect(card).toBeVisible();
  const point = await center(card);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 30, point.y + 10, { steps: 5 });
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  await page.mouse.up();
  expect(await planVersion(request, planId)).toBe(before);
});
