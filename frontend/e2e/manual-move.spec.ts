import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, type Locator, type Page, test, toasts } from "./support/test";

import { type Detail, enterTarget, getJson, locationRows, planVersion, type RosterRow } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 and UJ-7: the planner makes a manual move from the part panel and moves it back, keyboard
// only from the search field; a part with no stock cannot be moved; a part opens from the
// Locations table. AD-12: a bare proxy 500 and a 503 after the server applied the command both
// retry to one change (Story 4.3; FR-15, FR-33, FR-34, NFR-10, UX-DR24, UX-DR26, AD-12).

const NO_STOCK = "No current location (no stock above zero)";
const RETRYING = "The last change was not saved yet. Trying again.";

/** A part with stock in exactly one location (so the dialog shows "From …" as text). */
async function singleLocationPart(request: APIRequestContext, planId: string, skip: string[] = []): Promise<Detail> {
  const roster = await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${planId}/parts`);
  for (const row of roster.parts) {
    if (row.current_location === null || skip.includes(row.part)) continue;
    const detail = await getJson<Detail>(request, `/api/plans/${planId}/parts/${encodeURIComponent(row.part)}`);
    if (detail.other_locations.length === 0) return detail;
  }
  throw new Error("no part with a single location");
}

/** An empty location, a prefix to type for it and how many ↓ presses highlight it. */
async function emptyTarget(request: APIRequestContext, planId: string, skip: string[] = []) {
  const rows = await locationRows(request, planId);
  const codes = rows.map((row) => row.location.code);
  const code = rows.find((row) => !row.occupied && !skip.includes(row.location.code))!.location.code;
  const prefix = code.slice(0, -1);
  const matches = codes.filter((other) => other.toUpperCase().startsWith(prefix.toUpperCase())).slice(0, 8);
  const index = matches.indexOf(code);
  return index >= 0 ? { code, prefix, downs: index + 1 } : { code, prefix: code, downs: 1 };
}

/** Presses Tab until `target` has the focus (at most `max` times). */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Opens the part panel at `?part=` and its Manual move… dialog; returns the dialog. */
async function openDialog(page: Page, planId: string, part: string): Promise<Locator> {
  await page.goto(`/plans/${planId}/parts?part=${encodeURIComponent(part)}`);
  const panel = page.getByRole("complementary", { name: part });
  await panel.getByRole("button", { name: "Manual move…" }).click();
  const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
  await expect(dialog.getByRole("combobox", { name: "To-location" })).toBeFocused();
  return dialog;
}

test("uj1 makes a manual move from the part panel and moves it back", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Move ${randomUUID().slice(0, 8)}`)).id;
  const detail = await singleLocationPart(request, planId);
  const part = detail.part;
  const from = detail.current_location!.code;
  const target = await emptyTarget(request, planId);
  const before = await planVersion(request, planId);

  await page.goto(`/plans/${planId}/parts`);
  const main = page.getByRole("main");
  await expect(main.getByRole("table", { name: "Parts" }).locator("tbody tr").first()).toBeVisible();

  // Ctrl+/ → search → the part's result → the part panel.
  await main.getByRole("heading", { name: "Parts", level: 1 }).click();
  await page.keyboard.press("Control+/");
  await page.keyboard.type(part);
  const result = page.locator(`[data-search-part="${part}"]`);
  await expect(result).toBeVisible();
  await tabTo(page, result);
  await page.keyboard.press("Enter");
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeFocused();

  // Manual move… → the dialog, focus in the to-location field, from-location as text.
  const moveButton = panel.getByRole("button", { name: "Manual move…" });
  await tabTo(page, moveButton);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
  const to = dialog.getByRole("combobox", { name: "To-location" });
  await expect(to).toBeFocused();
  await expect(dialog).toContainText(`From ${from}`);
  await expect(dialog.getByLabel("From-location")).toHaveCount(0);
  const confirm = dialog.getByRole("button", { name: "Move", exact: true });
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await expect(confirm).toHaveAccessibleDescription("Enter a to-location.");

  // The from-location itself is refused with the server's sentence.
  await page.keyboard.type(from);
  const fromError = "This is the from-location. Choose another.";
  // The sentence shows under the field (the disabled Move button's tooltip repeats it, hidden).
  await expect(dialog.getByText(fromError, { exact: true }).first()).toBeVisible();
  await expect(to).toHaveAttribute("aria-invalid", "true");
  await expect(to).toHaveAccessibleDescription(fromError);
  await expect(confirm).toHaveAccessibleDescription(fromError);

  // Esc closes the option list, then clears the field; the dialog stays.
  await page.keyboard.press("Escape");
  await expect(to).toHaveAttribute("aria-expanded", "false");
  await expect(to).toHaveValue(from);
  await page.keyboard.press("Escape");
  await expect(to).toHaveValue("");
  await expect(dialog).toBeVisible();
  await expect(to).not.toHaveAttribute("aria-invalid", "true");

  // A code that is not in the Locations file.
  await page.keyboard.type("ZZ-99");
  await expect(dialog.getByText("ZZ-99 is not in the Locations file.", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(to).toHaveValue("");

  // An empty location picked with ↓ + Enter from the option list.
  await page.keyboard.type(target.prefix);
  await expect(to).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < target.downs; i++) await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("option", { name: target.code, exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(to).toHaveValue(target.code);
  await expect(to).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.locator("[data-move-effect]")).toHaveText("to an empty location");
  await expect(confirm).not.toHaveAttribute("aria-disabled");

  // Enter confirms: the toast names the move, the panel shows the new current location.
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(`Moved ${part}: ${from} → ${target.code} (Manual, round 0).`, { exact: true })).toBeVisible();
  // Story 7.3 (UX-DR14): a move toast offers Undo.
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
  await expect(dialog).toHaveCount(0);
  await expect(moveButton).toBeFocused();
  await expect(panel.locator(`[data-location-chip="${target.code}"]`)).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved automatically");
  expect(await planVersion(request, planId)).toBe(before + 1);

  // Move it back: the preview says the move is undone and the button reads Remove move.
  await page.keyboard.press("Enter");
  await expect(to).toBeFocused();
  await expect(dialog).toContainText(`From ${target.code}`);
  await page.keyboard.type(from);
  await expect(dialog.locator("[data-move-effect]")).toHaveText(
    `This undoes move 1: ${part} returns to ${from} and the move is removed.`,
  );
  const remove = dialog.getByRole("button", { name: "Remove move" });
  await expect(remove).not.toHaveAttribute("aria-disabled");
  // The option list is open on the typed code; Esc closes it, then Enter confirms.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(`Removed move 1: ${part} returns to ${from}.`, { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(panel.locator(`[data-location-chip="${from}"]`)).toBeVisible();
  expect(await planVersion(request, planId)).toBe(before + 2);
});

