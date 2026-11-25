import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { parseCategoriesTab, planCategoriesHref } from "@/lib/view-state/urls";
import { AisleCategoriesView, AisleRow, CategoryChip, pickerOptions } from "@/modules/categories/aisle-categories-tab";
import {
  categoriesApi,
  changedFields,
  fieldErrors,
  type KeywordRule,
  keywordRulesKey,
  movedIds,
  type PlanAisleCategories,
  planCategoryCheckKey,
  runCategoriesWrite,
} from "@/modules/categories/api";
import { CategoriesView } from "@/modules/categories/categories-page";
import {
  deleteRuleConfirm,
  KeywordRulesView,
  ruleColumns,
  ruleErrors,
  RuleFieldsInputs,
  type RuleRowActions,
} from "@/modules/categories/keyword-rules-tab";

// Story 13.2 (FR-43, FR-45, UX-DR7, UX-DR16, UX-DR18): the Categories page rendered to static
// markup (Vitest has no DOM; clicks, focus and the round trips are covered in e2e).

const PLAN = "11111111-1111-4111-8111-111111111111";

function rule(id: string, position: number, keyword: string, category: string): KeywordRule {
  return { id, position, keyword, category, updated_at: "2026-11-24T10:00:00Z" };
}

const RULES = [rule("r1", 0, "filter", "Filters"), rule("r2", 1, "oil", "Oils"), rule("r3", 2, "belt", "Belts")];

const NO_ACTIONS: RuleRowActions = { onEdit: () => {}, onDelete: () => {}, onMove: () => {} };

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** Every element in a returned tree (not rendering child components). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

/** The `<tr>` markup of each body row. */
function bodyRows(markup: string): string[] {
  const tbody = markup.slice(markup.indexOf("<tbody"));
  return tbody
    .split("<tr")
    .slice(1)
    .map((row) => `<tr${row}`);
}

function rulesMarkup(rules: readonly KeywordRule[], actions: RuleRowActions = NO_ACTIONS) {
  return renderToStaticMarkup(<KeywordRulesView rules={rules} onAdd={async () => null} actions={actions} />);
}

function actionsCell(actions: RuleRowActions, row: KeywordRule) {
  const column = ruleColumns(RULES.length, actions).find((candidate) => candidate.key === "actions")!;
  return elements(column.cell(row, { isActive: true }));
}

