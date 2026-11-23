import { randomUUID } from "node:crypto";

import { createSamplePlan } from "./support/sample-plan";
import { type APIRequestContext, expect, type Page, test, toasts } from "./support/test";

// UJ-3 "continues a saved plan" as a logged-in user (Story 9.3; FR-11, FR-40, UX-DR4, AD-12):
// the avatar user menu names who is logged in, and when the session ends while the app is open,
// Log in opens and the page (and a change made meanwhile) comes back after logging in. The e2e
// server runs with FEATURE_AUTH=true. Each test starts logged out with its own account.

const SAME_SITE = { "Sec-Fetch-Site": "same-origin" };

test.use({ storageState: { cookies: [], origins: [] } });

function uniqueUsername(): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `uj3${Date.now()}${digits}`;
}

/** Signs up a new account; `request` then carries its session. */
async function signUp(request: APIRequestContext): Promise<string> {
  const username = uniqueUsername();
  const response = await request.post("/api/auth/signup", {
    data: { username, password: "secret", password_repeat: "secret" },
    headers: SAME_SITE,
  });
  expect(response.status(), await response.text()).toBe(201);
  return username;
}

/** Logs in through the Log in page, which must already be open. */
async function logIn(page: Page, username: string) {
  const card = page.getByRole("region", { name: "Log in" });
  await expect(card).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("secret");
  await card.getByRole("button", { name: "Log in" }).click();
}

test.describe("uj3 fr40 the logged-in user and session expiry", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj3 fr40 the avatar menu shows who is logged in", async ({ page, request }) => {
    test.setTimeout(90_000);
    const username = await signUp(request);
    const plan = await createSamplePlan(request, `Mine ${randomUUID().slice(0, 8)}`);
    await page.goto("/login");
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);

    const banner = page.getByRole("banner");
    const avatar = banner.getByRole("button", { name: "User menu" });
    await expect(avatar).toHaveText(username.slice(0, 2).toUpperCase());
    const box = await avatar.boundingBox();
    expect([box?.width, box?.height]).toEqual([34, 34]);
    await expect(banner.getByRole("button", { name: "Log out" })).toHaveCount(0);

    // Keyboard: Enter opens the menu, the arrows move, Esc closes it and focus returns to the avatar.
    await avatar.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Logged in as")).toBeVisible();
    await expect(menu.getByText(username, { exact: true })).toBeVisible();
    const logOut = menu.getByRole("menuitem", { name: "Log out" });
    await expect(logOut).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(avatar).toBeFocused();

    // The plan this user created says so in the saved-plans list.
    const row = page.getByRole("main").getByRole("table", { name: "Saved plans" }).getByRole("row", { name: plan.name });
    await expect(row).toContainText(username);
  });

  test("uj3 fr40 a change made after the session expired is sent after Log in", async ({ page, request }) => {
    test.setTimeout(120_000);
    const username = await signUp(request);
    const plan = await createSamplePlan(request, `Expiry ${randomUUID().slice(0, 8)}`);
    await page.goto("/login");
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);

    await page.goto(`/plans/${plan.id}/best-locations?mode=list`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Best locations", level: 1 })).toBeVisible();
    await main.getByRole("combobox", { name: "Aisle" }).selectOption("A");
    const markAisle = main.getByRole("button", { name: "Mark aisle A", exact: true });
    await expect(markAisle).toBeVisible();
    const planUrl = page.url();

    // The session ends while the plan is open; the next change meets a 401.
    await page.context().clearCookies();
    await markAisle.click();
    await expect(page).toHaveURL(/\/login$/);

    await logIn(page, username);
    await expect(page).toHaveURL(planUrl);
    await expect(main.getByRole("list", { name: "Best-location marks" }).getByText("Aisle A", { exact: true })).toBeVisible();
    await expect(toasts(page).getByText("Best-location marks changed.", { exact: true }).last()).toBeVisible();

    // Saved once, by this user.
    const view = (await (await request.get(`/api/plans/${plan.id}/locations`)).json()) as { marks: unknown[] };
    expect(view.marks).toHaveLength(1);
    const summary = (await (await request.get(`/api/plans/${plan.id}`)).json()) as {
      last_edited_by: string;
      version: number;
    };
    expect(summary.last_edited_by).toBe(username);
    expect(summary.version).toBe(2);
  });

  test("uj3 fr40 a change held after the session expired is sent after Create account", async ({ page, request }) => {
    test.setTimeout(120_000);
    const username = await signUp(request);
    const plan = await createSamplePlan(request, `Signup ${randomUUID().slice(0, 8)}`);
    await page.goto("/login");
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);

    await page.goto(`/plans/${plan.id}/best-locations?mode=list`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Best locations", level: 1 })).toBeVisible();
    await main.getByRole("combobox", { name: "Aisle" }).selectOption("A");
    const markAisle = main.getByRole("button", { name: "Mark aisle A", exact: true });
    await expect(markAisle).toBeVisible();
    const planUrl = page.url();

    await page.context().clearCookies();
    await markAisle.click();
    await expect(page).toHaveURL(/\/login$/);

    // A new account instead of the old one: Create account returns to the plan too.
    await page.getByRole("region", { name: "Log in" }).getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    const newUser = uniqueUsername();
    const card = page.getByRole("region", { name: "Create account" });
    await page.getByLabel("Username").fill(newUser);
    await page.getByLabel("Password", { exact: true }).fill("secret");
    await page.getByLabel("Repeat password").fill("secret");
    await card.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(planUrl);
    await expect(main.getByRole("list", { name: "Best-location marks" }).getByText("Aisle A", { exact: true })).toBeVisible();

    const view = (await (await request.get(`/api/plans/${plan.id}/locations`)).json()) as { marks: unknown[] };
    expect(view.marks).toHaveLength(1);
    const summary = (await (await request.get(`/api/plans/${plan.id}`)).json()) as { last_edited_by: string };
    expect(summary.last_edited_by).toBe(newUser);
  });

  test("uj3 fr40 a page opened after the session expired returns after Log in", async ({ page, request }) => {
    test.setTimeout(90_000);
    const username = await signUp(request);
    const plan = await createSamplePlan(request, `Return ${randomUUID().slice(0, 8)}`);
    await page.goto("/login");
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);

    await page.goto(`/plans/${plan.id}/overview`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

    await page.context().clearCookies();
    await page.getByRole("navigation", { name: "Plan steps" }).getByRole("link", { name: /^\d*Parts/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(toasts(page).getByText("Log in to continue.")).toHaveCount(0);

    await logIn(page, username);
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/parts$`));
    await expect(main.getByRole("heading", { name: "Parts", level: 1 })).toBeVisible();
  });
});
