import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Listbox, nextListboxIndex } from "@/components/common/listbox";
import { ApiError } from "@/lib/api/errors";
import type { SavedPlanRow } from "@/lib/api/plans";
import { SAVED_PLANS_TITLE } from "@/lib/copy";
import { NEW_PLAN_HREF, newPlanFromHref, parseNewPlanFrom } from "@/lib/view-state/urls";
import { ReusePicker } from "@/modules/new-plan/new-plan-page";
import {
  CHOOSE_PLAN,
  createdToast,
  errorView,
  NAME_REQUIRED,
  REUSE_OPTION_TEXT,
  reuseOptionMeta,
  UPLOAD_INSTEAD_TEXT,
  validateReuse,
} from "@/modules/new-plan/selection";
import { reuseFormData, reusePlan } from "@/modules/new-plan/upload";

// Story 6.3: a New Plan from a saved plan's import (FR-2, UX-DR5, UX-DR17, AD-20).

const html = renderToStaticMarkup;

const ROW: SavedPlanRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Spring plan",
  import_id: "99999999-9999-4999-8999-999999999999",
  data_as_of: "2026-09-30",
  uploaded_at: "2026-11-20T23:30:00Z",
  created_by: "planner",
  created_at: "2026-11-21T08:05:00Z",
  last_edited_by: "planner",
  last_edited_at: "2026-11-22T14:45:00Z",
};
const OTHER: SavedPlanRow = { ...ROW, id: "22222222-2222-4222-8222-222222222222", name: "Autumn plan" };

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe("fr2 new plan from an import: urls", () => {
  it("fr2_ad20_new_plan_from_href_is_built_and_read_in_view_state", () => {
    expect(newPlanFromHref("8d3c")).toBe("/plans/new?from=8d3c");
    expect(newPlanFromHref("a b&c")).toBe("/plans/new?from=a+b%26c");
    expect(newPlanFromHref("p1").startsWith(NEW_PLAN_HREF)).toBe(true);
    expect(parseNewPlanFrom(new URLSearchParams("from=8d3c"))).toBe("8d3c");
    expect(parseNewPlanFrom(new URLSearchParams("from=a+b%26c"))).toBe("a b&c");
    expect(parseNewPlanFrom({ from: ["x", "y"] })).toBe("x");
    expect(parseNewPlanFrom({ from: "" })).toBeUndefined();
    expect(parseNewPlanFrom({})).toBeUndefined();
  });
});

describe("fr2 reuse form", () => {
  it("fr2_reuse_needs_a_name_and_a_chosen_plan", () => {
    expect(validateReuse("", undefined)).toEqual({ name: NAME_REQUIRED, plan: CHOOSE_PLAN, ok: false });
    expect(validateReuse("B", undefined)).toEqual({ name: null, plan: CHOOSE_PLAN, ok: false });
    expect(validateReuse("  ", ROW.id)).toEqual({ name: NAME_REQUIRED, plan: null, ok: false });
    expect(validateReuse("B", ROW.id)).toEqual({ name: null, plan: null, ok: true });
    expect(CHOOSE_PLAN).toBe("Choose a saved plan.");
    expect(REUSE_OPTION_TEXT).toBe("Or reuse the import of a saved plan");
    expect(UPLOAD_INSTEAD_TEXT).toBe("Upload three files instead");
  });

  it("fr2_reuse_sends_the_name_and_import_id_only", () => {
    const data = reuseFormData({ name: "B", importId: ROW.import_id });
    expect([...data.keys()]).toEqual(["name", "import_id"]);
    expect(data.get("name")).toBe("B");
    expect(data.get("import_id")).toBe(ROW.import_id);
  });

  it("fr2_reuse_posts_once_and_reads_the_created_plan", async () => {
    const created = { id: "p2", name: "B", data_as_of: "2026-09-30" };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(created), { status: 201 }));
    await expect(reusePlan({ name: "B", importId: ROW.import_id }, fetchImpl)).resolves.toMatchObject(created);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(["/api/plans", "POST"]);
    expect((init.body as FormData).get("import_id")).toBe(ROW.import_id);
    expect(createdToast("B", "2026-09-30")).toBe("B created. Data as of 2026-09-30.");
  });

  it("fr2_reuse_of_a_deleted_import_shows_its_message", async () => {
    const message = "This import no longer exists. Choose another saved plan.";
    const body = JSON.stringify({ error: { code: "not_found", message, details: [] } });
    const fetchImpl = vi.fn(async () => new Response(body, { status: 404 }));
    const error = await reusePlan({ name: "B", importId: ROW.import_id }, fetchImpl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(errorView(error as ApiError)).toEqual({ kind: "message", message });

    const offline = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const failed = await reusePlan({ name: "B", importId: ROW.import_id }, offline).catch((e: unknown) => e);
    expect((failed as ApiError).code).toBe("internal");
  });
});

