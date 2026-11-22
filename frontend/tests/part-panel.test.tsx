import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocationChip, locationChipHref } from "@/components/common/location-chip";
import {
  CLOSE_LABEL,
  NO_CURRENT_LOCATION,
  NO_PICK_GROUPS,
  PartFacts,
  PartPanel,
  PartPanelFrame,
} from "@/components/common/part-panel";
import type { LocationRef, PartDetail } from "@/lib/api/plans";
import { picksLine, sharedJobsText, thresholdText } from "@/lib/copy";
import { parseLocationParams, planStepHref } from "@/lib/view-state/urls";
import { NO_CURRENT_LOCATION as PARTS_NO_CURRENT_LOCATION } from "@/modules/parts/parts-page";

// Story 2.6: the part panel and location chips (FR-13, FR-20, UX-DR24, UX-DR25). Rendered to
// static markup; Vitest has no DOM.

function ref(code: string, aisle: string): LocationRef {
  return { code, aisle, level: "1", section: "1", position: "1", is_best: false };
}

const DETAIL: PartDetail = {
  version: 1,
  part: "2400",
  description: "Brake pad - Volvo V70",
  movement_class: "fast",
  picks: 1234,
  class_threshold: { min_picks: 24, max_picks: null },
  total_stock: "1500.5",
  current_location: ref("C-01-01-02", "C"),
  other_locations: [{ location: ref("A-01-02-01", "A"), stock: "2" }],
  pick_groups: [
    { partner: { part: "5000", description: "Engine oil 5W-30", aisle: "A" }, shared_jobs: 8 },
    { partner: { part: "1008614-00", description: "Oil filter", aisle: null }, shared_jobs: 1 },
  ],
};

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("uxdr24 picks line per class", () => {
  it("uxdr24_fr13_threshold_text_from_server_limits", () => {
    expect(thresholdText({ min_picks: 24, max_picks: null })).toBe("24 or more");
    expect(thresholdText({ min_picks: 6, max_picks: 23 })).toBe("6–23");
    expect(thresholdText({ min_picks: 1, max_picks: 5 })).toBe("1–5");
    expect(thresholdText({ min_picks: 0, max_picks: 0 })).toBe("0");
    expect(thresholdText({ min_picks: 1000, max_picks: 1999 })).toBe("1,000–1,999");
  });

  it("uxdr24_fr13_picks_line", () => {
    expect(picksLine(61, { min_picks: 24, max_picks: null })).toBe("61 picks in the period (24 or more)");
    expect(picksLine(12, { min_picks: 6, max_picks: 23 })).toBe("12 picks in the period (6–23)");
    expect(picksLine(1, { min_picks: 1, max_picks: 5 })).toBe("1 pick in the period (1–5)");
    expect(picksLine(0, { min_picks: 0, max_picks: 0 })).toBe("0 picks in the period (0)");
    expect(picksLine(1234, { min_picks: 24, max_picks: null })).toBe("1,234 picks in the period (24 or more)");
  });

  it("fr20_shared_jobs_text", () => {
    expect(sharedJobsText(8)).toBe("8 shared jobs");
    expect(sharedJobsText(1)).toBe("1 shared job");
  });
});

describe("uxdr25 location chip", () => {
  it("uxdr25_chip_links_to_locations_at_aisle_with_row", () => {
    expect(locationChipHref("p1", { code: "B-01-01-02", aisle: "B" })).toBe(
      "/plans/p1/locations?aisle=B&loc=B-01-01-02",
    );
    const markup = renderToStaticMarkup(<LocationChip planId="p1" location={ref("B-01-01-02", "B")} />);
    expect(markup).toMatch(/^<a /);
    expect(markup).toContain('href="/plans/p1/locations?aisle=B&amp;loc=B-01-01-02"');
    expect(markup).toContain("type-code-table");
    expect(markup).toContain("h-control-sm");
    expect(markup).toContain("border-ink");
    expect(markup).toContain("rounded-sm");
  });
});

