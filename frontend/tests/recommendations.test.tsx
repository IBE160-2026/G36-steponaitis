import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  KeptPartRow,
  NoSpaceRow,
  PlanSummary,
  RecommendationRow,
  RecommendationsView,
  RunMeta,
} from "@/lib/api/plans";
import { SAVING_REASON } from "@/lib/commands";
import { NO_OPEN_TO_APPLY } from "@/lib/copy";
import { parseRecommendationsTab, type RecommendationsTab } from "@/lib/view-state/urls";
import {
  bandViews,
  collapseNoSpace,
  EMPTY_TAB,
  isApplyShortcut,
  isKeepShortcut,
  itemId,
  nextOptionIndex,
  optionName,
  ROWS_PER_RULE,
  tabCounts,
  tabItems,
  tabName,
  TABS,
} from "@/modules/recommendations/list";
import {
  applyReason,
  emptyRunText,
  eyebrowText,
  failedRunText,
  NO_BEST_NOTE,
  NO_RUN,
  RecommendationsView as View,
} from "@/modules/recommendations/recommendations-page";

// Story 5.7 (FR-23–FR-30, UX-DR31–35): the Recommendations page. Rendered to static markup; Vitest
// has no DOM, so keys, grouping and selection are pure helpers tested directly.

let next = 0;

function rec(fields: Partial<RecommendationRow> = {}): RecommendationRow {
  next += 1;
  return {
    id: `run:${fields.number ?? next}`,
    number: next,
    rule: "rule_1",
    part: `P${next}`,
    description: `Part ${next}`,
    movement_class: "fast",
    picks: 30,
    from_location: "C-01-01-01",
    to_location: "A-01-01-03",
    from_best: false,
    to_best: true,
    status: "open",
    applied: null,
    outdated: null,
    reason: { kind: "class", movement_class: "fast", picks: 30, threshold: { min_picks: 24, max_picks: null } },
    ...fields,
  };
}

function noSpace(part: string, fields: Partial<NoSpaceRow> = {}): NoSpaceRow {
  return {
    part,
    rule: "rule_1",
    description: `Part ${part}`,
    movement_class: "fast",
    picks: 40,
    from_location: "B-01-01-02",
    from_best: false,
    reason: null,
    cause: { rule: "rule_1", aisle: null, outside_best: false },
    kept_in_place: false,
    ...fields,
  };
}

const RUN: RunMeta = { id: "run", round: 1, created_at: "2026-11-22T13:05:00Z", created_by: "planner" };

function view(
  recommendations: RecommendationRow[],
  no_space: NoSpaceRow[] = [],
  run: RunMeta | null = RUN,
  kept_parts: KeptPartRow[] = [],
): RecommendationsView {
  return { version: 5, run, recommendations, no_space, kept_parts };
}

function summary(fields: Partial<PlanSummary> = {}): PlanSummary {
  return { version: 5, apply_all_count: 3, best_locations: 12, ...fields } as PlanSummary;
}

