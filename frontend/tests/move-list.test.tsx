import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPlanMoveList,
  type MoveListLine,
  type MoveListView as MoveListData,
  planMoveListKey,
  planRootKey,
} from "@/lib/api/plans";
import { moveListDataLine, moveListGeneratedLine, RULE_LABELS, ruleCellText, swapLocationsText } from "@/lib/copy";
import { stepFromSegment, stepSegment } from "@/lib/view-state/steps";
import { planStepHref } from "@/lib/view-state/urls";
import { createPrintFlow, MoveListView } from "@/modules/move-list/move-list-page";

// Story 8.3: the move list print view (FR-38, AD-17, UX-DR52). Rendered to static markup; Vitest
// has no DOM, so the print flow is tested on its controller with a real QueryClient and a mocked
// fetch. TZ is Europe/Oslo (vitest.config.mts).

function line(move: number, round: number, overrides: Partial<MoveListLine> = {}): MoveListLine {
  return {
    move_number: move,
    round,
    part: `P${move}`,
    description: `Part ${move}`,
    from_location: `A-01-01-0${move}`,
    to_location: `C-01-01-0${move}`,
    rule: "rule_1",
    swap: null,
    ...overrides,
  };
}

// Server order is kept even where it is not move-number order; round 1 is missing (a gap).
const VIEW: MoveListData = {
  version: 7,
  header: {
    name: "Plan A",
    data_as_of: "2026-10-30",
    uploaded_at: "2026-11-21T23:30:00Z",
    rounds: 2,
    generated_at: "2026-11-23T13:05:00Z",
  },
  rounds: [
    { round: 0, label: "before the first run", lines: [line(5, 0, { rule: "manual" })] },
    { round: 2, label: null, lines: [line(9, 2), line(3, 2, { rule: "rule_3" }), line(4, 2, { rule: "rule_2" })] },
  ],
};

const SWAP_VIEW: MoveListData = {
  ...VIEW,
  header: { ...VIEW.header, rounds: 1 },
  rounds: [
    {
      round: 1,
      label: null,
      lines: [
        line(1, 1, { rule: "manual", swap: { index: 1, size: 2, locations: ["A", "B"] } }),
        line(2, 1, { rule: "manual", swap: { index: 2, size: 2, locations: ["A", "B"] } }),
      ],
    },
  ],
};

const EMPTY: MoveListData = { ...VIEW, header: { ...VIEW.header, rounds: 0 }, rounds: [] };

function html(view: MoveListData, props: { printing?: boolean; error?: Error | null } = {}) {
  return renderToStaticMarkup(<MoveListView planId="p1" view={view} {...props} />);
}

