import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LocationRow, LocationsView as LocationsData } from "@/lib/api/plans";
import { parseLocationParams, planStepHref } from "@/lib/view-state/urls";
import {
  aisleFromParams,
  countLine,
  filterLocations,
  LocationsView,
  NO_FILTERS,
  occupancyLine,
} from "@/modules/locations/locations-page";

// Story 2.4: the locations table with occupancy (FR-14, UX-DR9, UX-DR27, UX-DR57). Rendered to
// static markup; Vitest has no DOM, so filtering and URL handling are tested as pure helpers.

function row(code: string, overrides: { occupied?: boolean; is_best?: boolean } = {}): LocationRow {
  const occupied = overrides.occupied ?? true;
  return {
    location: {
      code,
      aisle: code.slice(0, 1),
      level: "1",
      section: "1",
      position: "1",
      is_best: overrides.is_best ?? false,
    },
    walk_path: "1250",
    occupied,
    contents: occupied ? [{ part: "0100", description: "Wiper blade - Volvo V70", stock: "4" }] : [],
  };
}

const ROWS = [
  row("A-01"),
  row("A-02", { occupied: false }),
  row("B-01", { is_best: true }),
  row("B-02", { occupied: false, is_best: true }),
  row("C-01"),
];

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function codes(rows: readonly LocationRow[]): string[] {
  return rows.map((entry) => entry.location.code);
}

describe("fr14 occupancy line", () => {
  it("fr14_occupancy_line", () => {
    expect(
      occupancyLine("Whole warehouse", { locations: 2000, occupied: 1584, empty: 416, occupied_percent: "79.2" }),
    ).toBe("Whole warehouse · 79.2% occupied · 1,584 of 2,000 locations · 416 empty");
    expect(occupancyLine("Aisle A", { locations: 9, occupied: 8, empty: 1, occupied_percent: "88.9" })).toBe(
      "Aisle A · 88.9% occupied · 8 of 9 locations · 1 empty",
    );
    expect(occupancyLine("Aisle Z", { locations: 1, occupied: 1, empty: 0, occupied_percent: "100.0" })).toBe(
      "Aisle Z · 100.0% occupied · 1 of 1 location · 0 empty",
    );
  });

  it("fr14_count_line", () => {
    expect(countLine(2000, 2000, false)).toBe("2,000 locations");
    expect(countLine(223, 2000, true)).toBe("223 of 2,000 locations");
  });
});

describe("fr14 filter locations", () => {
  it("fr14_filter_locations", () => {
    expect(codes(filterLocations(ROWS, NO_FILTERS))).toEqual(codes(ROWS));
    expect(codes(filterLocations(ROWS, { ...NO_FILTERS, aisle: "B" }))).toEqual(["B-01", "B-02"]);
    expect(codes(filterLocations(ROWS, { ...NO_FILTERS, occupancy: "occupied" }))).toEqual(["A-01", "B-01", "C-01"]);
    expect(codes(filterLocations(ROWS, { ...NO_FILTERS, occupancy: "empty" }))).toEqual(["A-02", "B-02"]);
    expect(codes(filterLocations(ROWS, { ...NO_FILTERS, best: "best" }))).toEqual(["B-01", "B-02"]);
    expect(codes(filterLocations(ROWS, { ...NO_FILTERS, best: "not-best" }))).toEqual(["A-01", "A-02", "C-01"]);
    expect(codes(filterLocations(ROWS, { aisle: "B", occupancy: "empty", best: "best" }))).toEqual(["B-02"]);
    expect(codes(filterLocations(ROWS, { aisle: "A", occupancy: "occupied", best: "not-best" }))).toEqual(["A-01"]);
  });
});

describe("uxdr9 location params", () => {
  it("uxdr9_location_params", () => {
    expect(planStepHref("p1", "locations")).toBe("/plans/p1/locations");
    expect(planStepHref("p1", "locations", {})).toBe("/plans/p1/locations");
    expect(planStepHref("p1", "locations", { aisle: "B" })).toBe("/plans/p1/locations?aisle=B");
    expect(planStepHref("p1", "locations", { aisle: "", loc: "B-01 & 2" })).toBe("/plans/p1/locations?loc=B-01+%26+2");
    expect(planStepHref("p 1", "locations", { aisle: "B", loc: "B-01" })).toBe("/plans/p%201/locations?aisle=B&loc=B-01");

    expect(parseLocationParams({ aisle: ["B", "C"], loc: "B-01" })).toEqual({ aisle: "B", loc: "B-01" });
    expect(parseLocationParams({ aisle: "", loc: undefined })).toEqual({});
    expect(parseLocationParams(new URLSearchParams("aisle=A&aisle=B&loc=&x=1"))).toEqual({ aisle: "A" });
  });

  it("uxdr9_unknown_aisle_shows_all_aisles", () => {
    const aisles = [{ aisle: "A" }, { aisle: "B" }];
    expect(aisleFromParams({ aisle: "B" }, aisles)).toBe("B");
    expect(aisleFromParams({ aisle: "Z" }, aisles)).toBe("");
    expect(aisleFromParams({}, aisles)).toBe("");
  });
});

describe("uxdr57 occupancy in words", () => {
  const view: LocationsData = {
    version: 1,
    locations: ROWS,
    aisles: [
      { aisle: "A", locations: 2, occupied: 1, empty: 1, occupied_percent: "50.0" },
      { aisle: "B", locations: 2, occupied: 1, empty: 1, occupied_percent: "50.0" },
      { aisle: "C", locations: 1, occupied: 1, empty: 0, occupied_percent: "100.0" },
    ],
    warehouse: { locations: 5, occupied: 3, empty: 2, occupied_percent: "60.0" },
  };

  it("uxdr57_occupancy_in_words", () => {
    const markup = renderToStaticMarkup(<LocationsView view={view} />);
    expect(markup).toContain('data-occupancy="occupied">Occupied<');
    expect(markup).toContain('data-occupancy="empty">Empty<');
    const plain = text(markup);
    expect(plain).toContain("Whole warehouse · 60.0% occupied · 3 of 5 locations · 2 empty");
    expect(plain).toContain("Aisle C · 100.0% occupied · 1 of 1 location · 0 empty");
    expect(plain).toContain("5 locations");
    expect(plain).toContain("None");
    expect(plain).toContain("stock 4");
    expect(plain).toContain("1,250");
  });

  it("uxdr9_aisle_from_url_filters_rows", () => {
    const markup = renderToStaticMarkup(<LocationsView view={view} params={{ aisle: "B", loc: "B-02" }} />);
    const plain = text(markup);
    expect(plain).toContain("2 of 5 locations");
    expect(plain).toContain("B-01");
    expect(plain).not.toContain("A-01");
  });
});
