import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test, toasts } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// Story 7.4 (FR-35, FR-36, UX-DR38, UX-DR16): Reset… in the Recommendations header's "⋯" menu asks
// a destructive confirm with the server's move count (Cancel first and focused), and a confirmed
// reset deletes every move and run: round 0, "No run yet", before/after without moves, marks kept.

type Row = { id: string; status: string };
type View = { recommendations: Row[] };
type Summary = { current_round: number; move_count: number; best_locations: number; undo_preview: unknown };

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

async function applyNextOpen(request: APIRequestContext, planId: string) {
  const view = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const rec = view.recommendations.find((row) => row.status === "open");
  expect(rec).toBeDefined();
  await command(request, planId, { type: "apply", recommendation_id: rec!.id });
}

test("uj3 resets the planning copy", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Reset ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  await applyNextOpen(request, planId);
  await applyNextOpen(request, planId);
  const before = await getJson<Summary>(request, `/api/plans/${planId}`);
  expect(before.move_count).toBe(2);
  expect(before.best_locations).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/recommendations?tab=applied`);
  const main = page.getByRole("main");
  const more = main.getByRole("button", { name: "More actions", exact: true });
  const question =
    "Reset removes all 2 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1.";

  // Esc closes the confirm without sending anything and returns focus to "⋯".
  await more.click();
  await page.getByRole("menuitem", { name: "Reset…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Reset plan" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(question);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await getJson<Summary>(request, `/api/plans/${planId}`)).toEqual(before);

  // Confirm resets the plan.
  await more.click();
  await page.getByRole("menuitem", { name: "Reset…" }).click();
  await dialog.getByRole("button", { name: "Reset plan" }).click();
  await expect(
    toasts(page).getByText("Plan reset. 2 moves removed; marks kept. The next run is round 1.", { exact: true }),
  ).toBeVisible();
  await expect(more).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations\\?tab=open$`));
  await expect(main.getByTestId("round-chip")).toHaveText("Round 0");
  await expect(main.getByText(/^No run yet\./)).toBeVisible();
  const after = await getJson<Summary>(request, `/api/plans/${planId}`);
  expect(after.current_round).toBe(0);
  expect(after.move_count).toBe(0);
  expect(after.undo_preview).toBeNull();
  expect(after.best_locations).toBe(before.best_locations);

  await page.goto(`/plans/${planId}/before-after`);
  await expect(page.getByRole("main").getByText("No moves yet: before and after are the same.", { exact: true })).toBeVisible();
});