const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("fr38 move list header", () => {
  it("fr38_header_lines", () => {
    const markup = html(VIEW);
    expect(markup).toMatch(/<h1[^>]*>Move list · Plan A<\/h1>/);
    // uploaded_at 23:30Z is the next day in Oslo; generated_at 13:05Z is 14:05 there.
    expect(text(markup)).toContain("Data as of 2026-10-30 · uploaded 2026-11-22 · 2 rounds");
    expect(text(markup)).toContain("Generated 2026-11-23 14:05 · Smart Warehouse Planner");
  });

  it("fr38_header_singular_round", () => {
    expect(moveListDataLine({ ...VIEW.header, rounds: 1 })).toBe("Data as of 2026-10-30 · uploaded 2026-11-22 · 1 round");
    expect(moveListGeneratedLine("2026-11-23T13:05:00Z")).toBe("Generated 2026-11-23 14:05 · Smart Warehouse Planner");
  });

  it("fr38_header_and_column_heads_sit_in_thead", () => {
    const markup = html(VIEW);
    const thead = /<thead>(.*?)<\/thead>/.exec(markup)?.[1] ?? "";
    expect(thead).toContain("Move list · Plan A");
    expect(thead).toContain("Generated 2026-11-23 14:05");
    const heads = [...thead.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual([
      '<span aria-hidden="true">✓</span><span class="sr-only">Done</span>',
      "Round",
      "Part",
      "Description",
      "From",
      "To",
      "Rule",
      "Note",
    ]);
    expect(markup.match(/<table/g)).toHaveLength(1);
  });
});

describe("fr38 move list rounds and lines", () => {
  it("fr38_bands_per_round_with_round_0_label_and_gap", () => {
    const markup = html(VIEW);
    const bodies = [...markup.matchAll(/<tbody data-round="(\d+)">/g)].map((m) => m[1]);
    expect(bodies).toEqual(["0", "2"]);
    const bands = [...markup.matchAll(/<tr data-round-band[^>]*>(.*?)<\/tr>/g)].map((m) => text(m[1]));
    expect(bands).toEqual(["ROUND 0before the first run", "ROUND 2one walk · from-location before to-location"]);
    expect(markup).not.toContain("ROUND 1");
  });

  it("fr38_lines_in_response_order_each_with_its_round", () => {
    const markup = html(VIEW);
    const lines = [...markup.matchAll(/<tr data-move-line="(\d+)"[^>]*>(.*?)<\/tr>/g)];
    expect(lines.map((m) => m[1])).toEqual(["5", "9", "3", "4"]);
    const cells = (row: string) => [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => text(m[1]));
    expect(cells(lines[0][2])).toEqual(["", "0", "P5", "Part 5", "A-01-01-05", "C-01-01-05", "Manual", ""]);
    expect(cells(lines[1][2])).toEqual(["", "2", "P9", "Part 9", "A-01-01-09", "C-01-01-09", "Rule 1", ""]);
    expect(cells(lines[2][2])[6]).toBe("Rule 3");
    expect(cells(lines[3][2])[6]).toBe("Rule 2");
    expect(lines[0][2]).toContain('<span aria-hidden="true" class="inline-block size-[14px]');
  });

  it("fr38_rule_cells_and_swap_marks", () => {
    expect(ruleCellText(line(1, 1))).toBe("Rule 1");
    expect(swapLocationsText(line(1, 1))).toBeNull();
    const markup = html(SWAP_VIEW);
    const rules = [...markup.matchAll(/<tr data-move-line[^>]*>(?:<td[^>]*>.*?<\/td>){6}<td[^>]*>(.*?)<\/td>/g)].map(
      (m) => m[1],
    );
    expect(rules).toHaveLength(2);
    expect(text(rules[0])).toBe("Manual · Swap 1/2A ↔ B");
    expect(text(rules[1])).toBe("Manual · Swap 2/2A ↔ B");
    expect(rules[0]).toMatch(/<span data-swap-locations="true" class="[^"]*type-print-code[^"]*">A ↔ B<\/span>/);
  });

  it("fr38_rule_labels_are_shared_with_the_move_toast", () => {
    expect(RULE_LABELS).toEqual({ rule_1: "Rule 1", rule_2: "Rule 2", rule_3: "Rule 3", manual: "Manual" });
  });

  it("fr38_footnotes_with_and_without_swap", () => {
    const walk = "Lines follow Walk Path; moves out of a location come before moves into it, except in a swap.";
    const swap = "Swap: set one bin aside, move the other into its place, then put the first one in.";
    expect(html(VIEW)).toContain(walk);
    expect(html(VIEW)).not.toContain(swap);
    expect(html(SWAP_VIEW)).toContain(walk);
    expect(html(SWAP_VIEW)).toContain(swap);
  });
});

describe("uxdr52 move list actions", () => {
  it("uxdr52_print_is_the_only_primary_button_beside_back_to_recommendations", () => {
    const markup = html(VIEW);
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toMatch(/<button[^>]*>Print<\/button>/);
    expect(markup).not.toContain("aria-disabled");
    expect(markup).toContain('href="/plans/p1/recommendations"');
    expect(markup).toContain("Back to Recommendations");
  });

  it("fr38_empty_move_list", () => {
    const markup = html(EMPTY);
    expect(markup).not.toContain("<table");
    expect(markup).toMatch(/<p data-move-list-empty[^>]*>There are no moves to print\.<\/p>/);
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Print<\/button>/);
    expect(markup).toMatch(/role="tooltip"[^>]*>There are no moves to print\.<\/span>/);
    expect(markup).toContain('href="/plans/p1/recommendations"');
  });

  it("uxdr52_print_is_busy_while_it_refetches", () => {
    const markup = html(VIEW, { printing: true });
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Print<\/button>/);
    expect(markup).toContain('aria-busy="true"');
  });

  it("uxdr52_a_failed_refetch_is_shown_above_the_paper", () => {
    const markup = html(VIEW, { error: new Error("The server is not available.") });
    expect(markup).toContain('<p role="alert" class="type-body text-ink">The server is not available.</p>');
    expect(markup).toContain("<table");
  });
});

