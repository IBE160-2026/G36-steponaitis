import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALL_SAVED_PLANS,
  PlanPlate,
  planMenuItems,
  plateMeta,
  uploadedText,
} from "@/components/common/app-shell/plan-plate";
import { NEW_PLAN_FROM_IMPORT } from "@/lib/copy";
import { openingText, showsLoadError } from "@/components/common/plan-status";
import { SettingsList, settingsRows } from "@/components/common/settings-list";
import { ApiError, INTERNAL_MESSAGE, internalError } from "@/lib/api/errors";
import { fetchPlans, fetchPlanSummary, type PlanSummary, type SavedPlanRow } from "@/lib/api/plans";
import { handleQueryError, PLAN_DELETED } from "@/lib/api/query-errors";
import { parsePlanPath, planSettingsHref, planStepHref } from "@/lib/view-state/urls";
import { OverviewView } from "@/modules/overview/overview-page";
import { SETTINGS_NOTE, SettingsView } from "@/modules/settings/settings-page";

// Story 1.9: overview, settings, plan plate and the shared plan queries (FR-7, FR-8, FR-9, FR-18,
// AD-12, AD-20, UX-DR5, UX-DR21, UX-DR22). Vitest runs with TZ=Europe/Oslo.

const html = renderToStaticMarkup;
const PLAN_ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";
const SETTINGS = {
  period_months: 12,
  fast_min_picks: 24,
  medium_min_picks: 6,
  slow_min_picks: 1,
  pick_group_min_shared_jobs: 5,
};

function summary(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: PLAN_ID,
    name: "Demo",
    import_id: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
    data_as_of: "2026-09-30",
    uploaded_at: "2026-11-21T23:30:00Z",
    created_by: "planner",
    created_at: "2026-11-21T23:30:00Z",
    last_edited_by: "planner",
    last_edited_at: "2026-11-21T23:30:00Z",
    version: 1,
    current_round: 0,
    settings: SETTINGS,
    period_start: "2025-10-01",
    period_end: "2026-09-30",
    class_counts: { fast: 1584, medium: 12, slow: 3, dead: 0 },
    best_locations: 0,
    empty_best_locations: 0,
    apply_all_count: 0,
    undo_preview: null,
    steps: [],
    ...overrides,
  };
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fr18 settings list", () => {
  it("fr18_settings_list_shows_every_number_from_the_snapshot", () => {
    expect(settingsRows(SETTINGS)).toEqual([
      { term: "Period", value: "12 months" },
      { term: "Fast-moving", value: "24 or more picks" },
      { term: "Medium-moving", value: "6–23 picks" },
      { term: "Slow-moving", value: "1–5 picks" },
      { term: "Dead stock", value: "0 picks" },
      { term: "Pick group", value: "5 or more shared jobs" },
    ]);
  });

  it("fr18_settings_list_follows_other_limits_and_singular_month", () => {
    const rows = settingsRows({
      period_months: 1,
      fast_min_picks: 50,
      medium_min_picks: 10,
      slow_min_picks: 2,
      pick_group_min_shared_jobs: 3,
    });
    expect(rows.map((row) => row.value)).toEqual([
      "1 month",
      "50 or more picks",
      "10–49 picks",
      "2–9 picks",
      "0–1 picks",
      "3 or more shared jobs",
    ]);
  });

  it("fr18_settings_list_renders_a_description_list", () => {
    const markup = html(<SettingsList settings={SETTINGS} />);
    expect(markup).toMatch(/^<dl/);
    expect(markup).toContain("<dt");
    expect(text(markup)).toContain("Pick group 5 or more shared jobs");
  });

  it("fr18_settings_view_is_read_only_with_the_config_note", () => {
    const markup = html(<SettingsView summary={summary()} />);
    expect(markup).toContain(">Settings</h1>");
    expect(markup).toContain(SETTINGS_NOTE);
    expect(SETTINGS_NOTE).toBe("Changed in the config file, not in the app.");
    expect(markup).not.toMatch(/<input|<button/);
  });
});

