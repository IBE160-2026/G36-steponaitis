import { type APIRequestContext, expect, type Page, test } from "./support/test";

// UJ-3 "continues a saved plan", entered through Log in (Story 9.2, FR-40, UX-DR53). The e2e
// server runs with FEATURE_AUTH=true. These tests start logged out and sign up their own account
// through the API, so they never log the shared e2e account out.

const WRONG_LOGIN = "Wrong username or password. Check both and try again.";
const LOGIN_LOCKED = "Too many failed logins for this username. Wait a minute and try again.";

test.use({ storageState: { cookies: [], origins: [] } });

function uniqueUsername(): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `uj3${Date.now()}${digits}`;
}

async function signUp(request: APIRequestContext): Promise<string> {
  const username = uniqueUsername();
  const response = await request.post("/api/auth/signup", {
    data: { username, password: "secret", password_repeat: "secret" },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(201);
  return username;
}

function card(page: Page) {
  return page.getByRole("region", { name: "Log in" });
}

test.describe("fr40 uj3 log in and log out", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("fr40 uj3 a visitor without a session is sent to Log in, a 380px card under the logo", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);

    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Smart Warehouse Planner" })).toBeVisible();
    await expect(banner.getByRole("navigation")).toHaveCount(0);
    await expect(banner.getByRole("button")).toHaveCount(0);

    const section = card(page);
    await expect(section).toBeVisible();
    expect((await section.boundingBox())?.width).toBe(380);
    await expect(section.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
    await expect(section.getByText("Plans are shared by everyone who logs in.")).toBeVisible();
    for (const field of [page.getByLabel("Username"), page.getByLabel("Password", { exact: true })]) {
      expect((await field.boundingBox())?.height).toBe(40);
    }
    const submit = section.getByRole("button", { name: "Log in" });
    const form = section.locator("form");
    expect((await submit.boundingBox())?.width).toBe((await form.boundingBox())?.width);
    await expect(section.getByText("No account?")).toBeVisible();
    await expect(section.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup");
    await expect(section.getByRole("button", { name: "Show password" })).toBeVisible();

    await page.goto("/plans");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("fr40 uj3 a wrong password is one alert, then the right one opens the saved plans", async ({
    page,
    request,
  }) => {
    const username = await signUp(request);
    await page.goto("/login");
    const section = card(page);
    const password = page.getByLabel("Password", { exact: true });

    await page.getByLabel("Username").fill(username);
    await password.fill("wrong1");
    await section.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await section.getByRole("button", { name: "Log in" }).click();

    const alert = section.getByRole("alert");
    await expect(alert).toHaveText(WRONG_LOGIN);
    await expect(alert).toHaveCount(1);
    await expect(page.getByLabel("Username")).toHaveValue(username);
    await expect(password).toHaveValue("");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);

    await password.fill("secret");
    await section.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/plans$/);
    expect((await (await page.request.get("/api/session")).json()).user).toBe(username);
    await page.goto("/");
    await expect(page).toHaveURL(/\/plans$/);
  });

  test("fr40 uj3 Log out returns to Log in and the plans need a login again", async ({ page, request }) => {
    const username = await signUp(request);
    await page.goto("/login");
    await page.getByLabel("Username").fill(username.toUpperCase());
    await page.getByLabel("Password", { exact: true }).fill("secret");
    await card(page).getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();

    // Log out is in the avatar user menu (Story 9.3).
    await page.getByRole("banner").getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(card(page)).toBeVisible();
    expect((await page.context().cookies()).filter((c) => c.name === "swp_session")).toEqual([]);
    expect((await page.request.get("/api/plans")).status()).toBe(401);

    // Back in history, from the client cache alone: the session is logged out and no plan data shows.
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(card(page)).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "User menu" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Saved plans" })).toHaveCount(0);

    await page.goto("/plans");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("fr40 uj3 five wrong logins lock the username for a minute", async ({ page }) => {
    // A fresh name with no account: failures count per username whether or not it exists.
    const username = uniqueUsername();
    await page.goto("/login");
    const section = card(page);
    const alert = section.getByRole("alert");
    const password = page.getByLabel("Password", { exact: true });
    const submit = section.getByRole("button", { name: "Log in" });

    await page.getByLabel("Username").fill(username);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await password.fill(`wrong${attempt}`);
      const answered = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
      await submit.click();
      expect((await answered).status()).toBe(401);
      await expect(alert).toHaveText(WRONG_LOGIN);
      await expect(password).toHaveValue("");
    }

    await password.fill("wrong6");
    const locked = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
    await submit.click();
    expect((await locked).status()).toBe(429);
    await expect(alert).toHaveText(LOGIN_LOCKED);
    await expect(alert).toHaveCount(1);
    await expect(page.getByLabel("Username")).toHaveValue(username);
    await expect(password).toHaveValue("wrong6");
    await expect(page).toHaveURL(/\/login$/);

    // Another username is not locked.
    await page.getByLabel("Username").fill(uniqueUsername());
    await password.fill("wrong7");
    await submit.click();
    await expect(alert).toHaveText(WRONG_LOGIN);
  });

  test("fr40 the page is a 404 when the session reports auth off", async ({ page }) => {
    await page.route("**/api/session", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, feature_auth: false } });
    });

    await page.goto("/login");

    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
