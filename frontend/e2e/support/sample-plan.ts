import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type APIRequestContext, expect } from "@playwright/test";

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
