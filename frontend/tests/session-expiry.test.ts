import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { planSummaryKey } from "@/lib/api/plans";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";
import { SessionExpiry } from "@/lib/api/session-expiry";
import { CommandClient } from "@/lib/commands";

// Story 9.3: session expiry while the app is open (FR-40, AD-12). A 401 GET or command opens Log
// in; a held command is posted again unchanged after Log in.

const PLAN = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";
const MARK_A = { type: "set_best_mark", mark: { kind: "aisle", aisle: "A" } } as const;
const LOG_IN = { error: { code: "unauthenticated", message: "Log in to continue.", details: [] } };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.unstubAllGlobals();
});

/** Let pending promise callbacks run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("fr40 session expiry coordinator", () => {
  it("fr40_expire_keeps_the_first_page_until_restore", () => {
    const expiry = new SessionExpiry();
    void expiry.expire("/plans/p1/locations?aisle=A");
    void expiry.expire("/plans/p2/parts");
    expect(expiry.isWaiting()).toBe(true);
    expect(expiry.restore()).toBe("/plans/p1/locations?aisle=A");
    expect(expiry.isWaiting()).toBe(false);
    void expiry.expire("/plans/p2/parts");
    expect(expiry.restore()).toBe("/plans/p2/parts");
  });

  it("fr40_expire_never_remembers_an_auth_page", () => {
    const expiry = new SessionExpiry();
    void expiry.expire("/login");
    void expiry.expire("/signup?x=1");
    expect(expiry.restore()).toBeNull();
  });

  it("fr40_restore_resolves_every_waiter_and_is_null_when_nothing_waits", async () => {
    const expiry = new SessionExpiry();
    expect(expiry.restore()).toBeNull();
    const done: number[] = [];
    void expiry.expire("/plans").then(() => done.push(1));
    void expiry.expire("/plans").then(() => done.push(2));
    await flush();
    expect(done).toEqual([]);
    expiry.restore();
    await flush();
    expect(done).toEqual([1, 2]);
  });
});

describe("fr40 shared query error hook", () => {
  it("fr40_unauthenticated_get_opens_login_without_a_toast", () => {
    const effects = { notify: vi.fn(), navigate: vi.fn(), sessionExpired: vi.fn(async () => {}) };
    handleQueryError(new ApiError(401, "unauthenticated", "Log in to continue."), effects);
    expect(effects.sessionExpired).toHaveBeenCalledTimes(1);
    expect(effects.notify).not.toHaveBeenCalled();
    expect(effects.navigate).not.toHaveBeenCalled();
  });
});

describe("fr40 held command", () => {
  function setup() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData(planSummaryKey(PLAN), { version: 4 });
    const observer = new QueryObserver(queryClient, {
      queryKey: planSummaryKey(PLAN),
      queryFn: async () => ({ version: 5 }),
      staleTime: Infinity,
    });
    cleanups.push(observer.subscribe(() => {}));
    const expiry = new SessionExpiry();
    const effects: QueryErrorEffects = {
      notify: vi.fn(),
      navigate: vi.fn(),
      sessionExpired: vi.fn(() => expiry.expire(`/plans/${PLAN}/locations`)),
    };
    const sleep = vi.fn(async () => {});
    const client = new CommandClient(queryClient, effects, { sleep, randomId: () => "cmd-1" });
    return { client, effects, expiry, sleep };
  }

  function mockFetch(...answers: Response[]) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected fetch");
      return next;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fr40_command_401_waits_for_login_then_posts_the_same_body_once", async () => {
    const h = setup();
    const fetchMock = mockFetch(json(401, LOG_IN), json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();

    expect(h.effects.sessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.client.getState(PLAN)).toEqual({ pending: true, notice: null, saved: false });
    expect(await h.client.send(PLAN, MARK_A)).toBe("busy");
    expect(h.effects.notify).not.toHaveBeenCalled();

    expect(h.expiry.restore()).toBe(`/plans/${PLAN}/locations`);
    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(second).toEqual(first);
    expect(second).toEqual({ ...MARK_A, command_id: "cmd-1", base_version: 4 });
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: null, saved: true });
    expect(h.sleep).not.toHaveBeenCalled();
  });

  it("fr40_command_401_again_after_login_waits_again", async () => {
    const h = setup();
    const fetchMock = mockFetch(json(401, LOG_IN), json(401, LOG_IN), json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();
    h.expiry.restore();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.effects.sessionExpired).toHaveBeenCalledTimes(2);
    expect(h.client.getState(PLAN).pending).toBe(true);
    h.expiry.restore();
    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
