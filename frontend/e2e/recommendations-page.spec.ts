import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test, toasts } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// UJ-1 (Story 5.7; FR-23–FR-30, UX-DR31–35): the planner runs the rules on the Recommendations
// page, reads the rows by keyboard, applies one, meets a 409 for a row applied elsewhere, and
// applies the rest. Retro item 26: the Apply button, its toast, the 409 path and the views
// refreshing after apply (handed over by Story 5.2) are all checked here.

type Row = {
  id: string;
  number: number;
  rule: "rule_1" | "rule_2" | "rule_3";
  part: string;
  from_location: string;
  to_location: string;
  status: "open" | "applied" | "outdated";
};
type View = { run: { round: number } | null; recommendations: Row[]; no_space: unknown[] };

const RULES = ["rule_1", "rule_2", "rule_3"] as const;

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** The open rows the page shows first: rule order, server order within a rule, 5 per rule. */
function visibleOpen(view: View): Row[] {
  const open = view.recommendations.filter((row) => row.status === "open");
  return RULES.flatMap((rule) => open.filter((row) => row.rule === rule).slice(0, 5));
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

test("uj1 runs, reads and applies recommendations", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Recommendations ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });

  await page.goto(`/plans/${planId}/recommendations`);
  const main = page.getByRole("main");
  const chip = main.getByTestId("round-chip");
  await expect(chip).toHaveText("Round 0");
  await expect(
    main.getByText("No run yet. Run recommendations to start round 1 on the planning copy as it is now."),
  ).toBeVisible();
  await expect(main.getByRole("button", { name: "Apply all (0)" })).toHaveAttribute("aria-disabled", "true");

  // A run that fails on the server: nothing changes, the message says so, the button is refocused.
  const runButton = main.getByRole("button", { name: "Run recommendations" });
  await page.route(
    `**/api/plans/${planId}/commands`,
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        json: { error: { code: "internal", message: "Something went wrong. Try again.", details: [] } },
      }),
    { times: 1 },
  );
  await runButton.click();
  await expect(
    main.getByText("The run stopped before it finished. Nothing changed: still round 0. Run recommendations to try again."),
  ).toBeVisible();
  await expect(runButton).toBeFocused();
  await expect(chip).toHaveText("Round 0");

  // Run: round 1, Open tab, focus on the first row, the polite announcement.
  await runButton.click();
  await expect(chip).toHaveText("Round 1");
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations\\?tab=open$`));
  const ran = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const shown = visibleOpen(ran);
  expect(shown.length).toBeGreaterThan(2);
  const openCount = ran.recommendations.filter((row) => row.status === "open").length;
  await expect(main.getByRole("tab", { name: /^Open, / })).toHaveAttribute("aria-selected", "true");
  await expect(main.getByRole("tab", { name: /^Open, / })).toHaveAccessibleName(
    `Open, ${plural(openCount, "recommendation", "recommendations")}`,
  );
  await expect(page.getByRole("status").filter({ hasText: /^Recommendations, round 1, / })).toHaveText(
    `Recommendations, round 1, ${plural(ran.recommendations.length, "recommendation", "recommendations")}, ${ran.no_space.length} no space`,
  );
  const listbox = main.getByRole("listbox", { name: "Recommendations" });
  const options = listbox.getByRole("option");
  await expect(options.first()).toBeFocused();
  const eyebrow = main.getByTestId("detail-eyebrow");
  const eyebrowOf = (row: Row) => `SELECTED · #${row.number} · RULE ${row.rule.slice(-1)}`;
  await expect(eyebrow).toHaveText(eyebrowOf(shown[0]));

  // ↓ selects the second row and the detail follows; ↑ goes back.
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toBeFocused();
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(eyebrow).toHaveText(eyebrowOf(shown[1]));
  await page.keyboard.press("ArrowUp");
  await expect(eyebrow).toHaveText(eyebrowOf(shown[0]));

  // Apply: the toast names the move and offers Undo (Story 7.3), the row moves to Applied, the Open count drops.
  const first = shown[0];
  const detail = main.getByRole("region", { name: "Selected recommendation" });
  await detail.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    toasts(page).getByText(`Applied · move 1, round 1 · ${first.part} ${first.from_location} → ${first.to_location}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
  await expect(main.getByRole("tab", { name: /^Open, / })).toHaveAccessibleName(
    `Open, ${plural(openCount - 1, "recommendation", "recommendations")}`,
  );
  await main.getByRole("tab", { name: /^Applied, / }).click();
  await expect(page).toHaveURL(/\?tab=applied$/);
  await expect(listbox.getByRole("option", { name: new RegExp(`^#${first.number}, ${first.part}, `) })).toHaveAccessibleName(
    /Applied · move 1, round 1$/,
  );
  await expect(main.getByText("Applied · move 1, round 1").first()).toBeVisible();

  // 409: the next open row is applied elsewhere; Apply in the page shows the server's message and
  // the refetched view shows the row as applied.
  await main.getByRole("tab", { name: /^Open, / }).click();
  const now = visibleOpen(await getJson<View>(request, `/api/plans/${planId}/recommendations`));
  const taken = now[0];
  await expect(eyebrow).toHaveText(eyebrowOf(taken));
  await command(request, planId, { type: "apply", recommendation_id: taken.id });
  await detail.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(toasts(page).getByText(`Recommendation #${taken.number} is already applied.`, { exact: true })).toBeVisible();
  await expect(listbox.getByRole("option", { name: new RegExp(`^#${taken.number}, `) })).toHaveCount(0);
  await main.getByRole("tab", { name: /^Applied, / }).click();
  await expect(listbox.getByRole("option", { name: new RegExp(`^#${taken.number}, `) })).toHaveAccessibleName(
    /Applied · move 2, round 1$/,
  );

  // Alt+A on a focused option applies it: the toast names the move, the Open count drops by one.
  await main.getByRole("tab", { name: /^Open, / }).click();
  const beforeKey = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const openBeforeKey = beforeKey.recommendations.filter((row) => row.status === "open").length;
  const keyed = visibleOpen(beforeKey)[0];
  await expect(eyebrow).toHaveText(eyebrowOf(keyed));
  await options.first().focus();
  await page.keyboard.press("Alt+KeyA");
  await expect(
    toasts(page).getByText(`Applied · move 3, round 1 · ${keyed.part} ${keyed.from_location} → ${keyed.to_location}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(main.getByRole("tab", { name: /^Open, / })).toHaveAccessibleName(
    `Open, ${plural(openBeforeKey - 1, "recommendation", "recommendations")}`,
  );

  // Enter on "Show N more under rule X" (a button inside the listbox) is not taken by the options
  // (retro item 15): the rule's hidden rows appear and the button is gone.
  const afterKey = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const openRows = afterKey.recommendations.filter((row) => row.status === "open");
  const longRule = RULES.find((rule) => openRows.filter((row) => row.rule === rule).length > 5);
  expect(longRule).toBeDefined();
  const hidden = openRows.filter((row) => row.rule === longRule).length - 5;
  const showMore = listbox.getByRole("button", { name: `Show ${hidden} more under rule ${longRule?.slice(-1)}` });
  const shownBefore = visibleOpen(afterKey).length;
  await expect(options).toHaveCount(shownBefore);
  await showMore.focus();
  await page.keyboard.press("Enter");
  await expect(options).toHaveCount(shownBefore + hidden);
  await expect(showMore).toHaveCount(0);

  // Manual move… from the detail of a "no space" row opens the shared dialog.
  await main.getByRole("tab", { name: /^No space, / }).click();
  await options.first().click();
  await expect(eyebrow).toContainText("SELECTED · NO SPACE · RULE");
  const part = (await detail.getByRole("heading", { level: 2 }).textContent()) ?? "";
  const manualMove = detail.getByRole("button", { name: "Manual move…" });
  await expect(manualMove).not.toHaveAttribute("aria-disabled", "true");
  await manualMove.click();
  const dialog = page.getByRole("dialog", { name: `Manual move · ${part}` });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Apply all: the confirm popover, then the toast; the button drops to 0 and the step is done.
  const before = await getJson<{ apply_all_count: number }>(request, `/api/plans/${planId}`);
  expect(before.apply_all_count).toBeGreaterThan(0);
  const applyAll = main.getByRole("button", { name: `Apply all (${before.apply_all_count})` });
  const confirm = page.getByRole("dialog", { name: "Apply all" });
  // Cancel sends nothing: the plan version stays and focus returns to the button.
  const versionBefore = await planVersion(request, planId);
  await applyAll.click();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(applyAll).toBeFocused();
  expect(await planVersion(request, planId)).toBe(versionBefore);
  await applyAll.click();
  const noun = before.apply_all_count === 1 ? "recommendation" : "recommendations";
  await expect(confirm).toContainText(
    `Apply ${before.apply_all_count} ${noun} from round 1? Undo reverses them one move at a time.`,
  );
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await confirm.getByRole("button", { name: "Apply all" }).click();
  await expect(toasts(page).getByText(/^Applied \d+ recommendations? from round 1\./)).toBeVisible();
  await expect(main.getByRole("button", { name: "Apply all (0)" })).toHaveAttribute("aria-disabled", "true");
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await expect(nav.getByRole("link", { name: /^Recommendations\s*, step 6/ })).toHaveAccessibleName(
    /Recommendations\s*, step 6, done$/,
  );
});
