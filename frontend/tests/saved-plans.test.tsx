import { DropdownMenu } from "radix-ui";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SavedPlanRow } from "@/lib/api/plans";
import {
  DELETE_PLAN_CONFIRM,
  DELETE_PLAN_ITEM,
  DELETE_PLAN_TITLE,
  deletePlanQuestion,
  LOADING_SAVED_PLANS,
  NEW_PLAN_FROM_IMPORT,
} from "@/lib/copy";
import { ApiError } from "@/lib/api/errors";
import { NEW_PLAN_HREF, planOpenHref, SAVED_PLANS_HREF } from "@/lib/view-state/urls";
import {
  actionsLabel,
  deleteFailure,
  DEMO_FILES_TEXT,
  EMPTY_TEXT,
  focusAfterDelete,
  planActionsId,
  planColumns,
  PlansLoadError,
  RETRY_LABEL,
  RowMenu,
  SavedPlansView,
} from "@/modules/plans/saved-plans-page";

// Story 6.1: the saved-plans list as the start page (FR-7, FR-8, AD-20, UX-DR18, UX-DR30,
// epic-1 retro item 5). Times show in Europe/Oslo (vitest.config.ts).

const html = renderToStaticMarkup;
const noop = () => {};
const COLUMNS = planColumns(noop);

const A: SavedPlanRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Edited",
  import_id: "99999999-9999-4999-8999-999999999999",
  data_as_of: "2026-09-30",
  uploaded_at: "2026-11-20T23:30:00Z",
  created_by: "planner",
  created_at: "2026-11-21T08:05:00Z",
  last_edited_by: "planner",
  last_edited_at: "2026-11-22T14:45:00Z",
};
const B: SavedPlanRow = {
  ...A,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Other",
  last_edited_at: "2026-11-21T09:00:00Z",
};

function ready(plans: SavedPlanRow[]) {
  return html(<SavedPlansView state={{ kind: "ready", plans }} onRetry={noop} onOpen={noop} />);
}

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

/** Every element in a component's returned tree (not rendering child components). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

describe("fr8 saved-plans list", () => {
  it("fr8_ad20_saved_plans_and_open_urls_are_built_in_view_state", () => {
    expect(SAVED_PLANS_HREF).toBe("/plans");
    expect(NEW_PLAN_HREF).toBe("/plans/new");
    // Story 6.2: the bare plan URL, which opens the plan's stored last view.
    expect(planOpenHref("8d3c")).toBe("/plans/8d3c");
    expect(planOpenHref("a b")).toBe("/plans/a%20b");
  });

  it("fr8_columns_in_order_with_local_dates", () => {
    expect(COLUMNS.map((column) => column.header)).toEqual([
      "Name",
      "Data as of",
      "Uploaded",
      "Created by",
      "Created",
      "Last edited by",
      "Last edited",
      "Actions",
    ]);
    const cells = COLUMNS.slice(0, 7).map((column) => html(<>{column.cell(A, { isActive: false })}</>));
    // Uploaded is the local date of `uploaded_at`: 23:30Z is the next day in Oslo.
    expect(cells).toEqual([
      expect.stringContaining("Edited"),
      "2026-09-30",
      "2026-11-21",
      "planner",
      "2026-11-21 09:05",
      "planner",
      "2026-11-22 15:45",
    ]);
  });

  it("fr8_rows_in_server_order_with_one_primary_new_plan", () => {
    const page = ready([A, B]);
    expect(page).toContain("<h1");
    expect(page).toContain("Saved plans");
    expect(page.indexOf("Edited")).toBeLessThan(page.indexOf("Other"));
    expect(page).not.toContain("aria-sort");
    expect(count(page, ">New Plan<")).toBe(1);
    expect(page).toContain(`href="${NEW_PLAN_HREF}"`);
  });

  it("ux_dr18_only_the_active_rows_menu_button_is_tabbable", () => {
    const page = ready([A, B]);
    const buttons = [...page.matchAll(/<button[^>]*aria-label="Actions for [^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain(`aria-label="${actionsLabel("Edited")}"`);
    expect(buttons[0]).toContain('tabindex="0"');
    expect(buttons[1]).toContain(`aria-label="${actionsLabel("Other")}"`);
    expect(buttons[1]).toContain('tabindex="-1"');
    expect([...page.matchAll(/<tr[^>]*tabindex="0"/g)]).toHaveLength(1);
  });

  it("fr7_ux_dr30_empty_state_copy_and_the_only_new_plan", () => {
    const page = ready([]);
    expect(EMPTY_TEXT).toBe(
      "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.",
    );
    expect(page).toContain(EMPTY_TEXT);
    expect(page).toContain(DEMO_FILES_TEXT);
    expect(DEMO_FILES_TEXT).toBe("Demo files: data/sample/");
    expect(page).not.toContain("<table");
    expect(count(page, ">New Plan<")).toBe(1);
  });

  it("fr8_loading_is_plain_text", () => {
    const page = html(<SavedPlansView state={{ kind: "loading" }} onRetry={noop} onOpen={noop} />);
    expect(page).toContain('role="status"');
    expect(page).toContain(LOADING_SAVED_PLANS);
    expect(page).not.toContain("<table");
  });

  it("fr8_retro5_failed_list_offers_try_again_and_new_plan", () => {
    const page = html(
      <SavedPlansView state={{ kind: "error", message: "Something went wrong." }} onRetry={noop} onOpen={noop} />,
    );
    expect(page).toContain('role="alert"');
    expect(page).toContain("Something went wrong.");
    expect(page).toContain(`>${RETRY_LABEL}<`);
    expect(page).toContain(`href="${NEW_PLAN_HREF}"`);
    expect(count(page, ">New Plan<")).toBe(1);

    const onRetry = vi.fn();
    const retry = elements(PlansLoadError({ message: "x", onRetry })).find(
      (element) => element.props.children === RETRY_LABEL,
    );
    expect(retry).toBeDefined();
    (retry!.props.onClick as () => void)();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("fr2 saved-plans row menu", () => {
  it("fr2_ux_dr18_row_menu_holds_open_then_new_plan_from_this_import", () => {
    const links = elements(RowMenu({ plan: A, isActive: true, onDelete: noop })).filter(
      (element) => typeof element.props.href === "string",
    );
    expect(links.map((link) => [link.props.children, link.props.href])).toEqual([
      ["Open", `/plans/${A.id}`],
      [NEW_PLAN_FROM_IMPORT, `/plans/new?from=${A.id}`],
    ]);
    expect(NEW_PLAN_FROM_IMPORT).toBe("New Plan from this import");
  });
});

const C: SavedPlanRow = { ...A, id: "33333333-3333-4333-8333-333333333333", name: "Third" };

/** The text of a menu item: its own string child, or its link's. */
function itemText(item: ReactElement<Record<string, unknown>>): unknown {
  const child = item.props.children;
  return isValidElement<Record<string, unknown>>(child) ? child.props.children : child;
}

