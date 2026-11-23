import { afterEach, describe, expect, it, vi } from "vitest";

import { planViewKey } from "@/lib/view-state/storage";
import {
  parseRecommendationsTab,
  planOpenHref,
  recommendationsTabHref,
  rememberPlanView,
  storedPlanViewHref,
} from "@/lib/view-state/urls";

// Story 6.2: the plan's last view lives only in this browser (FR-9, AD-20). Every read and write
// goes through the try/catch helpers, so blocked storage opens the overview.

const PLAN = "11111111-1111-4111-8111-111111111111";
const OVERVIEW = `/plans/${PLAN}/overview`;

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  } as unknown as Storage;
}

function blocked(): Storage {
  const fail = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return { getItem: fail, setItem: fail } as unknown as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ad20 plan view state", () => {
  it("ad20_view_key_per_plan", () => {
    expect(planViewKey(PLAN)).toBe(`swp:plan:${PLAN}:view`);
  });

  it("fr9_open_href_is_the_bare_plan_url", () => {
    expect(planOpenHref("8d3c")).toBe("/plans/8d3c");
    expect(planOpenHref("a b")).toBe("/plans/a%20b");
  });

  it("ad20_round_trip_restores_step_and_query", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));

    rememberPlanView(`/plans/${PLAN}/locations`, "aisle=B&part=X");

    expect(JSON.parse(values[planViewKey(PLAN)])).toEqual({ step: "locations", query: { aisle: "B", part: "X" } });
    expect(storedPlanViewHref(PLAN)).toBe(`/plans/${PLAN}/locations?aisle=B&part=X`);
  });

  it("ad20_spec_example_stored_value_opens_its_view", () => {
    vi.stubGlobal(
      "localStorage",
      storage({ [planViewKey(PLAN)]: '{"step":"locations","query":{"aisle":"B","part":"X"}}' }),
    );

    expect(storedPlanViewHref(PLAN)).toBe(`/plans/${PLAN}/locations?aisle=B&part=X`);
  });

  it("ad20_only_view_keys_are_recorded_and_restored", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));

    rememberPlanView(`/plans/${PLAN}/recommendations`, new URLSearchParams("tab=outdated&rec=r1&move=3&x=1&aisle="));

    expect(JSON.parse(values[planViewKey(PLAN)])).toEqual({
      step: "recommendations",
      query: { tab: "outdated", rec: "r1", move: "3" },
    });

    values[planViewKey(PLAN)] = JSON.stringify({
      step: "parts",
      query: { part: "P 1", evil: "x", loc: 5, aisle: "" },
    });
    expect(storedPlanViewHref(PLAN)).toBe(`/plans/${PLAN}/parts?part=P+1`);
  });

  it("ad20_settings_list_new_and_bare_urls_are_not_recorded", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));

    for (const path of [`/plans/${PLAN}/settings`, "/plans", "/plans/new", `/plans/${PLAN}`, "/", `/plans/${PLAN}/nope`]) {
      rememberPlanView(path, "aisle=A");
    }

    expect(values).toEqual({});
  });

  it("uxdr6_move_list_is_remembered_from_its_print_route", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));

    rememberPlanView(`/plans/${PLAN}/print`, "");

    expect(JSON.parse(values[planViewKey(PLAN)])).toEqual({ step: "move-list", query: {} });
    expect(storedPlanViewHref(PLAN)).toBe(`/plans/${PLAN}/print`);
  });

  it("uxdr6_old_move_list_path_is_not_a_view", () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("localStorage", storage(values));

    rememberPlanView(`/plans/${PLAN}/move-list`, "");

    expect(values).toEqual({});
  });

  it("ad20_nothing_stored_opens_overview", () => {
    vi.stubGlobal("localStorage", storage({}));

    expect(storedPlanViewHref(PLAN)).toBe(OVERVIEW);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["unknown step", '{"step":"settings","query":{"aisle":"B"}}'],
    ["no step", '{"query":{"aisle":"B"}}'],
    ["not an object", '"locations"'],
    ["null", "null"],
  ])("ad20_%s_opens_overview", (_name, value) => {
    vi.stubGlobal("localStorage", storage({ [planViewKey(PLAN)]: value }));

    expect(storedPlanViewHref(PLAN)).toBe(OVERVIEW);
  });

  it("ad20_query_that_is_not_an_object_is_ignored", () => {
    vi.stubGlobal("localStorage", storage({ [planViewKey(PLAN)]: '{"step":"parts","query":"part=X"}' }));

    expect(storedPlanViewHref(PLAN)).toBe(`/plans/${PLAN}/parts`);
  });

  it("ad20_blocked_storage_opens_overview_without_error", () => {
    vi.stubGlobal("localStorage", blocked());

    expect(() => rememberPlanView(`/plans/${PLAN}/locations`, "aisle=B")).not.toThrow();
    expect(storedPlanViewHref(PLAN)).toBe(OVERVIEW);
  });

  it("ad20_missing_storage_opens_overview", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(() => rememberPlanView(`/plans/${PLAN}/parts`, "")).not.toThrow();
    expect(storedPlanViewHref(PLAN)).toBe(OVERVIEW);
  });
});

describe("fr32 kept in place tab url", () => {
  it("fr32_kept_tab_href_and_parse", () => {
    expect(recommendationsTabHref("p1", "kept")).toBe("/plans/p1/recommendations?tab=kept");
    expect(parseRecommendationsTab(new URLSearchParams("tab=kept"))).toBe("kept");
  });
});
