import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createSamplePlan } from "./support/sample-plan";

// UJ-6: the planner opens the Pick groups step and reads which parts are picked together and
// whether each pair sits in the same aisle (Story 2.5; FR-20, UX-DR29).

test.skip(({ browserName }) => browserName !== "chromium", "The pick groups journey runs in Chromium.");

type Part = { part: string; description: string; aisle: string | null };
type Row = { part_a: Part; part_b: Part; shared_jobs: number; same_aisle: boolean };
type View = { version: number; pick_groups: Row[] };

test("uj6 checks which parts are picked together on the pick groups table", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const planId = (await createSamplePlan(request, `Pick groups ${randomUUID().slice(0, 8)}`)).id;
  const api = await request.get(`/api/plans/${planId}/pick-groups`);
  expect(api.status()).toBe(200);
  const view = (await api.json()) as View;
  expect(view.pick_groups.length).toBeGreaterThan(0);

  await page.goto(`/plans/${planId}/overview`);
  const nav = page.getByRole("navigation", { name: "Plan steps" });
  await nav.getByRole("link", { name: /^\d*Pick groups/ }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/${planId}/pick-groups$`));

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Pick groups", level: 1 })).toBeVisible();
  const count = view.pick_groups.length;
  const countLine = `${count.toLocaleString("en-US")} ${count === 1 ? "pick group" : "pick groups"}`;
  await expect(main.getByText(countLine, { exact: true })).toBeVisible();

  const body = main.getByRole("table", { name: "Pick groups" }).locator("tbody tr");
  await expect(body).toHaveCount(count);

  const first = view.pick_groups[0];
  const firstRow = body.first();
  await expect(firstRow).toContainText(first.part_a.part);
  await expect(firstRow).toContainText(first.part_b.part);
  await expect(firstRow.getByRole("cell").nth(2)).toHaveText(first.shared_jobs.toLocaleString("en-US"));
  await expect(firstRow.locator("[data-same-aisle]")).toHaveText(first.same_aisle ? "Same aisle" : "Different aisles");

  const aisleText = (aisle: string | null) => aisle ?? "No current location";
  const aislesA = await body.locator("td:nth-child(4)").allTextContents();
  const aislesB = await body.locator("td:nth-child(5)").allTextContents();
  expect(aislesA).toEqual(view.pick_groups.map((row) => aisleText(row.part_a.aisle)));
  expect(aislesB).toEqual(view.pick_groups.map((row) => aisleText(row.part_b.aisle)));

  const cells = await body.locator("[data-same-aisle]").allTextContents();
  expect(cells).toEqual(view.pick_groups.map((row) => (row.same_aisle ? "Same aisle" : "Different aisles")));
});
