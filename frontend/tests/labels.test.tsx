import jsQR from "jsqr";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import * as importsApi from "@/lib/api/imports";
import { type AisleLabels, type LabelsView as LabelsData, planLabelsKey, planRootKey } from "@/lib/api/plans";
import {
  LABELS_AFTER_MOVES,
  LABELS_EMPTY_AISLE,
  LABELS_LOAD_FAILED,
  LABELS_PRINT_BUSY,
  labelsCountLine,
  labelsHeading,
  NO_LABELS_TO_PRINT,
} from "@/lib/copy";
import { planLabelsHref } from "@/lib/view-state/urls";
import { chooseAisle, LabelsLoadFailed, LabelsView } from "@/modules/labels/labels-page";

// Story 14.1: the location labels print view (FR-48, NFR-9). A label is one (location, part): the
// location code in large text, the part number in small text and a QR code of the part number
// (decided 2026-11-28). Rendered to static markup; Vitest has no DOM, so the QR codes are
// rasterised from the rendered path and decoded with jsQR.

const PLAN = "11111111-2222-3333-4444-555555555555";

type Pair = readonly [code: string, part: string];

function aisle(name: string, pairs: readonly Pair[]): AisleLabels {
  return {
    aisle: name,
    labels: pairs.map(([code, part]) => ({
      location: { code, aisle: name, level: "1", section: null, position: null, is_best: false },
      part,
    })),
  };
}

// Server order, deliberately not sorted: mixed code and part patterns, lowercase, a part number
// that looks like a location code, and one location with two parts (two labels, P1 then P2).
const A_PAIRS: readonly Pair[] = [
  ["A-19-03-01", "70455"],
  ["A-01-01-10", "P1"],
  ["A-01-01-10", "P2"],
  ["a-2b", "ab-12/x"],
  ["A1", "0100"],
  ["A-01-01-02", "B-01-01-01"],
  ["R-12-x-9", "30400 3050"],
  ["a-01-01-01-C1", "XK-2000-55-LONG.PART_1"],
];
const A_CODES = A_PAIRS.map(([code]) => code);
const A_PARTS = A_PAIRS.map(([, part]) => part);
const B_PAIRS: readonly Pair[] = [
  ["B-01-01-01", "Q1"],
  ["B-01-01-02", "Q2"],
];
const LABELS: LabelsData = { version: 1, aisles: [aisle("A", A_PAIRS), aisle("B", B_PAIRS), aisle("C", [])] };

function html(props: Partial<Parameters<typeof LabelsView>[0]> = {}): string {
  return renderToStaticMarkup(<LabelsView planId={PLAN} labels={LABELS} aisle={LABELS.aisles[0]} {...props} />);
}

function labelCodes(markup: string): string[] {
  return [...markup.matchAll(/data-label="([^"]*)"/g)].map((match) => match[1]);
}

function labelParts(markup: string): string[] {
  return [...markup.matchAll(/data-label-part="([^"]*)"/g)].map((match) => match[1]);
}

const SCALE = 4;

/** Rasterises one rendered QR `<svg>` at `SCALE` px per module and decodes it with jsQR. */
function decode(svg: string): string | undefined {
  const size = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)?.[1]);
  const d = /<path d="([^"]*)"/.exec(svg)?.[1] ?? "";
  const width = size * SCALE;
  const rgba = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const [, x, y] of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const offset = ((Number(y) * SCALE + dy) * width + Number(x) * SCALE + dx) * 4;
        rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0;
      }
    }
  }
  return jsQR(rgba, width, width)?.data;
}

