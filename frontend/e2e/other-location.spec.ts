import { randomUUID } from "node:crypto";

import { type APIRequestContext, expect, type Locator, test, toasts } from "./support/test";

import { getJson, planVersion } from "./support/plan-api";
import { createSamplePlan } from "./support/sample-plan";

// Story 7.2 (FR-31, UX-DR36): the planner applies a recommendation to another allowed location
// from the server's listbox (Alt+O, arrows, Enter). The row reads "Applied · move N, round R"
// with the chosen location, the toast names the move, and before/after shows it.

type Row = {
  id: string;
  number: number;
  rule: string;
  part: string;
  from_location: string;
  to_location: string;
  status: string;
};
type View = { recommendations: Row[] };
type Ref = { code: string; aisle: string; level: string; is_best: boolean };
type OtherLocations = { recommendation_id: string; locations: Ref[] };

async function command(request: APIRequestContext, planId: string, body: Record<string, unknown>) {
  const response = await request.post(`/api/plans/${planId}/commands`, {
    data: { command_id: randomUUID(), base_version: await planVersion(request, planId), ...body },
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  expect(response.status(), await response.text()).toBe(200);
}

function aisleRow(table: Locator, aisle: string): Locator {
  return table.locator("tbody tr").filter({ has: table.page().getByRole("cell", { name: aisle, exact: true }) });
}

test("uj1 applies a recommendation with another location", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const planId = (await createSamplePlan(request, `Other location ${randomUUID().slice(0, 8)}`)).id;
  await command(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
  await command(request, planId, { type: "run" });
  const ran = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const rec = ran.recommendations.find((row) => row.rule === "rule_1" && row.status === "open")!;
  expect(rec).toBeDefined();
  const others = await getJson<OtherLocations>(
    request,
    `/api/plans/${planId}/recommendations/${encodeURIComponent(rec.id)}/other-locations`,
  );
  expect(others.locations.length).toBeGreaterThan(0);
  expect(others.locations.map((ref) => ref.code)).not.toContain(rec.to_location);
  // The listbox highlights the first location; ArrowDown moves to the next (clamped at the end).
  const chosen = others.locations[Math.min(1, others.locations.length - 1)];

  await page.goto(`/plans/${planId}/recommendations?tab=open`);
  const main = page.getByRole("main");
  const list = main.getByRole("listbox", { name: "Recommendations" });
  const option = list.getByRole("option", { name: new RegExp(`^#${rec.number}, ${rec.part}, `) });
  await option.click();
  await expect(option).toBeFocused();
  const detail = main.getByRole("region", { name: "Selected recommendation" });
  const trigger = detail.getByRole("button", { name: "Other location" });
  await expect(trigger).toHaveAttribute("aria-keyshortcuts", "Alt+O");
  await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");

  await page.keyboard.press("Alt+KeyO");
  const locations = page.getByRole("listbox", { name: "Other locations" });
  await expect(locations).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const options = locations.getByRole("option");
  await expect(options).toHaveCount(others.locations.length);
  await expect(options.first()).toHaveAccessibleName(
    `${others.locations[0].code}, Aisle ${others.locations[0].aisle} · Level ${others.locations[0].level}, ${
      others.locations[0].is_best ? "BEST" : "not best"
    }`,
  );
  await expect(main.locator("input")).toHaveCount(0);

  // Esc closes and returns focus to the trigger; nothing is sent.
  await page.keyboard.press("Escape");
  await expect(locations).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await planVersion(request, planId)).toBe(3);

  await trigger.click();
  await expect(locations).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(locations.getByRole("option", { selected: true })).toHaveAccessibleName(new RegExp(`^${chosen.code}, `));
  expect(await planVersion(request, planId)).toBe(3);
  await page.keyboard.press("Enter");

  const toast = toasts(page).getByText(
    new RegExp(`^Applied · move (\\d+), round 1 · ${rec.part} ${rec.from_location} → ${chosen.code}$`),
  );
  await expect(toast).toBeVisible();
  const moveNumber = /move (\d+),/.exec((await toast.textContent()) ?? "")?.[1];
  await expect(toasts(page).getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);

  await main.getByRole("tab", { name: /^Applied, / }).click();
  const applied = list.getByRole("option", { name: new RegExp(`^#${rec.number}, ${rec.part}, `) });
  await expect(applied).toHaveAccessibleName(
    new RegExp(`to ${chosen.code}(?: BEST)?, Applied · move ${moveNumber}, round 1$`),
  );
  await applied.click();
  await expect(detail.getByText(`Applied · move ${moveNumber}, round 1`, { exact: true })).toBeVisible();
  await expect(detail.getByText(chosen.code, { exact: true })).toBeVisible();
  await expect(detail.getByText(rec.to_location, { exact: true })).toHaveCount(0);

  // Before/after shows the part moved into the chosen location's aisle.
  await page.goto(`/plans/${planId}/before-after`);
  const table = main.getByRole("table", { name: "Before/after" });
  await expect(table).toBeVisible();
  await expect(aisleRow(table, chosen.aisle).locator("td").nth(1)).toContainText(rec.part);
  const state = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const row = state.recommendations.find((r) => r.id === rec.id) as Row & {
    applied: { to_location: string } | null;
  };
  expect(row.to_location).toBe(rec.to_location);
  expect(row.applied?.to_location).toBe(chosen.code);

  // A second open recommendation with at least two allowed locations: typing moves the highlight
  // without sending, and a click applies the clicked location.
  let second: Row | undefined;
  let secondSet: Ref[] = [];
  for (const candidate of state.recommendations.filter((r) => r.status === "open")) {
    const set = await getJson<OtherLocations>(
      request,
      `/api/plans/${planId}/recommendations/${encodeURIComponent(candidate.id)}/other-locations`,
    );
    if (set.locations.length >= 2) {
      second = candidate;
      secondSet = set.locations;
      break;
    }
  }
  expect(second).toBeDefined();
  const typed = secondSet[secondSet.length - 1];
  const clicked = secondSet[0];
  const version = await planVersion(request, planId);

  await page.goto(`/plans/${planId}/recommendations?tab=open`);
  const secondOption = list.getByRole("option", { name: new RegExp(`^#${second!.number}, ${second!.part}, `) });
  await secondOption.click();
  await detail.getByRole("button", { name: "Other location" }).click();
  await expect(locations).toBeFocused();
  await expect(locations.getByRole("option")).toHaveCount(secondSet.length);
  await expect(locations.getByRole("option", { selected: true })).toHaveAccessibleName(new RegExp(`^${clicked.code}, `));
  await page.keyboard.type(typed.code);
  await expect(locations.getByRole("option", { selected: true })).toHaveAccessibleName(new RegExp(`^${typed.code}, `));
  expect(await planVersion(request, planId)).toBe(version);

  await locations.getByRole("option", { name: new RegExp(`^${clicked.code}, `) }).click();
  await expect(
    toasts(page).getByText(
      new RegExp(`^Applied · move \\d+, round 1 · ${second!.part} ${second!.from_location} → ${clicked.code}$`),
    ),
  ).toBeVisible();
  const afterClick = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const clickedRow = afterClick.recommendations.find((r) => r.id === second!.id) as Row & {
    applied: { to_location: string } | null;
  };
  expect(clickedRow.status).toBe("applied");
  expect(clickedRow.applied?.to_location).toBe(clicked.code);
});
