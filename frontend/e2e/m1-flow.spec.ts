import { join } from "node:path";

import { expect, type Locator, test, toasts } from "./support/test";

import { type Detail, getJson, locationRows, moveFromPanel, partDetail } from "./support/plan-api";
import { SAMPLE, SAMPLE_FILES } from "./support/sample-plan";

// Milestone 1 gate (Story 5.8; UJ-1, FR-1, FR-13, FR-19, FR-21, FR-23, FR-28, FR-33, FR-37): the
// whole milestone 1 journey through the UI on `data/sample/`: New Plan → Overview → Parts → Pick
// groups → mark aisle A and level 1 → run → apply one → one manual move → Before/after shows the
// change. Any uncaught page error fails the test.

type Row = { id: string; rule: string; part: string; from_location: string; to_location: string; status: string };
type View = { recommendations: Row[] };

function aisleRow(table: Locator, aisle: string): Locator {
  return table.locator("tbody tr").filter({ has: table.page().getByRole("cell", { name: aisle, exact: true }) });
}

test("uj1 milestone 1 flow on the sample data", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // New Plan with the three sample files.
  await page.goto("/plans/new");
  await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
  await page.getByLabel("Plan name").fill("Milestone 1 demo");
  await page.getByLabel("Locations", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.locations));
  await page.getByLabel("Inventory", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.inventory));
  await page.getByLabel("Transactions", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.transactions));
  await page.getByRole("button", { name: "New Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
  const planId = new URL(page.url()).pathname.split("/")[2];

  // Overview → Parts → Pick groups.
  const main = page.getByRole("main");
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await expect(main.getByRole("heading", { name: "Parts", level: 1 })).toBeVisible();
  await expect(main.getByRole("table", { name: "Parts" }).locator("tbody tr").first()).toBeVisible();
  await nav.getByRole("link", { name: /^\d*Pick groups/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/pick-groups$`));
  await expect(main.getByRole("heading", { name: "Pick groups", level: 1 })).toBeVisible();

  // Best locations: aisle A, then level 1 in all aisles.
  await nav.getByRole("link", { name: /^\d*Best locations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/best-locations$`));
  const marks = main.getByRole("list", { name: "Best-location marks" });
  await main.getByRole("combobox", { name: "Aisle" }).selectOption("A");
  await main.getByRole("button", { name: "Mark aisle A", exact: true }).click();
  await expect(marks.getByText("Aisle A", { exact: true })).toBeVisible();
  const modes = main.getByRole("radiogroup", { name: "Marking mode" });
  await modes.getByRole("radio", { name: "Level" }).click();
  await expect(modes.getByRole("radio", { name: "Level" })).toHaveAttribute("aria-checked", "true");
  await main.getByRole("combobox", { name: "Level" }).selectOption("1");
  await main.getByRole("radiogroup", { name: "Level scope" }).getByRole("radio", { name: "in all aisles" }).click();
  await main.getByRole("button", { name: "Mark level 1 in all aisles", exact: true }).click();
  await expect(marks.getByText("Level 1 in all aisles", { exact: true })).toBeVisible();
  await expect(main.getByText("Saving the last change…")).toHaveCount(0);

  // Recommendations: run round 1 and apply the first one.
  await nav.getByRole("link", { name: /^\d*Recommendations/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations`));
  await expect(main.getByTestId("round-chip")).toHaveText("Round 0");
  await main.getByRole("button", { name: "Run recommendations" }).click();
  await expect(main.getByTestId("round-chip")).toHaveText("Round 1");
  const listbox = main.getByRole("listbox", { name: "Recommendations" });
  await expect(listbox.getByRole("option").first()).toBeFocused();
  const ran = await getJson<View>(request, `/api/plans/${planId}/recommendations`);
  const firstOpen = ["rule_1", "rule_2", "rule_3"]
    .flatMap((rule) => ran.recommendations.filter((row) => row.rule === rule && row.status === "open"))
    .at(0);
  expect(firstOpen, "run 1 on the sample data gives an open recommendation").toBeDefined();
  const first = firstOpen!;
  await expect(main.getByTestId("detail-eyebrow")).toContainText(`RULE ${first.rule.slice(-1)}`);
  const detail = main.getByRole("region", { name: "Selected recommendation" });
  await detail.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    toasts(page).getByText(`Applied · move 1, round 1 · ${first.part} ${first.from_location} → ${first.to_location}`, {
      exact: true,
    }),
  ).toBeVisible();

  // One manual move: a part in one location only into an empty location in another aisle.
  const rows = await locationRows(request, planId);
  let moved: Detail | undefined;
  for (const row of rows) {
    if (row.contents.length !== 1 || row.contents[0].part === first.part) continue;
    const candidate = await partDetail(request, planId, row.contents[0].part);
    if (candidate.other_locations.length === 0 && candidate.current_location?.code === row.location.code) {
      moved = candidate;
      break;
    }
  }
  expect(moved).toBeDefined();
  const part = moved!.part;
  const source = moved!.current_location!;
  const targetRow = rows.find((row) => !row.occupied && row.location.aisle !== source.aisle);
  expect(targetRow, `an empty location outside aisle ${source.aisle}`).toBeDefined();
  const target = targetRow!.location;
  await nav.getByRole("link", { name: /^\d*Parts/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/parts$`));
  await main.getByRole("searchbox", { name: "Search parts and locations" }).click();
  await page.keyboard.type(part);
  await main.locator(`[data-search-part="${part}"]`).click();
  await moveFromPanel(page, page.getByRole("complementary", { name: part }), part, source.code, target.code, 1);

  // Before/after shows the manual move per aisle.
  await nav.getByRole("link", { name: /Before\/after\s*, step 7$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/before-after$`));
  const table = main.getByRole("table", { name: "Before/after" });
  await expect(table).toBeVisible();
  await expect(main.getByText("No moves yet: before and after are the same.", { exact: true })).toHaveCount(0);
  await expect(aisleRow(table, target.aisle).locator("td").nth(1)).toContainText(part);
  await expect(aisleRow(table, source.aisle).locator("td").nth(2)).toContainText(part);

  expect(pageErrors).toEqual([]);
});