describe("fr43 keyword rules tab", () => {
  it("fr43_rows_show_position_keyword_category_in_server_order", () => {
    const rows = bodyRows(rulesMarkup(RULES));
    expect(rows.map((row) => text(row).trim().split(" ").slice(0, 3).join(" "))).toEqual([
      "1 filter Filters",
      "2 oil Oils",
      "3 belt Belts",
    ]);
    const markup = rulesMarkup(RULES);
    expect(markup).toContain('aria-label="Keyword rules"');
    // Position is a number column: right-aligned and tabular (UX-DR18).
    expect(rows[0]).toMatch(/<td class="[^"]*text-right tabular-nums[^"]*">1<\/td>/);
    expect(text(markup)).toContain("Add rule");
  });

  it("fr43_no_rules_shows_the_empty_line_and_the_form", () => {
    const markup = text(rulesMarkup([]));
    expect(markup).toContain("No keyword rules yet.");
    expect(markup).toContain("Keyword");
    expect(markup).toContain("Category");
  });

  it("fr43_nfr10_move_up_disabled_on_first_row_and_move_down_on_last", () => {
    const [first, middle, last] = bodyRows(rulesMarkup(RULES));
    const button = (row: string, name: string) => row.slice(row.lastIndexOf("<button", row.indexOf(`aria-label="${name}`)));
    expect(button(first, "Move up filter")).toMatch(/^<button[^>]*aria-disabled="true"/);
    expect(text(first)).toContain("This is the first rule.");
    expect(button(first, "Move down filter")).not.toMatch(/^<button[^>]*aria-disabled/);
    expect(button(middle, "Move up oil")).not.toMatch(/^<button[^>]*aria-disabled/);
    expect(button(middle, "Move down oil")).not.toMatch(/^<button[^>]*aria-disabled/);
    expect(button(last, "Move down belt")).toMatch(/^<button[^>]*aria-disabled="true"/);
    expect(text(last)).toContain("This is the last rule.");
  });

  it("fr43_nfr10_move_buttons_ask_for_the_neighbour_swap", () => {
    const onMove = vi.fn();
    const buttons = actionsCell({ ...NO_ACTIONS, onMove }, RULES[1]).filter((el) => typeof el.props.onClick === "function");
    const byLabel = (label: string) => buttons.find((el) => el.props["aria-label"] === label)!;
    (byLabel("Move up oil").props.onClick as () => void)();
    (byLabel("Move down oil").props.onClick as () => void)();
    expect(onMove.mock.calls).toEqual([
      [RULES[1], -1],
      [RULES[1], 1],
    ]);
    const ids = RULES.map((r) => r.id);
    expect(movedIds(ids, 0, 1)).toEqual(["r2", "r1", "r3"]);
    expect(movedIds(ids, 1, -1)).toEqual(["r2", "r1", "r3"]);
    expect(movedIds(ids, 2, 1)).toEqual(ids);
  });

  it("ux_dr18_only_the_active_row_buttons_are_tab_stops", () => {
    const column = ruleColumns(RULES.length, NO_ACTIONS).find((candidate) => candidate.key === "actions")!;
    const inactive = renderToStaticMarkup(<>{column.cell(RULES[1], { isActive: false })}</>);
    const active = renderToStaticMarkup(<>{column.cell(RULES[1], { isActive: true })}</>);
    expect(inactive.match(/tabindex="-1"/g)).toHaveLength(4);
    expect(active.match(/tabindex="0"/g)).toHaveLength(4);
  });

  it("fr43_ux_dr16_delete_asks_first", () => {
    expect(deleteRuleConfirm({ keyword: "oil", category: "Oils" })).toEqual({
      title: "Delete rule",
      description: "Delete the rule “oil” → Oils?",
      confirmLabel: "Delete rule",
    });
    const onDelete = vi.fn();
    const deleteButton = actionsCell({ ...NO_ACTIONS, onDelete }, RULES[1]).find(
      (el) => el.props["aria-label"] === "Delete oil…",
    )!;
    expect(deleteButton.props.children).toBe("Delete…");
    (deleteButton.props.onClick as () => void)();
    expect(onDelete).toHaveBeenCalledWith(RULES[1]);
  });

  it("fr43_server_field_error_shows_under_its_input", () => {
    const error = new ApiError(422, "validation_failed", "That keyword already has a rule.", [
      { field: "keyword", message: "That keyword already has a rule." },
    ]);
    const errors = ruleErrors(error);
    expect(errors).toEqual({ keyword: "That keyword already has a rule." });
    expect(ruleErrors(new ApiError(503, "unavailable", "The keyword rules are busy. Try again."))).toBeNull();
    expect(ruleErrors(new ApiError(422, "validation_failed", "x", [{ field: "ids", message: "x" }]))).toBeNull();

    const markup = renderToStaticMarkup(
      <RuleFieldsInputs idPrefix="add" values={{ keyword: "Oil", category: "Oils" }} errors={errors!} onChange={() => {}} />,
    );
    const inputTag = (id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))![0];
    expect(inputTag("add-keyword")).toContain('aria-invalid="true"');
    expect(inputTag("add-keyword")).toContain('aria-describedby="add-keyword-error"');
    // The error sentence follows the keyword input, before the category field.
    const errorAt = markup.indexOf('id="add-keyword-error"');
    expect(errorAt).toBeGreaterThan(markup.indexOf('id="add-keyword"'));
    expect(errorAt).toBeLessThan(markup.indexOf('id="add-category"'));
    expect(text(markup)).toContain("That keyword already has a rule.");
    expect(inputTag("add-category")).not.toContain("aria-invalid");
  });

  it("fr43_field_errors_keep_the_first_message_per_field", () => {
    expect(
      fieldErrors([
        { field: "keyword", message: "A" },
        { field: "keyword", message: "B" },
        { field: "category", message: "C" },
        { field: 3, message: "D" },
      ]),
    ).toEqual({ keyword: "A", category: "C" });
  });
});