function render(
  data: RecommendationsView,
  tab: RecommendationsTab = "open",
  props: { summary?: PlanSummary; disabledReason?: string } = {},
) {
  return renderToStaticMarkup(
    <View
      summary={props.summary ?? summary()}
      view={data}
      tab={tab}
      onTabChange={() => {}}
      disabledReason={props.disabledReason}
      onSend={async () => ({ outcome: "confirmed", events: [] })}
    />,
  );
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const OUTDATED = rec({
  status: "outdated",
  outdated: { cause: "filled", location: "A-01-01-03", move_number: 2, partner: null, aisle: null },
});
const APPLIED = rec({ status: "applied", applied: { move_number: 16, round: 1 } });

describe("ux_dr31 tabs", () => {
  it("ux_dr31_tab_parse_defaults_to_open", () => {
    expect(parseRecommendationsTab(new URLSearchParams("tab=outdated"))).toBe("outdated");
    expect(parseRecommendationsTab({ tab: "no-space" })).toBe("no-space");
    expect(parseRecommendationsTab({ tab: ["applied", "open"] })).toBe("applied");
    expect(parseRecommendationsTab(new URLSearchParams("tab=kept"))).toBe("kept");
    expect(parseRecommendationsTab(new URLSearchParams("tab=dismissed"))).toBe("open");
    expect(parseRecommendationsTab({})).toBe("open");
  });

  it("ux_dr31_tab_counts_and_names", () => {
    const data = view([rec(), rec(), OUTDATED, APPLIED], [noSpace("1200")]);
    expect(tabCounts(data)).toEqual({ open: 2, applied: 1, kept: 0, outdated: 1, "no-space": 1 });
    expect(tabName("open", 13)).toBe("Open, 13 recommendations");
    expect(tabName("applied", 1)).toBe("Applied, 1 recommendation");
    expect(tabName("outdated", 0)).toBe("Outdated, 0 recommendations");
    expect(tabName("no-space", 31)).toBe("No space, 31 parts");
    expect(tabName("no-space", 1)).toBe("No space, 1 part");
    const markup = render(data);
    expect(markup).toContain('aria-label="Open, 2 recommendations"');
    expect(markup).toContain('aria-label="Outdated, 1 recommendation"');
    expect(markup).toContain('aria-label="No space, 1 part"');
  });

  it("ux_dr31_empty_tabs", () => {
    const data = view([rec()], [noSpace("1200")]);
    expect(text(render(data, "applied"))).toContain(EMPTY_TAB.applied);
    expect(text(render(data, "outdated"))).toContain("No outdated recommendations.");
    expect(text(render(view([rec()]), "no-space"))).toContain("No “no space” parts in this run.");
  });
});

describe("ux_dr32 rule bands and collapsing", () => {
  it("ux_dr32_rule_bands_in_rule_order_five_per_rule", () => {
    const rows = [
      rec({ rule: "rule_3" }),
      ...Array.from({ length: 7 }, () => rec({ rule: "rule_1" })),
      rec({ rule: "rule_3" }),
    ];
    const items = tabItems(view(rows), "open");
    const bands = bandViews("open", items, new Set(), new Set());
    expect(bands.map((band) => band.rule)).toEqual(["rule_1", "rule_3"]);
    expect(bands[0].rows).toHaveLength(ROWS_PER_RULE);
    expect(bands[0].more).toEqual({ count: 2 });
    expect(bands[1].rows.map((r) => itemId(r.item))).toEqual([rows[0].id, rows[8].id]);
    expect(bands[1].more).toBeNull();
    const expanded = bandViews("open", items, new Set(["rule_1"] as const), new Set());
    expect(expanded[0].rows).toHaveLength(7);
    expect(expanded[0].more).toBeNull();

    const markup = text(render(view(rows)));
    expect(markup).toContain("Show 2 more under rule 1");
    expect(markup).toContain("Fast-moving parts into best locations");
    expect(markup).toContain("Most shared jobs first · the part with fewer picks moves");
    expect(markup).not.toContain("Slow-moving and dead parts out of best locations");
  });

  it("ux_dr32_no_space_collapses_consecutive_identical_lines", () => {
    const aisleD = { rule: "rule_3" as const, aisle: "D", outside_best: false };
    const entries = [
      noSpace("1200"),
      noSpace("10240"),
      noSpace("2400"),
      noSpace("6600", { rule: "rule_3", cause: aisleD }),
      noSpace("6700", { rule: "rule_3", cause: { ...aisleD, aisle: "A" } }),
      noSpace("6800", { rule: "rule_3", cause: aisleD }),
    ];
    const items = tabItems(view([], entries), "no-space");
    expect(collapseNoSpace(items).map((run) => [itemId(run.first), run.rest.length])).toEqual([
      ["nospace:1200", 2],
      ["nospace:6600", 0],
      ["nospace:6700", 0],
      ["nospace:6800", 0],
    ]);
    const bands = bandViews("no-space", items, new Set(), new Set());
    expect(bands[0].rows).toEqual([{ item: items[0], moreLikeThis: { key: "nospace:1200", count: 2 } }]);
    const open = bandViews("no-space", items, new Set(), new Set(["nospace:1200"]));
    expect(open[0].rows.map((r) => itemId(r.item))).toEqual(["nospace:1200", "nospace:10240", "nospace:2400"]);
    expect(text(render(view([], entries), "no-space"))).toContain("2 more like this");
  });
});

describe("ux_dr33 rows and detail", () => {
  it("ux_dr33_option_names_carry_state_words", () => {
    const open = rec({ number: 1, part: "1100" });
    expect(optionName({ kind: "rec", row: open })).toBe("#1, 1100, from C-01-01-01 to A-01-01-03 BEST");
    expect(optionName({ kind: "rec", row: OUTDATED })).toMatch(/, outdated, A-01-01-03 was filled by a manual move\.$/);
    expect(optionName({ kind: "rec", row: APPLIED })).toMatch(/, Applied · move 16, round 1$/);
    expect(optionName({ kind: "no-space", row: noSpace("1200") })).toBe(
      "1200, from B-01-01-02, No space · no empty best location",
    );
    expect(optionName({ kind: "rec", row: rec({ number: 2, part: "4400", from_best: true, to_best: false }) })).toBe(
      "#2, 4400, from C-01-01-01 BEST to A-01-01-03",
    );
    expect(optionName({ kind: "no-space", row: noSpace("2400", { from_location: "A-01-02-01", from_best: true }) })).toBe(
      "2400, from A-01-02-01 BEST, No space · no empty best location",
    );
  });

  it("ux_dr33_row_states_render", () => {
    expect(text(render(view([APPLIED]), "applied"))).toContain("Applied · move 16, round 1");
    const outdated = render(view([OUTDATED]), "outdated");
    expect(outdated).toContain("line-through");
    expect(text(outdated)).toContain("Outdated");
    expect(text(outdated)).toContain("A-01-01-03 was filled by a manual move.");
    const noSpaceMarkup = text(render(view([], [noSpace("1200")]), "no-space"));
    expect(noSpaceMarkup).toContain("NO SPACE");
    expect(noSpaceMarkup).toContain("SELECTED · NO SPACE · RULE 1");
  });

  it("ux_dr33_listbox_selects_the_first_row_and_controls_the_detail", () => {
    const first = rec({ part: "1100" });
    const markup = render(view([first, rec()]));
    expect(markup).toMatch(/role="listbox"[^>]*aria-controls="([^"]+)"/);
    const controls = /role="listbox"[^>]*aria-controls="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toContain(`id="${controls}"`);
    expect(markup.match(/role="option" aria-selected="true"/g)).toHaveLength(1);
    expect(markup.match(/role="option" aria-selected="false"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="0"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(text(markup)).toContain(eyebrowText({ kind: "rec", row: first }));
  });

  it("ux_dr33_detail_reason_bold_and_eyebrow", () => {
    const row = rec({ number: 3, rule: "rule_2" });
    expect(eyebrowText({ kind: "rec", row })).toBe("SELECTED · #3 · RULE 2");
    expect(eyebrowText({ kind: "no-space", row: noSpace("1200", { rule: "rule_3" }) })).toBe(
      "SELECTED · NO SPACE · RULE 3",
    );
    const markup = render(view([row]));
    expect(markup).toContain("<strong>30</strong>");
    expect(markup).toContain("<strong>24</strong>");
  });

  it("fr29_apply_disabled_with_the_cause_on_outdated_rows", () => {
    expect(applyReason(OUTDATED, undefined)).toBe("A-01-01-03 was filled by a manual move.");
    expect(applyReason(rec(), undefined)).toBeUndefined();
    expect(applyReason(rec(), SAVING_REASON)).toBe(SAVING_REASON);
    const markup = render(view([OUTDATED]), "outdated");
    expect(markup).toMatch(/aria-disabled="true"[^>]*>Apply</);
  });
});

describe("ux_dr33 keys", () => {
  it("ux_dr33_arrow_home_end_move_the_selection", () => {
    expect(nextOptionIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextOptionIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextOptionIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextOptionIndex("Home", 2, 3)).toBe(0);
    expect(nextOptionIndex("End", 0, 3)).toBe(2);
    expect(nextOptionIndex("Enter", 0, 3)).toBeNull();
    expect(nextOptionIndex("ArrowDown", 0, 0)).toBeNull();
  });

  it("fr30_alt_a_applies_never_in_a_text_field", () => {
    const option = { tagName: "DIV" };
    expect(isApplyShortcut({ altKey: true, code: "KeyA", target: option })).toBe(true);
    expect(isApplyShortcut({ altKey: false, code: "KeyA", target: option })).toBe(false);
    expect(isApplyShortcut({ altKey: true, code: "KeyB", target: option })).toBe(false);
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isApplyShortcut({ altKey: true, code: "KeyA", target: { tagName } })).toBe(false);
    }
    expect(isApplyShortcut({ altKey: true, code: "KeyA", target: { tagName: "DIV", isContentEditable: true } })).toBe(
      false,
    );
  });
});

