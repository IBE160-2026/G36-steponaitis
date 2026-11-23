import { type APIRequestContext, expect, type Page } from "./test";

// Shared by the journeys that start logged out (login, signup, session expiry, the demo and the
// user journeys): unique usernames, sign-up through the API, Log in through the page and the demo
// flag turned on in the browser only.

const SAME_SITE = { "Sec-Fetch-Site": "same-origin" };

/** The demo front page's headline and the titles of its four panels (UJ-5). */
export const HEADLINE = "Every move comes with a reason.";
export const PANELS = ["In your export", "Classified fast", "You decide", "On the move list"];

/** The password every account made by `signUp` has. */
export const PASSWORD = "secret";

/**
 * A fresh username: `prefix`, the time and six random digits, letters and numbers only. With a
 * three-letter prefix that is 3 + 13 + 6 = 22 letters and numbers.
 */
export function uniqueUsername(prefix = "uj3"): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `${prefix}${Date.now()}${digits}`;
}

/** Signs up a new account through the API; `request` then carries its session. */
export async function signUp(request: APIRequestContext, prefix = "uj3"): Promise<string> {
  const username = uniqueUsername(prefix);
  const response = await request.post("/api/auth/signup", {
    data: { username, password: PASSWORD, password_repeat: PASSWORD },
    headers: SAME_SITE,
  });
  expect(response.status(), await response.text()).toBe(201);
  return username;
}

/** Logs in through the Log in page, which must already be open. */
export async function logIn(page: Page, username: string, password = PASSWORD) {
  const card = page.getByRole("region", { name: "Log in" });
  await expect(card).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await card.getByRole("button", { name: "Log in" }).click();
}

/**
 * The e2e server runs as a local install (FEATURE_DEMO off, which keeps the suite free of the
 * 50-plan demo cap), so the demo is turned on in this browser only: GET /api/session is rewritten
 * to `feature_demo: true` and POST /api/auth/demo is forwarded to a real `demo`/`demo` login.
 * `onDemo` sees the method of every request to /api/auth/demo.
 */
export async function turnDemoOn(page: Page, onDemo?: (method: string) => void) {
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, feature_demo: true } });
  });
  await page.route("**/api/auth/demo", async (route) => {
    const request = route.request();
    onDemo?.(request.method());
    const response = await route.fetch({
      url: new URL("/api/auth/login", request.url()).toString(),
      method: "POST",
      headers: { ...request.headers(), "content-type": "application/json" },
      postData: JSON.stringify({ username: "demo", password: "demo" }),
    });
    await route.fulfill({ response });
  });
}