describe("fr43 fr45 categories api", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(status: number, body: unknown) {
    const fetch = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("fr43_reorder_sends_the_full_id_list_and_the_list_it_moved_from", async () => {
    const fetch = stubFetch(200, { rules: [] });
    await categoriesApi.reorderRules(["r2", "r1", "r3"], ["r1", "r2", "r3"]);
    expect(fetch).toHaveBeenCalledWith("/api/keyword-rules/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["r2", "r1", "r3"], base_ids: ["r1", "r2", "r3"] }),
    });
  });

  it("fr43_stale_reorder_rejects_with_409_refetches_and_is_a_toast", async () => {
    const message = "The keyword rules were changed elsewhere. The list is reloaded. Try again.";
    stubFetch(409, { error: { code: "command_rejected", message, details: [] } });
    const queryClient = new QueryClient();
    queryClient.setQueryData(keywordRulesKey(), { rules: RULES });
    queryClient.setQueryData(planCategoryCheckKey(PLAN), { rows: [] });
    const error = await runCategoriesWrite(queryClient, () =>
      categoriesApi.reorderRules(["r2", "r1"], ["r1", "r2"]),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "command_rejected", message });
    // Not a field error, so the tab shows the message as a toast.
    expect(ruleErrors(error as ApiError)).toBeNull();
    // The failed write still marks the rules and every category check stale, so the list reloads.
    expect(queryClient.getQueryState(keywordRulesKey())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(planCategoryCheckKey(PLAN))?.isInvalidated).toBe(true);
  });

  it("fr43_edit_sends_only_the_changed_fields", async () => {
    const stored = RULES[1];
    expect(changedFields(stored, { keyword: "oil", category: "Engine oils" })).toEqual({ category: "Engine oils" });
    expect(changedFields(stored, { keyword: "Oil", category: "Oils" })).toEqual({ keyword: "Oil" });
    expect(changedFields(stored, { keyword: "Oil", category: "Engine oils" })).toEqual({
      keyword: "Oil",
      category: "Engine oils",
    });
    expect(changedFields(stored, { keyword: "oil", category: "Oils" })).toEqual({});
    const fetch = stubFetch(200, stored);
    await categoriesApi.editRule("r2", { category: "Engine oils" });
    expect(fetch).toHaveBeenCalledWith("/api/keyword-rules/r2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "Engine oils" }),
    });
  });

  it("fr45_put_sends_the_aisle_whole_list", async () => {
    const fetch = stubFetch(200, { aisle: "A/1", categories: [] });
    await categoriesApi.setAisleCategories("A/1", ["Oils", "Filters"]);
    expect(fetch).toHaveBeenCalledWith("/api/aisle-categories/A%2F1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: ["Oils", "Filters"] }),
    });
  });

  it("fr43_delete_resolves_on_204_and_a_busy_server_throws_its_message", async () => {
    stubFetch(204, undefined);
    await expect(categoriesApi.deleteRule("r1")).resolves.toBeUndefined();
    stubFetch(503, { error: { code: "unavailable", message: "The keyword rules are busy. Try again.", details: [] } });
    await expect(categoriesApi.reorderRules(["r1"], ["r1"])).rejects.toMatchObject({
      code: "unavailable",
      message: "The keyword rules are busy. Try again.",
    });
  });
});

const VIEW: PlanAisleCategories = {
  aisles: [
    {
      aisle: "A",
      categories: [
        { category: "Belts", has_rule: false },
        { category: "Oils", has_rule: true },
      ],
    },
    { aisle: "B", categories: [] },
  ],
  rule_categories: ["Filters", "Oils"],
};

