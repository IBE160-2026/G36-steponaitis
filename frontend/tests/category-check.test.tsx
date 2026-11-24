import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { planRootKey } from "@/lib/api/plans";
import { categoryCheckCountLine } from "@/lib/copy";
import { parsePlanPath, planCategoryCheckHref } from "@/lib/view-state/urls";
import {
  type CategoryCheck,
  type CategoryCheckRow,
  isCategoryCheckKey,
  planAisleCategoriesKey,
  planCategoryCheckKey,
} from "@/modules/categories/api";
import { CategoriesView } from "@/modules/categories/categories-page";
import { categoryCheckColumns, CategoryCheckView } from "@/modules/categories/category-check-page";

// Story 13.3 (FR-46, UX-DR18, UX-DR24, UX-DR56): the Category check page rendered to static markup
// (Vitest has no DOM; clicks, focus and the round trips are covered in e2e).

const PLAN = "11111111-1111-4111-8111-111111111111";

function row(part: string, code: string, aisle: string, category: string, aisleCategories: string[]): CategoryCheckRow {
  return {
    part,
    description: `Description ${part}`,
    category,
    current_location: { code, aisle, level: "1", section: null, position: null, is_best: false },
    aisle_categories: aisleCategories,
  };
}

// Server order (AD-14): the page shows it as given, even when part numbers are not sorted.
const VIEW: CategoryCheck = {
  version: 4,
  rows: [row("P9", "A-01", "A", "Oils", ["Belts", "Filters"]), row("P1", "B-01", "B", "Filters", ["Oils"])],
  outside_count: 2,
  aisles_without_categories: 1234,
};

function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

function bodyRows(markup: string): string[] {
  const tbody = markup.slice(markup.indexOf("<tbody"));
  return tbody
    .split("<tr")
    .slice(1)
    .map((tr) => `<tr${tr}`);
}

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

function page(view: CategoryCheck): string {
  return renderToStaticMarkup(<CategoryCheckView planId={PLAN} view={view} onOpenPart={() => {}} />);
}

describe("fr46 category check page", () => {
  it("fr46_count_line_plural_and_singular_with_thousands_separators", () => {
    expect(categoryCheckCountLine(12, 4)).toBe("12 parts outside their aisle's categories · 4 aisles without categories");
    expect(categoryCheckCountLine(1, 1)).toBe("1 part outside its aisle's categories · 1 aisle without categories");
    expect(categoryCheckCountLine(0, 0)).toBe("0 parts outside their aisle's categories · 0 aisles without categories");
    expect(categoryCheckCountLine(1234, 5678)).toBe(
      "1,234 parts outside their aisle's categories · 5,678 aisles without categories",
    );
  });

  it("fr46_title_note_count_line_and_back_link", () => {
    const markup = page(VIEW);
    expect(markup).toContain(">Category check</h1>");
    expect(text(markup)).toContain(
      "Parts whose category is not one of the categories of the aisle they are in now. Parts without a category, parts with no stock and aisles without categories are not checked.",
    );
    expect(text(markup)).toContain("2 parts outside their aisle's categories · 1,234 aisles without categories");
    expect(markup).toContain(`href="/plans/${PLAN}/categories"`);
  });

  it("fr46_rows_in_server_order_with_columns", () => {
    const markup = page(VIEW);
    expect(markup).toContain('aria-label="Category check"');
    const head = markup.slice(markup.indexOf("<thead"), markup.indexOf("</thead>"));
    for (const header of ["Part", "Description", "Category", "Current location", "Aisle", "Aisle categories"]) {
      expect(head).toContain(`>${header}<`);
    }
    const rows = bodyRows(markup);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('data-open-part="P9"');
    expect(rows[1]).toContain('data-open-part="P1"');
    const first = text(rows[0]);
    expect(first).toContain("Description P9");
    expect(first).toContain("Oils");
    expect(first).toContain("Belts, Filters");
    expect(rows[0]).toContain('data-location-chip="A-01"');
    expect(rows[0]).toContain(`href="/plans/${PLAN}/locations?aisle=A&amp;loc=A-01"`);
  });

  it("fr46_empty_result_shows_the_message_and_count_line", () => {
    const markup = page({ ...VIEW, rows: [], outside_count: 0, aisles_without_categories: 1 });
    expect(markup).not.toContain("<table");
    expect(text(markup)).toContain("Every checked part is in an aisle meant for its category.");
    expect(text(markup)).toContain("0 parts outside their aisle's categories · 1 aisle without categories");
  });

  it("fr46_part_button_opens_the_panel_with_its_part", () => {
    const open = vi.fn();
    const column = categoryCheckColumns(PLAN, open).find((candidate) => candidate.key === "part")!;
    const [button] = elements(column.cell(VIEW.rows[1], { isActive: true })).filter((el) => el.type === "button");
    const target = {} as HTMLElement;
    (button.props.onClick as (event: { currentTarget: HTMLElement }) => void)({ currentTarget: target });
    expect(open).toHaveBeenCalledWith("P1", target);
  });

  it("fr46_check_query_is_under_the_plan_root_key", () => {
    expect(planCategoryCheckKey(PLAN).slice(0, 2)).toEqual([...planRootKey(PLAN)]);
  });

  it("fr46_category_writes_mark_every_plan_check_stale", () => {
    expect(isCategoryCheckKey(planCategoryCheckKey(PLAN))).toBe(true);
    expect(isCategoryCheckKey(planCategoryCheckKey("other"))).toBe(true);
    expect(isCategoryCheckKey([...planRootKey(PLAN), "summary"])).toBe(false);
    expect(isCategoryCheckKey(planAisleCategoriesKey(PLAN))).toBe(false);
  });

  it("fr46_categories_page_links_to_the_check", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <CategoriesView planId={PLAN} tab="keywords" onTabChange={() => {}} />
      </QueryClientProvider>,
    );
    expect(markup).toMatch(new RegExp(`href="/plans/${PLAN}/categories/check"[^>]*>Category check<`));
  });
});

describe("fr46 category check urls", () => {
  it("fr46_category_check_href", () => {
    expect(planCategoryCheckHref("a b")).toBe("/plans/a%20b/categories/check");
    expect(planCategoryCheckHref(PLAN, { part: "P 1", aisle: "" })).toBe(`/plans/${PLAN}/categories/check?part=P+1`);
  });

  it("fr46_parse_plan_path_accepts_the_check_path", () => {
    expect(parsePlanPath(`/plans/${PLAN}/categories/check`)).toEqual({ planId: PLAN, view: "categories/check" });
    expect(parsePlanPath(planCategoryCheckHref("a b"))).toEqual({ planId: "a b", view: "categories/check" });
    expect(parsePlanPath(`/plans/${PLAN}/categories`)).toEqual({ planId: PLAN, view: "categories" });
  });

  it("fr46_parse_plan_path_rejects_other_four_segment_paths", () => {
    expect(parsePlanPath(`/plans/${PLAN}/categories/other`)).toBeNull();
    expect(parsePlanPath(`/plans/${PLAN}/overview/check`)).toBeNull();
    expect(parsePlanPath(`/other/${PLAN}/categories/check`)).toBeNull();
    expect(parsePlanPath(`/plans/${PLAN}/categories/check/extra`)).toBeNull();
  });
});
