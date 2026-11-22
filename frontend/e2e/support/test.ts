import { test as base } from "@playwright/test";

export { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";

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