test("uj1 moves a part from a chosen other location", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Other from ${randomUUID().slice(0, 8)}`)).id;
  const roster = await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${planId}/parts`);
  let detail: Detail | undefined;
  for (const row of roster.parts) {
    if (row.current_location === null) continue;
    const candidate = await getJson<Detail>(request, `/api/plans/${planId}/parts/${encodeURIComponent(row.part)}`);
    if (candidate.other_locations.length > 0) {
      detail = candidate;
      break;
    }
  }
  expect(detail).toBeDefined();
  const part = detail!.part;
  const current = detail!.current_location!.code;
  const chosen = detail!.other_locations[0].location.code;
  const target = await emptyTarget(request, planId);

  const dialog = await openDialog(page, planId, part);
  const fromSelect = dialog.getByLabel("From-location");
  await expect(fromSelect).toHaveValue(current);
  await fromSelect.selectOption(chosen);
  await expect(fromSelect).toHaveValue(chosen);
  // Typed in lower case: the field sends the Locations file's exact code.
  await dialog.getByRole("combobox", { name: "To-location" }).focus();
  await enterTarget(page, dialog, target.code.toLowerCase(), "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(`Moved ${part}: ${chosen} → ${target.code} (Manual, round 0).`, { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel.locator(`[data-location-chip="${target.code}"]`)).toBeVisible();

  // Story 7.3 (FR-35, UX-DR14): the toast's Undo takes back exactly that move.
  await toasts(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toasts(page).getByText("Undid move 1.", { exact: true })).toBeVisible();
  await expect(panel.locator(`[data-location-chip="${target.code}"]`)).toHaveCount(0);
  const summary = await getJson<{ undo_preview: unknown }>(request, `/api/plans/${planId}`);
  expect(summary.undo_preview).toBeNull();
});

