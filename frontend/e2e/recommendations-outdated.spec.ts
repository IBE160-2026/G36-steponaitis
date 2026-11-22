import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 (Story 5.5; FR-29, AD-7, UX-DR14, UX-DR28): after a run, removing a best-location mark
// outdates recommendations; the toast counts them and **View** opens the Outdated tab.

test.skip(({ browserName }) => browserName !== "chromium", "The outdated recommendations journey runs in Chromium.");

type Recommendations = {
  version: number;
  recommendations: { status: string; outdated: { cause: string } | null }[];
};

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

test("uj1 sees recommendations outdated by a mark change", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Outdated ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  const before = await getJson<Recommendations>(request, `/api/plans/${planId}/recommendations`);
  expect(before.recommendations.length).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/best-locations`);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Remove mark Aisle A" }).click();

  // The toast shows once the command is confirmed, so the server already holds the outdated status.
  const toast = page.getByText(/^Best-location marks changed · /);
  await expect(toast).toBeVisible();
  const after = await getJson<Recommendations>(request, `/api/plans/${planId}/recommendations`);
  const outdated = after.recommendations.filter((rec) => rec.outdated?.cause === "marks").length;
  expect(outdated).toBeGreaterThan(0);
  const noun = outdated === 1 ? "recommendation is" : "recommendations are";
  await expect(toast).toHaveText(
    `Best-location marks changed · ${outdated.toLocaleString("en-US")} ${noun} now outdated`,
  );
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations\\?tab=outdated$`));
  // Story 5.7: the page opens on the Outdated tab and lists the outdated rows.
  await expect(main.getByRole("tab", { name: /^Outdated, / })).toHaveAttribute("aria-selected", "true");
  const options = main.getByRole("listbox", { name: "Recommendations" }).getByRole("option");
  await expect(options.first()).toHaveAccessibleName(/, outdated, The best-location marks changed\.$/);
});
