import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { cappedLine, isSearchShortcut, noMatchText, SearchResults } from "@/components/common/search-field";
import type { LocationRef, SearchView } from "@/lib/api/plans";

// Story 2.6: the search field (FR-15, UX-DR8, UX-DR11). Rendered to static markup; Vitest has no DOM.

function ref(code: string, aisle: string): LocationRef {
  return { code, aisle, level: "1", section: null, position: null, is_best: false };
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const noop = () => {};

describe("uxdr8 search shortcut", () => {
  it("uxdr8_ctrl_or_meta_slash_focuses_plain_slash_never", () => {
    const base = { key: "/", ctrlKey: false, metaKey: false, altKey: false };
    expect(isSearchShortcut({ ...base, ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ ...base, metaKey: true })).toBe(true);
    expect(isSearchShortcut(base)).toBe(false);
    expect(isSearchShortcut({ ...base, ctrlKey: true, altKey: true })).toBe(false);
    expect(isSearchShortcut({ ...base, key: "k", ctrlKey: true })).toBe(false);
  });
});

describe("fr15 search results", () => {
  it("fr15_no_match_sentence", () => {
    expect(noMatchText("  zzzz ")).toBe("No part or location matches “zzzz”.");
    const view: SearchView = { version: 1, query: " zzzz", parts: [], part_count: 0, locations: [], location_count: 0 };
    const markup = renderToStaticMarkup(<SearchResults planId="p1" view={view} onOpenPart={noop} />);
    expect(text(markup).trim()).toBe("No part or location matches “zzzz”.");
    expect(markup).toContain('role="status"');
  });

  it("fr15_results_grouped_in_server_order", () => {
    const view: SearchView = {
      version: 1,
      query: "a-01",
      parts: [
        { part: "9000", description: "Zeta", movement_class: "slow" },
        { part: "1000", description: "Alpha", movement_class: "fast" },
      ],
      part_count: 2,
      locations: [{ location: ref("A-01-01-02", "A") }, { location: ref("A-01-01-01", "A") }],
      location_count: 2,
    };
    const markup = renderToStaticMarkup(<SearchResults planId="p1" view={view} onOpenPart={noop} />);
    const plain = text(markup);
    expect(plain.indexOf("Parts")).toBeLessThan(plain.indexOf("9000"));
    expect(plain.indexOf("9000")).toBeLessThan(plain.indexOf("1000"));
    expect(plain.indexOf("1000")).toBeLessThan(plain.indexOf("Locations"));
    expect(plain.indexOf("A-01-01-02")).toBeLessThan(plain.indexOf("A-01-01-01"));
    expect(markup).toMatch(/<button type="button" data-search-part="9000"/);
    expect(markup).toContain('href="/plans/p1/locations?aisle=A&amp;loc=A-01-01-02"');
    expect(plain).not.toContain(" of ");
  });

  it("fr15_capped_lists_show_shown_of_count", () => {
    expect(cappedLine(20, 1545)).toBe("20 of 1,545");
    expect(cappedLine(3, 3)).toBeNull();
    const parts = Array.from({ length: 20 }, (_, i) => ({
      part: `P${i}`,
      description: `Part ${i}`,
      movement_class: "dead" as const,
    }));
    const view: SearchView = { version: 1, query: "a", parts, part_count: 1545, locations: [], location_count: 0 };
    const plain = text(renderToStaticMarkup(<SearchResults planId="p1" view={view} onOpenPart={noop} />));
    expect(plain).toContain("Parts 20 of 1,545");
    expect(plain).toContain("Locations No locations");
  });
});
