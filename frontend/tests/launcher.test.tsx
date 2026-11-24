import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CommandEvent, PlanSummary } from "@/lib/api/plans";
import { SAVING_REASON, type SendResult } from "@/lib/commands";
import { applyAllQuestion, NO_OPEN_TO_APPLY, resetQuestion } from "@/lib/copy";
import {
  BAND_ENTRIES,
  CATEGORIES_ENTRY,
  isLauncherShortcut,
  KEYBOARD_NOTE,
  KEYBOARD_SHORTCUTS,
  LAUNCHER_ACTIONS,
  LAUNCHER_STEPS,
  type LauncherAction,
  type LauncherContext,
  launcherResults,
  NO_MATCH,
  RESET_ACTION,
  SEARCH_PLACEHOLDER,
  STAGE2_PLATES,
  STEP_CODES,
  stepCountLines,
  stepState,
} from "@/lib/launcher";
import { FLOW_STEPS } from "@/lib/view-state/steps";
import {
  NEW_PLAN_HREF,
  newPlanFromHref,
  planCategoriesHref,
  planSettingsHref,
  planStepHref,
  SAVED_PLANS_HREF,
} from "@/lib/view-state/urls";
import { LauncherBody, type LauncherResults, resolveActions } from "@/modules/launcher/launcher";

// Story 6.5 (UX-DR7, UX-DR8, UJ-8): the launcher's data lists, its pure helpers and the drawer
// body rendered to static markup (Vitest has no DOM, so keys and focus are covered in e2e).

const PLAN = "11111111-1111-4111-8111-111111111111";

function summary(fields: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: PLAN,
    name: "Spring layout",
    data_as_of: "2026-09-30",
    current_round: 1,
    apply_all_count: 4,
    best_locations: 120,
    empty_best_locations: 9,
    move_count: 0,
    undo_preview: null,
    class_counts: { fast: 312, medium: 400, slow: 500, dead: 333 },
    steps: [
      { key: "overview", checked: true, count: null },
      { key: "parts", checked: true, count: 1545 },
      { key: "locations", checked: true, count: 2210 },
      { key: "pick-groups", checked: true, count: 87 },
      { key: "best-locations", checked: false, count: null },
      { key: "recommendations", checked: false, count: null },
      { key: "before-after", checked: false, count: null },
      { key: "move-list", checked: false, count: null },
    ],
    ...fields,
  } as PlanSummary;
}

function context(fields: Partial<LauncherContext> = {}): LauncherContext {
  return {
    planId: PLAN,
    summary: summary(),
    navigate: vi.fn(),
    send: vi.fn(async (): Promise<SendResult> => ({ outcome: "confirmed", events: [] })),
    notify: vi.fn(),
    ...fields,
  };
}

const [RUN, APPLY_ALL] = LAUNCHER_ACTIONS;
const OTHER = { id: "22222222-2222-4222-8222-222222222222", name: "Autumn trial" };

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function body(props: { actions?: readonly LauncherAction[]; query?: string; summary?: PlanSummary | null } = {}) {
  const sum = props.summary === null ? undefined : (props.summary ?? summary());
  const resolved = sum ? resolveActions(props.actions ?? LAUNCHER_ACTIONS, context({ summary: sum })) : [];
  const results: LauncherResults = launcherResults(props.query ?? "", { actions: resolved, plans: [OTHER] });
  return renderToStaticMarkup(
    <LauncherBody
      planId={PLAN}
      currentStep="parts"
      summary={sum}
      plans={[OTHER]}
      actions={resolved}
      results={results}
      query={props.query ?? ""}
      highlight={0}
      listboxId="results"
      optionId={(index) => `option-${index}`}
      onActivate={() => {}}
    />,
  );
}

