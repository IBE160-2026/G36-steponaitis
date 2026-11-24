import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { HEADLINE, logIn, PANELS, PASSWORD, signUp, turnDemoOn, uniqueUsername } from "./support/auth";
import { aisleRow } from "./support/before-after";
import { DEFAULT_SLOW_RGB, expectSlowBin, printOffenders, rootSlow, SHADE_6, SHADE_6_RGB } from "./support/colours";
import { dragOver, startDrag, targetFor } from "./support/drag";
import { gridButton, launcher, planReady, searchField, STEPS } from "./support/launcher";
import { isMoveListGet, printCount, printedGenerated, stubPrint } from "./support/move-list";
import { getJson, locationRows, moveFromPanel, partDetail, postCommand, type Ref } from "./support/plan-api";
import {
  plural,
  type RecRow,
  recommendationsOf,
  recOption,
  selectRecommendation,
  visibleOpen,
} from "./support/recommendations";
import { chooseSampleFiles, createSamplePlan, newPlanThroughUi, SAMPLE, SAMPLE_FILES } from "./support/sample-plan";
import { type APIRequestContext, expect, type Locator, type Page, test, toasts } from "./support/test";

// The user journeys UJ-1 to UJ-8 (EXPERIENCE.md "Key Flows"; SM-7), one end-to-end walk each through
// the real UI on `data/sample/`. Each test walks its journey's numbered steps, climax, resolution
// and failure path and asserts what the user sees at each step; the comments name the step
// numbers. The API is used only to set up the state a journey takes as given ("a plan saved last
// week", "another plan Spring re-slot") and to read view JSON for data-dependent picks (which part,
// which location): the example values in EXPERIENCE.md are illustrative. Steps that need Epics
// 13–16 are declared as skipped tests at the end. The existing specs stay the per-step detail tests:
//
// - UJ-1: new-plan, plan-overview, locations-wall, best-locations-wall, recommendations-page,
//   other-location, keep-in-place, manual-move, drag, before-after, login, sm2-flow
// - UJ-2: move-list, move-list-print
// - UJ-3: saved-plans, reopen-plan, session-expiry, undo, recommendations-outdated, reuse-import
// - UJ-4: key-colours
// - UJ-5: front-page, demo-version, signup, login
// - UJ-6: pick-groups, part-panel-search, views-follow-planning-copy
// - UJ-7: parts-roster, keep-in-place, part-panel-search, manual-move
// - UJ-8: launcher
//
// Journeys run in parallel (and in three browsers) against one database: every plan and account
// has a unique name, and nothing asserts global state another test can change.

type Summary = {
  import_id: string;
  data_as_of: string;
  uploaded_at: string;
  last_edited_at: string;
  current_round: number;
  best_locations: number;
  empty_best_locations: number;
  move_count: number;
  version: number;
  period_start: string;
  period_end: string;
  class_counts: Record<"fast" | "medium" | "slow" | "dead", number>;
};
type WallLocation = { location: Ref & { level: string }; occupied: boolean; parts: { part: string }[] };
type WallMove = { status: string; from_location: Ref; to_location: Ref };
type Wall = { locations: WallLocation[]; moves: WallMove[] };
type RosterRow = {
  rank: number;
  part: string;
  picks: number;
  movement_class: "fast" | "medium" | "slow" | "dead";
  current_location: Ref | null;
  kept_in_place: boolean;
};
type GroupPart = { part: string; aisle: string | null };
type PickGroup = { part_a: GroupPart; part_b: GroupPart; shared_jobs: number; same_aisle: boolean };
type Count = { before: number; after: number };
type BeforeAfter = { total: { fast_in_best: Count; pick_groups_together: Count } };
type MoveListView = { header: { generated_at: string } };

const CLASS_LABELS = { fast: "Fast-moving", medium: "Medium-moving", slow: "Slow-moving", dead: "Dead stock" };
const NO_STOCK = "No current location (no stock above zero)";
const MARKS_CHANGED = "Best-location marks changed.";
const n = (value: number) => value.toLocaleString("en-US");

const summaryOf = (request: APIRequestContext, planId: string) => getJson<Summary>(request, `/api/plans/${planId}`);
const wallOf = (request: APIRequestContext, planId: string, aisle: string) =>
  getJson<Wall>(request, `/api/plans/${planId}/wall?aisle=${aisle}`);
const rosterOf = async (request: APIRequestContext, planId: string) =>
  (await getJson<{ parts: RosterRow[] }>(request, `/api/plans/${planId}/parts`)).parts;
const pickGroupsOf = async (request: APIRequestContext, planId: string) =>
  (await getJson<{ pick_groups: PickGroup[] }>(request, `/api/plans/${planId}/pick-groups`)).pick_groups;
const beforeAfterOf = (request: APIRequestContext, planId: string) =>
  getJson<BeforeAfter>(request, `/api/plans/${planId}/before-after`);

/** `YYYY-MM-DD HH:MM` (or the date only) of an instant in the browser's zone, as the app shows it. */
async function localDateTime(page: Page, instant: string, dateOnly = false): Promise<string> {
  const text = await page.evaluate((value) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(value))
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  }, instant);
  return dateOnly ? text.slice(0, 10) : text;
}

function nav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Plan steps" });
}

