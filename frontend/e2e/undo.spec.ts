import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test, toasts } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// Story 7.3 (FR-35, UX-DR38, UX-DR14): Undo last move in the Recommendations header names the move
// it would undo, the undone toast uses the exact UX-DR38 sentences, the remaining recommendations
// show "Outdated after undo.", and a move toast's Undo takes back that move.

type Row = { id: string; number: number; rule: string; part: string; from_location: string; to_location: string; status: string };
type View = { recommendations: Row[] };
type Summary = { undo_preview: { move_number: number } | null; current_round: number };

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

test("uj3 undoes the last move", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Undo ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  const ran = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const rec = ran.recommendations.find((row) => row.status === "open")!;
  expect(rec).toBeDefined();

  await page.goto(`/plans/${planId}/recommendations?tab=open`);
  const main = page.getByRole("main");
  const undo = main.getByRole("button", { name: "Undo last move", exact: true });
  await expect(undo).toHaveAttribute("aria-disabled", "true");
  await expect(undo).toHaveAccessibleDescription("No moves to undo");

  const list = main.getByRole("listbox", { name: "Recommendations" });
  await list.getByRole("option", { name: new RegExp(`^#${rec.number}, ${rec.part}, `) }).click();
  const detail = main.getByRole("region", { name: "Selected recommendation" });
  await detail.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    toasts(page).getByText(`Applied · move 1, round 1 · ${rec.part} ${rec.from_location} → ${rec.to_location}`, {
      exact: true,
    }),
  ).toBeVisible();

  // Hover or focus names the move; a click undoes it.
  const label = `Undo move 1: ${rec.part} ${rec.from_location} → ${rec.to_location}`;
  await expect(undo).not.toHaveAttribute("aria-disabled");
  await expect(undo).toHaveAccessibleDescription(label);
  await undo.hover();
  await expect(main.getByRole("tooltip").filter({ hasText: label })).toBeVisible();
  await undo.click();
  await expect(
    toasts(page).getByText(
      "Undid move 1. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(undo).toHaveAttribute("aria-disabled", "true");
  await expect(undo).toHaveAccessibleDescription("No moves to undo");

  await main.getByRole("tab", { name: /^Outdated, / }).click();
  await expect(list.getByRole("option").first()).toHaveAccessibleName(/, outdated, Outdated after undo\.$/);
  const after = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  expect(after.recommendations.every((row) => row.status === "outdated")).toBe(true);

  // A new round, apply again, then the toast's Undo takes back exactly that move (move 2).
  await command(request, planId, { type: "run" });
  const round2 = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const again = round2.recommendations.find((row) => row.status === "open")!;
  expect(again).toBeDefined();
  await page.goto(`/plans/${planId}/recommendations?tab=open`);
  await list.getByRole("option", { name: new RegExp(`^#${again.number}, ${again.part}, `) }).click();
  await detail.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(toasts(page).getByText(/^Applied · move 2, round 2 · /)).toBeVisible();
  await toasts(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toasts(page).getByText(/^Undid move 2\. Unapplied recommendations of round 2 are now outdated\./)).toBeVisible();
  await expect(undo).toHaveAccessibleDescription("No moves to undo");
  const summary = await getJson<Summary>(request, `/api/plans/${planId}`);
  expect(summary.undo_preview).toBeNull();
  expect(summary.current_round).toBe(2);
});
