import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test, toasts } from "./support/test";

import { getJson, partDetail, planVersion, postCommand } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 (Story 12.2; FR-51, UX-DR50, NFR-10): drag a bin on the One aisle wall with the mouse and
// drop it on an empty location. A short press stays a click; the target hints come from the server
// preview; `Esc` cancels; a one-part drop sends `move_parts` at once; several parts open the drop
// dialog; a drop on an occupied location opens the occupied dialog (Story 12.3: Swap, Put together
// or Cancel, nothing sent until chosen); the Best locations wall and Whole warehouse never start a
// drag.

type WallPart = { part: string; kept_in_place: boolean };
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

  // A drop on an occupied location opens the occupied dialog (Story 12.3); `Esc` closes it, nothing sent.
  await startDrag(page, fromCell);
  await dragOver(page, fullCell);
  await expect(fullCell).toHaveAttribute("data-drop-target", "swap");
  await page.mouse.up();
  await expect(page.locator("[data-drag-lifted]")).toHaveCount(0);
  const occupiedDialog = page.getByRole("dialog", { name: `${full} is occupied` });
  await expect(occupiedDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(fullCell).toBeFocused();
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

/** The part numbers at `code` on the wall, in wall order. */
function partsAt(wall: Wall, code: string): string[] {
  return wall.locations.find((entry) => entry.location.code === code)!.parts.map((entry) => entry.part);
}

/** Drags from `fromCell` (at `half`) onto `toCell`, waits for the occupied hint and drops. */
async function dropOnOccupied(page: Page, fromCell: Locator, toCell: Locator, half: "left" | "right" = "left") {
  await startDrag(page, fromCell, half);
  await dragOver(page, toCell);
  await expect(toCell).toHaveAttribute("data-drop-target", "swap");
  await page.mouse.up();
}

/** A checkbox in the dialog for `part` (its accessible name starts with the part number). */
function partBox(scope: Locator, part: string): Locator {
  return scope.getByRole("checkbox", { name: new RegExp(`^${part}\\b`) });
}

/** Toggles a checkbox by keyboard. */
async function toggle(page: Page, box: Locator) {
  await box.focus();
  await page.keyboard.press("Space");
}

test("uj1 drops a bin on an occupied location to swap or put it together", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Drag swap ${randomUUID().slice(0, 8)}`)).id;
  const initial = await wallOf(page, planId);

  await page.goto(`/plans/${planId}/locations?aisle=${AISLE}`);
  await expect(grid(page)).toBeVisible();
  const from = onePartLocations(initial)[0].location.code;
  await cellOf(page, from).scrollIntoViewIfNeeded();
  // One-part locations in view, nearest first: the pairs for Swap, Put together and the two-part swap.
  const near = await nearestInView(
    page,
    from,
    onePartLocations(initial).map((entry) => entry.location.code),
  );
  expect(near.length).toBeGreaterThanOrEqual(7);
  const [to, from2, to2, host1, host2, donor1, donor2] = near;
  const part = partsAt(initial, from)[0];
  const back = partsAt(initial, to)[0];
  const part2 = partsAt(initial, from2)[0];
  const back2 = partsAt(initial, to2)[0];

  // Set up by API: the target's part is kept in place (FR-32); two locations with two parts each.
  await postCommand(request, planId, { type: "set_keep", part: back });
  for (const [donor, host] of [
    [donor1, host1],
    [donor2, host2],
  ]) {
    await postCommand(request, planId, { type: "put_together", from: donor, to: host, parts: partsAt(initial, donor) });
  }
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await cellOf(page, from).scrollIntoViewIfNeeded();
  const before = await planVersion(request, planId);

  // One part on each side: titled "<to> is occupied", no groups, Swap / Put together / Cancel, no
  // button focused; the kept part in the swap shows the warning, Swap stays enabled.
  const fromCell = cellOf(page, from);
  const toCell = cellOf(page, to);
  await dropOnOccupied(page, fromCell, toCell);
  const dialog = page.getByRole("dialog", { name: `${to} is occupied` });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("group")).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog.getByRole("button")).toHaveText(["Swap", "Put together", "Cancel"]);
  await expect(dialog.locator("[data-kept-warning]")).toHaveText(`${back} is kept in place. Swap anyway?`);
  await expect(dialog.locator("[data-kept-warning] svg")).toBeVisible();
  const swap = dialog.getByRole("button", { name: "Swap", exact: true });
  await expect(swap).not.toHaveAttribute("aria-disabled", /.*/);

  // `Esc` closes it: nothing sent, focus on the dropped-on cell.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(toCell).toBeFocused();
  expect(await planVersion(request, planId)).toBe(before);

  // Cancel closes it too.
  await dropOnOccupied(page, fromCell, toCell);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toCell).toBeFocused();
  expect(await planVersion(request, planId)).toBe(before);

  // Put together: one Manual move into the occupied location; the wall shows the "M" marker.
  const to2Cell = cellOf(page, to2);
  await dropOnOccupied(page, cellOf(page, from2), to2Cell);
  const dialog2 = page.getByRole("dialog", { name: `${to2} is occupied` });
  await expect(dialog2).toBeVisible();
  await dialog2.getByRole("button", { name: "Put together", exact: true }).click();
  await expect(
    toasts(page).getByText(`Moved ${part2}: ${from2} → ${to2} (Manual, round 0).`, { exact: true }),
  ).toBeVisible();
  await expect(dialog2).toHaveCount(0);
  expect(await planVersion(request, planId)).toBe(before + 1);
  const together = await wallOf(page, planId);
  expect(partsAt(together, to2).sort()).toEqual([part2, back2].sort());
  expect(partsAt(together, from2)).toEqual([]);
  await expect(to2Cell).toHaveAttribute("aria-label", /manual move, arrived here/);
  // The two set-up moves by API plus this one.
  await expect(page.locator('[data-wall-markers] [data-move-marker="M"]')).toHaveCount(3);

  // Swap by keyboard: the parts trade places, the kept mark stays set, the toast has Undo.
  await dropOnOccupied(page, fromCell, toCell);
  await expect(dialog).toBeVisible();
  await swap.focus();
  await page.keyboard.press("Enter");
  await expect(
    toasts(page).getByText(`Swapped ${from} ↔ ${to} · 2 manual moves, round 0.`, { exact: true }),
  ).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true }).last()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(await planVersion(request, planId)).toBe(before + 2);
  const swapped = await wallOf(page, planId);
  expect(partsAt(swapped, to)).toEqual([part]);
  expect(partsAt(swapped, from)).toEqual([back]);
  expect(swapped.locations.find((entry) => entry.location.code === from)!.parts[0].kept_in_place).toBe(true);

  // Two parts on both sides: both groups, the dragged part and every back-part checked.
  const [lifted, staying] = partsAt(swapped, host1);
  const [backA, backB] = partsAt(swapped, host2);
  const host1Cell = cellOf(page, host1);
  const host2Cell = cellOf(page, host2);
  await dropOnOccupied(page, host1Cell, host2Cell, "left");
  const dialog3 = page.getByRole("dialog", { name: `${host2} is occupied` });
  await expect(dialog3).toBeVisible();
  const fromGroup = dialog3.getByRole("group", { name: `Parts to move from ${host1}` });
  const backGroup = dialog3.getByRole("group", { name: `Parts to move back to ${host1}` });
  await expect(fromGroup.getByRole("checkbox")).toHaveCount(2);
  await expect(backGroup.getByRole("checkbox")).toHaveCount(2);
  // Focus starts on the first checkbox, never on a button.
  await expect(partBox(fromGroup, lifted)).toBeFocused();
  await expect(partBox(fromGroup, lifted)).toBeChecked();
  await expect(partBox(fromGroup, staying)).not.toBeChecked();
  await expect(partBox(backGroup, backA)).toBeChecked();
  await expect(partBox(backGroup, backB)).toBeChecked();
  await expect(dialog3.locator("[data-kept-warning]")).toHaveCount(0);

  // No part to move: both disabled with the reason; pressing sends nothing.
  const swap3 = dialog3.getByRole("button", { name: "Swap", exact: true });
  const together3 = dialog3.getByRole("button", { name: "Put together", exact: true });
  await toggle(page, partBox(fromGroup, lifted));
  for (const button of [swap3, together3]) {
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toHaveAccessibleDescription("Choose at least one part to move.");
  }
  await swap3.focus();
  await page.keyboard.press("Enter");
  await expect(dialog3).toBeVisible();
  expect(await planVersion(request, planId)).toBe(before + 2);
  await toggle(page, partBox(fromGroup, lifted));

  // No part to move back: only Swap is disabled.
  await toggle(page, partBox(backGroup, backA));
  await toggle(page, partBox(backGroup, backB));
  await expect(swap3).toHaveAttribute("aria-disabled", "true");
  await expect(swap3).toHaveAccessibleDescription("Choose at least one part to move back.");
  await expect(together3).not.toHaveAttribute("aria-disabled", /.*/);

  // Swap one chosen part with one back-part: only those move.
  await toggle(page, partBox(backGroup, backB));
  await expect(swap3).not.toHaveAttribute("aria-disabled", /.*/);
  await swap3.focus();
  await page.keyboard.press("Enter");
  await expect(
    toasts(page).getByText(`Swapped ${host1} ↔ ${host2} · 2 manual moves, round 0.`, { exact: true }),
  ).toBeVisible();
  await expect(dialog3).toHaveCount(0);
  expect(await planVersion(request, planId)).toBe(before + 3);
  const after = await wallOf(page, planId);
  expect(partsAt(after, host1).sort()).toEqual([staying, backB].sort());
  expect(partsAt(after, host2).sort()).toEqual([lifted, backA].sort());

  // Put together from a location with several parts: only the checked (dragged) part moves.
  const [lifted2, staying2] = partsAt(after, host1);
  // Focus is back on host2, whose tooltip may cover host1: `Esc` hides it.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-wall-tooltip]")).toHaveCount(0);
  await dropOnOccupied(page, host1Cell, host2Cell, "left");
  await expect(dialog3).toBeVisible();
  await expect(partBox(fromGroup, lifted2)).toBeChecked();
  await expect(partBox(fromGroup, staying2)).not.toBeChecked();
  await together3.click();
  // The toast's wording depends on FR-34 (the part may return to where it came from): check by API.
  await expect(dialog3).toHaveCount(0);
  await expect.poll(() => planVersion(request, planId)).toBe(before + 4);
  const final = await wallOf(page, planId);
  expect(partsAt(final, host1)).toEqual([staying2]);
  expect(partsAt(final, host2).sort()).toEqual([lifted, backA, lifted2].sort());
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
