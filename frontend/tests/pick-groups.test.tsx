import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickGroupRow, PickGroupsView as PickGroupsData } from "@/lib/api/plans";
import { emptyMessage, groupCountLine, PickGroupsView } from "@/modules/pick-groups/pick-groups-page";

// Story 2.5: the pick groups table (FR-20, UX-DR29). Rendered to static markup; Vitest has no DOM.

function group(
  a: [string, string | null],
  b: [string, string | null],
  shared_jobs: number,
  same_aisle: boolean,
): PickGroupRow {
  return {
    part_a: { part: a[0], description: `Description ${a[0]}`, aisle: a[1] },
    part_b: { part: b[0], description: `Description ${b[0]}`, aisle: b[1] },
    shared_jobs,
    same_aisle,
  };
}

// Server order is kept even where it is not the shared-jobs order the server would send.
const ROWS = [
  group(["8100", "A"], ["8200", "B"], 1234, false),
  group(["9100", "D"], ["9200", "D"], 6, true),
  group(["1008614-00", null], ["2300", "C"], 7, false),
  // Equal aisles but the server says not the same aisle: the server flag wins (AD-3).
  group(["5000", "A"], ["5100", "A"], 5, false),
];

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("fr20 group count line", () => {
  it("fr20_group_count_line", () => {
    expect(groupCountLine(10)).toBe("10 pick groups");
    expect(groupCountLine(1)).toBe("1 pick group");
    expect(groupCountLine(1500)).toBe("1,500 pick groups");
  });
});

describe("uxdr29 pick groups table", () => {
  it("uxdr29_pick_groups_table_markup", () => {
    const view: PickGroupsData = { version: 1, min_shared_jobs: 5, pick_groups: ROWS };
    const markup = renderToStaticMarkup(<PickGroupsView view={view} />);
    const plain = text(markup);
    expect(markup).toContain('aria-label="Pick groups"');
    expect(plain).toContain("4 pick groups");
    for (const head of ["Part A", "Part B", "Shared jobs", "Aisle of part A", "Aisle of part B", "Same aisle"]) {
      expect(plain).toContain(head);
    }
    expect(plain).toContain("8100 Description 8100");
    expect(plain).toContain("8200 Description 8200");
    expect(plain).toContain("1,234");
    expect(markup).toMatch(/data-same-aisle="true"[^>]*><svg[^>]*data-icon="link"/);
    expect(markup).toContain("Same aisle</span>");
    expect(markup).toContain('data-same-aisle="false">Different aisles<');
    expect(plain).toContain("No current location");
    const serverFlag = markup.slice(markup.indexOf(">5000<"));
    expect(serverFlag).toContain('data-same-aisle="false">Different aisles<');
    expect(serverFlag).not.toContain('data-same-aisle="true"');
    const order = ["8100", "9100", "1008614-00", "5000"].map((part) => plain.indexOf(`${part} Description`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(plain).not.toContain(emptyMessage(5));
  });

  it("uxdr29_empty_state", () => {
    const markup = renderToStaticMarkup(<PickGroupsView view={{ version: 1, min_shared_jobs: 5, pick_groups: [] }} />);
    expect(text(markup)).toContain("No pick groups: no two parts share 5 or more jobs in the period.");
    expect(markup).not.toContain("<table");
    expect(text(markup)).not.toMatch(/\d pick group/);
  });

  it("fr20_empty_message_uses_the_servers_min_shared_jobs", () => {
    expect(emptyMessage(5)).toBe("No pick groups: no two parts share 5 or more jobs in the period.");
    expect(emptyMessage(3)).toBe("No pick groups: no two parts share 3 or more jobs in the period.");
    const markup = renderToStaticMarkup(<PickGroupsView view={{ version: 2, min_shared_jobs: 3, pick_groups: [] }} />);
    expect(text(markup)).toContain(emptyMessage(3));
    expect(text(markup)).not.toContain("share 5 or more");
  });
});