/** The markup of the column `role="group"` labelled `name` (up to the next column). */
function column(markup: string, name: string): string {
  const start = markup.indexOf(`role="group" aria-label="${name}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = markup.indexOf('role="group"', start + 1);
  return markup.slice(start, next < 0 ? undefined : next);
}

/** Every element in a component's returned tree (not rendering child components). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

describe("ux_dr7 launcher data", () => {
  it("ux_dr7_step_codes_in_flow_order", () => {
    expect(LAUNCHER_STEPS.map((step) => step.code)).toEqual(["OVR", "PRT", "LOC", "GRP", "BST", "REC", "B/A", "MOV"]);
    expect(LAUNCHER_STEPS.map((step) => step.key)).toEqual(FLOW_STEPS.map((step) => step.key));
    expect(STEP_CODES["before-after"]).toBe("B/A");
  });

  it("ux_dr7_band_stage2_and_keyboard_lists", () => {
    expect(BAND_ENTRIES.map((entry) => [entry.code, entry.name, entry.href(PLAN)])).toEqual([
      ["SAV", "Saved plans", SAVED_PLANS_HREF],
      ["NEW", "New Plan", NEW_PLAN_HREF],
      ["NEW", "New Plan from this import", newPlanFromHref(PLAN)],
      ["SET", "Settings", planSettingsHref(PLAN)],
    ]);
    expect([CATEGORIES_ENTRY.code, CATEGORIES_ENTRY.name, CATEGORIES_ENTRY.href(PLAN)]).toEqual([
      "CAT",
      "Categories",
      planCategoriesHref(PLAN),
    ]);
    expect(STAGE2_PLATES.map((plate) => `${plate.code} ${plate.name}`)).toEqual(["LBL Location labels"]);
    expect(KEYBOARD_SHORTCUTS.map((shortcut) => shortcut.keys)).toEqual(["Ctrl K", "Ctrl /", "Alt A", "Esc"]);
    expect(KEYBOARD_NOTE).toBe("⌘ and ⌥ on a Mac.");
    expect(SEARCH_PLACEHOLDER).toBe("Search features, actions and plans");
  });

  it("ux_dr7_ctrl_or_cmd_k_is_the_shortcut", () => {
    const key = (fields: Partial<KeyboardEvent>) =>
      isLauncherShortcut({ key: "k", code: "KeyK", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...fields });
    expect(key({ ctrlKey: true })).toBe(true);
    expect(key({ metaKey: true })).toBe(true);
    expect(key({ ctrlKey: true, key: "K" })).toBe(true);
    expect(key({})).toBe(false);
    expect(key({ ctrlKey: true, altKey: true })).toBe(false);
    expect(key({ ctrlKey: true, key: "j", code: "KeyJ" })).toBe(false);
    // A non-Latin layout (Cyrillic "л" on the K key) still matches by key position.
    expect(key({ ctrlKey: true, key: "л" })).toBe(true);
    // Ctrl+Shift+K stays the browser's (Firefox web console).
    expect(key({ ctrlKey: true, shiftKey: true, key: "K" })).toBe(false);
  });
});

describe("ux_dr7 step state and counts", () => {
  it("ux_dr7_step_state_all_four", () => {
    const sum = summary();
    expect(stepState("parts", "parts", sum)).toBe("You are here");
    expect(stepState("move-list", "parts", sum)).toBe("Output");
    expect(stepState("before-after", "parts", sum)).toBe("Output");
    expect(stepState("overview", "parts", sum)).toBe("Done");
    expect(stepState("best-locations", "parts", sum)).toBe("Not done yet");
    // Before the summary loads nothing is known to be done.
    expect(stepState("overview", "parts")).toBe("Not done yet");
  });

  it("ux_dr7_ad3_count_lines_for_every_step", () => {
    const sum = summary();
    expect(stepCountLines("overview", sum)).toEqual(["Data as of 2026-09-30", "round 1"]);
    expect(stepCountLines("parts", sum)).toEqual(["1,545 parts", "312 fast-moving"]);
    expect(stepCountLines("locations", sum)).toEqual(["2,210 locations"]);
    expect(stepCountLines("pick-groups", sum)).toEqual(["87 pick groups"]);
    expect(stepCountLines("best-locations", sum)).toEqual(["120 best · 9 empty"]);
    expect(stepCountLines("recommendations", sum)).toEqual(["Round 1 · 4 to apply"]);
    expect(stepCountLines("before-after", sum)).toEqual([]);
    expect(stepCountLines("move-list", sum)).toEqual([]);
  });
});

describe("ux_dr8 launcher search", () => {
  const actions = resolveActions(LAUNCHER_ACTIONS, context());
  const plans = [OTHER, { id: "3", name: "Recount" }];

  it("ux_dr8_blank_query_shows_the_columns", () => {
    expect(launcherResults("", { actions, plans })).toBeNull();
    expect(launcherResults("   ", { actions, plans })).toBeNull();
  });

  it("ux_dr8_groups_in_order_case_insensitive", () => {
    const groups = launcherResults("REC", { actions, plans }) ?? [];
    expect(groups.map((group) => group.label)).toEqual(["Steps", "Actions", "Saved plans"]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["step:recommendations"]);
    // "Run round 2" matches through its keyword "run recommendations".
    expect(groups[1].items.map((item) => item.id)).toEqual(["action:run-recommendations"]);
    expect(groups[2].items.map((item) => item.id)).toEqual(["plan:3"]);

    const mov = launcherResults("  mov ", { actions, plans }) ?? [];
    expect(mov.map((group) => group.label)).toEqual(["Steps", "Actions"]);
    expect(mov[0].items[0]).toMatchObject({ kind: "step", step: { code: "MOV", name: "Move list" } });
    // "Undo last move" (Story 7.3) matches through its keyword.
    expect(mov[1].items.map((item) => item.id)).toEqual(["action:undo-last-move"]);
  });

  it("ux_dr8_actions_then_band_entries_by_code_and_name", () => {
    const groups = launcherResults("new", { actions, plans }) ?? [];
    expect(groups.map((group) => group.label)).toEqual(["Actions"]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["band:new-plan", "band:new-plan-from-import"]);
    const run = launcherResults("run", { actions, plans }) ?? [];
    expect(run.flatMap((group) => group.items.map((item) => item.id))).toEqual(["action:run-recommendations"]);
    const plan = launcherResults("autumn", { actions, plans }) ?? [];
    expect(plan).toEqual([{ label: "Saved plans", items: [{ kind: "plan", id: `plan:${OTHER.id}`, plan: OTHER }] }]);
  });

  it("ux_dr7_cat_is_found_by_code_and_category", () => {
    for (const query of ["CAT", "Category", "keyword rules"]) {
      const groups = launcherResults(query, { actions, plans }) ?? [];
      const ids = groups.flatMap((group) => group.items.map((item) => item.id));
      expect(ids).toContain("band:categories");
      expect(groups.find((group) => group.items.some((item) => item.id === "band:categories"))?.label).toBe(
        "Actions",
      );
    }
  });

  it("ux_dr8_no_match_sentence", () => {
    expect(launcherResults("xyz", { actions, plans })).toEqual([]);
    expect(NO_MATCH(" xyz ")).toBe("No feature or saved plan matches “xyz”.");
    expect(text(body({ query: "xyz" }))).toContain("No feature or saved plan matches “xyz”.");
  });
});

describe("ux_dr7 registered actions", () => {
  it("ux_dr7_run_label_keywords_and_saving_reason", () => {
    expect(RUN.id).toBe("run-recommendations");
    expect(RUN.column).toBe("recommendations");
    expect(RUN.label(context())).toBe("Run round 2");
    expect(RUN.keywords).toEqual(["run recommendations"]);
    expect(RUN.disabledReason?.(context())).toBeUndefined();
    expect(RUN.disabledReason?.(context({ savingReason: SAVING_REASON }))).toBe("Saving the last change…");
    expect(RUN.confirm).toBeUndefined();
  });

  it("ux_dr7_fr23_run_navigates_sends_and_announces", async () => {
    const event = { type: "run_done", round: 2, recommendations: 13, no_space: 4 } as CommandEvent;
    const ctx = context({ send: vi.fn(async (): Promise<SendResult> => ({ outcome: "confirmed", events: [event] })) });
    await RUN.run(ctx);
    expect(ctx.navigate).toHaveBeenCalledWith(planStepHref(PLAN, "recommendations"));
    expect(ctx.send).toHaveBeenCalledWith({ type: "run" });
    expect(ctx.notify).toHaveBeenCalledWith("Recommendations, round 2, 13 recommendations, 4 no space");
  });

  it("ux_dr16_fr30_apply_all_disabled_reasons_and_confirm", () => {
    expect(APPLY_ALL.label(context())).toBe("Apply all (4)…");
    const none = context({ summary: summary({ apply_all_count: 0 }), savingReason: SAVING_REASON });
    expect(APPLY_ALL.disabledReason?.(none)).toBe(NO_OPEN_TO_APPLY);
    expect(NO_OPEN_TO_APPLY).toBe("No open recommendations to apply.");
    expect(APPLY_ALL.disabledReason?.(context({ savingReason: SAVING_REASON }))).toBe(SAVING_REASON);
    expect(APPLY_ALL.disabledReason?.(context())).toBeUndefined();
    expect(APPLY_ALL.confirm?.(context())).toEqual({
      title: "Apply all",
      description: applyAllQuestion(4, 1),
      confirmLabel: "Apply all",
      destructive: false,
    });
  });

  it("ux_dr16_fr30_apply_all_sends_and_toasts", async () => {
    const event = { type: "apply_all_done", applied: [1, 2], skipped: [] } as unknown as CommandEvent;
    const ctx = context({ send: vi.fn(async (): Promise<SendResult> => ({ outcome: "confirmed", events: [event] })) });
    await APPLY_ALL.run(ctx);
    expect(ctx.navigate).toHaveBeenCalledWith(planStepHref(PLAN, "recommendations"));
    expect(ctx.send).toHaveBeenCalledWith({ type: "apply_all" });
    expect(ctx.notify).toHaveBeenCalledWith("Applied 2 recommendations from round 1.");
  });

  it("fr35_uxdr38_reset_label_confirm_and_saving_reason", () => {
    expect(LAUNCHER_ACTIONS.map((action) => action.id)).toEqual([
      "run-recommendations",
      "apply-all",
      "undo-last-move",
      "reset",
    ]);
    expect(LAUNCHER_ACTIONS.at(-1)).toBe(RESET_ACTION);
    expect(RESET_ACTION.id).toBe("reset");
    expect(RESET_ACTION.column).toBe("recommendations");
    expect(RESET_ACTION.label(context())).toBe("Reset…");
    expect(RESET_ACTION.keywords).toEqual(["reset plan"]);
    expect(RESET_ACTION.disabledReason?.(context())).toBeUndefined();
    expect(RESET_ACTION.disabledReason?.(context({ savingReason: SAVING_REASON }))).toBe(SAVING_REASON);
    expect(RESET_ACTION.confirm?.(context({ summary: summary({ move_count: 18 }) }))).toEqual({
      title: "Reset plan",
      description: resetQuestion(18),
      confirmLabel: "Reset plan",
      destructive: true,
    });
  });

  it("fr35_uxdr38_reset_navigates_sends_and_toasts", async () => {
    const event = { type: "plan_reset", moves_removed: 2 } as CommandEvent;
    const ctx = context({ send: vi.fn(async (): Promise<SendResult> => ({ outcome: "confirmed", events: [event] })) });
    await RESET_ACTION.run(ctx);
    expect(ctx.navigate).toHaveBeenCalledWith(planStepHref(PLAN, "recommendations"));
    expect(ctx.send).toHaveBeenCalledWith({ type: "reset" });
    expect(ctx.notify).toHaveBeenCalledWith("Plan reset. 2 moves removed; marks kept. The next run is round 1.");
  });

  it("fr35_uxdr38_reset_noop_toasts_0_moves", async () => {
    const ctx = context();
    await RESET_ACTION.run(ctx);
    expect(ctx.notify).toHaveBeenCalledWith("Plan reset. 0 moves removed; marks kept. The next run is round 1.");
  });
});

describe("uj8 launcher drawer", () => {
  it("uj8_eight_columns_with_state_counts_and_actions", () => {
    const markup = body();
    for (const step of FLOW_STEPS) expect(markup).toContain(`role="group" aria-label="${step.name}"`);
    const parts = text(column(markup, "Parts"));
    expect(parts).toContain("PRT");
    expect(parts).toContain("You are here");
    expect(parts).toContain("1,545 parts");
    const rec = column(markup, "Recommendations");
    expect(text(rec)).toContain("Run round 2");
    expect(text(rec)).toContain("Apply all (4)…");
    expect(text(rec)).toContain("Reset…");
    expect(text(column(markup, "Move list"))).toContain("Output");
    const stage2 = column(markup, "Stage 2");
    expect(stage2).toContain('aria-disabled="true"');
    expect(text(stage2)).toContain("Coming in stage 2");
    expect(text(markup)).toContain("Autumn trial");
    expect(text(markup)).toContain("Data as of 2026-09-30 · round 1");
    expect(text(markup)).toContain(KEYBOARD_NOTE);
  });

  it("ux_dr7_cat_is_an_active_link_and_lbl_stays_inert", () => {
    const stage2 = column(body(), "Stage 2");
    const cat = stage2.slice(stage2.indexOf("<a"), stage2.indexOf("</a>"));
    expect(cat).toContain(`href="${planCategoriesHref(PLAN)}"`);
    expect(text(cat)).toContain("CAT");
    expect(text(cat)).toContain("Categories");
    expect(cat).not.toContain("aria-disabled");
    expect(text(cat)).not.toContain("Coming in stage 2");
    const lbl = stage2.slice(stage2.indexOf("<button"));
    expect(text(lbl)).toContain("LBL");
    expect(lbl).toContain('aria-disabled="true"');
    expect(text(lbl)).toContain("Coming in stage 2");
  });

  it("uj8_before_the_summary_columns_show_links_and_states_only", () => {
    const markup = body({ summary: null });
    expect(text(column(markup, "Parts"))).toContain("You are here");
    expect(text(markup)).not.toContain("parts ");
    expect(text(markup)).not.toContain("Run round");
  });

  it("uj8_apply_all_with_none_open_is_aria_disabled_with_its_reason", () => {
    const rec = column(body({ summary: summary({ apply_all_count: 0 }) }), "Recommendations");
    expect(rec).toMatch(/aria-disabled="true"[^>]*>Apply all \(0\)…/);
    expect(text(rec)).toContain(NO_OPEN_TO_APPLY);
  });

  it("uj8_a_registered_action_shows_in_its_column_and_search_without_launcher_changes", () => {
    const extra: LauncherAction = {
      id: "test-extra",
      column: "recommendations",
      label: () => "Extra test action",
      keywords: ["zebra"],
      run: () => {},
    };
    const actions = [...LAUNCHER_ACTIONS, extra];
    const rec = text(column(body({ actions }), "Recommendations"));
    expect(rec.indexOf("Extra test action")).toBeGreaterThan(rec.indexOf("Apply all (4)…"));
    const found = body({ actions, query: "zebra" });
    expect(found).toContain('role="listbox"');
    expect(found).toMatch(/role="option" aria-selected="true"[^>]*>.*Extra test action/);
  });

  it("uj8_results_listbox_highlights_the_first_option", () => {
    const markup = body({ query: "mov" });
    expect(markup).toContain('id="option-0" role="option" aria-selected="true"');
    expect(text(markup)).toContain("MOV Move list");
  });
});

describe("ux_dr16 confirm dialog", () => {
  const props = {
    open: true,
    onOpenChange: () => {},
    title: "Apply all",
    description: "Apply?",
    confirmLabel: "Apply all",
    onConfirm: () => {},
  };
  const confirmVariant = (node: ReactNode) =>
    elements(node).find((element) => element.type === Button && element.props.variant !== "tertiary")?.props.variant;

  it("ux_dr16_destructive_by_default_primary_when_not", () => {
    expect(confirmVariant(ConfirmDialog(props))).toBe("destructive");
    expect(confirmVariant(ConfirmDialog({ ...props, destructive: false }))).toBe("primary");
  });
});
