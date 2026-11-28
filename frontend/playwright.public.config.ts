import { defineConfig, devices } from "@playwright/test";

// Post-deploy check of the public deployment (Story 16.2, UJ-5, FR-40, FR-50, NFR-5, NFR-6): runs
// the production-like specs of e2e/production against the live site instead of a local server.
// Opt-in, run by hand after a deploy with `npm run e2e:public`; never in CI (CI finishes before
// Vercel deploys). The specs create no plan and no new account (Demo version recreates the `demo`
// account if its row is missing); Log in as `demo` is not throttled while Demo version is on and
// writes nothing. PUBLIC_URL picks another origin.
// The public demo password is published as `demo` on purpose (README "Deploy"); it is no secret.
process.env.E2E_DEMO_PASSWORD ||= "demo";

export default defineConfig({
  testDir: "./e2e/production",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: the live site must pass on the first try; a retry would hide a real failure as flaky.
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PUBLIC_URL || "https://g36steponaitis.vercel.app",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
