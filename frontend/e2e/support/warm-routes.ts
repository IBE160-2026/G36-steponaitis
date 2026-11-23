import { type FullConfig, request } from "@playwright/test";

// Global setup: `next dev` compiles a route the first time it is requested, which can take longer
// than an assertion's timeout under parallel workers. Requesting every app route once before the
// tests start moves that compile out of the journeys, so a cross-route navigation (e.g. a location
// chip from Parts to Locations) waits only on rendering, never on a cold compile. Only needed when
// a reused `next dev` server runs; the default web server (`npm run e2e:serve`) is a production
// build with nothing to compile, so there it is a cheap warm-up.

const PLAN = "00000000-0000-0000-0000-000000000000";
// One built step per route file (Move list is `print`), plus "move-list" for the `[step]` redirect route.
const PLAN_STEPS = [
  "overview",
  "parts",
  "locations",
  "pick-groups",
  "best-locations",
  "settings",
  "before-after",
  "recommendations",
  "print",
  "move-list",
];

export default async function warmRoutes(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const context = await request.newContext({ baseURL });
  try {
    const paths = ["/", "/plans", "/plans/new", "/signup", "/login", ...PLAN_STEPS.map((step) => `/plans/${PLAN}/${step}`)];
    for (const path of paths) {
      // A route only needs to compile; any status (e.g. 404 for an unbuilt step) will do.
      await context.get(path, { timeout: 120_000, failOnStatusCode: false });
    }
  } finally {
    await context.dispose();
  }
}
