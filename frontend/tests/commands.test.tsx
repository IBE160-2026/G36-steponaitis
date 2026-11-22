import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/common/app-shell";
import { PlanPlate } from "@/components/common/app-shell/plan-plate";
import { SaveStatusView } from "@/components/common/app-shell/save-status";
import { Button } from "@/components/common/button";
import { INTERNAL_MESSAGE, isErrorEnvelope } from "@/lib/api/errors";
import { planLocationsKey, type PlanSummary, planSummaryKey } from "@/lib/api/plans";
import { NEW_PLAN_HREF, PLAN_DELETED } from "@/lib/api/query-errors";
import {
  baseVersion,
  CommandClient,
  CommandsProvider,
  FAILED_TEXT,
  IDLE_STATE,
  isConsistent,
  latestConsistent,
  MAX_STALE_REFETCHES,
  newCommandId,
  noticeText,
  RETRY_DELAYS_MS,
  RETRYING_TEXT,
  SAVED_TEXT,
  SAVING_REASON,
  type SaveNotice,
  staleIndexes,
  useConsistentPlanData,
  useConsistentPlanQueries,
  usePlanCommands,
} from "@/lib/commands";

// Story 3.3: the client command flow and autosave (FR-10, AD-12). fetch is mocked; the
// QueryClient is real, with plan queries observed so they count as active.

// Only the shell-on-a-plan-path test sets a path; every other test sees no pathname, as before.
const nav = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => nav.path,
}));

const html = renderToStaticMarkup;
const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";
const OTHER_PLAN = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const IMPORT_KEY = ["import", "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"] as const;
const MARK_A = { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } } as const;