/** The markup of one aisle row (`<li aria-labelledby>` to the next one). */
function aisleRow(markup: string, aisle: string): string {
  const start = markup.indexOf(`>Aisle ${aisle}</h3>`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = markup.indexOf(">Aisle ", start + 1);
  return markup.slice(start, next < 0 ? undefined : next);
}

describe("fr45 aisle categories tab", () => {
  it("fr45_one_row_per_aisle_with_chips_and_remove_buttons", () => {
    const markup = renderToStaticMarkup(<AisleCategoriesView view={VIEW} onChange={() => {}} />);
    const a = aisleRow(markup, "A");
    expect(text(a)).toContain("Belts");
    expect(text(a)).toContain("Oils");
    expect(a).toContain('aria-label="Remove Belts from aisle A"');
    expect(a).toContain('aria-label="Remove Oils from aisle A"');
    expect(text(aisleRow(markup, "B"))).toContain("No categories");
    expect(markup.indexOf(">Aisle A<")).toBeLessThan(markup.indexOf(">Aisle B<"));
  });

  it("fr45_stale_category_says_no_rule_gives_it", () => {
    const a = aisleRow(renderToStaticMarkup(<AisleCategoriesView view={VIEW} onChange={() => {}} />), "A");
    const belts = a.slice(a.indexOf(">Belts<"), a.indexOf(">Oils<"));
    const oils = a.slice(a.indexOf(">Oils<"));
    expect(text(belts)).toContain("no keyword rule gives this category");
    expect(text(oils)).not.toContain("no keyword rule gives this category");
  });

  it("fr45_picker_excludes_categories_already_on_the_aisle", () => {
    expect(pickerOptions(VIEW.rule_categories, VIEW.aisles[0])).toEqual(["Filters"]);
    expect(pickerOptions(VIEW.rule_categories, VIEW.aisles[1])).toEqual(["Filters", "Oils"]);
    expect(pickerOptions(["Oils"], { aisle: "C", categories: [{ category: "oils", has_rule: true }] })).toEqual([]);
    const markup = renderToStaticMarkup(<AisleCategoriesView view={VIEW} onChange={() => {}} />);
    const a = aisleRow(markup, "A");
    expect(a).toContain('<option value="Filters"');
    expect(a).not.toContain('<option value="Oils"');
    expect(a).toContain('aria-label="Add the category to aisle A"');
    expect(aisleRow(markup, "B")).toContain('<option value="Oils"');
  });

  it("fr45_add_and_remove_send_the_aisle_whole_list", () => {
    const onChange = vi.fn();
    let tree: ReactNode = null;
    // AisleRow is called inside a component render, so its hooks run; its returned tree holds the
    // real Add button and chips with their handlers.
    function Capture() {
      tree = AisleRow({ entry: VIEW.aisles[0], ruleCategories: ["Oils", "Filters"], onChange });
      return null;
    }
    renderToStaticMarkup(<Capture />);
    const all = elements(tree);
    const add = all.find((el) => el.props["aria-label"] === "Add the category to aisle A")!;
    (add.props.onClick as () => void)();
    const belts = all.find((el) => el.type === CategoryChip && el.props.category === "Belts")!;
    const remove = elements(CategoryChip(belts.props as Parameters<typeof CategoryChip>[0])).find(
      (el) => el.props["aria-label"] === "Remove Belts from aisle A",
    )!;
    (remove.props.onClick as () => void)();
    expect(onChange.mock.calls).toEqual([
      ["A", ["Belts", "Oils", "Filters"]],
      ["A", ["Oils"]],
    ]);
  });

  it("fr45_with_no_rules_the_picker_says_add_a_rule_first", () => {
    const view = { ...VIEW, rule_categories: [] };
    const markup = renderToStaticMarkup(<AisleCategoriesView view={view} onChange={() => {}} />);
    expect(text(markup)).toContain("Add a keyword rule first to give aisles categories.");
    expect(markup).not.toContain("<select");
    // Existing categories stay and can still be removed.
    expect(markup).toContain('aria-label="Remove Belts from aisle A"');
  });
});

describe("ux_dr7 categories page", () => {
  function page(tab: "keywords" | "aisles") {
    return renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <CategoriesView planId={PLAN} tab={tab} onTabChange={() => {}} />
      </QueryClientProvider>,
    );
  }

  it("ux_dr7_title_and_two_tabs", () => {
    const markup = page("keywords");
    expect(markup).toContain(">Categories</h1>");
    expect(markup).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Keyword rules</);
    expect(markup).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*>Aisle categories</);
    expect(page("aisles")).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Aisle categories</);
  });

  it("ux_dr7_tab_is_kept_in_the_url", () => {
    expect(planCategoriesHref(PLAN)).toBe(`/plans/${PLAN}/categories`);
    expect(planCategoriesHref(PLAN, "aisles")).toBe(`/plans/${PLAN}/categories?tab=aisles`);
    expect(planCategoriesHref("a b", "keywords")).toBe("/plans/a%20b/categories?tab=keywords");
    expect(parseCategoriesTab(new URLSearchParams("tab=aisles"))).toBe("aisles");
    expect(parseCategoriesTab(new URLSearchParams("tab=other"))).toBe("keywords");
    expect(parseCategoriesTab({})).toBe("keywords");
  });
});
