import { expect, type Page, test } from "../support/test";

// UJ-5 "an examiner tries the app" (Story 9.7, FR-50, NFR-5, NFR-6) against the production-like
// build of playwright.production.config.ts: APP_ENV=production with FEATURE_AUTH and FEATURE_DEMO
// on. Unlike e2e/front-page.spec.ts, nothing is rewritten in the browser (no page.route).

test.use({ storageState: { cookies: [], origins: [] } });

const HEADLINE = "Every move comes with a reason.";

function hero(page: Page) {
  return page.getByRole("main");
}

function avatar(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: "User menu" });
}

async function openDemoVersion(page: Page) {
  await page.goto("/");
  await expect(hero(page).getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
  await hero(page).getByRole("button", { name: "Demo version" }).click();
  await expect(page).toHaveURL(/\/plans$/);
}

test.describe("uj5 the production-like build", () => {
  test("fr50 nfr5 uj5 the production-like build shows the front page, Demo version opens the saved-plans list as demo, and Log out returns to the front page", async ({
    page,
  }) => {
    const session = await page.request.get("/api/session");
    expect(session.ok()).toBe(true);
    const body = (await session.json()) as { user: unknown; feature_auth: boolean; feature_demo: boolean };
    expect(body.feature_auth).toBe(true);
    expect(body.feature_demo).toBe(true);
    expect(body.user).toBeNull();

    await openDemoVersion(page);
    await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await expect(avatar(page)).toHaveText("DE");

    await avatar(page).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    await expect(avatar(page)).toHaveCount(0);
  });

  test("nfr6 uj5 the session cookie is Secure in the production-like build", async ({ page, context }) => {
    await openDemoVersion(page);
    await expect(avatar(page)).toHaveText("DE");

    // Chromium treats http://localhost as a secure context and keeps the Secure cookie (why the
    // production config runs Chromium only).
    const cookie = (await context.cookies()).find((candidate) => candidate.name === "swp_session");
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
  });
});
