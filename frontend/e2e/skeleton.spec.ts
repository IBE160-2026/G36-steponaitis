import { expect, test } from "./support/test";

// No user journey covers the walking skeleton; these tests name NFR-2 (local install). `/` now
// redirects to a plan (Story 1.9), so the frontend is checked on New Plan.

test("nfr2 frontend serves the app shell", async ({ page }) => {
  await page.goto("/plans/new");
  await expect(page.getByRole("link", { name: "Smart Warehouse Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
});

test("nfr2 health is rewritten from the frontend origin to the backend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
