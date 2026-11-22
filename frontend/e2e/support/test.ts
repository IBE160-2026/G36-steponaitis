import { expect as baseExpect, test as base } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

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

// Shared `test` for every e2e spec. After the test body, unroute all page.route handlers with
// ignoreErrors before the page closes, so a handler still inside route.fetch/continue cannot report
// "route.fetch: Test ended" outside any test (CI run 45017052318). Not "wait": a handler awaiting a
// held promise would hang teardown.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await runTest(page);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  },
});
