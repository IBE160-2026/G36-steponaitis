import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const repoRoot = join(__dirname, "..");

export default defineConfig({
  testDir: "./e2e",
  // Runs after the web server is up. Only matters when a reused `next dev` server runs (it compiles
  // every route once); against the production build it is a quick no-op warm-up.
  globalSetup: "./e2e/support/warm-routes.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
  webServer: {
    // A production build (`next build` + `next start`) and a multi-worker backend: dev-mode React
    // re-renders and a single GIL-bound backend process made journeys slow under parallel workers.
    command: "npm run e2e:serve",
    cwd: repoRoot,
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    // Covers `next build` plus migrations and server start.
    timeout: 300_000,
    env: {
      DATABASE_URL: `sqlite:///${join(repoRoot, "backend", "var", "e2e.db")}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