describe("uxdr6 move list step route", () => {
  it("uxdr6_move_list_step_opens_print", () => {
    expect(planStepHref("p1", "move-list")).toBe("/plans/p1/print");
    expect(stepSegment("move-list")).toBe("print");
    expect(stepSegment("parts")).toBe("parts");
    expect(stepFromSegment("print")).toBe("move-list");
    expect(stepFromSegment("move-list")).toBeUndefined();
    expect(stepFromSegment("before-after")).toBe("before-after");
  });

  it("ad17_move_list_query_is_a_plan_query", () => {
    expect(planMoveListKey("p1").slice(0, 2)).toEqual([...planRootKey("p1")]);
  });
});

describe("ad17 print fetches again and prints after the render", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(responses: (() => Response)[]) {
    let call = 0;
    const fetchMock = vi.fn(async () => responses[Math.min(call++, responses.length - 1)]());
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(queryClient, {
      queryKey: planMoveListKey("p1"),
      queryFn: () => fetchPlanMoveList("p1"),
    });
    const unsubscribe = observer.subscribe(() => {});
    return { fetchMock, observer, unsubscribe };
  }

  const json = (generatedAt: string) => () =>
    new Response(JSON.stringify({ ...VIEW, header: { ...VIEW.header, generated_at: generatedAt } }), { status: 200 });
  const failure = () =>
    new Response(JSON.stringify({ error: { code: "unavailable", message: "The server is not available." } }), {
      status: 503,
    });

  it("ad17_print_refetches_then_prints_once_after_the_new_data_renders", async () => {
    const { fetchMock, observer, unsubscribe } = setup([json("2026-11-23T13:05:00Z"), json("2026-11-23T13:09:00Z")]);
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    const firstAt = observer.getCurrentResult().dataUpdatedAt;
    const print = vi.fn();
    const flow = createPrintFlow(print);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const error = await flow.request(() => observer.refetch());

    expect(error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/plans/p1/move-list");
    const result = observer.getCurrentResult();
    expect(result.data?.header.generated_at).toBe("2026-11-23T13:09:00Z");
    expect(print).not.toHaveBeenCalled();

    // A commit still showing the old data does not print; the commit of the new data does, once.
    flow.committed(firstAt);
    expect(print).not.toHaveBeenCalled();
    flow.committed(result.dataUpdatedAt);
    expect(print).toHaveBeenCalledTimes(1);
    flow.committed(result.dataUpdatedAt);
    expect(print).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("ad17_ordinary_renders_never_print", () => {
    const print = vi.fn();
    const flow = createPrintFlow(print);
    flow.committed(Date.now());
    expect(print).not.toHaveBeenCalled();
  });

  it("ad17_failed_refetch_does_not_print", async () => {
    const { fetchMock, observer, unsubscribe } = setup([json("2026-11-23T13:05:00Z"), failure]);
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    const print = vi.fn();
    const flow = createPrintFlow(print);

    const error = await flow.request(() => observer.refetch());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error?.message).toBe("The server is not available.");
    flow.committed(Date.now() + 1_000);
    expect(print).not.toHaveBeenCalled();
    unsubscribe();
  });
});
