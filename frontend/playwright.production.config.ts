import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const repoRoot = join(__dirname, "..");

// Production-like run (Story 9.7, UJ-5, NFR-6): the same production build and multi-worker backend
// as playwright.config.ts, but with APP_ENV=production and both flags on, so the demo front page and
// Demo version are tested with the real FEATURE_DEMO flag. Run with `npm run e2e:production`.
// Throwaway secrets, generated per run and never written to disk; they pass the startup check.
const jwtSecret = randomBytes(48).toString("base64url");
// The demo password is also the Log in test's: Playwright loads this config again in every worker,
// so the main process's value goes through the environment the workers inherit.
process.env.E2E_DEMO_PASSWORD ??= randomBytes(8).toString("hex");
const demoPassword = process.env.E2E_DEMO_PASSWORD;

export default defineConfig({
  testDir: "./e2e/production",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run e2e:serve",
    cwd: repoRoot,
    url: "http://localhost:3000/api/health",
    // Never reuse a running server: a local install (FEATURE_DEMO off) would fake the result.
    reuseExistingServer: false,
    // Covers `next build` plus migrations and server start.
    timeout: 300_000,
    env: {
      // The same file as the main config, deleted by `e2e:backend` on every start.
      DATABASE_URL: `sqlite:///${join(repoRoot, "backend", "var", "e2e.db")}`,
      NEXT_TELEMETRY_DISABLED: "1",
      APP_ENV: "production",
      FEATURE_AUTH: "true",
      FEATURE_DEMO: "true",
      JWT_SECRET: jwtSecret,
      DEMO_PASSWORD: demoPassword,
    },
  },
});
