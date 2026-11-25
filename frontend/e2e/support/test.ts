import { expect as baseExpect, test as base } from "@playwright/test";

import type { BrowserContextOptions, Locator, Page, PlaywrightWorkerArgs } from "@playwright/test";

export { type APIRequestContext, type Locator, type Page } from "@playwright/test";

/** Playwright's default `expect` timeout (the config sets none). */
const EXPECT_TIMEOUT_MS = 5_000;

/**
 * Locator matchers that need the element to exist. While a locator matches nothing, Playwright
 * 1.65 renders an aria snapshot of the whole page on every `expect` poll (for the error message).
 * On the Parts and Locations pages (about 30,000 elements) that takes ~0.3 s in Chromium and
 * blocks Firefox's main thread for the whole timeout, so the app never renders what the test
 * waits for. These matchers first wait for the element with `locator.waitFor` (no snapshot), then
 * run the real matcher within the same total timeout. `.not` and count matchers pass through.
 * `expect(page).toHaveURL` snapshots the same way while the URL differs, so it first waits with
 * `page.waitForURL`.
 */
const NEEDS_ELEMENT = new Set([
  "toBeAttached",
  "toBeChecked",
  "toBeDisabled",
  "toBeEditable",
  "toBeEmpty",
  "toBeEnabled",
  "toBeFocused",
  "toBeInViewport",
  "toBeVisible",
  "toContainText",
  "toHaveAccessibleDescription",
  "toHaveAccessibleName",
  "toHaveAttribute",
  "toHaveClass",
  "toHaveCSS",
  "toHaveId",
  "toHaveRole",
  "toHaveText",
  "toHaveValue",
  "toHaveValues",
]);

type Options = { timeout?: number };

function isLocator(value: unknown): value is Locator {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Locator).waitFor === "function" &&
    typeof (value as Locator).first === "function"
  );
}

function isPage(value: unknown): value is Page {
  return typeof value === "object" && value !== null && typeof (value as Page).waitForURL === "function";
}

function isOptions(value: unknown): value is Options {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** Runs `wait` (errors ignored), then `matcher` with what is left of the one timeout. */
function waitingMatcher(
  wait: (timeout: number, args: unknown[]) => Promise<unknown>,
  matcher: (...args: unknown[]) => Promise<void>,
) {
  return async (...args: unknown[]) => {
    const last = args.at(-1);
    const options: Options = isOptions(last) ? last : {};
    const rest = isOptions(last) ? args.slice(0, -1) : args;
    const timeout = options.timeout ?? EXPECT_TIMEOUT_MS;
    const started = Date.now();
    // A miss is reported by the real matcher below (with Playwright's message), not here.
    await wait(timeout, rest).catch(() => undefined);
    const remaining = Math.max(1, timeout - (Date.now() - started));
    return matcher(...rest, { ...options, timeout: remaining });
  };
}

function withWait<T extends object>(matchers: T, subject: Locator | Page): T {
  return new Proxy(matchers, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof value !== "function") return value;
      const matcher = value.bind(target);
      if (isLocator(subject) && NEEDS_ELEMENT.has(property)) {
        return waitingMatcher((timeout) => subject.first().waitFor({ state: "attached", timeout }), matcher);
      }
      if (isPage(subject) && property === "toHaveURL") {
        // `toHaveURL` takes a string, RegExp or predicate, as `waitForURL` does.
        return waitingMatcher(
          (timeout, [url]) => subject.waitForURL(url as Parameters<Page["waitForURL"]>[0], { timeout, waitUntil: "commit" }),
          matcher,
        );
      }
      return value;
    },
  });
}

/** `expect` from `@playwright/test`; matchers wait for the element or URL first (see above). */
export const expect = new Proxy(baseExpect, {
  apply(target, thisArg, args: Parameters<typeof baseExpect>) {
    const matchers = Reflect.apply(target, thisArg, args);
    const subject = args[0];
    return isLocator(subject) || isPage(subject) ? withWait(matchers, subject) : matchers;
  },
});

/**
 * The toast list (sonner's `[data-sonner-toaster]`). Look toasts up here rather than with a
 * page-wide `page.getByText`: on the Parts and Locations pages one page-wide text or role query
 * takes about 0.5 s in Firefox, on the page's main thread.
 */
export function toasts(page: Page): Locator {
  return page.locator("[data-sonner-toaster]");
}

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

/** The fixed e2e account every spec runs as (Story 9.2): the server runs with FEATURE_AUTH on. */
export const E2E_USER = { username: "e2eplanner", password: "e2e-secret" } as const;

const SAME_SITE = { "Sec-Fetch-Site": "same-origin" };

/**
 * Log the e2e account in through the API and return its cookie as a storage state. Signs up first
 * and logs in only when the sign-up is refused (the account exists, or another worker won the
 * race): a login for a missing account would count as a failed login, and many workers starting
 * on a fresh database at once would lock the username (FR-40, Story 16.0). Undefined when
 * /api/auth/signup is 404: a reused server with auth off.
 */
async function logInE2eUser(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined) {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: SAME_SITE });
  try {
    const signup = await api.post("/api/auth/signup", {
      data: { ...E2E_USER, password_repeat: E2E_USER.password },
    });
    if (signup.status() === 404) return undefined;
    let response = signup;
    if (signup.status() !== 201) {
      // Every worker logs in at once on a reused server; attempts are counted before the password
      // check (Story 16.0), so a burst can meet 429 `login_locked` until the first success clears it.
      for (let attempt = 0; ; attempt++) {
        response = await api.post("/api/auth/login", { data: E2E_USER });
        if (response.status() !== 429 || attempt >= 5) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!response.ok()) throw new Error(`e2e login failed: ${response.status()} ${await response.text()}`);
    return (await api.storageState()) as StorageState;
  } finally {
    await api.dispose();
  }
}

// Shared `test` for every e2e spec.
// - Every browser context and the `request` fixture carry the e2e account's session cookie (one
//   login per worker). A spec that needs a logged-out visitor opts out with
//   `test.use({ storageState: { cookies: [], origins: [] } })`.
// - After the test body, unroute all page.route handlers with ignoreErrors before the page closes,
//   so a handler still inside route.fetch/continue cannot report "route.fetch: Test ended" outside
//   any test (CI run 45017052318). Not "wait": a handler awaiting a held promise would hang teardown.
export const test = base.extend<object, { e2eSession: StorageState | undefined }>({
  e2eSession: [
    async ({ playwright }, provide, workerInfo) => {
      await provide(await logInE2eUser(playwright, workerInfo.project.use.baseURL));
    },
    { scope: "worker" },
  ],
  storageState: async ({ e2eSession }, provide) => provide(e2eSession),
  // Playwright's own `request` ignores `storageState`; this one carries the same cookie.
  request: async ({ playwright, baseURL, storageState }, provide) => {
    const request = await playwright.request.newContext({ baseURL, storageState });
    await provide(request);
    await request.dispose();
  },
  page: async ({ page }, runTest) => {
    await runTest(page);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  },
});
