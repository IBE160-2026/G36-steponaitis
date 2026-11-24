import jsQR from "jsqr";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AisleLabels, importLabelsKey, type LabelsView as LabelsData } from "@/lib/api/imports";
import { labelsCountLine, labelsHeading } from "@/lib/copy";
import { planLabelsHref } from "@/lib/view-state/urls";
import { chooseAisle, LabelsLoadFailed, LabelsView } from "@/modules/labels/labels-page";

// Story 14.1: the location labels print view (FR-48, NFR-9). Rendered to static markup; Vitest has
// no DOM, so the QR codes are rasterised from the rendered path and decoded with jsQR.

const PLAN = "11111111-2222-3333-4444-555555555555";

function aisle(name: string, codes: string[]): AisleLabels {
  return {
    aisle: name,
    locations: codes.map((code) => ({ code, aisle: name, level: "1", section: null, position: null, is_best: false })),
  };
}

// Server order, deliberately not sorted; mixed code patterns and lowercase.
const A_CODES = ["A-19-03-01", "A-01-01-10", "a-2b", "A1", "A-01-01-02", "R-12-x-9", "a-01-01-01-C1"];
const LABELS: LabelsData = { aisles: [aisle("A", A_CODES), aisle("B", ["B-01-01-01", "B-01-01-02"])] };

function html(props: Partial<Parameters<typeof LabelsView>[0]> = {}): string {
  return renderToStaticMarkup(<LabelsView planId={PLAN} labels={LABELS} aisle={LABELS.aisles[0]} {...props} />);
}

function labelCodes(markup: string): string[] {
  return [...markup.matchAll(/data-label="([^"]*)"/g)].map((match) => match[1]);
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fr48 location labels", () => {
  it("test_fr48_qr_encodes_exact_code", () => {
    const markup = html();
    const labels = markup.split("<div data-label=").slice(1);
    expect(labels).toHaveLength(A_CODES.length);
    for (const label of labels) {
      const code = /^"([^"]*)"/.exec(label)?.[1];
      const svg = label.slice(label.indexOf("<svg"), label.indexOf("</svg>"));
      expect(svg).toContain('role="img"');
      expect(svg).toContain(`aria-label="QR code ${code}"`);
      expect(decode(svg)).toBe(code);
    }
  });

  it("fr48_labels_render_in_response_order_one_per_location", () => {
    const markup = html();
    expect(labelCodes(markup)).toEqual(A_CODES);
    const rows = markup.split("data-label-row").slice(1);
    expect(rows.map((row) => labelCodes(row.split("data-label-row")[0]).length)).toEqual([3, 3, 1]);
    for (const row of markup.match(/<div data-label-row[^>]*>/g) ?? []) expect(row).toContain("break-inside-avoid");
    expect(markup).toContain(labelsHeading("A"));
    expect(markup).toContain(labelsCountLine(A_CODES.length));
    expect(labelsHeading("A")).toBe("Location labels · Aisle A");
    expect(labelsCountLine(123)).toBe("123 labels");
    expect(labelsCountLine(1)).toBe("1 label");
    // The picker lists every server aisle in order, the shown one selected.
    expect([...markup.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1])).toEqual(["A", "B"]);
    expect(markup).toMatch(/<option[^>]*value="A" selected=""/);
    const b = html({ aisle: LABELS.aisles[1] });
    expect(labelCodes(b)).toEqual(["B-01-01-01", "B-01-01-02"]);
    expect(b).toMatch(/<option[^>]*value="B" selected=""/);
  });

  it("fr48_toolbar_is_print_hidden_and_paper_prints_bare", () => {
    const markup = html();
    expect(markup).toMatch(/data-labels-toolbar[^>]*print:hidden/);
    expect(markup).toMatch(/data-paper[^>]*print:p-0[^>]*print:shadow-none/);
    expect(markup).toContain("h-[36mm]");
    expect(markup).toContain("grid-cols-3");
    expect(markup).toContain("font-code text-[20pt]");
    expect(importLabelsKey("imp")).toEqual(["import", "imp", "labels"]);
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