/** Opens a flow step from the flow bar and waits for its URL. */
async function openStep(page: Page, planId: string, step: RegExp, path: string) {
  await nav(page).getByRole("link", { name: step }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/${path}`));
}

function plate(page: Page): Locator {
  return page.getByRole("banner").getByRole("button", { name: /Data as of/ });
}

/** Waits for a confirmed best-location change: its toast, and no command still saving. */
async function expectMarksSaved(page: Page) {
  await expect(toasts(page).getByText(MARKS_CHANGED, { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("main").getByText("Saving the last change…")).toHaveCount(0);
}

/** Selects `row` in the listbox, applies it from the detail and waits for the toast; returns the move number. */
async function applyFromDetail(page: Page, row: RecRow, round: number, to = row.to_location): Promise<number> {
  const main = page.getByRole("main");
  await selectRecommendation(main, row);
  await main.getByRole("region", { name: "Selected recommendation" }).getByRole("button", { name: "Apply", exact: true }).click();
  const toast = toasts(page)
    .getByText(new RegExp(`^Applied · move (\\d+), round ${round} · ${row.part} ${row.from_location} → ${to}$`))
    .last();
  await expect(toast).toBeVisible();
  return Number(/move (\d+),/.exec((await toast.textContent()) ?? "")?.[1]);
}

/** Runs the rules from the Recommendations page and waits for the round chip. */
async function runRound(page: Page, round: number) {
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Run recommendations" }).click();
  await expect(main.getByTestId("round-chip")).toHaveText(`Round ${round}`, { timeout: 30_000 });
}

/** A one-part location (in `aisle`, if given) whose part is stored nowhere else and is in none of `skip`. */
async function lonePart(
  request: APIRequestContext,
  planId: string,
  locations: readonly WallLocation[],
  skip: ReadonlySet<string>,
): Promise<{ part: string; from: string; aisle: string }> {
  for (const entry of locations) {
    if (entry.parts.length !== 1 || skip.has(entry.parts[0].part) || skip.has(entry.location.code)) continue;
    const detail = await partDetail(request, planId, entry.parts[0].part);
    if (detail.other_locations.length === 0 && detail.current_location?.code === entry.location.code) {
      return { part: detail.part, from: entry.location.code, aisle: entry.location.aisle };
    }
  }
  throw new Error("no one-part location with a part stored nowhere else");
}

/** Every code a move of `wall` starts or ends at (so a test can leave those locations alone). */
function moveEnds(wall: Wall): Set<string> {
  return new Set(wall.moves.flatMap((move) => [move.from_location.code, move.to_location.code]));
}

// -------------------------------------------------------------------------------------------------
// Journeys that start logged out: UJ-1 (logs in), UJ-3 (session expired), UJ-5 (the demo).

test.describe("user journeys from a logged-out browser", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj1 fr1 fr3 fr7 fr14 fr21 fr23 fr28 fr30 fr31 fr32 fr33 fr37 fr40 fr42 fr51 builds a re-slotting plan from a fresh export", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const username = await signUp(request, "uj1");
    const name = `Autumn re-slot ${randomUUID().slice(0, 8)}`;
    const main = page.getByRole("main");

    // Step 1: Log in lands on the saved-plans list; New Plan, the plan name and the three files.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);
    await expect(main.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await main.getByRole("link", { name: "New Plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);
    await page.getByLabel("Plan name").fill(name);

    // Failure path: an Inventory export without the Quantity column stops the import, nothing is
    // saved, the Inventory tile is marked and the other two files stay chosen.
    const tile = (role: string) => page.locator(`[data-role="${role}"]`);
    await chooseSampleFiles(page);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles({
      name: "Inventory.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Part,Part Description,Location\n0100,Bolt,A-01-01-01-A1\n"),
    });
    await page.getByRole("button", { name: "New Plan", exact: true }).click();
    const stopped = page.getByRole("alert").filter({ hasText: "Import stopped: nothing was saved." });
    await expect(stopped).toBeVisible({ timeout: 30_000 });
    await expect(stopped).toContainText("Inventory.csv");
    await expect(stopped).toContainText("Quantity");
    await expect(tile("inventory")).toHaveAttribute("data-state", "failed");
    for (const role of ["locations", "transactions"]) await expect(tile(role)).toHaveAttribute("data-state", "passed");
    await expect(page).toHaveURL(/\/plans\/new$/);
    // The fixed export is chosen again; the import passes.
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(join(SAMPLE, SAMPLE_FILES.inventory));
    await expect(tile("inventory")).toHaveAttribute("data-state", "none");
    await page.getByRole("button", { name: "New Plan", exact: true }).click();

    // Step 2: the plan opens on the Plan overview: data as of, uploaded today, the period, the
    // settings and the counts per movement class.
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    const planId = new URL(page.url()).pathname.split("/")[2];
    const api = page.request;
    const summary = await summaryOf(api, planId);
    await expect(toasts(page).getByText(`${name} created. Data as of ${summary.data_as_of}.`)).toBeVisible();
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(main.getByText(summary.data_as_of, { exact: true })).toBeVisible();
    await expect(main.getByText(await localDateTime(page, summary.uploaded_at, true), { exact: true })).toBeVisible();
    await expect(main.getByText(`${summary.period_start} to ${summary.period_end}`, { exact: true })).toBeVisible();
    await expect(main.getByText("5 or more shared jobs")).toBeVisible();
    const classes = main.locator("li[data-class]");
    await expect(classes).toHaveCount(4);
    for (const [index, key] of (["fast", "medium", "slow", "dead"] as const).entries()) {
      await expect(classes.nth(index)).toHaveText(`${CLASS_LABELS[key]}${n(summary.class_counts[key])}`);
    }
    await expect(plate(page)).toContainText(`Data as of ${summary.data_as_of} · round 0`);

    // Step 3: Locations shows aisle A as a wall; Tab into it, arrow along a level, read the tooltips.
    await openStep(page, planId, /^\d*Locations/, "locations");
    await expect(main.getByRole("heading", { name: "Aisle A", level: 2 })).toBeVisible();
    const wallA = await wallOf(api, planId, "A");
    const byCode = new Map(wallA.locations.map((entry) => [entry.location.code, entry]));
    const grid = main.getByRole("grid", { name: "Aisle A bin wall" });
    await expect(grid).toBeVisible();
    const focusedCode = () => page.evaluate(() => document.activeElement?.getAttribute("data-grid-cell") ?? null);
    async function expectTooltip(code: string) {
      const entry = byCode.get(code)!;
      const tip = page.locator(`[data-wall-tooltip="${code}"]`);
      await expect(tip).toBeVisible();
      await expect(tip).toContainText(code);
      await expect(tip.locator("[data-tip-occupancy]")).toHaveText(
        entry.occupied ? `Occupied · ${plural(entry.parts.length, "part", "parts")}` : "Empty",
      );
      for (const part of entry.parts) await expect(tip.locator(`[data-tip-part="${part.part}"]`)).toBeVisible();
    }
    await main.getByRole("link", { name: "Edit best-location marks" }).focus();
    await page.keyboard.press("Tab");
    const firstCell = (await focusedCode())!;
    expect(byCode.has(firstCell)).toBe(true);
    await expectTooltip(firstCell);
    const seen = new Set([firstCell]);
    let previous = firstCell;
    for (let step = 0; step < 3; step += 1) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(focusedCode).not.toBe(previous);
      previous = (await focusedCode())!;
      seen.add(previous);
      await expectTooltip(previous);
    }
    // Each tooltip read says occupied (with its parts) or empty; at least one cell read is occupied.
    expect([...seen].some((code) => byCode.get(code)!.occupied)).toBe(true);
    await page.keyboard.press("Escape");

    // Step 4: Best locations: Whole aisle marks aisle A, then Level · in all aisles marks level 1.
    // Rails and BEST tags appear and the "best · empty" counts follow the server.
    await openStep(page, planId, /^\d*Best locations/, "best-locations");
    const markingGrid = main.getByRole("grid", { name: "Aisle A bin wall" });
    await expect(markingGrid).toBeVisible();
    const picture = main.locator('[data-wall-panel="A"]');
    const modes = main.getByRole("radiogroup", { name: "Marking mode" });
    await modes.getByRole("radio", { name: "Whole aisle" }).click();
    const cell = markingGrid.locator("[data-grid-cell]").first();
    await cell.hover();
    await expect(main.locator("[data-mark-preview]")).toHaveText("Mark aisle A");
    await cell.click();
    await expectMarksSaved(page);
    await expect(picture.locator("[data-rail]").first()).toBeAttached();
    await expect(main.getByRole("tab", { name: /^A/ }).locator("[data-best-tag]")).toHaveText("BEST");
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await modes.getByRole("radio", { name: "Level", exact: true }).click();
    await main.getByRole("radiogroup", { name: "Level scope" }).getByRole("radio", { name: "in all aisles" }).click();
    const level1 = main.locator('[data-level-mark="1"]').first();
    await expect(level1).toHaveAccessibleName("Mark level 1 in all aisles");
    await level1.focus();
    await page.keyboard.press("Enter");
    await expectMarksSaved(page);
    await expect(level1).toHaveAccessibleName("Unmark level 1 in all aisles");
    const marks = main.getByRole("list", { name: "Best-location marks" });
    await expect(marks.getByRole("listitem")).toHaveText(["Aisle A", "Level 1 in all aisles"]);
    await expect(picture.locator('[data-level="1"] [data-best-tag="BEST"]').first()).toBeAttached();
    await main.getByRole("tab", { name: /^B/ }).click();
    await expect(main.locator('[data-wall-panel="B"] [data-level="1"] [data-rail]').first()).toBeAttached();
    const marked = await summaryOf(api, planId);
    expect(marked.best_locations).toBeGreaterThan(0);
    await expect(main.getByTestId("best-counts")).toHaveText(
      `${n(marked.best_locations)} best · ${n(marked.empty_best_locations)} empty`,
    );

    // Step 5: Run recommendations: round 1 lists rule 1, 2 and 3, each with a reason in numbers, and
    // the No space tab has a count.
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await expect(main.getByTestId("round-chip")).toHaveText("Round 0");
    await runRound(page, 1);
    const round1 = await recommendationsOf(api, planId);
    const listbox = main.getByRole("listbox", { name: "Recommendations" });
    for (const rule of [1, 2, 3]) {
      await expect(listbox.getByRole("group", { name: new RegExp(`^Rule ${rule} `) })).toBeVisible();
    }
    expect(round1.no_space.length).toBeGreaterThan(0);
    await expect(main.getByRole("tab", { name: /^No space, / })).toHaveAccessibleName(
      `No space, ${plural(round1.no_space.length, "part", "parts")}`,
    );
    const detail = main.getByRole("region", { name: "Selected recommendation" });
    const reason = detail.getByTestId("detail-reason");

    // Step 6: #1 under rule 1: the detail lifts the bin out of its location and shows the target;
    // apply it, then most of the others the same way (rule 2 and rule 3 here).
    const first = round1.recommendations.find((row) => row.rule === "rule_1" && row.status === "open")!;
    expect(first, "round 1 has an open rule 1 recommendation").toBeDefined();
    // Rule 1 fills best locations in location-code order, so #1 lands in aisle A (marked whole);
    // steps 10 and 11 read aisle A's Before/after row and wall for it.
    expect(first.to_location.startsWith("A-"), `rule 1 #1 targets aisle A (${first.to_location})`).toBe(true);
    await selectRecommendation(main, first);
    await expect(main.getByTestId("detail-eyebrow")).toHaveText(`SELECTED · #${first.number} · RULE 1`);
    await expect(reason).toContainText(`Fast-moving: ${n(first.picks)} ${first.picks === 1 ? "pick" : "picks"} in the period`);
    await expect(detail.locator(`[data-crops] [data-lifted="${first.number}"]`)).toHaveCount(1);
    await expect(detail.locator(`[data-crops] [data-move-target="${first.number}"]`)).toHaveCount(1);
    await expect(detail).toContainText(first.from_location);
    await expect(detail).toContainText(first.to_location);
    await applyFromDetail(page, first, 1);
    const appliedRule2: string[] = [];
    for (let count = 0; count < 3; count += 1) {
      const next = visibleOpen(await recommendationsOf(api, planId)).find((row) => row.rule === "rule_2")!;
      await applyFromDetail(page, next, 1);
      appliedRule2.push(next.from_location);
    }
    const rule3 = visibleOpen(await recommendationsOf(api, planId)).find((row) => row.rule === "rule_3")!;
    expect(rule3, "an open rule 3 recommendation").toBeDefined();
    await selectRecommendation(main, rule3);
    await expect(reason).toContainText(`Pick group with ${(rule3.reason as { partner: string }).partner}`);
    await applyFromDetail(page, rule3, 1);

    // Step 7: Other location ▾ on another rule 1 part: pick another empty best location and apply.
    type OtherLocations = { locations: (Ref & { is_best: boolean })[] };
    let other: { row: RecRow; to: string } | undefined;
    for (const row of visibleOpen(await recommendationsOf(api, planId)).filter((r) => r.rule === "rule_1")) {
      const set = await getJson<OtherLocations>(
        api,
        `/api/plans/${planId}/recommendations/${encodeURIComponent(row.id)}/other-locations`,
      );
      const best = set.locations.find((location) => location.is_best);
      if (best) {
        other = { row, to: best.code };
        break;
      }
    }
    expect(other, "a rule 1 recommendation with another allowed location").toBeDefined();
    await selectRecommendation(main, other!.row);
    await detail.getByRole("button", { name: "Other location" }).click();
    const otherList = page.getByRole("listbox", { name: "Other locations" });
    await expect(otherList).toBeFocused();
    await expect(otherList.getByRole("option", { selected: true })).toHaveAccessibleName(new RegExp(`^${other!.to}, `));
    await page.keyboard.press("Enter");
    await expect(
      toasts(page).getByText(
        new RegExp(`^Applied · move \\d+, round 1 · ${other!.row.part} ${other!.row.from_location} → ${other!.to}$`),
      ),
    ).toBeVisible();

    // Step 8: one part would not fit: Keep in place moves it to the Kept in place tab.
    const keep = visibleOpen(await recommendationsOf(api, planId)).find((row) => row.rule === "rule_1")!;
    await selectRecommendation(main, keep);
    await detail.getByRole("button", { name: "Keep in place" }).click();
    await expect(
      toasts(page).getByText(`${keep.part} is kept in place. Remove the mark from the part or the Kept in place tab.`, {
        exact: true,
      }),
    ).toBeVisible();
    const keptTab = main.getByRole("tab", { name: /^Kept in place, / });
    await expect(keptTab).toHaveAccessibleName("Kept in place, 1 part");
    await keptTab.click();
    await expect(recOption(main, keep)).toHaveAccessibleName(/, Kept in place$/);
    await main.getByRole("tab", { name: /^Open, / }).click();

    // Step 9: a Manual move from the part panel, shown with "M" on the wall; and a bin dragged on
    // the wall to an empty location (FR-51), the wall's other way to make a manual move.
    await openStep(page, planId, /^\d*Locations/, "locations");
    await expect(grid).toBeVisible();
    const wallNow = await wallOf(api, planId, "A");
    const busy = moveEnds(wallNow);
    const manual = await lonePart(api, planId, wallNow.locations, busy);
    const emptyA = wallNow.locations.filter((entry) => !entry.occupied && !busy.has(entry.location.code));
    const manualTo = emptyA[0].location.code;
    const field = main.getByRole("searchbox", { name: "Search parts and locations" });
    await field.click();
    await page.keyboard.type(manual.part);
    await main.locator(`[data-search-part="${manual.part}"]`).click();
    const panel = page.getByRole("complementary", { name: manual.part });
    await expect(panel.getByRole("heading", { name: manual.part, level: 2 })).toBeFocused();
    await moveFromPanel(page, panel, manual.part, manual.from, manualTo, 1);
    const markers = main.locator("[data-wall-markers]");
    await expect(markers.locator('[data-move-marker="M"]')).toHaveCount(1);
    await expect(grid.locator(`[data-grid-cell="${manualTo}"]`)).toHaveAttribute("aria-label", /manual move, arrived here$/);
    await panel.getByRole("button", { name: "Close part panel" }).click();
    await expect(panel).toHaveCount(0);

    // The first lone part on the wall with an empty location in view near it (the drop target).
    const empties = wallNow.locations.filter((entry) => !entry.occupied).map((entry) => entry.location.code);
    let drag: { part: string; from: string; to: string } | undefined;
    const skip = new Set([...busy, manual.part, manual.from, manualTo]);
    for (const entry of wallNow.locations.filter((row) => row.parts.length === 1)) {
      if (skip.has(entry.location.code) || skip.has(entry.parts[0].part)) continue;
      const lone = await partDetail(api, planId, entry.parts[0].part);
      if (lone.other_locations.length > 0) continue;
      await grid.locator(`[data-grid-cell="${entry.location.code}"]`).scrollIntoViewIfNeeded();
      const to = await targetFor(page, planId, lone.part, entry.location.code, empties, "empty").catch(() => null);
      if (to !== null) {
        drag = { part: lone.part, from: entry.location.code, to };
        break;
      }
    }
    expect(drag, "a lone part with an empty location in view").toBeDefined();
    const dragFrom = drag!;
    const dragTo = drag!.to;
    const fromCell = grid.locator(`[data-grid-cell="${dragFrom.from}"]`);
    const toCell = grid.locator(`[data-grid-cell="${dragTo}"]`);
    await startDrag(page, fromCell);
    await expect(page.locator("[data-drag-lifted]")).toBeVisible();
    await dragOver(page, toCell);
    await expect(toCell).toHaveAttribute("data-drop-target", "move");
    await page.mouse.up();
    await expect(
      toasts(page).getByText(`Moved ${dragFrom.part}: ${dragFrom.from} → ${dragTo} (Manual, round 1).`, { exact: true }),
    ).toBeVisible();
    await expect(markers.locator('[data-move-marker="M"]')).toHaveCount(2);

    // Step 10 (climax): Before/after shows, aisle by aisle, the parts moving in and out, more
    // fast-moving parts in best locations and more pick groups in the same aisle.
    await openStep(page, planId, /Before\/after\s*, step 7$/, "before-after");
    const table = main.getByRole("table", { name: "Before/after" });
    await expect(table).toBeVisible();
    await expect(aisleRow(table, "A").locator("td").nth(1)).toContainText(first.part);
    await expect(aisleRow(table, first.from_location.split("-")[0]).locator("td").nth(2)).toContainText(first.part);
    const beforeAfter = await beforeAfterOf(api, planId);
    const total = aisleRow(table, "Total");
    for (const field of ["fast_in_best", "pick_groups_together"] as const) {
      const count = beforeAfter.total[field];
      expect(count.after, field).toBeGreaterThan(count.before);
      await expect(total.locator(`[data-count="${field}"]`)).toHaveText(`${n(count.before)} → ${n(count.after)}`);
    }
    // On the wall, aisle A's lifted bins have settled into their slots with the applied markers.
    await openStep(page, planId, /^\d*Locations/, "locations");
    await expect(grid).toBeVisible();
    await expect(markers.locator('[data-move-marker="applied"]').first()).toBeAttached();
    await expect(grid.locator(`[data-grid-cell="${first.to_location}"]`)).toHaveAttribute(
      "aria-label",
      new RegExp(`move ${first.number} applied, arrived here`),
    );
    await expect(picture.locator(`[data-lifted="${first.number}"]`)).toHaveCount(0);

    // Step 11 (resolution): the plan saved itself; a second run offers rule 1 the best locations
    // that the applied rule 2 moves freed.
    expect((await summaryOf(api, planId)).move_count).toBeGreaterThanOrEqual(8);
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await runRound(page, 2);
    const round2 = await recommendationsOf(api, planId);
    const intoFreed = round2.recommendations.find(
      (row) => row.rule === "rule_1" && row.status === "open" && appliedRule2.includes(row.to_location),
    );
    expect(intoFreed, `a round 2 rule 1 recommendation into one of ${appliedRule2.join(", ")}`).toBeDefined();
    await selectRecommendation(main, intoFreed!);
    await expect(main.getByTestId("detail-eyebrow")).toHaveText(`SELECTED · #${intoFreed!.number} · RULE 1`);
    await expect(detail).toContainText(intoFreed!.to_location);

    expect(pageErrors).toEqual([]);
  });

  test("uj3 fr8 fr9 fr11 fr2 fr29 fr35 fr38 fr40 continues a saved plan a week later", async ({ page, request }) => {
    test.setTimeout(240_000);
    // Given: Justas's plan from last week (marks, a run, an applied move, a manual move that made a
    // recommendation outdated) and an older plan; then the session has expired.
    const username = await signUp(request, "uj3");
    const older = await createSamplePlan(request, `Older ${randomUUID().slice(0, 8)}`);
    const name = `Autumn re-slot ${randomUUID().slice(0, 8)}`;
    const planId = (await createSamplePlan(request, name)).id;
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await postCommand(request, planId, { type: "run" });
    const ran = await recommendationsOf(request, planId);
    const [appliedRec, outdatedRec] = ran.recommendations.filter((row) => row.status === "open");
    await postCommand(request, planId, { type: "apply", recommendation_id: appliedRec.id });
    const rows = await locationRows(request, planId);
    const busy = new Set(ran.recommendations.flatMap((row) => [row.part, row.from_location, row.to_location]));
    const filler = await lonePart(
      request,
      planId,
      rows.map((row) => ({ location: { ...row.location, level: "" }, occupied: row.occupied, parts: row.contents })),
      busy,
    );
    await postCommand(request, planId, { type: "manual_move", part: filler.part, from: filler.from, to: outdatedRec.to_location });
    const lastWeek = await recommendationsOf(request, planId);
    expect(lastWeek.recommendations.find((row) => row.id === outdatedRec.id)!.status).toBe("outdated");
    const lastWeekPaper = await getJson<MoveListView>(request, `/api/plans/${planId}/move-list`);
    const saved = await summaryOf(request, planId);

    // The app was open last week; meanwhile the session expired (its cookie is gone).
    const main = page.getByRole("main");
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);
    await expect(main.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    await page.context().clearCookies();

    // Step 1: opening the app again asks to log in; after Log in the saved-plans list comes back
    // and shows the plan above the older one, with its last-edited time.
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page, username);
    await expect(page).toHaveURL(/\/plans$/);
    await expect(main.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    const list = main.getByRole("table", { name: "Saved plans" });
    const row = list.getByRole("row", { name });
    await expect(row).toBeVisible();
    expect(Number(await row.getAttribute("data-row-index"))).toBeLessThan(
      Number(await list.getByRole("row", { name: older.name }).getAttribute("data-row-index")),
    );
    await expect(row).toContainText(await localDateTime(page, saved.last_edited_at));
    await expect(row).toContainText(username);

    // Step 2: open it: the same data-as-of date and round; marks, moves and the outdated
    // recommendation exactly as left.
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/plans/${planId}/overview$`));
    await expect(plate(page)).toContainText(`Data as of ${saved.data_as_of} · round 1`);
    await expect(main.locator("dt", { hasText: /^Best locations$/ }).locator("xpath=following-sibling::dd[1]")).toHaveText(
      n(saved.best_locations),
    );
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await expect(main.getByTestId("round-chip")).toHaveText("Round 1");
    const leftOutdated = lastWeek.recommendations.filter((rec) => rec.status === "outdated").length;
    await expect(main.getByRole("tab", { name: /^Applied, / })).toHaveAccessibleName("Applied, 1 recommendation");
    await expect(main.getByRole("tab", { name: /^Outdated, / })).toHaveAccessibleName(
      `Outdated, ${plural(leftOutdated, "recommendation", "recommendations")}`,
    );
    await expect(main.getByRole("tab", { name: /^No space, / })).toHaveAccessibleName(
      `No space, ${plural(lastWeek.no_space.length, "part", "parts")}`,
    );

    // Step 3: Undo last move: it names the manual move; the toast names it and the unapplied
    // recommendations of the run turn outdated.
    const undo = main.getByRole("button", { name: "Undo last move", exact: true });
    await expect(undo).toHaveAccessibleDescription(`Undo move 2: ${filler.part} ${filler.from} → ${outdatedRec.to_location}`);
    await undo.click();
    await expect(
      toasts(page).getByText(
        "Undid move 2. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(undo).toHaveAccessibleDescription(
      `Undo move 1: ${appliedRec.part} ${appliedRec.from_location} → ${appliedRec.to_location}`,
    );
    const undone = await recommendationsOf(request, planId);
    const outdatedNow = undone.recommendations.filter((rec) => rec.status === "outdated").length;
    expect(undone.recommendations.filter((rec) => rec.status === "open")).toEqual([]);
    await expect(main.getByRole("tab", { name: /^Outdated, / })).toHaveAccessibleName(
      `Outdated, ${plural(outdatedNow, "recommendation", "recommendations")}`,
    );

    // Step 4: run again for fresh recommendations and apply two more.
    await runRound(page, 2);
    const fresh = visibleOpen(await recommendationsOf(request, planId));
    // Move numbers are never reused: the undone move 2 leaves the next one at 3.
    expect(await applyFromDetail(page, fresh[0], 2)).toBe(3);
    const next = visibleOpen(await recommendationsOf(request, planId))[0];
    expect(await applyFromDetail(page, next, 2)).toBe(4);

    // Steps 5–6 (climax): print the move list again; its header carries a new generated time.
    await openStep(page, planId, /^\d*Move list/, "print");
    await expect(main.locator("[data-move-line]")).toHaveCount(3);
    await stubPrint(page);
    const printGet = page.waitForResponse(isMoveListGet(planId));
    await main.getByRole("button", { name: "Print", exact: true }).click();
    const printed = (await (await printGet).json()) as MoveListView;
    await expect.poll(() => printCount(page)).toBe(1);
    expect(Date.parse(printed.header.generated_at)).toBeGreaterThan(Date.parse(lastWeekPaper.header.generated_at));
    // Times show to the minute, so the paper is compared with the new response's time: the line
    // printed is the fresh one, never a cached header.
    expect(await printedGenerated(page)).toEqual([
      `Generated ${await localDateTime(page, printed.header.generated_at)} · Smart Warehouse Planner`,
    ]);

    // Step 7: New Plan from this import (plate menu): the same import, none of the marks or moves.
    await plate(page).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "New Plan from this import" }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/new\\?from=${planId}$`));
    await expect(
      main.getByRole("listbox", { name: "Saved plans" }).getByRole("option", { name: new RegExp(name) }),
    ).toHaveAttribute("aria-selected", "true");
    const tryName = `Autumn try ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Plan name").fill(tryName);
    await page.getByRole("button", { name: "New Plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    const tryId = new URL(page.url()).pathname.split("/")[2];
    expect(tryId).not.toBe(planId);
    await expect(plate(page)).toContainText(tryName);
    await expect(plate(page)).toContainText(`Data as of ${saved.data_as_of} · round 0`);
    const tried = await summaryOf(request, tryId);
    expect(tried.import_id).toBe(saved.import_id);
    expect([tried.best_locations, tried.move_count, tried.current_round]).toEqual([0, 0, 0]);
  });

  test("uj5 fr39 fr40 fr50 fr28 fr42 an examiner tries the demo", async ({ page }) => {
    test.setTimeout(240_000);
    await turnDemoOn(page);
    const main = page.getByRole("main");

    // Step 1 (local install, demo flag on in this browser): the front page and its four panels.
    await page.goto("/");
    await expect(main.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    const panels = page
      .locator("#how-it-works")
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3 }) });
    await expect(panels.getByRole("heading", { level: 3 })).toHaveText(PANELS);

    // Step 2: Demo version lands on the saved-plans list as `demo`, with no login page.
    await main.getByRole("button", { name: "Demo version" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(main.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
    const avatar = page.getByRole("banner").getByRole("button", { name: "User menu" });
    await expect(avatar).toHaveText("DE");
    await expect(main.getByRole("table", { name: "Saved plans" }).or(main.getByText(/^No plans yet\./))).toBeVisible();

    // Step 3: New Plan with the three files from data/sample/; the plan opens on the overview.
    await main.getByRole("link", { name: "New Plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/new$/);
    const planId = await newPlanThroughUi(page, `Examiner ${randomUUID().slice(0, 8)}`);
    await expect(main.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

    // Step 4: as in UJ-1 step 3: the Locations wall, a best-location mark, Run recommendations.
    await openStep(page, planId, /^\d*Locations/, "locations");
    await expect(main.getByRole("grid", { name: "Aisle A bin wall" })).toBeVisible();
    await openStep(page, planId, /^\d*Best locations/, "best-locations");
    await main.getByRole("radiogroup", { name: "Marking mode" }).getByRole("radio", { name: "Whole aisle" }).click();
    await main.getByRole("grid", { name: "Aisle A bin wall" }).locator("[data-grid-cell]").first().click();
    await expectMarksSaved(page);
    await expect(main.getByRole("list", { name: "Best-location marks" }).getByRole("listitem")).toHaveText(["Aisle A"]);
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await runRound(page, 1);

    // Step 5 (climax): recommendation #1 shows its reason in numbers and its bin lifted on the wall.
    const ran = await recommendationsOf(page.request, planId);
    const top = visibleOpen(ran)[0];
    expect(top.number).toBe(1);
    const detail = main.getByRole("region", { name: "Selected recommendation" });
    await expect(main.getByTestId("detail-eyebrow")).toHaveText(`SELECTED · #1 · RULE ${top.rule.slice(-1)}`);
    const reason = top.reason!;
    await expect(detail.getByTestId("detail-reason")).toContainText(
      reason.kind === "class" ? `${n(reason.picks)} ${reason.picks === 1 ? "pick" : "picks"} in the period` : `${n(reason.shared_jobs)} shared jobs`,
    );
    await expect(detail.locator('[data-crops] [data-lifted="1"]')).toHaveCount(1);
    await detail.getByRole("link", { name: "Show on the Locations wall" }).click();
    const fromAisle = top.from_location.split("-")[0];
    await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=${fromAisle}&rec=`));
    await expect(main.locator(`[data-wall-panel="${fromAisle}"] [data-lifted="1"]`)).toHaveCount(1);

    // Step 6 (resolution): Log out in the avatar menu returns to the demo front page.
    await avatar.click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(main.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();

    // Other ways in: Log in with demo/demo.
    await main.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page, "demo", "demo");
    await expect(page).toHaveURL(/\/plans$/);
    await expect(avatar).toHaveText("DE");
    await avatar.click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Other ways in: Create account. Failure path: the username is taken; focus on Username;
    // another name succeeds.
    await main.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    const card = page.getByRole("region", { name: "Create account" });
    const username = page.getByLabel("Username");
    await username.fill("demo");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repeat password").fill(PASSWORD);
    await card.getByRole("button", { name: "Create account" }).click();
    await expect(card.getByText("That username is taken. Try another.")).toBeVisible();
    await expect(username).toBeFocused();
    await expect(page).toHaveURL(/\/signup$/);
    const examiner = uniqueUsername("uj5");
    await username.fill(examiner);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repeat password").fill(PASSWORD);
    await card.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(avatar).toHaveText(examiner.slice(0, 2).toUpperCase());
  });
});

// -------------------------------------------------------------------------------------------------
// Journeys of the logged-in planner (the shared e2e account).

test.describe("user journeys of a logged-in planner", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj2 fr38 nfr9 a colleague carries out the move list", async ({ page, request }) => {
    test.setTimeout(180_000);
    // Given: a plan with two applied rounds (round 1 frees best locations, round 2 uses them).
    const name = `Autumn re-slot ${randomUUID().slice(0, 8)}`;
    const planId = (await createSamplePlan(request, name)).id;
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "level", level: "1", aisle: null } });
    await postCommand(request, planId, { type: "run" });
    const round1 = (await recommendationsOf(request, planId)).recommendations.filter((row) => row.status === "open");
    for (const row of round1.filter((rec) => rec.rule === "rule_2").slice(0, 5)) {
      await postCommand(request, planId, { type: "apply", recommendation_id: row.id });
    }
    await postCommand(request, planId, { type: "run" });
    await postCommand(request, planId, { type: "apply_all" });
    // A run only targets locations empty when it starts, so within one round only manual moves can
    // go into a location another line empties: one part moves out of its slot, another moves in.
    const toRows = (rows: Awaited<ReturnType<typeof locationRows>>) =>
      rows.map((row) => ({ location: { ...row.location, level: "" }, occupied: row.occupied, parts: row.contents }));
    const now = await locationRows(request, planId);
    const out = await lonePart(request, planId, toRows(now), new Set());
    const into = await lonePart(request, planId, toRows(now), new Set([out.part, out.from]));
    const empty = now.find((row) => !row.occupied)!.location.code;
    await postCommand(request, planId, { type: "manual_move", part: out.part, from: out.from, to: empty });
    await postCommand(request, planId, { type: "manual_move", part: into.part, from: into.from, to: out.from });
    const summary = await summaryOf(request, planId);

    // Step 1: Move list from the flow bar, printed from the browser.
    await page.goto(`/plans/${planId}/overview`);
    const main = page.getByRole("main");
    await openStep(page, planId, /^\d*Move list/, "print");
    const lines = main.locator("[data-move-line]");
    await expect(lines).toHaveCount(summary.move_count);
    const print = main.getByRole("button", { name: "Print", exact: true });
    await stubPrint(page);
    await print.click();
    await expect.poll(() => printCount(page)).toBe(1);

    // Step 2: the header: plan name, data-as-of date, when it was generated.
    await expect(main.locator("[data-move-list-title]")).toHaveText(`Move list · ${name}`);
    await expect(main.locator("[data-move-list-data]")).toContainText(`Data as of ${summary.data_as_of}`);
    await expect(main.locator("[data-move-list-data]")).toHaveText(/ · 2 rounds$/);
    await expect(main.locator("[data-move-list-generated]")).toHaveText(/^Generated \d{4}-\d{2}-\d{2} \d{2}:\d{2} · /);

    // Step 3: the ROUND 1 band (one walk), and each line: tick box, round, part, from, to, Note.
    const bands = main.locator("[data-round-band]");
    await expect(bands).toHaveCount(2);
    await expect(bands.nth(0)).toContainText("ROUND 1");
    await expect(bands.nth(0)).toContainText("one walk · from-location before to-location");
    for (const header of ["Round", "Part", "Description", "From", "To", "Rule", "Note"]) {
      await expect(main.locator("[data-paper] thead").getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    }
    const line = lines.first();
    await expect(line.locator("td").nth(0).locator("span")).toBeVisible();
    await expect(line.locator("td").nth(1)).toHaveText("1");
    await expect(line.locator("td").nth(7)).toHaveText("");

    // Step 4 (and the climax, step 5): in each round, a line into a location comes after the line
    // that empties it, so no target is still full when the colleague gets there.
    const walk = await page.evaluate(() =>
      [...document.querySelectorAll("[data-move-line]")].map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          round: cells[1].textContent ?? "",
          part: cells[2].textContent ?? "",
          from: cells[4].textContent ?? "",
          to: cells[5].textContent ?? "",
          rule: cells[6].textContent ?? "",
        };
      }),
    );
    expect(walk).toHaveLength(summary.move_count);
    // Not vacuous: at least one line goes into a location an earlier line of its round emptied
    // (the two manual moves of the starting state).
    expect(
      walk.some((into, index) =>
        walk.some((out, at) => at < index && out.round === into.round && out.from === into.to && out.part !== into.part),
      ),
      "a line into a location emptied earlier in its round",
    ).toBe(true);
    for (const [index, into] of walk.entries()) {
      if (into.rule.includes("Swap")) continue;
      const emptiedLater = walk.findIndex(
        (out, at) => at > index && out.round === into.round && out.from === into.to && out.part !== into.part,
      );
      expect(emptiedLater, `line ${index + 1} into ${into.to} comes after the line emptying it`).toBe(-1);
    }

    // Step 6: the Round 2 band, whose moves use the locations round 1 freed.
    await expect(bands.nth(1)).toContainText("ROUND 2");
    const round2 = walk.filter((entry) => entry.round === "2");
    expect(round2.length).toBeGreaterThan(0);
    const freed = new Set(walk.filter((entry) => entry.round === "1").map((entry) => entry.from));
    expect(round2.some((entry) => freed.has(entry.to))).toBe(true);

    // On paper only the move list prints: the app chrome and the actions are hidden.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator('header[data-surface="graphite"]')).toHaveCSS("display", "none");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(print).toBeHidden();
    await expect(main.locator("[data-move-list-title]")).toBeVisible();
    await expect(bands).toHaveCount(2);
    await page.emulateMedia({ media: "screen" });
    await expect(print).toBeVisible();
    // Failure path (a part not at its from-location) is written in the Note space by hand; the tool
    // does not track moves carried out, so there is nothing more to check here.
  });

  test("uj4 fr42 changes a colour from the key", async ({ page, request }) => {
    test.setTimeout(180_000);
    // Given: a plan with applied moves (so the move list prints lines), open on the Locations wall.
    const planId = (await createSamplePlan(request, `Colours ${randomUUID().slice(0, 8)}`)).id;
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await postCommand(request, planId, { type: "run" });
    await postCommand(request, planId, { type: "apply_all" });
    const version = (await summaryOf(request, planId)).version;

    // Step 1: the Locations wall with its Key.
    await page.goto(`/plans/${planId}/overview`);
    await openStep(page, planId, /^\d*Locations/, "locations");
    const main = page.getByRole("main");
    const picture = main.locator('[data-wall-panel="A"]');
    await expect(picture.locator("[data-cell]").first()).toBeVisible();
    await expectSlowBin(picture, DEFAULT_SLOW_RGB);

    // Step 2: Slow-moving in the Key opens a popover above it: eight shades, the current one ringed.
    const entry = main.getByRole("button", { name: "Slow-moving, change colour" });
    await entry.click();
    const dialog = page.getByRole("dialog", { name: "Slow-moving colour" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radiogroup").getByRole("radio")).toHaveCount(8);
    const current = dialog.getByRole("radio", { name: "Default", exact: true });
    await expect(current).toBeChecked();
    await expect(current).toBeFocused();
    expect((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height).toBeLessThanOrEqual(
      (await entry.boundingBox())!.y,
    );

    // Step 3: arrowing through the shades previews each one live on the wall.
    let shown = await rootSlow(page);
    for (let shade = 1; shade <= 6; shade += 1) {
      await page.keyboard.press("ArrowRight");
      const radio = dialog.getByRole("radio", { name: `Slow-moving shade ${shade} of 8` });
      await expect(radio).toBeChecked();
      await expect(radio).toBeFocused();
      const before = shown;
      await expect.poll(() => rootSlow(page)).not.toBe(before);
      shown = await rootSlow(page);
    }
    await expect.poll(() => rootSlow(page)).toBe(SHADE_6);
    await expectSlowBin(picture, SHADE_6_RGB);

    // Step 4: shade 6, no warning; Done announces the change and focus returns to the Key entry.
    await expect(dialog.getByRole("status")).toHaveText("");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
    await expect(main.locator("[data-key-announcer]")).toHaveText("Slow-moving colour changed");
    await expect(entry).toBeFocused();

    // Step 5 (climax): the wall and the Key swatch use the new shade; the ▼ glyph is unchanged.
    await expectSlowBin(picture, SHADE_6_RGB);
    await expectSlowBin(main.locator('[data-key-swatch="slow"]'), SHADE_6_RGB);

    // Step 6 (resolution): after a reload the colour is still there; no plan changed.
    await page.reload();
    await expect(picture.locator("[data-cell]").first()).toBeVisible();
    expect(await rootSlow(page)).toBe(SHADE_6);
    await expectSlowBin(picture, SHADE_6_RGB);
    expect((await summaryOf(request, planId)).version).toBe(version);

    // Failure path: a hex close to the selection violet warns; Esc restores the colour from when
    // the popover opened.
    await entry.click();
    await expect(dialog).toBeVisible();
    const hex = dialog.getByRole("textbox", { name: "Colour code" });
    await hex.fill("#9A6AF0");
    await expect.poll(() => rootSlow(page)).toBe("#9A6AF0");
    await expect(dialog.getByRole("status")).toContainText(
      /Slow-moving and Selection look alike \(ΔE \d+\)\. Bins and the selection frame may be hard to tell apart\./,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(entry).toBeFocused();
    expect(await rootSlow(page)).toBe(SHADE_6);
    await expectSlowBin(picture, SHADE_6_RGB);

    // Climax, on paper: the printed move list stays black and white.
    await openStep(page, planId, /^\d*Move list/, "print");
    await expect(main.locator("[data-move-line]").first()).toBeVisible();
    expect(await printOffenders(page, SHADE_6_RGB)).toEqual([]);
  });

  test("uj6 fr19 fr20 fr26 fr28 fr37 checks which parts are picked together", async ({ page, request }) => {
    test.setTimeout(180_000);
    const planId = (await createSamplePlan(request, `Pick groups ${randomUUID().slice(0, 8)}`)).id;
    const groups = await pickGroupsOf(request, planId);
    const pair = groups.find((row) => row.part_a.aisle !== null && row.part_b.aisle !== null && !row.same_aisle)!;
    expect(pair, "a pick group in different aisles").toBeDefined();

    // Step 1: Pick groups, sorted by shared jobs, most first; both parts, the shared jobs, each
    // part's aisle and Same aisle or Different aisles.
    await page.goto(`/plans/${planId}/overview`);
    await openStep(page, planId, /^\d*Pick groups/, "pick-groups");
    const main = page.getByRole("main");
    const table = main.getByRole("table", { name: "Pick groups" });
    const body = table.locator("tbody tr");
    await expect(body).toHaveCount(groups.length);
    const shared = (await table.locator("tbody tr td:nth-child(3)").allTextContents()).map((text) =>
      Number(text.replace(/,/g, "")),
    );
    expect(shared).toEqual([...shared].sort((a, b) => b - a));
    const groupRow = (a: string, b: string) =>
      body.filter({ has: page.locator(`[data-open-part="${a}"]`) }).filter({ has: page.locator(`[data-open-part="${b}"]`) });

    // Step 2: near the top, a pair in different aisles.
    const pairRow = groupRow(pair.part_a.part, pair.part_b.part);
    await expect(pairRow.getByRole("cell").nth(2)).toHaveText(n(pair.shared_jobs));
    await expect(pairRow.locator("td:nth-child(4)")).toHaveText(pair.part_a.aisle!);
    await expect(pairRow.locator("td:nth-child(5)")).toHaveText(pair.part_b.aisle!);
    await expect(pairRow.locator("[data-same-aisle]")).toHaveText("Different aisles");

    // Step 3: the part panel: its pick groups and partners, its current location as a chip; the chip
    // opens the Locations wall at that bin.
    const part = pair.part_a.part;
    const detail = await getJson<{ current_location: Ref; pick_groups: { partner: { part: string }; shared_jobs: number }[] }>(
      request,
      `/api/plans/${planId}/parts/${encodeURIComponent(part)}`,
    );
    await pairRow.locator(`[data-open-part="${part}"]`).click();
    const panel = page.getByRole("complementary", { name: part });
    await expect(panel.getByRole("heading", { name: part, level: 2 })).toBeFocused();
    await expect(panel.locator("[data-partner]")).toHaveCount(detail.pick_groups.length);
    await expect(panel.locator(`[data-partner="${pair.part_b.part}"]`)).toContainText(`${n(pair.shared_jobs)} shared jobs`);
    const chip = panel.locator(`[data-location-chip="${detail.current_location.code}"]`);
    await chip.click();
    await expect(page).toHaveURL(
      new RegExp(
        `/plans/${planId}/locations\\?aisle=${detail.current_location.aisle}&loc=${encodeURIComponent(detail.current_location.code)}$`,
      ),
    );
    await expect(page.getByRole("dialog", { name: detail.current_location.code })).toBeVisible();
    await page.keyboard.press("Escape");

    // Step 4: run; a rule 3 row moves a part into its partner's aisle, with the reason in numbers.
    const before = await beforeAfterOf(request, planId);
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await runRound(page, 1);
    const rule3 = (await recommendationsOf(request, planId)).recommendations.filter(
      (row) => row.rule === "rule_3" && row.status === "open",
    );
    expect(rule3.length).toBeGreaterThan(0);
    // The pair from step 2 when the run moves one of its parts; else the first rule 3 row.
    const isPair = (row: RecRow) =>
      row.reason?.kind === "pick_group" &&
      [row.part, row.reason.partner].sort().join() === [pair.part_a.part, pair.part_b.part].sort().join();
    const rec = rule3.find(isPair) ?? rule3[0];
    const why = rec.reason as Extract<RecRow["reason"], { kind: "pick_group" }>;
    await selectRecommendation(main, rec);
    await expect(main.getByRole("region", { name: "Selected recommendation" }).getByTestId("detail-reason")).toHaveText(
      `Pick group with ${why.partner} (aisle ${why.partner_aisle}): ${n(why.shared_jobs)} shared jobs (${n(why.min_shared_jobs)} or more)`,
    );
    expect(rec.to_location.split("-")[0]).toBe(why.partner_aisle);
    await applyFromDetail(page, rec, 1);

    // Step 5 (climax): on Pick groups the row now says Same aisle (aisles come from the planning
    // copy), and Before/after counts one more pick group in the same aisle.
    await openStep(page, planId, /^\d*Pick groups/, "pick-groups");
    const movedRow = groupRow(rec.part, why.partner);
    await expect(movedRow.locator("[data-same-aisle]")).toHaveText("Same aisle");
    await expect(movedRow.locator("td:nth-child(4)")).toHaveText(why.partner_aisle!);
    await expect(movedRow.locator("td:nth-child(5)")).toHaveText(why.partner_aisle!);
    await openStep(page, planId, /Before\/after\s*, step 7$/, "before-after");
    const together = (await beforeAfterOf(request, planId)).total.pick_groups_together;
    expect(together.after).toBe(before.total.pick_groups_together.after + 1);
    const totalRow = aisleRow(main.getByRole("table", { name: "Before/after" }), "Total");
    await expect(totalRow.locator('[data-count="pick_groups_together"]')).toHaveText(
      `${n(together.before)} → ${n(together.after)}`,
    );
    // Empty case ("No pick groups: no two parts share 5 or more jobs in the period.") cannot be
    // reached from the UI on the sample data, which always has pick groups; the empty table text is
    // covered by the frontend unit tests of the Pick groups view.
  });

  test("uj7 fr13 fr15 fr17 fr32 fr33 fr42 looks through the parts before a run", async ({ page, request }) => {
    test.setTimeout(180_000);
    // Given: a plan with its best locations marked, before its first run.
    const planId = (await createSamplePlan(request, `Parts ${randomUUID().slice(0, 8)}`)).id;
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "level", level: "1", aisle: null } });
    const roster = await rosterOf(request, planId);
    const whyLine = (row: RosterRow) =>
      `${CLASS_LABELS[row.movement_class]} · ${n(row.picks)} ${row.picks === 1 ? "pick" : "picks"} · ${row.current_location?.code ?? NO_STOCK}`;

    // Step 1: Parts: every part ranked by picks, each with its why-line.
    await page.goto(`/plans/${planId}/overview`);
    await openStep(page, planId, /^\d*Parts/, "parts");
    // CSS, not role, for the roster (about 38k elements; see parts-roster.spec.ts).
    const main = page.locator("main");
    const body = main.locator('table[aria-label="Parts"] tbody tr');
    await expect(main.getByText(`${n(roster.length)} parts`, { exact: true })).toBeVisible();
    await expect(body).toHaveCount(roster.length);
    await expect(body.first().locator("td").first()).toHaveText("1");
    await expect(body.first().locator("[data-why-line]")).toHaveText(whyLine(roster[0]));

    // Step 2: the Fast-moving chip leaves only fast-moving parts.
    const fast = roster.filter((row) => row.movement_class === "fast");
    const chip = main.getByRole("group", { name: "Filter by movement class" }).getByRole("button", { name: "Fast-moving" });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(main.getByText(`${n(fast.length)} of ${n(roster.length)} parts`, { exact: true })).toBeVisible();
    await expect(body).toHaveCount(fast.length);
    expect((await body.locator("[data-why-line]").allTextContents()).every((line) => line.startsWith("Fast-moving"))).toBe(true);

    // Step 3: a bulky fast-moving part: its panel, Keep in place; the toast, the pin on its row.
    const kept = fast[0];
    const keptRow = body.first();
    await expect(keptRow).toContainText(kept.part);
    await keptRow.locator("td").nth(1).click();
    const keptPanel = page.getByRole("complementary", { name: kept.part });
    await keptPanel.getByRole("button", { name: "Keep in place" }).click();
    await expect(
      toasts(page).getByText(`${kept.part} is kept in place. Remove the mark from the part or the Kept in place tab.`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(keptRow.getByText("kept in place", { exact: true })).toBeVisible();
    await expect(keptRow.getByRole("button", { name: "Remove keep in place" })).toBeVisible();

    // Step 4: Ctrl+/ focuses the search; "oil filter" lists parts and locations apart; choosing a
    // part opens its panel.
    type Search = { parts: { part: string }[] };
    const search = await getJson<Search>(request, `/api/plans/${planId}/search?q=oil%20filter`);
    let chosen: { part: string; from: string } | undefined;
    for (const { part } of search.parts) {
      if (part === kept.part) continue;
      const detail = await partDetail(request, planId, part);
      if (detail.current_location && detail.other_locations.length === 0) {
        chosen = { part, from: detail.current_location.code };
        break;
      }
    }
    expect(chosen, "an oil filter stored in one location").toBeDefined();
    const field = main.getByRole("searchbox", { name: "Search parts and locations" });
    await main.getByRole("heading", { name: "Parts", level: 1 }).click();
    await page.keyboard.press("Control+/");
    await expect(field).toBeFocused();
    await page.keyboard.type("oil filter");
    const results = main.getByRole("region", { name: "Search results" });
    await expect(results.getByRole("heading", { name: "Parts" })).toBeVisible();
    await expect(results.getByRole("heading", { name: "Locations" })).toBeVisible();
    await results.locator(`[data-search-part="${chosen!.part}"]`).click();
    const panel = page.getByRole("complementary", { name: chosen!.part });
    await expect(panel.getByRole("heading", { name: chosen!.part, level: 2 })).toBeFocused();

    // Step 5: Manual move… into an empty location; the wall shows it with "M".
    const rows = await locationRows(request, planId);
    const target = rows.find((row) => !row.occupied)!.location;
    await moveFromPanel(page, panel, chosen!.part, chosen!.from, target.code);
    await panel.locator(`[data-location-chip="${target.code}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${planId}/locations\\?aisle=${target.aisle}&loc=`));
    const grid = main.getByRole("grid", { name: `Aisle ${target.aisle} bin wall` });
    await expect(grid.locator(`[data-grid-cell="${target.code}"]`)).toHaveAttribute("aria-label", /manual move, arrived here$/);
    await expect(main.locator('[data-wall-markers] [data-move-marker="M"]')).toHaveCount(1);
    await page.keyboard.press("Escape");

    // Step 6 (climax): in the run the kept part gets no recommendation, and the manual move is
    // already in the planning copy the run starts from.
    await openStep(page, planId, /^\d*Recommendations/, "recommendations");
    await runRound(page, 1);
    const ran = await recommendationsOf(request, planId);
    expect(ran.recommendations.filter((row) => row.part === kept.part)).toEqual([]);
    for (const row of ran.recommendations.filter((rec) => rec.part === chosen!.part)) {
      expect(row.from_location).toBe(target.code);
    }
    expect((await partDetail(request, planId, chosen!.part)).current_location?.code).toBe(target.code);
    const keptTab = page.getByRole("main").getByRole("tab", { name: /^Kept in place, / });
    await keptTab.click();
    await expect(
      page.getByRole("main").getByRole("listbox", { name: "Recommendations" }).getByRole("option", { name: new RegExp(`^${kept.part}, `) }),
    ).toHaveAccessibleName(/, Kept in place$/);

    // Failure path: a part with no stock has no current location, and Manual move… is disabled.
    const noStock = roster.find((row) => row.current_location === null)!;
    await openStep(page, planId, /^\d*Parts/, "parts");
    await expect(body.first()).toBeVisible();
    await main.getByRole("heading", { name: "Parts", level: 1 }).click();
    await page.keyboard.press("Control+/");
    await expect(field).toBeFocused();
    await page.keyboard.type(noStock.part);
    await main.locator(`[data-search-part="${noStock.part}"]`).click();
    const noStockPanel = page.getByRole("complementary", { name: noStock.part });
    await expect(noStockPanel).toContainText(NO_STOCK);
    const moveButton = noStockPanel.getByRole("button", { name: "Manual move…" });
    await expect(moveButton).toHaveAttribute("aria-disabled", "true");
    await expect(moveButton).toHaveAccessibleDescription(NO_STOCK);
  });

  test("uj8 ux_dr7 ux_dr8 fr23 jumps around with the launcher", async ({ page, request }) => {
    test.setTimeout(180_000);
    // Given: a plan deep in Recommendations (round 1), and another saved plan named "Spring …".
    const suffix = randomUUID().slice(0, 8);
    const planId = (await createSamplePlan(request, `Autumn re-slot ${suffix}`)).id;
    const spring = await createSamplePlan(request, `Spring re-slot moves ${suffix}`);
    await postCommand(request, planId, { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } });
    await postCommand(request, planId, { type: "run" });
    await page.goto(`/plans/${planId}/recommendations`);
    const main = page.getByRole("main");
    await expect(main.getByTestId("round-chip")).toHaveText("Round 1");
    await planReady(page);

    // Step 1: Ctrl+K unfolds the flow map: one column per step, focus in the search field.
    await page.keyboard.press("Control+k");
    await expect(launcher(page)).toBeVisible();
    await expect(searchField(page)).toBeFocused();
    for (const step of STEPS) await expect(launcher(page).getByRole("group", { name: step, exact: true })).toBeVisible();
    await expect(launcher(page).getByRole("group", { name: "Recommendations", exact: true }).getByText("You are here")).toBeVisible();

    // Step 2: "mov" groups Steps, Actions and Saved plans; Move list is highlighted; Enter opens it.
    await page.keyboard.type("mov");
    const results = launcher(page).getByRole("listbox", { name: "Results" });
    for (const group of ["Steps", "Actions", "Saved plans"]) {
      await expect(results.getByRole("group", { name: group, exact: true })).toBeVisible();
    }
    await expect(results.getByRole("group", { name: "Actions", exact: true })).toContainText("Undo last move");
    await expect(results.getByRole("group", { name: "Saved plans", exact: true })).toContainText(spring.name);
    const first = results.getByRole("option").first();
    await expect(first).toContainText("Move list");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${planId}/print$`));
    await expect(launcher(page)).toBeHidden();
    await expect(page.getByRole("heading", { name: "Move list", level: 1 })).toBeVisible();

    // Step 3: without typing, Tab to the Recommendations column, arrow to Run round 2, Enter runs it.
    await page.keyboard.press("Control+k");
    await expect(searchField(page)).toBeFocused();
    const rec = launcher(page).getByRole("group", { name: "Recommendations", exact: true });
    const recLink = rec.getByRole("link", { name: /REC/ });
    for (let tab = 0; tab < STEPS.length && !(await recLink.evaluate((el) => el === document.activeElement)); tab += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(recLink).toBeFocused();
    const run = rec.getByRole("button", { name: "Run round 2" });
    for (let arrow = 0; arrow < 5 && !(await run.evaluate((el) => el === document.activeElement)); arrow += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await expect(run).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${planId}/recommendations`));
    await expect(main.getByTestId("round-chip")).toHaveText("Round 2", { timeout: 30_000 });
    await expect(toasts(page).getByText(/^Recommendations, round 2, /)).toBeVisible();

    // Step 4: "spring" and Enter open the other plan.
    await page.keyboard.press("Control+k");
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.type(`spring re-slot moves ${suffix}`);
    await expect(launcher(page).getByRole("option", { name: spring.name })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/plans/${spring.id}(/|$)`));
    await expect(launcher(page)).toBeHidden();
    await expect(plate(page)).toContainText(spring.name);
    await planReady(page);

    // Failure path: "xyz" matches nothing; Esc closes the drawer and focus returns to the grid
    // button; CAT is an active link, and LBL reads "Coming in stage 2" and does not open.
    await page.keyboard.press("Control+k");
    await page.keyboard.type("xyz");
    await expect(launcher(page).getByText("No feature or saved plan matches “xyz”.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(launcher(page)).toBeHidden();
    await expect(gridButton(page)).toBeFocused();
    await page.keyboard.press("Control+k");
    const cat = launcher(page).getByRole("link", { name: /CAT/ });
    await expect(cat).not.toContainText("Coming in stage 2");
    await expect(cat).not.toHaveAttribute("aria-disabled");
    const lbl = launcher(page).getByRole("button", { name: /LBL/ });
    await expect(lbl).toContainText("Coming in stage 2");
    await expect(lbl).toHaveAttribute("aria-disabled", "true");
    const url = page.url();
    await lbl.focus();
    await page.keyboard.press("Enter");
    await expect(launcher(page)).toBeVisible();
    expect(page.url()).toBe(url);
    await page.keyboard.press("Escape");
    await expect(launcher(page)).toBeHidden();
  });
});

// -------------------------------------------------------------------------------------------------
// Journey steps that need later epics: declared here so the report lists them as skipped.

test.skip("uj1 fr46 the category check of a plan's parts and aisles (Epic 13, stage 2)", async () => {});
test.skip("uj2 fr48 location labels with QR codes printed from a plan (Epic 14, stage 2)", async () => {});
test.skip("uj3 fr41 a concurrent edit by another planner shows the warning (Epic 15, if time allows)", async () => {});
test.skip("uj5 the examiner opens the public deployment's demo front page (Epic 16, deployment)", async () => {});
