import { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";

// Shared by the journeys that read plan views through the API and make manual moves.

export type Ref = { code: string; aisle: string };
export type RosterRow = { part: string; current_location: Ref | null };
export type Detail = { part: string; current_location: Ref | null; other_locations: { location: Ref }[] };
export type LocationRow = { location: Ref; occupied: boolean; contents: { part: string }[] };

export async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}

export async function planVersion(request: APIRequestContext, planId: string): Promise<number> {
  return (await getJson<{ version: number }>(request, `/api/plans/${planId}`)).version;
}

export async function partDetail(request: APIRequestContext, planId: string, part: string): Promise<Detail> {
  return getJson<Detail>(request, `/api/plans/${planId}/parts/${encodeURIComponent(part)}`);
}

export async function locationRows(request: APIRequestContext, planId: string): Promise<LocationRow[]> {
  return (await getJson<{ locations: LocationRow[] }>(request, `/api/plans/${planId}/locations`)).locations;
}

/** Types the whole code and waits for the allowed preview's effect line. */
export async function enterTarget(page: Page, dialog: Locator, code: string, effect: string) {
  await page.keyboard.type(code);
  await expect(dialog.locator("[data-move-effect]")).toHaveText(effect);
}

/**
 * In an open part panel: Manual move… → type `to` → confirm (Esc closes the option list, Enter
 * confirms); waits for the move's toast.
 */
export async function moveFromPanel(page: Page, panel: Locator, part: string, from: string, to: string) {
  await panel.getByRole("button", { name: "Manual move…" }).click();
  const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
  await expect(dialog.getByRole("combobox", { name: "To-location" })).toBeFocused();
  await enterTarget(page, dialog, to, "to an empty location");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Moved ${part}: ${from} → ${to} (Manual, round 0).`, { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

export type Occupancy = { locations: number; occupied: number; empty: number; occupied_percent: string };

/** The page's occupancy line for `occupancy` ("Aisle A · 79.2% occupied · 1 of 2 locations · 1 empty"). */
export function occupancyLine(label: string, occupancy: Occupancy): string {
  const n = (value: number) => value.toLocaleString("en-US");
  const noun = occupancy.locations === 1 ? "location" : "locations";
  return `${label} · ${occupancy.occupied_percent}% occupied · ${n(occupancy.occupied)} of ${n(occupancy.locations)} ${noun} · ${n(occupancy.empty)} empty`;
}
