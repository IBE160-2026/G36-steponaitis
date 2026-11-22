import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  type AisleBeforeAfter,
  type BeforeAfterView as BeforeAfterData,
  planBeforeAfterKey,
  planRootKey,
} from "@/lib/api/plans";
import { BeforeAfterView, beforeAfterRows, NO_MOVES } from "@/modules/before-after/before-after-page";

// Story 4.6: the before/after page (FR-37, UX-DR51). Rendered to static markup; Vitest has no DOM.

const same = (n: number) => ({ before: n, after: n });

function aisle(name: string, overrides: Partial<AisleBeforeAfter> = {}): AisleBeforeAfter {
  return {
    aisle: name,
    moved_in: [],
    moved_out: [],
    fast_in_best: same(0),
    pick_groups_together: same(0),
    occupied: same(3),
    empty: same(2),
    ...overrides,
  };
}

// Server order is kept even where it is not text order.
const MOVED: BeforeAfterData = {
  version: 2,
  has_moves: true,
  aisles: [
    aisle("C", { moved_in: ["9300", "0100"], fast_in_best: { before: 1, after: 5 }, occupied: { before: 3, after: 4 } }),
    aisle("A", { moved_out: ["0100"], occupied: { before: 1200, after: 1199 } }),
  ],
  total: {
    fast_in_best: { before: 1, after: 5 },
    pick_groups_together: same(1),
    occupied: { before: 1203, after: 1203 },
    empty: same(4),
  },
};

const FRESH: BeforeAfterData = {
  version: 1,
  has_moves: false,
  aisles: [aisle("A"), aisle("B")],
  total: { fast_in_best: same(0), pick_groups_together: same(0), occupied: same(6), empty: same(4) },
};

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function rowsOf(markup: string): string[] {
  return markup.split("<tr").slice(2);
}

describe("fr37 before/after page", () => {
  it("fr37_query_key_is_under_the_plan_root", () => {
    const root = [...planRootKey("p")];
    expect(planBeforeAfterKey("p").slice(0, root.length)).toEqual(root);
  });

  it("fr37_rows_in_server_order_then_total", () => {
    expect(beforeAfterRows(MOVED).map((row) => row.label)).toEqual(["C", "A", "Total"]);
    const markup = renderToStaticMarkup(<BeforeAfterView view={MOVED} />);
    expect(markup).toContain('aria-label="Before/after"');
    const rows = rowsOf(markup);
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toMatch(/^ [^>]*> C /);
    expect(text(rows[1])).toMatch(/^ [^>]*> A /);
    expect(text(rows[2])).toContain("Total");
  });

  it("fr37_changed_after_is_strong_and_equal_is_plain", () => {
    const markup = renderToStaticMarkup(<BeforeAfterView view={MOVED} />);
    const [c, a, total] = rowsOf(markup);
    expect(c).toContain('data-count="fast_in_best"');
    expect(c).toMatch(/data-count="fast_in_best"[^>]*>1 → <span class="type-body-strong">5<\/span>/);
    expect(c).toMatch(/data-count="occupied"[^>]*>3 → <span class="type-body-strong">4<\/span>/);
    expect(c).toMatch(/data-count="pick_groups_together"[^>]*>0 → 0<\/span>/);
    expect(a).toMatch(/data-count="occupied"[^>]*>1,200 → <span class="type-body-strong">1,199<\/span>/);
    expect(total).toMatch(/data-count="occupied"[^>]*>1,203 → 1,203<\/span>/);
    for (const field of ["fast_in_best", "pick_groups_together", "occupied", "empty"]) {
      expect(total).toContain(`data-count="${field}"`);
    }
    expect(markup).toMatch(/<td class="[^"]*text-right tabular-nums[^"]*"><span data-count=/);
  });

  it("fr37_moved_lists_or_none", () => {
    const markup = renderToStaticMarkup(<BeforeAfterView view={MOVED} />);
    const [c, a, total] = rowsOf(markup);
    expect(c).toContain('<span class="type-code-table text-ink">9300, 0100</span>');
    expect(text(c)).toContain("None");
    expect(a).toContain('<span class="type-code-table text-ink">0100</span>');
    expect(text(total)).not.toContain("None");
    expect(total).not.toContain("type-code-table");
  });

  it("fr37_no_moves_note_only_without_moves", () => {
    expect(text(renderToStaticMarkup(<BeforeAfterView view={FRESH} />))).toContain(NO_MOVES);
    expect(NO_MOVES).toBe("No moves yet: before and after are the same.");
    expect(text(renderToStaticMarkup(<BeforeAfterView view={MOVED} />))).not.toContain(NO_MOVES);
  });

  it("uxdr51_heads_name_best_in_words", () => {
    const markup = renderToStaticMarkup(<BeforeAfterView view={FRESH} />);
    const head = text(markup.slice(markup.indexOf("<thead"), markup.indexOf("</thead>")));
    for (const name of [
      "Aisle",
      "Moved in",
      "Moved out",
      "Fast-moving in best locations",
      "Pick groups in the same aisle",
      "Occupied",
      "Empty",
    ]) {
      expect(head).toContain(name);
    }
    expect(head).toMatch(/\bbest\b/);
    expect(text(markup)).toContain("Before/after");
  });

  it("uxdr51_table_is_one_tab_stop", () => {
    const markup = renderToStaticMarkup(<BeforeAfterView view={MOVED} />);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(2);
  });
});