describe("fr7 overview", () => {
  it("fr7_overview_shows_dates_period_counts_and_settings", () => {
    const markup = html(<OverviewView summary={summary()} />);
    const body = text(markup);
    expect(markup).toContain(">Overview</h1>");
    expect(body).toContain("Data as of 2026-09-30");
    // 23:30 UTC is already the next day in Oslo: the upload date is the viewer's local date.
    expect(body).toContain("Uploaded 2026-11-22");
    expect(body).toContain("Period 2025-10-01 to 2026-09-30");
    expect(body).toContain("Parts by movement class");
    expect(body).toContain("Fast-moving 1,584");
    expect(body).toContain("Medium-moving 12");
    expect(body).toContain("Slow-moving 3");
    expect(body).toContain("Dead stock 0");
    expect(markup.match(/<li data-class=/g)).toHaveLength(4);
    expect(markup.match(/<svg[^>]*data-class=/g)).toHaveLength(4);
    expect(body).toContain("Fast-moving 24 or more picks");
    expect(markup).toContain(`href="${planSettingsHref(PLAN_ID)}"`);
  });

  it("fr22_overview_shows_best_and_empty_best_counts", () => {
    expect(text(html(<OverviewView summary={summary()} />))).toContain(
      "Best locations 0 Empty best locations 0",
    );
    const body = text(html(<OverviewView summary={summary({ best_locations: 1234, empty_best_locations: 7 })} />));
    expect(body).toContain("Best locations 1,234");
    expect(body).toContain("Empty best locations 7");
  });

  it("fr7_overview_opening_text_uses_the_cached_plan_name", () => {
    const s = summary();
    const rows: SavedPlanRow[] = [
      {
        id: PLAN_ID,
        name: "Spring plan",
        import_id: s.import_id,
        data_as_of: s.data_as_of,
        uploaded_at: s.uploaded_at,
        created_by: s.created_by,
        created_at: s.created_at,
        last_edited_by: s.last_edited_by,
        last_edited_at: s.last_edited_at,
      },
    ];
    expect(openingText(PLAN_ID, rows)).toBe("Opening Spring plan…");
    expect(openingText("other", rows)).toBe("Opening the plan…");
    expect(openingText(PLAN_ID, undefined)).toBe("Opening the plan…");
  });
});

describe("ad20 plan urls", () => {
  it("ad20_parse_plan_path_reads_plan_id_and_view", () => {
    expect(parsePlanPath("/plans/x/overview")).toEqual({ planId: "x", view: "overview" });
    expect(parsePlanPath("/plans/x/settings")).toEqual({ planId: "x", view: "settings" });
    expect(parsePlanPath(planStepHref(PLAN_ID, "parts"))).toEqual({ planId: PLAN_ID, view: "parts" });
  });

  it("ad20_parse_plan_path_rejects_other_paths", () => {
    expect(parsePlanPath("/plans/new")).toBeNull();
    expect(parsePlanPath("/")).toBeNull();
    expect(parsePlanPath("/plans/x/overview/extra")).toBeNull();
    expect(parsePlanPath("/other/x/overview")).toBeNull();
  });

  it("ad20_settings_href_is_built_in_view_state", () => {
    expect(planSettingsHref("a b")).toBe("/plans/a%20b/settings");
  });
});

describe("ad12 shared query error hook", () => {
  it("ad12_fr8_plan_not_found_toasts_and_opens_saved_plans", () => {
    const notify = vi.fn();
    const navigate = vi.fn();
    handleQueryError(new ApiError(404, "plan_not_found", "This plan does not exist."), { notify, navigate });
    expect(notify).toHaveBeenCalledWith(PLAN_DELETED);
    expect(PLAN_DELETED).toBe("This plan was deleted.");
    expect(navigate).toHaveBeenCalledWith("/plans");
  });

  it("ad12_plan_not_found_hook_ignores_other_errors", () => {
    const notify = vi.fn();
    const navigate = vi.fn();
    handleQueryError(new ApiError(422, "validation_failed", "Bad id."), { notify, navigate });
    handleQueryError(internalError(), { notify, navigate });
    handleQueryError(new Error("plan_not_found"), { notify, navigate });
    expect(notify).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ad12_plan_queries_read_the_error_envelope", async () => {
    const body = JSON.stringify({ error: { code: "plan_not_found", message: "This plan does not exist.", details: [] } });
    const fetchMock = vi.fn(async () => new Response(body, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPlanSummary(PLAN_ID)).rejects.toMatchObject({ code: "plan_not_found", status: 404 });
    expect(fetchMock).toHaveBeenCalledWith(`/api/plans/${PLAN_ID}`);
  });

  it("ad12_plan_queries_turn_a_network_failure_into_internal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(fetchPlans()).rejects.toMatchObject({ code: "internal", message: INTERNAL_MESSAGE });
  });
});

