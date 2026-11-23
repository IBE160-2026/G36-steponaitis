import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type APIRequestContext, expect, type Page } from "./test";

// Shared by the journeys that need a plan made from `data/sample/` through the API.

export const SAMPLE = join(__dirname, "..", "..", "..", "data", "sample");
export const SAMPLE_FILES = {
  locations: "Locations.xlsx",
  inventory: "Inventory.xlsx",
  transactions: "transactions.xlsx",
};
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type CreatedPlan = { id: string; name: string; uploaded_at: string };

/** Creates a plan from the sample files and returns the created plan JSON. */
export async function createSamplePlan(request: APIRequestContext, name: string): Promise<CreatedPlan> {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = { name };
  for (const [role, file] of Object.entries(SAMPLE_FILES)) {
    multipart[role] = { name: file, mimeType: XLSX, buffer: readFileSync(join(SAMPLE, file)) };
  }
  const response = await request.post("/api/plans", {
    multipart,
    headers: { "Sec-Fetch-Site": "same-origin" },
    timeout: 30_000,
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as CreatedPlan;
}

/** Chooses the three sample files on the open New Plan page (Locations, Inventory, Transactions). */
export async function chooseSampleFiles(page: Page) {
  await page.getByLabel("Locations", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.locations));
  await page.getByLabel("Inventory", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.inventory));
  await page.getByLabel("Transactions", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.transactions));
}

/**
 * New Plan through the page: opens /plans/new (unless it is already open), names the plan, chooses
 * the three sample files and submits; returns the new plan's id once its overview has opened.
 */
export async function newPlanThroughUi(page: Page, name: string): Promise<string> {
  if (!/\/plans\/new$/.test(new URL(page.url()).pathname)) await page.goto("/plans/new");
  await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
  await page.getByLabel("Plan name").fill(name);
  await chooseSampleFiles(page);
  await page.getByRole("button", { name: "New Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
  return new URL(page.url()).pathname.split("/")[2];
}