describe("ux_dr17 listbox", () => {
  it("ux_dr17_listbox_keys_move_the_selection_and_clamp", () => {
    expect(nextListboxIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextListboxIndex("ArrowUp", -1, 3)).toBe(2);
    expect(nextListboxIndex("ArrowDown", 1, 3)).toBe(2);
    expect(nextListboxIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextListboxIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextListboxIndex("Home", 2, 3)).toBe(0);
    expect(nextListboxIndex("End", 0, 3)).toBe(2);
    expect(nextListboxIndex("Enter", 0, 3)).toBeNull();
    expect(nextListboxIndex("ArrowDown", -1, 0)).toBeNull();
  });

  it("ux_dr17_listbox_is_one_tab_stop_with_the_selected_option_marked", () => {
    const markup = html(
      <Listbox
        label="Things"
        options={["a", "b", "c"]}
        optionKey={(option) => option}
        renderOption={(option) => <span>{option}</span>}
        selectedKey="b"
        onSelect={() => {}}
      />,
    );
    expect(markup).toMatch(/^<div[^>]*role="listbox"[^>]*>/);
    expect(markup).toContain('aria-label="Things"');
    expect(count(markup, 'tabindex="0"')).toBe(1);
    expect(count(markup, "tabindex=")).toBe(1);
    expect(count(markup, 'role="option"')).toBe(3);
    expect(count(markup, 'aria-selected="true"')).toBe(1);
    expect(count(markup, 'aria-selected="false"')).toBe(2);
    const active = /aria-activedescendant="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toMatch(new RegExp(`id="${active}" role="option" aria-selected="true"`));
    expect(count(markup, "h-control-md")).toBe(3);
    expect(count(markup, "bg-selected-tint")).toBe(1);
    expect(count(markup, "bg-ink")).toBe(1);
  });

  it("ux_dr17_listbox_with_nothing_selected_has_no_active_option", () => {
    const markup = html(
      <Listbox label="Things" options={["a"]} optionKey={(o) => o} renderOption={(o) => o} selectedKey="zz" onSelect={() => {}} />,
    );
    expect(markup).not.toContain("aria-activedescendant");
    expect(markup).not.toContain('aria-selected="true"');
  });
});

describe("fr2 reuse picker", () => {
  const picker = (props: Partial<Parameters<typeof ReusePicker>[0]> = {}) =>
    html(
      <ReusePicker
        plans={[ROW, OTHER]}
        loadError={null}
        chosenPlanId={ROW.id}
        error={null}
        errorId="err"
        disabled={false}
        onChoose={() => {}}
        {...props}
      />,
    );

  it("fr2_ux_dr17_reuse_lists_saved_plans_with_name_and_data_as_of", () => {
    const markup = picker();
    expect(SAVED_PLANS_TITLE).toBe("Saved plans");
    expect(markup).toContain('role="listbox" aria-label="Saved plans"');
    expect(markup).toContain(">Spring plan<");
    expect(markup).toContain(">Autumn plan<");
    expect(reuseOptionMeta("2026-09-30")).toBe("Data as of 2026-09-30");
    expect(count(markup, "Data as of 2026-09-30")).toBe(2);
    expect(count(markup, 'aria-selected="true"')).toBe(1);
  });

  it("fr2_reuse_without_a_chosen_plan_says_choose_a_saved_plan", () => {
    const markup = picker({ chosenPlanId: undefined, error: CHOOSE_PLAN });
    expect(markup).toContain('aria-describedby="err"');
    expect(markup).toContain('id="err"');
    expect(markup).toContain(CHOOSE_PLAN);
    expect(markup).not.toContain('aria-selected="true"');
  });
});
