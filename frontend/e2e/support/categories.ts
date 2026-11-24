import { type APIRequestContext, expect, type Locator, type Page } from "./test";

// Shared by the specs that use the Categories page (Story 13.2, 13.3): keyword rules and aisle
// categories are global, so each spec adds unique rules and cleans them up through the API.

const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin" };

/** The Keyword rules table row whose keyword cell is exactly `keyword`. */
export function ruleRow(page: Page, keyword: string): Locator {
  return page
    .getByRole("table", { name: "Keyword rules" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: keyword, exact: true }) });
}

/** Adds a rule through the Add rule form and waits for its row. */
export async function addRule(page: Page, keyword: string, category: string) {
  const form = page.getByRole("form", { name: "Add rule" });
  await form.getByLabel("Keyword").fill(keyword);
  await form.getByLabel("Category").fill(category);
  await form.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleRow(page, keyword)).toBeVisible();
  await expect(form.getByLabel("Keyword")).toHaveValue("");
}

/** On the Aisle categories tab: picks `category` for `aisle` and adds it; waits for its chip. */
export async function addAisleCategory(page: Page, aisle: string, category: string) {
  const row = page.getByRole("listitem", { name: `Aisle ${aisle}`, exact: true });
  await row.getByLabel(`Category to add to aisle ${aisle}`).selectOption(category);
  await row.getByRole("button", { name: `Add the category to aisle ${aisle}` }).click();
  await expect(row.getByRole("button", { name: `Remove ${category} from aisle ${aisle}` })).toBeVisible();
}

/** Cleanup: deletes the rules with these keywords and clears `aisle`'s categories (API). */
export async function removeCategories(request: APIRequestContext, keywords: readonly string[], aisle: string) {
  const response = await request.get("/api/keyword-rules");
  expect(response.ok(), await response.text()).toBe(true);
  const { rules } = (await response.json()) as { rules: { id: string; keyword: string }[] };
  for (const rule of rules.filter((candidate) => keywords.includes(candidate.keyword))) {
    const deleted = await request.delete(`/api/keyword-rules/${rule.id}`, { headers: SAME_ORIGIN });
    expect(deleted.ok(), await deleted.text()).toBe(true);
  }
  const cleared = await request.put(`/api/aisle-categories/${encodeURIComponent(aisle)}`, {
    data: { categories: [] },
    headers: SAME_ORIGIN,
  });
  expect(cleared.ok(), await cleared.text()).toBe(true);
}