describe("fr12 delete a plan", () => {
  it("fr12_ux_dr18_row_menu_order_open_new_plan_then_delete", () => {
    const onDelete = vi.fn();
    const items = elements(RowMenu({ plan: A, isActive: true, onDelete })).filter(
      (element) => element.type === DropdownMenu.Item,
    );
    expect(items.map(itemText)).toEqual(["Open", NEW_PLAN_FROM_IMPORT, DELETE_PLAN_ITEM]);
    expect(DELETE_PLAN_ITEM).toBe("Delete…");
    (items[2].props.onSelect as () => void)();
    expect(onDelete).toHaveBeenCalledWith(A);
  });

  it("fr12_ux_dr16_delete_confirm_copy", () => {
    expect(deletePlanQuestion("Spring")).toBe(
      "Delete “Spring”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.",
    );
    expect(DELETE_PLAN_TITLE).toBe("Delete plan");
    expect(DELETE_PLAN_CONFIRM).toBe("Delete plan");
  });

  it("fr40_fr12_delete_with_an_ended_session_opens_log_in_not_a_toast", () => {
    expect(deleteFailure(new ApiError(401, "unauthenticated", "Log in to continue."))).toEqual({ kind: "session" });
    expect(deleteFailure(new ApiError(404, "plan_not_found", "Gone."))).toEqual({ kind: "gone" });
    expect(deleteFailure(new ApiError(500, "internal", "Something went wrong."))).toEqual({
      kind: "toast",
      message: "Something went wrong.",
    });
  });

  it("fr12_menu_button_has_a_stable_id", () => {
    expect(planActionsId(A.id)).toBe(`plan-actions-${A.id}`);
    expect(planActionsId(A.id)).toBe(planActionsId(A.id));
    expect(ready([A, B])).toContain(`id="${planActionsId(A.id)}"`);
  });

  it("fr12_ux_dr16_focus_after_delete_next_previous_or_none", () => {
    expect(focusAfterDelete([A, B, C], A.id)).toBe(B.id);
    expect(focusAfterDelete([A, B, C], B.id)).toBe(C.id);
    expect(focusAfterDelete([A, B, C], C.id)).toBe(B.id);
    expect(focusAfterDelete([A], A.id)).toBeNull();
    expect(focusAfterDelete([], A.id)).toBeNull();
  });
});