describe("ux_dr34 header and edge states", () => {
  it("fr23_header_round_chip_and_run_line", () => {
    const markup = text(render(view([rec(), OUTDATED], [noSpace("1200")])));
    expect(markup).toContain("Round 1");
    expect(markup).toContain("Run 2026-11-22 14:05 by planner · 2 recommendations · 1 no space");
    expect(markup).toContain("The next run starts round 2 and uses the planning copy as it is then.");
    expect(markup).toContain("Run recommendations");
    expect(markup).toContain("Apply all (3)");
  });

  it("fr30_apply_all_disabled_at_zero", () => {
    const markup = render(view([rec()]), "open", { summary: summary({ apply_all_count: 0 }) });
    expect(text(markup)).toContain("Apply all (0)");
    expect(markup).toContain(NO_OPEN_TO_APPLY);
  });

  it("ux_dr57_no_run_and_no_best_locations", () => {
    const noMarks = summary({ best_locations: 0, apply_all_count: 0 });
    const markup = text(render(view([], [], null), "open", { summary: noMarks }));
    expect(markup).toContain("Round 0");
    expect(markup).toContain(NO_RUN);
    expect(markup).toContain(NO_BEST_NOTE);
    expect(markup).not.toContain("Run 2026");
  });

  it("ux_dr57_empty_run_and_failed_run_copy", () => {
    expect(text(render(view([], [])))).toContain(emptyRunText(1));
    expect(emptyRunText(2)).toBe(
      "Round 2 found no recommendations and no “no space” parts. The rules have nothing more to suggest for these best-location marks.",
    );
    expect(failedRunText(1)).toBe(
      "The run stopped before it finished. Nothing changed: still round 1. Run recommendations to try again.",
    );
  });

  it("ux_dr13_saving_disables_plan_changing_buttons", () => {
    const markup = render(view([rec()]), "open", { disabledReason: SAVING_REASON });
    expect(markup.match(new RegExp(SAVING_REASON, "g"))?.length).toBeGreaterThanOrEqual(3);
  });
});