test("uj7 a part with no stock cannot be moved", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `No stock ${randomUUID().slice(0, 8)}`)).id;
  const roster = await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${planId}/parts`);
  const part = roster.parts.find((row) => row.current_location === null)!.part;

  await page.goto(`/plans/${planId}/parts?part=${encodeURIComponent(part)}`);
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel).toContainText(NO_STOCK);
  const moveButton = panel.getByRole("button", { name: "Manual move…" });
  await expect(moveButton).toHaveAttribute("aria-disabled", "true");
  await expect(moveButton).toHaveAccessibleDescription(NO_STOCK);
  // Focusable, and pressing it opens nothing.
  await moveButton.focus();
  await expect(moveButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("uj7 opens a part from the locations table and moves it", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Locations move ${randomUUID().slice(0, 8)}`)).id;
  const rows = await locationRows(request, planId);
  const source = rows.find((row) => row.contents.length > 0)!;
  const part = source.contents[0].part;
  const detail = await getJson<Detail>(request, `/api/plans/${planId}/parts/${encodeURIComponent(part)}`);
  const target = await emptyTarget(request, planId);

  await page.goto(`/plans/${planId}/locations?mode=list`);
  const table = page.getByRole("main").getByRole("table", { name: "Locations" });
  const opener = table.locator(`[data-open-part="${part}"]`).first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?mode=list&part=${encodeURIComponent(part)}$`));
  const panel = page.getByRole("complementary", { name: part });
  await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeFocused();

  const moveButton = panel.getByRole("button", { name: "Manual move…" });
  await tabTo(page, moveButton);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
  await expect(dialog.getByRole("combobox", { name: "To-location" })).toBeFocused();
  const from = detail.current_location!.code;
  if (detail.other_locations.length > 0) {
    await expect(dialog.getByLabel("From-location")).toHaveValue(from);
  } else {
    await expect(dialog).toContainText(`From ${from}`);
  }
  await enterTarget(page, dialog, target.code, "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(toasts(page).getByText(`Moved ${part}: ${from} → ${target.code} (Manual, round 0).`, { exact: true })).toBeVisible();

  // The Locations table shows the part at the target after the refetch.
  const targetRow = table.locator("tbody tr").filter({ has: page.getByText(target.code, { exact: true }) });
  await expect(targetRow.locator(`[data-open-part="${part}"]`)).toBeVisible();
  await expect(targetRow).toContainText("Occupied");
});

test("ad12 retries a command after a proxy 500 without the error envelope", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Proxy 500 ${randomUUID().slice(0, 8)}`)).id;
  const detail = await singleLocationPart(request, planId);
  const from = detail.current_location!.code;
  const target = await emptyTarget(request, planId);
  const before = await planVersion(request, planId);

  let posts = 0;
  // The retried POST waits until the page has been checked while the command is unconfirmed.
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/plans/${planId}/commands`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posts += 1;
    if (posts === 1) {
      await route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" });
      return;
    }
    await released;
    await route.fallback();
  });

  const dialog = await openDialog(page, planId, detail.part);
  await enterTarget(page, dialog, target.code, "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("save-status")).toContainText(RETRYING);
  // While unconfirmed, every plan-changing control is aria-disabled with the saving reason (FR-10).
  const saving = "Saving the last change…";
  const confirm = dialog.getByRole("button", { name: "Move", exact: true });
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await expect(confirm).toHaveAccessibleDescription(saving);
  const panelButton = page.getByRole("complementary", { name: detail.part, includeHidden: true }).locator("[data-manual-move]");
  await expect(panelButton).toHaveAttribute("aria-disabled", "true");
  await expect(panelButton).toHaveAccessibleDescription(saving);
  release();
  await expect(
    toasts(page).getByText(`Moved ${detail.part}: ${from} → ${target.code} (Manual, round 0).`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved automatically");
  expect(posts).toBe(2);
  expect(await planVersion(request, planId)).toBe(before + 1);
});

test("ad12 a 503 after the server applied the command retries to one version bump", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Applied 503 ${randomUUID().slice(0, 8)}`)).id;
  const detail = await singleLocationPart(request, planId);
  const from = detail.current_location!.code;
  const target = await emptyTarget(request, planId);
  const before = await planVersion(request, planId);

  const bodies: string[] = [];
  await page.route(`**/api/plans/${planId}/commands`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    bodies.push(route.request().postData() ?? "");
    if (bodies.length === 1) {
      // The server applies the command, but the page only sees a 503.
      const applied = await route.fetch();
      expect(applied.status()).toBe(200);
      await route.fulfill({ status: 503, contentType: "application/json", body: "" });
      return;
    }
    await route.fallback();
  });

  const dialog = await openDialog(page, planId, detail.part);
  await enterTarget(page, dialog, target.code, "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  const toast = toasts(page).getByText(`Moved ${detail.part}: ${from} → ${target.code} (Manual, round 0).`, { exact: true });
  await expect(toast).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Saved automatically");
  await expect(toast).toHaveCount(1);
  expect(bodies).toHaveLength(2);
  // The retry is the same command (same command_id), answered from the stored result.
  expect(bodies[1]).toBe(bodies[0]);
  expect(await planVersion(request, planId)).toBe(before + 1);
});