type Versioned = { version: number; tag?: string };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function envelope(status: number, code: string, message: string): Response {
  return json(status, { error: { code, message, details: [] } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A fetch mock that answers POSTs from a queue: a Response, an Error to throw, or a promise. */
function mockFetch(...answers: (Response | Error | Promise<Response>)[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    const next = answers.shift();
    if (next === undefined) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof mockFetch>, call: number) {
  return JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
}

const cleanups: (() => void)[] = [];

/**
 * A QueryClient with an observed summary (v4), an observed locations view (v4) and an observed
 * import query. Each queryFn returns the next value of its `serve` list (repeating the last).
 */
function setup(serve: { summary?: number[]; locations?: number[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const calls = { summary: 0, locations: 0, import: 0 };
  const serveFrom = (list: number[], n: number): Versioned => ({ version: list[Math.min(n, list.length - 1)] });
  const summaryFn = vi.fn(async () => serveFrom(serve.summary ?? [5], calls.summary++));
  const locationsFn = vi.fn(async () => serveFrom(serve.locations ?? [5], calls.locations++));
  const importFn = vi.fn(async () => ({ version: 1 }));
  queryClient.setQueryData(planSummaryKey(PLAN), { version: 4, tag: "seed" });
  queryClient.setQueryData(planLocationsKey(PLAN), { version: 4, tag: "seed" });
  queryClient.setQueryData(IMPORT_KEY, { version: 1 });
  for (const [queryKey, queryFn] of [
    [planSummaryKey(PLAN), summaryFn],
    [planLocationsKey(PLAN), locationsFn],
    [IMPORT_KEY, importFn],
  ] as const) {
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity });
    cleanups.push(observer.subscribe(() => {}));
  }
  const effects = { notify: vi.fn(), navigate: vi.fn() };
  const delays: number[] = [];
  let ids = 0;
  const client = new CommandClient(queryClient, effects, {
    sleep: async (ms) => {
      delays.push(ms);
    },
    randomId: () => `cmd-${++ids}`,
  });
  const notices: SaveNotice[] = [];
  cleanups.push(client.subscribe(() => notices.push(client.getState(PLAN).notice)));
  return { queryClient, client, effects, delays, notices, summaryFn, locationsFn, importFn };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  nav.path = null;
  while (cleanups.length) cleanups.pop()?.();
  vi.unstubAllGlobals();
});

describe("fr10 confirmed command", () => {
  it("fr10_confirmed_command_posts_once_with_new_id_and_base_version", async () => {
    const h = setup();
    const fetchMock = mockFetch(json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN).pending).toBe(true);
    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/plans/${PLAN}/commands`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(bodyOf(fetchMock, 0)).toEqual({ ...MARK_A, command_id: "cmd-1", base_version: 4 });
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: null, saved: true });
  });

  it("ad12_default_command_id_is_a_random_uuid", async () => {
    const queryClient = new QueryClient();
    const fetchMock = mockFetch(json(200, { version: 1, events: [] }), json(200, { version: 2, events: [] }));
    const client = new CommandClient(queryClient, { notify: vi.fn(), navigate: vi.fn() });
    await client.send(PLAN, MARK_A);
    await client.send(PLAN, MARK_A);
    const first = bodyOf(fetchMock, 0).command_id;
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(bodyOf(fetchMock, 1).command_id).not.toBe(first);
    // Nothing cached: base_version 0.
    expect(bodyOf(fetchMock, 0).base_version).toBe(0);
  });

  it("ad12_base_version_is_the_highest_cached_plan_version", () => {
    const queryClient = new QueryClient();
    expect(baseVersion(queryClient, PLAN)).toBe(0);
    queryClient.setQueryData(planSummaryKey(PLAN), { version: 3 });
    queryClient.setQueryData(planLocationsKey(PLAN), { version: 7 });
    queryClient.setQueryData(["plan", OTHER_PLAN, "summary"], { version: 99 });
    queryClient.setQueryData(IMPORT_KEY, { version: 50 });
    expect(baseVersion(queryClient, PLAN)).toBe(7);
  });

  it("ad12_confirm_refetches_only_plan_queries_and_never_edits_data_before", async () => {
    const h = setup();
    const response = deferred<Response>();
    mockFetch(response.promise);
    const before = h.queryClient.getQueryData(planSummaryKey(PLAN));
    const sending = h.client.send(PLAN, MARK_A);
    await Promise.resolve();
    // No optimistic update: the cached plan data is untouched while the POST is in flight.
    expect(h.queryClient.getQueryData(planSummaryKey(PLAN))).toBe(before);
    expect(h.summaryFn).not.toHaveBeenCalled();
    response.resolve(json(200, { version: 5, events: [] }));
    expect(await sending).toBe("confirmed");
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.locationsFn).toHaveBeenCalledTimes(1);
    expect(h.importFn).not.toHaveBeenCalled();
    expect(h.queryClient.getQueryData(planSummaryKey(PLAN))).toEqual({ version: 5 });
  });

  it("ad12_stale_refetch_is_retried_at_most_twice", async () => {
    const h = setup({ summary: [4] });
    mockFetch(json(200, { version: 5, events: [] }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("confirmed");
    // One refetch after the confirm, then two extra rounds for the view still at v4.
    expect(h.summaryFn).toHaveBeenCalledTimes(3);
    expect(h.locationsFn).toHaveBeenCalledTimes(1);
    expect(h.queryClient.getQueryData(planSummaryKey(PLAN))).toEqual({ version: 4 });
  });

  it("ad12_refetch_brings_views_up_to_the_highest_version_seen", async () => {
    // Another writer: the summary comes back at v6 after the v5 confirm; locations at v5 is now
    // stale and is refetched until it reaches v6.
    const h = setup({ summary: [6], locations: [5, 6] });
    mockFetch(json(200, { version: 5, events: [] }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("confirmed");
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.locationsFn).toHaveBeenCalledTimes(2);
    expect(h.queryClient.getQueryData(planLocationsKey(PLAN))).toEqual({ version: 6 });
  });

  it("ad12_refetch_to_the_highest_version_is_still_bounded", async () => {
    const h = setup({ summary: [6], locations: [5] });
    mockFetch(json(200, { version: 5, events: [] }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("confirmed");
    expect(h.locationsFn).toHaveBeenCalledTimes(1 + MAX_STALE_REFETCHES);
  });

  it("ad12_stale_refetch_stops_once_the_view_catches_up", async () => {
    const h = setup({ summary: [4, 5] });
    mockFetch(json(200, { version: 5, events: [] }));
    await h.client.send(PLAN, MARK_A);
    expect(h.summaryFn).toHaveBeenCalledTimes(2);
  });
});

describe("ad12 one command at a time", () => {
  it("ad12_second_send_for_the_same_plan_is_busy", async () => {
    const h = setup();
    const response = deferred<Response>();
    const fetchMock = mockFetch(response.promise, json(200, { version: 1, events: [] }));
    const first = h.client.send(PLAN, MARK_A);
    expect(await h.client.send(PLAN, MARK_A)).toBe("busy");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Another plan is not blocked.
    expect(await h.client.send(OTHER_PLAN, MARK_A)).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    response.resolve(json(200, { version: 5, events: [] }));
    expect(await first).toBe("confirmed");
  });

  it("ad12_pending_stays_until_the_refetch_has_finished", async () => {
    const h = setup();
    const refetch = deferred<Versioned>();
    h.summaryFn.mockImplementationOnce(() => refetch.promise);
    mockFetch(json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    await vi.waitFor(() => expect(h.summaryFn).toHaveBeenCalled());
    expect(h.client.getState(PLAN).pending).toBe(true);
    refetch.resolve({ version: 5 });
    await sending;
    expect(h.client.getState(PLAN).pending).toBe(false);
  });

  it("fr10_controls_are_disabled_with_reason_while_saving", async () => {
    const h = setup();
    const response = deferred<Response>();
    mockFetch(response.promise);
    function MarkButton() {
      const { disabledReason } = usePlanCommands(PLAN);
      return <Button disabledReason={disabledReason}>Mark</Button>;
    }
    const tree = () => (
      <QueryClientProvider client={h.queryClient}>
        <CommandsProvider effects={h.effects} client={h.client}>
          <MarkButton />
        </CommandsProvider>
      </QueryClientProvider>
    );
    expect(html(tree())).not.toContain("aria-disabled");
    const sending = h.client.send(PLAN, MARK_A);
    const during = html(tree());
    expect(during).toContain('aria-disabled="true"');
    expect(during).toContain(SAVING_REASON);
    expect(SAVING_REASON).toBe("Saving the last change…");
    response.resolve(json(200, { version: 5, events: [] }));
    await sending;
    const after = html(tree());
    expect(after).not.toContain("aria-disabled");
    expect(after).not.toContain(SAVING_REASON);
  });
});

describe("ad12 retries and failures", () => {
  it("ad12_transient_failures_retry_with_the_same_command_id", async () => {
    const h = setup();
    const fetchMock = mockFetch(new TypeError("network"), new Response("", { status: 503 }), json(200, { version: 5, events: [] }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("confirmed");
    expect(h.delays).toEqual([1000, 2000]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const bodies = [0, 1, 2].map((i) => bodyOf(fetchMock, i));
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(bodies[0].command_id).toBe("cmd-1");
    expect(h.notices).toContain("retrying");
    expect(h.client.getState(PLAN).notice).toBeNull();
    expect(noticeText("retrying")).toBe("The last change was not saved yet. Trying again.");
  });

  it("ad12_transient_exhausted_drops_refetches_and_shows_failed", async () => {
    const h = setup();
    const fetchMock = mockFetch(
      new TypeError("network"),
      new Response("bad gateway", { status: 502 }),
      new Response("", { status: 503 }),
      new Response("", { status: 504 }),
      new TypeError("network"),
    );
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(h.delays).toEqual([...RETRY_DELAYS_MS]);
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000, 8000]);
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.importFn).not.toHaveBeenCalled();
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: "failed", saved: false });
    expect(noticeText("failed")).toBe("The change was not saved. Try again.");
  });

  it("ad12_500_is_not_retried_and_shows_failed", async () => {
    const h = setup();
    const fetchMock = mockFetch(envelope(500, "internal", INTERNAL_MESSAGE));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.delays).toEqual([]);
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.client.getState(PLAN).notice).toBe("failed");
    expect(h.effects.notify).not.toHaveBeenCalled();
  });

  it("ad12_proxy_500_without_envelope_is_transient", async () => {
    // Retro 19: the backend's 500s carry the AD-11 envelope; a bare 500 is the `/api` proxy.
    const h = setup();
    const fetchMock = mockFetch(
      new Response("Internal Server Error", { status: 500, headers: { "Content-Type": "text/plain" } }),
      json(200, { version: 5, events: [] }),
    );
    expect(await h.client.send(PLAN, MARK_A)).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.delays).toEqual([1000]);
    expect(bodyOf(fetchMock, 1)).toEqual(bodyOf(fetchMock, 0));
    expect(h.notices).toContain("retrying");
    expect(h.effects.notify).not.toHaveBeenCalled();
  });

  it("ad12_proxy_500_without_envelope_exhausted_shows_failed", async () => {
    const h = setup();
    const bare = () => new Response("", { status: 500 });
    const fetchMock = mockFetch(bare(), bare(), bare(), bare(), bare());
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(h.delays).toEqual([...RETRY_DELAYS_MS]);
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: "failed", saved: false });
  });

  it("ad12_envelope_500_is_not_retried", async () => {
    const h = setup();
    const fetchMock = mockFetch(envelope(500, "internal", INTERNAL_MESSAGE));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.delays).toEqual([]);
    expect(h.client.getState(PLAN).notice).toBe("failed");
  });

  it("ad12_is_error_envelope_only_for_the_ad11_shape", () => {
    expect(isErrorEnvelope(JSON.stringify({ error: { code: "internal", message: "x", details: [] } }))).toBe(true);
    expect(isErrorEnvelope("Internal Server Error")).toBe(false);
    expect(isErrorEnvelope("")).toBe(false);
    expect(isErrorEnvelope(JSON.stringify({ error: "boom" }))).toBe(false);
    expect(isErrorEnvelope(JSON.stringify({ error: { code: "", message: "x" } }))).toBe(false);
  });

  it("ad12_command_id_failure_does_not_stick_pending", async () => {
    // Retro 21: the command is built inside the `try`, so a throwing id generator drops the send.
    const queryClient = new QueryClient();
    const fetchMock = mockFetch();
    const client = new CommandClient(queryClient, { notify: vi.fn(), navigate: vi.fn() }, {
      randomId: () => {
        throw new Error("no crypto");
      },
    });
    expect(await client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getState(PLAN)).toEqual({ pending: false, notice: "failed", saved: false });
    expect(await client.sendWithEvents(PLAN, MARK_A)).toEqual({ outcome: "dropped", events: [] });
  });

  it("ad12_uuid_fallback_without_random_uuid", () => {
    const real = globalThis.crypto;
    // A non-secure context (plain http on a LAN address) has no `crypto.randomUUID`.
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    const ids = new Set(Array.from({ length: 20 }, () => newCommandId()));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("fr33_send_with_events_returns_events", async () => {
    const h = setup();
    const event = {
      type: "move_made",
      move_number: 1,
      part: "9300",
      from_location: "B-01-03-02",
      to_location: "C-01-01-01",
      rule: "manual",
      round: 0,
    } as const;
    mockFetch(json(200, { version: 5, events: [event] }), envelope(409, "command_rejected", "No."));
    expect(await h.client.sendWithEvents(PLAN, MARK_A)).toEqual({ outcome: "confirmed", events: [event] });
    expect(await h.client.sendWithEvents(PLAN, MARK_A)).toEqual({ outcome: "dropped", events: [] });
  });

  it("ad12_plan_not_found_uses_the_shared_handling_without_refetch", async () => {
    const h = setup();
    mockFetch(envelope(404, "plan_not_found", "Plan not found."));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(h.effects.notify).toHaveBeenCalledWith(PLAN_DELETED);
    expect(h.effects.navigate).toHaveBeenCalledWith(NEW_PLAN_HREF);
    expect(h.summaryFn).not.toHaveBeenCalled();
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: null, saved: false });
  });

  it("ad12_other_4xx_toasts_the_message_and_refetches", async () => {
    const h = setup();
    mockFetch(envelope(422, "validation_failed", "X"));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(h.effects.notify).toHaveBeenCalledWith("X");
    expect(h.effects.navigate).not.toHaveBeenCalled();
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.delays).toEqual([]);
    expect(h.client.getState(PLAN).notice).toBeNull();
  });

  it("ad12_non_envelope_4xx_toasts_the_internal_message", async () => {
    const h = setup();
    mockFetch(new Response("<html>Bad request</html>", { status: 400 }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(h.effects.notify).toHaveBeenCalledWith(INTERNAL_MESSAGE);
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.client.getState(PLAN).notice).toBeNull();
  });

  it("ad12_next_send_clears_the_failed_notice_when_it_starts", async () => {
    const h = setup();
    const response = deferred<Response>();
    mockFetch(envelope(500, "internal", INTERNAL_MESSAGE), response.promise);
    await h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN).notice).toBe("failed");
    const sending = h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN)).toMatchObject({ pending: true, notice: null });
    response.resolve(json(200, { version: 5, events: [] }));
    expect(await sending).toBe("confirmed");
  });

  it("fr10_saved_is_false_while_the_next_command_is_unconfirmed", async () => {
    const h = setup();
    const response = deferred<Response>();
    mockFetch(json(200, { version: 5, events: [] }), response.promise);
    await h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN).saved).toBe(true);
    const sending = h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN)).toMatchObject({ pending: true, saved: false });
    response.resolve(json(200, { version: 6, events: [] }));
    expect(await sending).toBe("confirmed");
    expect(h.client.getState(PLAN).saved).toBe(true);
  });

  it("ad12_2xx_with_unreadable_body_goes_the_500_way", async () => {
    const h = setup();
    const fetchMock = mockFetch(new Response("<html>ok</html>", { status: 200 }));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: "failed", saved: false });
  });

  it("ad12_501_toasts_its_message_and_refetches", async () => {
    const h = setup();
    mockFetch(envelope(501, "not_implemented", "Not here."));
    expect(await h.client.send(PLAN, MARK_A)).toBe("dropped");
    expect(h.effects.notify).toHaveBeenCalledWith("Not here.");
    expect(h.summaryFn).toHaveBeenCalledTimes(1);
    expect(h.delays).toEqual([]);
    expect(h.client.getState(PLAN).notice).toBeNull();
  });

  it("ad12_state_objects_are_stable_between_changes", async () => {
    const h = setup();
    expect(h.client.getState(PLAN)).toBe(IDLE_STATE);
    mockFetch(json(200, { version: 5, events: [] }));
    await h.client.send(PLAN, MARK_A);
    expect(h.client.getState(PLAN)).toBe(h.client.getState(PLAN));
  });
});

describe("ad12 version-consistent plan data", () => {
  const v = (version: number) => ({ version });

  it("ad12_is_consistent_needs_every_item_with_one_version", () => {
    expect(isConsistent([v(5), v(5)])).toBe(true);
    expect(isConsistent([v(5), v(4)])).toBe(false);
    expect(isConsistent([v(5), undefined])).toBe(false);
    expect(isConsistent([])).toBe(true);
  });

  it("ad12_stale_indexes_only_for_defined_mismatched_sets", () => {
    expect(staleIndexes([v(5), v(4)])).toEqual([1]);
    expect(staleIndexes([v(4), v(6), v(5), v(6)])).toEqual([0, 2]);
    expect(staleIndexes([v(5), v(5)])).toEqual([]);
    expect(staleIndexes([v(5), undefined])).toEqual([]);
    expect(staleIndexes([undefined, v(4), v(5)])).toEqual([]);
    expect(staleIndexes([v(5), { other: 1 }])).toEqual([]);
    expect(staleIndexes([])).toEqual([]);
  });

  it("ad12_use_consistent_plan_queries_renders_only_agreeing_sets", () => {
    const query = (data: Versioned | undefined) => ({ data, isFetching: false, refetch: vi.fn() });
    function View({ datas }: { datas: [Versioned | undefined, Versioned | undefined] }) {
      const consistent = useConsistentPlanQueries([query(datas[0]), query(datas[1])]);
      return <span>{consistent ? consistent.map((d) => d.version).join(",") : "none"}</span>;
    }
    expect(html(<View datas={[v(5), v(4)]} />)).toContain("none");
    expect(html(<View datas={[v(5), undefined]} />)).toContain("none");
    expect(html(<View datas={[v(6), v(6)]} />)).toContain("6,6");
  });

  it("ad12_latest_consistent_keeps_the_previous_set_while_versions_disagree", () => {
    const agreed: Versioned[] = [v(4), v(4)];
    expect(latestConsistent([v(5), v(4)], undefined)).toBeUndefined();
    expect(latestConsistent([v(5), v(4)], agreed)).toBe(agreed);
    const next: Versioned[] = [v(5), v(5)];
    expect(latestConsistent(next, agreed)).toBe(next);
  });

  it("ad12_use_consistent_plan_data_renders_only_agreeing_sets", () => {
    function View({ datas }: { datas: [Versioned | undefined, Versioned | undefined] }) {
      const consistent = useConsistentPlanData(datas);
      return <span>{consistent ? consistent.map((d) => d.version).join(",") : "none"}</span>;
    }
    expect(html(<View datas={[v(5), v(4)]} />)).toContain("none");
    expect(html(<View datas={[v(5), undefined]} />)).toContain("none");
    expect(html(<View datas={[v(5), v(5)]} />)).toContain("5,5");
  });

  it("ad12_use_consistent_plan_data_keeps_the_previous_set_while_versions_disagree", () => {
    const steps: [Versioned, Versioned][] = [
      [v(4), v(4)],
      [v(5), v(4)],
    ];
    function Stepper() {
      // Render-phase state updates make the server renderer re-render this component in place.
      const [step, setStep] = useState(0);
      const consistent = useConsistentPlanData(steps[step]);
      if (step < steps.length - 1) setStep(step + 1);
      return <span>{consistent ? consistent.map((d) => d.version).join(",") : "none"}</span>;
    }
    expect(html(<Stepper />)).toContain("4,4");
  });
});

describe("fr10 save status and plan plate", () => {
  const plate = { name: "Demo", dataAsOf: "2026-09-30", uploadedAt: "2026-11-21T23:30:00Z", round: 0 };

  it("fr10_save_status_is_a_persistent_polite_live_region", () => {
    const empty = html(<SaveStatusView />);
    expect(empty).toContain('aria-live="polite"');
    expect(empty).not.toContain("role=");
    for (const [notice, text] of [
      ["retrying", RETRYING_TEXT],
      ["failed", FAILED_TEXT],
    ] as const) {
      const markup = html(<SaveStatusView notice={notice} saved />);
      expect(markup).toContain('aria-live="polite"');
      expect(markup).toContain(text);
      // The nested notice drops its own live role: announced once.
      expect(markup).not.toContain('role="status"');
      expect(markup).not.toContain(SAVED_TEXT);
    }
    const saved = html(<SaveStatusView saved />);
    expect(saved).toContain("sr-only");
    expect(saved).toContain("Saved automatically");
  });

  it("fr10_plan_plate_tooltip_says_saved_automatically_after_a_confirm", () => {
    expect(html(<PlanPlate {...plate} />)).not.toContain(SAVED_TEXT);
    const markup = html(<PlanPlate {...plate} saved />);
    const tooltip = markup.slice(markup.indexOf('role="tooltip"'));
    expect(tooltip).toContain("Uploaded");
    expect(tooltip).toContain("Saved automatically");
  });

  it("fr10_there_is_no_save_button_in_the_shell", () => {
    const queryClient = new QueryClient();
    const wrap = (children: ReactNode) => (
      <QueryClientProvider client={queryClient}>
        <CommandsProvider effects={{ notify: vi.fn(), navigate: vi.fn() }}>{children}</CommandsProvider>
      </QueryClientProvider>
    );
    const shell = html(wrap(<AppShell>page</AppShell>));
    expect(shell).toContain('aria-live="polite"');
    const markup = [shell, html(<PlanPlate {...plate} saved />), html(<SaveStatusView notice="failed" saved />)].join("");
    expect(markup).not.toMatch(/<button[^>]*>\s*Save\s*</i);
    expect(markup).not.toMatch(/>\s*Save\s*</);
  });

  it("fr10_shell_on_a_plan_path_shows_saved_and_failed", async () => {
    nav.path = `/plans/${PLAN}/overview`;
    const summary: PlanSummary = {
      id: PLAN,
      name: "Demo",
      import_id: IMPORT_KEY[1],
      data_as_of: "2026-09-30",
      uploaded_at: "2026-11-21T23:30:00Z",
      created_by: "planner",
      created_at: "2026-11-21T23:30:00Z",
      last_edited_by: "planner",
      last_edited_at: "2026-11-21T23:30:00Z",
      version: 4,
      current_round: 0,
      settings: {
        period_months: 12,
        fast_min_picks: 24,
        medium_min_picks: 6,
        slow_min_picks: 1,
        pick_group_min_shared_jobs: 5,
      },
      period_start: "2025-10-01",
      period_end: "2026-09-30",
      class_counts: { fast: 1584, medium: 12, slow: 3, dead: 0 },
      best_locations: 0,
      empty_best_locations: 0,
      steps: [],
    };
    const effects = { notify: vi.fn(), navigate: vi.fn() };
    const shellFor = (client: CommandClient, queryClient: QueryClient) =>
      html(
        <QueryClientProvider client={queryClient}>
          <CommandsProvider effects={effects} client={client}>
            <AppShell>page</AppShell>
          </CommandsProvider>
        </QueryClientProvider>,
      );
    const statusOf = (markup: string) => markup.slice(markup.indexOf('aria-live="polite"'), markup.indexOf("<main"));
    const tooltipOf = (markup: string) => markup.slice(markup.indexOf('role="tooltip"'));

    const confirmedQc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    confirmedQc.setQueryData(planSummaryKey(PLAN), summary);
    const confirmed = new CommandClient(confirmedQc, effects);
    mockFetch(json(200, { version: 5, events: [] }));
    expect(await confirmed.send(PLAN, MARK_A)).toBe("confirmed");
    const savedShell = shellFor(confirmed, confirmedQc);
    expect(tooltipOf(savedShell)).toContain(SAVED_TEXT);
    expect(statusOf(savedShell)).toContain(SAVED_TEXT);

    const failedQc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    failedQc.setQueryData(planSummaryKey(PLAN), summary);
    const failed = new CommandClient(failedQc, effects);
    mockFetch(envelope(500, "internal", INTERNAL_MESSAGE));
    expect(await failed.send(PLAN, MARK_A)).toBe("dropped");
    const failedShell = shellFor(failed, failedQc);
    expect(statusOf(failedShell)).toContain(FAILED_TEXT);
    expect(tooltipOf(failedShell)).not.toContain(SAVED_TEXT);
  });
});
