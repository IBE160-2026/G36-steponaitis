import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchImportLayout,
  importLayoutKey,
  importLayoutQueryOptions,
  importRootKey,
  type LayoutView,
} from "@/lib/api/imports";
import { planRootKey, planSummaryKey } from "@/lib/api/plans";
import { CommandClient } from "@/lib/commands";

// Story 10.1: the import-scoped wall layout query (FR-42, AD-3, AD-15). fetch is mocked.

const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";
const IMPORT = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const MARK_A = { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } } as const;

const LAYOUT: LayoutView = {
  aisles: [
    {
      aisle: "A",
      source: "columns",
      walk_path_first: "0",
      walk_path_last: "10",
      runs: [{ levels: ["1"], columns: 2, sections: [{ section: "1", first_column: 0, columns: 2 }] }],
      cells: [
        {
          run: 0,
          row: 0,
          column: 0,
          gap: false,
          location: { code: "A-1-1-1", aisle: "A", level: "1", section: "1", position: "1", is_best: false },
        },
        { run: 0, row: 0, column: 1, gap: true, location: null },
      ],
    },
  ],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.unstubAllGlobals();
});

describe("fr42 import layout query", () => {
  it("fr42_layout_key_is_import_scoped_outside_every_plan_key", () => {
    expect(importRootKey(IMPORT)).toEqual(["import", IMPORT]);
    expect(importLayoutKey(IMPORT)).toEqual(["import", IMPORT, "layout"]);
    expect(importLayoutKey(IMPORT)[0]).not.toBe(planRootKey(PLAN)[0]);
  });

  it("fr42_layout_query_is_never_stale_and_never_collected", () => {
    const options = importLayoutQueryOptions(IMPORT);
    expect(options.queryKey).toEqual(importLayoutKey(IMPORT));
    expect(options.staleTime).toBe(Infinity);
    expect(options.gcTime).toBe(Infinity);
  });

  it("fr42_layout_fetches_the_import_layout_url", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return json(200, LAYOUT);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchImportLayout(IMPORT)).resolves.toEqual(LAYOUT);
    expect(fetchMock).toHaveBeenCalledWith(`/api/imports/${IMPORT}/layout`);
  });

  it("fr42_layout_unknown_import_throws_not_found", async () => {
    const message = "This import no longer exists. Choose another saved plan.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(404, { error: { code: "not_found", message, details: [] } })),
    );
    await expect(fetchImportLayout(IMPORT)).rejects.toMatchObject({ code: "not_found", message });
  });

  it("fr42_layout_is_not_refetched_after_a_confirmed_command", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const layoutFn = vi.fn(async () => LAYOUT);
    const summaryFn = vi.fn(async () => ({ version: 5 }));
    queryClient.setQueryData(importLayoutKey(IMPORT), LAYOUT);
    queryClient.setQueryData(planSummaryKey(PLAN), { version: 4 });
    const layoutObserver = new QueryObserver(queryClient, { ...importLayoutQueryOptions(IMPORT), queryFn: layoutFn });
    const summaryObserver = new QueryObserver(queryClient, {
      queryKey: planSummaryKey(PLAN),
      queryFn: summaryFn,
      staleTime: Infinity,
    });
    cleanups.push(layoutObserver.subscribe(() => {}), summaryObserver.subscribe(() => {}));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(200, { version: 5, events: [] })),
    );
    const client = new CommandClient(
      queryClient,
      { notify: vi.fn(), navigate: vi.fn(), sessionExpired: vi.fn(async () => {}) },
      { sleep: async () => {}, randomId: () => "cmd-1" },
    );

    expect(await client.send(PLAN, MARK_A)).toBe("confirmed");

    expect(summaryFn).toHaveBeenCalled();
    expect(layoutFn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(importLayoutKey(IMPORT))).toBe(LAYOUT);
  });
});
