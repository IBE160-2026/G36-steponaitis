import { expect, type Page, test } from "./support/test";

// UJ-5 "other ways in": Create account (Story 9.1, FR-39, UX-DR53). The e2e server runs with
// FEATURE_AUTH=true and reuses backend/var/e2e.db within a run, so every test signs up a
// fresh username. These tests start logged out (the shared fixture logs every other spec in).

const TAKEN = "That username is taken. Try another.";
const MISMATCH = "The passwords don’t match.";
const ACCOUNT_LIMIT = "The demo has reached its account limit. Use Demo version instead.";

function uniqueUsername(): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `uj5${Date.now()}${digits}`; // 3 + 13 + 6 = 22 letters and numbers
}

function card(page: Page) {
  return page.getByRole("region", { name: "Create account" });
}

async function fill(page: Page, username: string, password: string, repeat: string) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Repeat password").fill(repeat);
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("fr39 create account", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("fr39 the page is a 380px card under a header with only the logo and name", async ({ page }) => {
    await page.goto("/signup");

    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Smart Warehouse Planner" })).toBeVisible();
    await expect(banner.getByRole("navigation")).toHaveCount(0);
    await expect(banner.getByRole("button")).toHaveCount(0);

    const section = card(page);
    await expect(section).toBeVisible();
    expect((await section.boundingBox())?.width).toBe(380);
    await expect(section.getByRole("heading", { level: 1, name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAccessibleDescription(
      "Letters and numbers. Must not be taken.",
    );
    for (const field of [
      page.getByLabel("Username"),
      page.getByLabel("Password", { exact: true }),
      page.getByLabel("Repeat password"),
    ]) {
      expect((await field.boundingBox())?.height).toBe(40);
    }
    await expect(section.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(section.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");

    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await section.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await section.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("fr39 uj5 errors show per field, then a new account opens the saved-plans list", async ({ page }) => {
    await page.goto("/signup");
    const section = card(page);
    const username = page.getByLabel("Username");
    const repeat = page.getByLabel("Repeat password");

    // A reserved name and a mismatch: both fields fail, focus goes to the first.
    await fill(page, "Planner", "secret", "secreT");
    await section.getByRole("button", { name: "Create account" }).click();

    await expect(section.getByText(TAKEN)).toBeVisible();
    await expect(section.getByText(MISMATCH)).toBeVisible();
    await expect(username).toHaveAttribute("aria-invalid", "true");
    await expect(repeat).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Password", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
    await expect(username).toBeFocused();

    const name = uniqueUsername();
    await fill(page, name, "secret", "secret");
    await section.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/plans$/);
    const session = await page.request.get("/api/session");
    expect((await session.json()).user).toBe(name);
  });

  test("fr39 a taken username is reported with focus on the username", async ({ page, request }) => {
    const name = uniqueUsername();
    // The `request` fixture has its own cookie jar, so the page stays signed out.
    const response = await request.post("/api/auth/signup", {
      data: { username: name, password: "secret", password_repeat: "secret" },
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    expect(response.status(), await response.text()).toBe(201);

    await page.goto("/signup");
    await page.getByLabel("Password", { exact: true }).focus();
    await fill(page, name.toUpperCase(), "secret", "secret");
    await card(page).getByRole("button", { name: "Create account" }).click();

    await expect(card(page).getByText(TAKEN)).toBeVisible();
    await expect(page.getByLabel("Username")).toBeFocused();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("fr39 uj5 a full demo refuses a new account", async ({ page }) => {
    // The e2e server runs with FEATURE_DEMO off, so the real 409 envelope is answered here.
    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "limit_reached", message: ACCOUNT_LIMIT, details: [{ limit: "max_accounts" }] },
        }),
      }),
    );
    await page.goto("/signup");
    const name = uniqueUsername();
    await fill(page, name, "secret", "secret");
    await card(page).getByRole("button", { name: "Create account" }).click();

    const alert = card(page).getByRole("alert");
    await expect(alert).toHaveText(ACCOUNT_LIMIT);
    await expect(alert).toHaveCount(1);
    await expect(page.getByLabel("Username")).toHaveValue(name);
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("fr39 the page is a 404 when the session reports auth off", async ({ page }) => {
    await page.route("**/api/session", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, feature_auth: false } });
    });

    await page.goto("/signup");

    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