function keptPart(part: string, fields: Partial<KeptPartRow> = {}): KeptPartRow {
  return {
    part,
    description: `Part ${part}`,
    movement_class: "slow",
    picks: 2,
    from_location: "A-01-03-01",
    from_best: true,
    ...fields,
  };
}

const KEPT = rec({ number: 5, part: "0500", rule: "rule_2", status: "kept" });

describe("fr32 kept in place tab", () => {
  it("fr32_tabs_in_order_with_kept_url_value", () => {
    expect(TABS.map((tab) => tab.label)).toEqual(["Open", "Applied", "Kept in place", "Outdated", "No space"]);
    expect(TABS.map((tab) => tab.value)).toContain("kept");
  });

  it("fr32_kept_tab_lists_each_kept_part_once_and_counts_parts", () => {
    const data = view(
      [rec(), KEPT, APPLIED],
      [noSpace("1200", { kept_in_place: true }), noSpace("10240")],
      RUN,
      [keptPart("9100", { from_best: false, from_location: "D-01-02-03" })],
    );
    const kept = tabItems(data, "kept");
    expect(kept.map(itemId)).toEqual([KEPT.id, "nospace:1200", "kept:9100"]);
    expect(tabItems(data, "no-space").map(itemId)).toEqual(["nospace:10240"]);
    expect(tabItems(data, "open").map(itemId)).not.toContain(KEPT.id);
    expect(tabCounts(data)).toEqual({ open: 1, applied: 1, kept: 3, outdated: 0, "no-space": 1 });
    expect(tabName("kept", 3)).toBe("Kept in place, 3 parts");
    expect(tabName("kept", 1)).toBe("Kept in place, 1 part");
    const bands = bandViews("kept", kept, new Set(), new Set());
    expect(bands.map((band) => band.rule)).toEqual(["rule_1", "rule_2", "kept"]);
    const markup = render(data, "kept");
    expect(markup).toContain('aria-label="Kept in place, 3 parts"');
    expect(text(markup)).toContain("No open recommendation in this run");
    expect(text(markup)).toContain("Part-number order");
  });

  it("fr32_kept_tab_empty_text", () => {
    expect(EMPTY_TAB.kept).toBe("Nothing kept in place.");
    expect(text(render(view([rec()]), "kept"))).toContain("Nothing kept in place.");
  });

  it("fr32_kept_row_detail_apply_disabled_and_remove_link", () => {
    expect(applyReason(KEPT, undefined)).toBe("0500 is kept in place.");
    expect(optionName({ kind: "rec", row: KEPT })).toMatch(/, Kept in place$/);
    expect(optionName({ kind: "kept-part", row: keptPart("9100") })).toBe("9100, at A-01-03-01 BEST, Kept in place");
    const markup = render(view([KEPT]), "kept");
    expect(markup).toMatch(/aria-disabled="true"[^>]*>Apply</);
    expect(markup).toContain("0500 is kept in place.");
    expect(markup).toMatch(/aria-keyshortcuts="Alt\+K"[^>]*>Remove keep in place</);
    expect(text(markup)).toContain("Kept in place");
    expect(eyebrowText({ kind: "kept-part", row: keptPart("9100") })).toBe("SELECTED · KEPT IN PLACE");
  });

  it("fr32_open_and_no_space_details_show_keep_link_applied_and_outdated_do_not", () => {
    const open = render(view([rec()]));
    expect(open).toMatch(/>Apply<\/button>[\s\S]*>Keep in place</);
    expect(text(render(view([], [noSpace("1200")]), "no-space"))).toContain("Keep in place");
    expect(text(render(view([APPLIED]), "applied"))).not.toContain("Keep in place");
    expect(text(render(view([OUTDATED]), "outdated"))).not.toContain("Keep in place");
  });

  it("fr32_kept_part_detail_has_remove_link_pin_and_no_apply", () => {
    const markup = render(view([], [], RUN, [keptPart("9100")]), "kept");
    expect(markup).toMatch(/aria-keyshortcuts="Alt\+K"[^>]*>Remove keep in place</);
    expect(markup).toMatch(/data-kept-in-place=""[^>]*><svg[\s\S]*?<span>Kept in place<\/span>/);
    expect(markup).not.toMatch(/>Apply</);
    expect(text(markup)).toContain("SELECTED · KEPT IN PLACE");
  });

  it("fr32_kept_no_space_detail_has_remove_link_pin_and_no_apply", () => {
    const markup = render(view([], [noSpace("1200", { kept_in_place: true })]), "kept");
    expect(markup).toMatch(/aria-keyshortcuts="Alt\+K"[^>]*>Remove keep in place</);
    expect(markup).toMatch(/data-kept-in-place=""[^>]*><svg[\s\S]*?<span>Kept in place<\/span>/);
    expect(markup).not.toMatch(/>Apply</);
    expect(text(markup)).toContain("SELECTED · NO SPACE · RULE 1");
  });

  it("fr32_empty_run_keeps_its_text_and_shows_the_kept_tab", () => {
    const markup = render(view([], [], RUN, [keptPart("0500")]), "kept");
    expect(text(markup)).toContain(emptyRunText(1));
    expect(markup).toContain('aria-label="Kept in place, 1 part"');
    expect(markup).toMatch(/>Remove keep in place</);
  });

  it("fr32_no_run_shows_no_run_text_and_the_kept_tab", () => {
    const markup = render(view([], [], null, [keptPart("0500")]), "kept");
    expect(text(markup)).toContain(NO_RUN);
    expect(markup).toContain('aria-label="Kept in place, 1 part"');
    expect(markup).toMatch(/>Remove keep in place</);
    expect(render(view([], [], null), "kept")).not.toContain('role="tablist"');
  });

  it("uxdr8_alt_k_keeps_never_in_a_text_field", () => {
    const option = { tagName: "DIV" };
    expect(isKeepShortcut({ altKey: true, code: "KeyK", target: option })).toBe(true);
    expect(isKeepShortcut({ altKey: false, code: "KeyK", target: option })).toBe(false);
    expect(isKeepShortcut({ altKey: true, code: "KeyA", target: option })).toBe(false);
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isKeepShortcut({ altKey: true, code: "KeyK", target: { tagName } })).toBe(false);
    }
    expect(isKeepShortcut({ altKey: true, code: "KeyK", target: { tagName: "DIV", isContentEditable: true } })).toBe(false);
  });
});
