import { expect, test } from "@playwright/test";

// No user journey covers the walking skeleton page; these tests name NFR-2 (local install).

test("nfr2 walking skeleton page shows backend ok", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Smart Warehouse Planner" })).toBeVisible();
  await expect(page.getByText("Backend: ok")).toBeVisible();
});

test("nfr2 walking skeleton page shows backend unreachable", async ({ page }) => {
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Backend: unreachable")).toBeVisible();
});

test("nfr2 health is rewritten from the frontend origin to the backend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