describe("ad12 plan views leave a deleted plan to the shared hook", () => {
  it("ad12_plan_not_found_keeps_the_opening_text", () => {
    expect(showsLoadError(new ApiError(404, "plan_not_found", "This plan does not exist."))).toBe(false);
    expect(showsLoadError(null)).toBe(false);
  });

  it("ad12_other_errors_show_their_message", () => {
    expect(showsLoadError(new ApiError(422, "validation_failed", "Bad id."))).toBe(true);
    expect(showsLoadError(internalError())).toBe(true);
  });
});

describe("ux_dr5 plan plate", () => {
  const plate = () =>
    html(<PlanPlate name="Demo" menu={planMenuItems("p0")} dataAsOf="2026-09-30" uploadedAt="2026-11-21T23:30:00Z" round={0} />);

  it("ux_dr5_plan_plate_shows_name_data_as_of_and_round", () => {
    expect(plateMeta("2026-09-30", 2)).toBe("Data as of 2026-09-30 · round 2");
    const markup = plate();
    expect(markup).toMatch(/^<span[^>]*><button/);
    expect(markup).toContain(">Demo</span>");
    expect(markup).toContain("Data as of 2026-09-30 · round 0");
  });

  it("ux_dr5_plan_plate_links_the_upload_tooltip", () => {
    expect(uploadedText("2026-11-21T23:30:00Z")).toBe("Uploaded 2026-11-22");
    const markup = plate();
    const describedBy = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
    expect(describedBy).toBeTruthy();
    expect(markup).toContain(`id="${describedBy}" role="tooltip"`);
    expect(markup).toContain("Uploaded 2026-11-22");
    expect(markup).toContain('aria-haspopup="menu"');
  });

  const plans = (ids: string[]) => ids.map((id) => ({ id, name: `Plan ${id}` }));

  it("ux_dr5_fr2_plan_plate_menu_ends_with_all_saved_plans_and_new_plan_from_this_import", () => {
    expect(planMenuItems("p0")).toEqual([
      { label: ALL_SAVED_PLANS, href: "/plans", kind: "action" },
      { label: NEW_PLAN_FROM_IMPORT, href: "/plans/new?from=p0", kind: "action" },
    ]);
    expect(ALL_SAVED_PLANS).toBe("All saved plans");
    expect(NEW_PLAN_FROM_IMPORT).toBe("New Plan from this import");
  });

  it("ux_dr5_fr8_plan_plate_menu_lists_at_most_five_other_plans_in_server_order", () => {
    const items = planMenuItems("p2", plans(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]));
    expect(items.map((item) => item.label)).toEqual([
      "Plan p1",
      "Plan p3",
      "Plan p4",
      "Plan p5",
      "Plan p6",
      ALL_SAVED_PLANS,
      NEW_PLAN_FROM_IMPORT,
    ]);
    expect(items[0]).toEqual({ label: "Plan p1", href: "/plans/p1", kind: "recent" });
    expect(items.at(-1)?.href).toBe("/plans/new?from=p2");
  });

  it("ux_dr5_plan_plate_menu_never_lists_the_open_plan", () => {
    const items = planMenuItems("p1", plans(["p1"]));
    expect(items.map((item) => item.label)).toEqual([ALL_SAVED_PLANS, NEW_PLAN_FROM_IMPORT]);
  });
});
