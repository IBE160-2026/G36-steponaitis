import { expect, type Page, test } from "./support/test";

// UJ-5 "an examiner tries the app" (Story 9.6, FR-40, FR-50, NFR-5, UX-DR54): the demo front page.
// The e2e server runs as a local install (FEATURE_DEMO off, which keeps the suite free of the
// 50-plan demo cap), so these tests turn the flag on in the browser only, as demo-version.spec.ts
// does: GET /api/session is rewritten to `feature_demo: true` and POST /api/auth/demo is forwarded to
// a real `demo`/`demo` login.

test.use({ storageState: { cookies: [], origins: [] } });

const HEADLINE = "Every move comes with a reason.";
const PANELS = ["In your export", "Classified fast", "You decide", "On the move list"];

async function turnDemoOn(page: Page) {
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, feature_demo: true } });
  });
  await page.route("**/api/auth/demo", async (route) => {
    const request = route.request();
    const response = await route.fetch({
      url: new URL("/api/auth/login", request.url()).toString(),
      method: "POST",
      headers: { ...request.headers(), "content-type": "application/json" },
      postData: JSON.stringify({ username: "demo", password: "demo" }),
    });
    await route.fulfill({ response });
  });
}

function hero(page: Page) {
  return page.getByRole("main");
}

test.describe("uj5 the demo front page", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await turnDemoOn(page);
  });

  test("nfr5 uj5 the demo front page shows the flow and its three ways in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);

    const banner = page.getByRole("banner");
    await expect(banner).toHaveCount(1);
    await expect(banner.getByText("Smart Warehouse Planner", { exact: true })).toBeVisible();
    await expect(banner.getByRole("link", { name: "How it works" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    // The app toolbar, its flow bar and the avatar are absent.
    await expect(banner.getByRole("button", { name: "User menu" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Plan steps" })).toHaveCount(0);

    const main = hero(page);
    await expect(main.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    await expect(main.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Create account" })).toBeVisible();
    const demo = main.getByRole("button", { name: "Demo version" });
    await expect(demo).toBeVisible();
    await expect(demo.locator('[data-icon="play"]')).toBeVisible();
    await expect(main.getByRole("img", { name: /A shelf wall in aisle G, section 14/ })).toBeVisible();
    await expect(main.getByText("RULE 1 · MOVE 1")).toBeVisible();

    const flow = page.locator("#how-it-works");
    await expect(flow.getByRole("heading", { level: 2, name: "One part, start to finish" })).toBeVisible();
    const items = flow.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
    await expect(items).toHaveCount(4);
    for (const [index, title] of PANELS.entries()) {
      await expect(items.nth(index).getByRole("heading", { level: 3 })).toHaveText(title);
    }
    // Static illustrations: no control inside the panels.
    await expect(flow.getByRole("button")).toHaveCount(0);
    await expect(flow.getByRole("link")).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 500 });
    await expect(flow.getByRole("heading", { level: 2 })).not.toBeInViewport();
    await banner.getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(flow.getByRole("heading", { level: 2 })).toBeInViewport();

    // Nothing scrolls sideways at 320px wide.
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(main.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("fr50 uj5 Demo version from the front page opens the saved-plans list as demo, and Log out returns to the front page", async ({
    page,
  }) => {
    await page.goto("/");
    await hero(page).getByRole("button", { name: "Demo version" }).click();

    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    const avatar = page.getByRole("banner").getByRole("button", { name: "User menu" });
    await expect(avatar).toHaveText("DE");

    await avatar.click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "User menu" })).toHaveCount(0);
  });

  test("fr40 uj5 Log in and Create account on the front page open their pages", async ({ page }) => {
    await page.goto("/");
    await hero(page).getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("region", { name: "Log in" })).toBeVisible();

    await page.goto("/");
    await hero(page).getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("region", { name: "Create account" })).toBeVisible();
  });
});