/** Every element of a React tree (function components are not called). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

/** The view's one primary button (Print), as a React element. */
function printButton(props: Partial<Parameters<typeof LabelsView>[0]> = {}): ReactElement<Record<string, unknown>> {
  const tree = LabelsView({ planId: PLAN, labels: LABELS, aisle: LABELS.aisles[0], ...props });
  const primaries = elements(tree).filter((element) => element.props.variant === "primary");
  expect(primaries).toHaveLength(1);
  return primaries[0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fr48 location labels", () => {
  it("test_fr48_qr_encodes_exact_code", () => {
    const markup = html();
    const labels = markup.split("<div data-label=").slice(1);
    expect(labels).toHaveLength(A_PAIRS.length);
    labels.forEach((label, index) => {
      const [code, part] = A_PAIRS[index];
      expect(/^"([^"]*)"/.exec(label)?.[1]).toBe(code);
      expect(/data-label-part="([^"]*)"/.exec(label)?.[1]).toBe(part);
      const svg = label.slice(label.indexOf("<svg"), label.indexOf("</svg>"));
      expect(svg).toContain('role="img"');
      expect(svg).toContain(`aria-label="QR code ${part}"`);
      // The QR code gives the part number and nothing else: never the location code.
      const decoded = decode(svg);
      expect(decoded).toBe(part);
      expect(decoded).not.toBe(code);
      // The same label prints the location code large and the decoded part number small.
      const spans = [...label.split("data-label-row")[0].matchAll(/<span([^>]*)>([^<]*)<\/span>/g)];
      expect(spans.map((span) => span[2])).toEqual([code, part]);
      expect(spans[0][1]).toContain("text-[20pt]");
      expect(spans[1][1]).toContain("data-label-part-text");
      expect(spans[1][1]).toContain("text-[9pt]");
      // A part number wider than the card ends with an ellipsis instead of being cut on both sides.
      expect(spans[1][1]).toContain("max-w-full truncate px-[1mm]");
    });
  });

  it("fr48_labels_render_in_response_order_one_per_location_and_part", () => {
    const markup = html();
    expect(labelCodes(markup)).toEqual(A_CODES);
    expect(labelParts(markup)).toEqual(A_PARTS);
    // A location with two parts gets two labels, in the server's part order.
    expect(labelCodes(markup).filter((code) => code === "A-01-01-10")).toHaveLength(2);
    const rows = markup.split("data-label-row").slice(1);
    expect(rows.map((row) => labelCodes(row.split("data-label-row")[0]).length)).toEqual([3, 3, 2]);
    for (const row of markup.match(/<div data-label-row[^>]*>/g) ?? []) expect(row).toContain("break-inside-avoid");
    expect(markup).toContain(labelsHeading("A"));
    expect(markup).toContain(labelsCountLine(A_PAIRS.length));
    expect(markup).not.toContain("data-labels-empty");
    expect(labelsHeading("A")).toBe("Location labels · Aisle A");
    expect(labelsCountLine(123)).toBe("123 labels");
    expect(labelsCountLine(1)).toBe("1 label");
    // The picker lists every server aisle in order, the shown one selected.
    expect([...markup.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1])).toEqual(["A", "B", "C"]);
    expect(markup).toMatch(/<option[^>]*value="A" selected=""/);
    const b = html({ aisle: LABELS.aisles[1] });
    expect(labelCodes(b)).toEqual(["B-01-01-01", "B-01-01-02"]);
    expect(labelParts(b)).toEqual(["Q1", "Q2"]);
    expect(b).toMatch(/<option[^>]*value="B" selected=""/);
  });

  it("fr48_aisle_without_stock_shows_an_empty_paper_and_says_so", () => {
    const markup = html({ aisle: LABELS.aisles[2] });
    // The aisle is in the picker and selected; the paper is there, with no row, label or QR code.
    expect(markup).toMatch(/<option[^>]*value="C" selected=""/);
    expect(markup).toContain("data-paper");
    expect(markup).not.toContain("data-label-row");
    expect(labelCodes(markup)).toEqual([]);
    expect(markup).not.toContain("<svg");
    expect(markup).toMatch(/data-labels-count[^>]*>0 labels</);
    expect(labelsCountLine(0)).toBe("0 labels");
    expect(LABELS_EMPTY_AISLE).toBe("No parts are stocked in this aisle.");
    // The line is in the toolbar, which never prints.
    const toolbar = markup.slice(markup.indexOf("data-labels-toolbar"), markup.indexOf("data-paper"));
    expect(toolbar).toMatch(new RegExp(`data-labels-empty[^>]*>${LABELS_EMPTY_AISLE}<`));
    // Nothing to print: Print is disabled and says why.
    expect(printButton({ aisle: LABELS.aisles[2] }).props.disabledReason).toBe(NO_LABELS_TO_PRINT);
    expect(NO_LABELS_TO_PRINT).toBe("There are no labels to print.");
  });

  it("fr48_says_the_labels_show_the_stock_after_the_moves", () => {
    expect(LABELS_AFTER_MOVES).toBe(
      "The labels show each part where the plan puts it. Print them after the moves are carried out.",
    );
    for (const shown of [LABELS.aisles[0], LABELS.aisles[2]]) {
      const markup = html({ aisle: shown });
      // On screen only: the line is in the toolbar, which never prints.
      const toolbar = markup.slice(markup.indexOf("data-labels-toolbar"), markup.indexOf("data-paper"));
      expect(toolbar).toMatch(new RegExp(`data-labels-note[^>]*>${LABELS_AFTER_MOVES}<`));
      expect(markup.slice(markup.indexOf("data-paper"))).not.toContain(LABELS_AFTER_MOVES);
    }
  });

  it("fr48_print_waits_while_the_labels_are_fetched", () => {
    expect(printButton().props.disabledReason).toBeUndefined();
    expect(printButton().props["aria-busy"]).toBeUndefined();
    const busy = printButton({ fetching: true });
    expect(busy.props.disabledReason).toBe(LABELS_PRINT_BUSY);
    expect(busy.props["aria-busy"]).toBe(true);
    expect(LABELS_PRINT_BUSY).toBe("Getting the latest labels…");
    // The paper stays while the refetch runs; no error shows.
    const markup = html({ fetching: true });
    expect(labelCodes(markup)).toEqual(A_CODES);
    expect(markup).not.toContain("data-labels-error");
  });

  it("fr48_failed_refetch_shows_the_error_above_the_paper_and_disables_print", () => {
    const error = new Error("The plan is busy. Try again.");
    const markup = html({ error });
    // The error is on screen only, between the toolbar and the stale paper.
    const alert = /<div data-labels-error="true" class="print:hidden"><p role="alert"[^>]*>([^<]*)<\/p><\/div>/.exec(markup);
    expect(alert?.[1]).toBe("The plan is busy. Try again.");
    expect(markup.indexOf("data-labels-toolbar")).toBeLessThan(markup.indexOf("data-labels-error"));
    expect(markup.indexOf("data-labels-error")).toBeLessThan(markup.indexOf("data-paper"));
    expect(labelCodes(markup)).toEqual(A_CODES);
    expect(printButton({ error }).props.disabledReason).toBe(LABELS_LOAD_FAILED);
    // A new fetch after the failure says it is fetching; an error without a message has the default.
    expect(printButton({ error, fetching: true }).props.disabledReason).toBe(LABELS_PRINT_BUSY);
    expect(html({ error: new Error("") })).toMatch(new RegExp(`role="alert"[^>]*>${LABELS_LOAD_FAILED}<`));
    // A deleted plan is left to the shared query hook: no message here.
    const deleted = new ApiError(404, "plan_not_found", "This plan does not exist.");
    expect(html({ error: deleted })).not.toContain("data-labels-error");
    expect(printButton({ error: deleted }).props.disabledReason).toBeUndefined();
  });

  it("fr48_toolbar_is_print_hidden_and_paper_prints_bare", () => {
    const markup = html();
    expect(markup).toMatch(/data-labels-toolbar[^>]*print:hidden/);
    expect(markup).toMatch(/data-paper[^>]*print:p-0[^>]*print:shadow-none/);
    expect(markup).toContain("h-[36mm]");
    expect(markup).toContain("grid-cols-3");
    expect(markup).toContain("font-code text-[20pt]");
    // The QR code is at least 20mm wide and never shrinks to fit.
    expect(markup).toContain("size-[22mm] shrink-0");
  });

  it("fr48_labels_query_is_plan_scoped", () => {
    // Under `['plan', planId]`, so a confirmed command refetches the labels.
    expect(planLabelsKey(PLAN)).toEqual([...planRootKey(PLAN), "labels"]);
    expect(planLabelsKey(PLAN)).toEqual(["plan", PLAN, "labels"]);
    // No import-scoped labels client is left behind.
    expect(Object.keys(importsApi).filter((name) => /labels/i.test(name))).toEqual([]);
  });

  it("fr48_print_calls_window_print", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });
    const tree = LabelsView({ planId: PLAN, labels: LABELS, aisle: LABELS.aisles[0] });
    const primaries = elements(tree).filter((element) => element.props.variant === "primary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0].props.children).toBe("Print");
    (primaries[0].props.onClick as () => void)();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("fr48_plan_labels_href", () => {
    expect(planLabelsHref(PLAN)).toBe(`/plans/${PLAN}/labels`);
    expect(planLabelsHref(PLAN, "B")).toBe(`/plans/${PLAN}/labels?aisle=B`);
    expect(planLabelsHref("a b", "A 1")).toBe("/plans/a%20b/labels?aisle=A+1");
  });

  it("fr48_aisle_choice_falls_back_to_the_first_server_aisle", () => {
    expect(chooseAisle(LABELS.aisles, "B")?.aisle).toBe("B");
    expect(chooseAisle(LABELS.aisles, "A")?.aisle).toBe("A");
    expect(chooseAisle(LABELS.aisles, undefined)?.aisle).toBe("A");
    expect(chooseAisle(LABELS.aisles, "ZZ")?.aisle).toBe("A");
    expect(chooseAisle(LABELS.aisles, "b")?.aisle).toBe("A");
    expect(chooseAisle([], "A")).toBeUndefined();
  });

  it("fr48_load_error_shows_the_message_and_no_paper", () => {
    const markup = renderToStaticMarkup(<LabelsLoadFailed error={new Error("This import no longer exists.")} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("This import no longer exists.");
    expect(markup).not.toContain("data-paper");
  });
});
