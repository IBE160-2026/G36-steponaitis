import { randomUUID } from "node:crypto";

import { launcher, planReady, searchField } from "./support/launcher";
import { createSamplePlan } from "./support/sample-plan";
import { expect, type Locator, type Page, test } from "./support/test";

// UJ-8, Story 13.2 (FR-43, FR-45, UX-DR7, UX-DR16, UX-DR18): CAT opens the Categories page, where
// the planner keeps the global keyword rules and gives aisles their categories. Rules and aisle
// categories are global and the browsers run this spec at the same time, so every keyword and
// category is unique to the run, each browser uses its own aisle, and only its own rows are read.

/** One aisle per browser project, so parallel runs never replace each other's aisle list. */
const AISLE_BY_PROJECT: Record<string, string> = { chromium: "G", firefox: "H", msedge: "I" };

function ruleRow(page: Page, keyword: string): Locator {
  return page
    .getByRole("table", { name: "Keyword rules" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: keyword, exact: true }) });
}

async function position(page: Page, keyword: string): Promise<number> {
  const text = await ruleRow(page, keyword).getByRole("cell").first().textContent();
  return Number((text ?? "").replace(/[^\d]/g, ""));
}

async function addRule(page: Page, keyword: string, category: string) {
  const form = page.getByRole("form", { name: "Add rule" });
  await form.getByLabel("Keyword").fill(keyword);
  await form.getByLabel("Category").fill(category);
  await form.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleRow(page, keyword)).toBeVisible();
  await expect(form.getByLabel("Keyword")).toHaveValue("");
}

test.describe("uj8 categories", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("uj8 opens CAT and manages keyword rules and aisle categories", async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const run = randomUUID().slice(0, 8);
    const first = { keyword: `kwa${run}`, category: `Cata ${run}` };
    const second = { keyword: `kwb${run}`, category: `Catb ${run}` };
    const edited = `Catc ${run}`;
    const aisle = AISLE_BY_PROJECT[testInfo.project.name] ?? "F";
    const plan = await createSamplePlan(request, `Rules journey ${run}`);

    // CAT is found by search and opens the Categories page on Keyword rules.
    await page.goto(`/plans/${plan.id}/overview`);
    await planReady(page);
    await page.keyboard.press("Control+k");
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.type("CAT");
    const option = launcher(page).getByRole("option", { name: /Keyword rules and aisle categories/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/categories$`));
    await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Keyword rules" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Aisle categories" })).toBeVisible();

    // Add two rules; a duplicate keyword shows the server's message under Keyword.
    await addRule(page, first.keyword, first.category);
    await addRule(page, second.keyword, second.category);
    const form = page.getByRole("form", { name: "Add rule" });
    await form.getByLabel("Keyword").fill(first.keyword.toUpperCase());
    await form.getByLabel("Category").fill("Other");
    await form.getByRole("button", { name: "Add rule" }).click();
    await expect(form.getByText("That keyword already has a rule.")).toBeVisible();
    await expect(form.getByLabel("Keyword")).toHaveAttribute("aria-invalid", "true");
    await expect(ruleRow(page, first.keyword.toUpperCase())).toHaveCount(0);
    await form.getByLabel("Keyword").fill("");
    await form.getByLabel("Category").fill("");

    // Edit the second rule's category in the dialog.
    await ruleRow(page, second.keyword).getByRole("button", { name: `Edit ${second.keyword}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit rule" });
    await expect(dialog.getByLabel("Keyword")).toHaveValue(second.keyword);
    await dialog.getByLabel("Category").fill(edited);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(ruleRow(page, second.keyword).getByRole("cell", { name: edited, exact: true })).toBeVisible();

    // Move the first rule down (the keyboard path) until it comes after the second one.
    expect(await position(page, first.keyword)).toBeLessThan(await position(page, second.keyword));
    for (let i = 0; i < 5 && (await position(page, first.keyword)) < (await position(page, second.keyword)); i++) {
      const before = await position(page, first.keyword);
      const moveDown = ruleRow(page, first.keyword).getByRole("button", { name: `Move down ${first.keyword}` });
      await moveDown.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => position(page, first.keyword)).not.toBe(before);
    }
    expect(await position(page, first.keyword)).toBeGreaterThan(await position(page, second.keyword));

    // Delete the second rule through the confirm: Cancel is focused and keeps it.
    const deleteSecond = ruleRow(page, second.keyword).getByRole("button", { name: `Delete ${second.keyword}…` });
    await deleteSecond.click();
    const confirm = page.getByRole("alertdialog", { name: "Delete rule" });
    await expect(confirm).toContainText(`Delete the rule “${second.keyword}” → ${edited}?`);
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(confirm).toBeHidden();
    await expect(ruleRow(page, second.keyword)).toHaveCount(1);
    await deleteSecond.click();
    await page.getByRole("alertdialog", { name: "Delete rule" }).getByRole("button", { name: "Delete rule" }).click();
    await expect(ruleRow(page, second.keyword)).toHaveCount(0);

    // Aisle categories: assign the first rule's category, remove it, assign it again.
    await page.getByRole("tab", { name: "Aisle categories" }).click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}/categories\\?tab=aisles$`));
    const row = page.getByRole("listitem", { name: `Aisle ${aisle}`, exact: true });
    const picker = row.getByLabel(`Category to add to aisle ${aisle}`);
    const chip = row.getByRole("button", { name: `Remove ${first.category} from aisle ${aisle}` });
    await picker.selectOption(first.category);
    await row.getByRole("button", { name: `Add the category to aisle ${aisle}` }).click();
    await expect(chip).toBeVisible();
    await expect(picker.locator("option", { hasText: first.category })).toHaveCount(0);
    await chip.click();
    await expect(chip).toHaveCount(0);
    await picker.selectOption(first.category);
    await row.getByRole("button", { name: `Add the category to aisle ${aisle}` }).click();
    await expect(chip).toBeVisible();
    await expect(row).not.toContainText("no keyword rule gives this category");

    // Delete the rule that gives it: the category stays on the aisle, marked.
    await page.getByRole("tab", { name: "Keyword rules" }).click();
    await ruleRow(page, first.keyword).getByRole("button", { name: `Delete ${first.keyword}…` }).click();
    await page.getByRole("alertdialog", { name: "Delete rule" }).getByRole("button", { name: "Delete rule" }).click();
    await expect(ruleRow(page, first.keyword)).toHaveCount(0);
    await page.getByRole("tab", { name: "Aisle categories" }).click();
    await expect(chip).toBeVisible();
    await expect(row).toContainText(`${first.category}· no keyword rule gives this category`);

    // Leave the aisle as it was.
    await chip.click();
    await expect(chip).toHaveCount(0);
  });
});