describe("uxdr24 part panel", () => {
  it("uxdr24_fr13_fr20_part_facts_markup", () => {
    const markup = renderToStaticMarkup(<PartFacts planId="p1" detail={DETAIL} />);
    const plain = text(markup);
    expect(plain).toContain("Brake pad - Volvo V70");
    expect(plain).toContain("Fast-moving");
    expect(markup).toMatch(/<svg[^>]*data-class="fast"/);
    expect(plain).toContain("1,234 picks in the period (24 or more)");
    expect(plain).toContain("1,500.5");
    expect(markup).toContain('data-location-chip="C-01-01-02"');
    expect(markup).toContain('href="/plans/p1/locations?aisle=A&amp;loc=A-01-02-01"');
    expect(plain).toContain("stock 2");
    expect(plain).toContain("5000 Engine oil 5W-30 8 shared jobs · Aisle A");
    expect(plain).toContain("1008614-00 Oil filter 1 shared job · No current location");
    expect(plain).not.toContain(NO_PICK_GROUPS);
  });

  it("uxdr24_fr13_no_current_location_and_no_pick_groups", () => {
    const detail: PartDetail = {
      ...DETAIL,
      movement_class: "dead",
      picks: 0,
      class_threshold: { min_picks: 0, max_picks: 0 },
      total_stock: "0",
      current_location: null,
      other_locations: [],
      pick_groups: [],
    };
    const plain = text(renderToStaticMarkup(<PartFacts planId="p1" detail={detail} />));
    expect(plain).toContain(NO_CURRENT_LOCATION);
    expect(plain).toContain("0 picks in the period (0)");
    expect(plain).toContain(NO_PICK_GROUPS);
    expect(NO_CURRENT_LOCATION).toBe(PARTS_NO_CURRENT_LOCATION);
  });

  it("uxdr24_panel_frame_is_a_labelled_aside_with_focusable_heading", () => {
    const markup = renderToStaticMarkup(
      <PartPanelFrame part="2400" onClose={() => {}}>
        <p>facts</p>
      </PartPanelFrame>,
    );
    expect(markup).toMatch(/^<aside aria-labelledby="([^"]+)"/);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup)![1];
    expect(markup).toMatch(new RegExp(`<h2 id="${labelledBy}" tabindex="-1" class="[^"]*type-section-title`));
    expect(markup).toContain(">2400</h2>");
    expect(markup).toContain("w-[400px]");
    expect(markup).toContain("border-l border-border bg-surface");
    expect(markup).not.toContain("shadow");
    expect(markup).toContain(`aria-label="${CLOSE_LABEL}"`);
    expect(markup).toContain('data-icon="close"');
  });
});

describe("ad12 part panel takes its detail from the page", () => {
  it("ad12_panel_shows_loading_while_the_detail_is_not_consistent_yet", () => {
    const plain = text(
      renderToStaticMarkup(
        <PartPanel planId="p1" part="2400" detail={undefined} detailError={null} onClose={() => {}} />,
      ),
    );
    expect(plain).toContain("Loading part 2400…");
    expect(plain).not.toContain("Brake pad - Volvo V70");
  });

  it("ad12_panel_shows_the_load_error_without_a_detail", () => {
    const plain = text(
      renderToStaticMarkup(
        <PartPanel
          planId="p1"
          part="2400"
          detail={undefined}
          detailError={new Error("No part 2400 in this plan.")}
          onClose={() => {}}
        />,
      ),
    );
    expect(plain).toContain("No part 2400 in this plan.");
    expect(plain).not.toContain("Loading part");
  });
});

describe("uxdr24 part in the URL", () => {
  it("uxdr24_part_param_round_trip", () => {
    const href = planStepHref("p1", "parts", { part: "1008614-00" });
    expect(href).toBe("/plans/p1/parts?part=1008614-00");
    expect(parseLocationParams(new URLSearchParams(href.split("?")[1]))).toEqual({ part: "1008614-00" });
    const both = planStepHref("p1", "locations", { aisle: "B", loc: "B-01", part: "A & B" });
    expect(both).toBe("/plans/p1/locations?aisle=B&loc=B-01&part=A+%26+B");
    expect(parseLocationParams(new URLSearchParams(both.split("?")[1]))).toEqual({ aisle: "B", loc: "B-01", part: "A & B" });
    expect(parseLocationParams({ part: ["2400", "5000"] })).toEqual({ part: "2400" });
    expect(parseLocationParams({ part: "" })).toEqual({});
  });
});
