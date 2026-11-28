import { expect, type Page, test } from "../support/test";

// UJ-5 "an examiner tries the app" (Story 9.7, Story 16.2, FR-40, FR-50, NFR-5, NFR-6) against the
// production-like build (playwright.production.config.ts, `npm run e2e:production`) or the public
// deployment (playwright.public.config.ts, `npm run e2e:public`): APP_ENV=production with
// FEATURE_AUTH and FEATURE_DEMO on. Unlike e2e/front-page.spec.ts, nothing is rewritten in the
// browser (no page.route). The tests create no plan and no new account (Demo version recreates the
// `demo` account if its row is missing), so they are safe on the public site; Log in writes and
// clears one login_attempts row.

test.use({ storageState: { cookies: [], origins: [] } });

const HEADLINE = "Every move comes with a reason.";

// A login on the public deployment can take several seconds (a cold Vercel function plus the bcrypt
// check against Supabase), longer than the default 5 s; locally it takes well under one.
const LOGIN_TIMEOUT_MS = 30_000;

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
  await expect(page).toHaveURL(/\/plans$/, { timeout: LOGIN_TIMEOUT_MS });
}

test.describe("uj5 the production deployment", () => {
  test("fr50 nfr5 uj5 production shows the front page, Demo version opens the saved-plans list as demo, and Log out returns to the front page", async ({
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

  test("fr40 uj5 Log in as demo with the demo password opens the saved-plans list as demo", async ({ page }) => {
    const demoPassword = process.env.E2E_DEMO_PASSWORD;
    expect(demoPassword, "E2E_DEMO_PASSWORD must be set by the Playwright config").toBeTruthy();

    await page.goto("/login");
    const section = page.getByRole("region", { name: "Log in" });
    await expect(section.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
    await page.getByLabel("Username").fill("demo");
    await page.getByLabel("Password", { exact: true }).fill(demoPassword ?? "");
    await section.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/plans$/, { timeout: LOGIN_TIMEOUT_MS });
    await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await expect(avatar(page)).toHaveText("DE");
  });

  test("nfr6 uj5 the session cookie is Secure in production", async ({ page, context }) => {
    await openDemoVersion(page);
    await expect(avatar(page)).toHaveText("DE");

    // Local run only (`e2e:production` over http://localhost): Chromium treats localhost as a secure
    // context and keeps the Secure cookie, which is why that config runs Chromium only. The public
    // run is https.
    const cookie = (await context.cookies()).find((candidate) => candidate.name === "swp_session");
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
  });
});
