import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 (Story 5.6; FR-30, AD-3, UX-DR6): apply all applies every open recommendation of the latest
// run, and the flow bar then checks Recommendations. The button is Story 5.7, so the command goes
// through the command API here.

type CommandResult = { version: number; events: { type: string }[] };

async function command(
  request: APIRequestContext,
  planId: string,
  body: Record<string, unknown>,
): Promise<CommandResult> {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as CommandResult;
}

test("uj1 applies all recommendations and the round is done", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Apply all ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  const before = await getJson<{ apply_all_count: number }>(request, `/api/plans/${planId}`);
  expect(before.apply_all_count).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  const step = nav.getByRole("link", { name: /^Recommendations\s*, step 6/ });
  await expect(step).toBeVisible();
  await expect(step).not.toHaveAccessibleName(/, done$/);

  const result = await command(request, planId, { type: "apply_all" });
  expect(result.events[0]?.type).toBe("apply_all_done");

  await page.reload();
  await expect(step).toHaveAccessibleName(/Recommendations\s*, step 6, done$/);
  const after = await getJson<{ apply_all_count: number }>(request, `/api/plans/${planId}`);
  expect(after.apply_all_count).toBe(0);
});
