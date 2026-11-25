import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { planSummaryKey } from "@/lib/api/plans";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";
import { SessionExpiry } from "@/lib/api/session-expiry";
import { CommandClient } from "@/lib/commands";
import { HELD_CHANGE_DROPPED } from "@/lib/commands/client";

// Story 9.3: session expiry while the app is open (FR-40, AD-12). A 401 GET or command opens Log
// in; a held command is posted again unchanged after the same user logs in, and dropped with a
// toast when a different (or unknown) user logs in (Story 16.0).

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

  it("fr40_restore_tells_waiters_whether_the_same_user_logged_in", async () => {
    const expiry = new SessionExpiry();
    const first = expiry.expire("/plans", "Kari7");
    const second = expiry.expire("/plans", null); // the cached session was already cleared
    expiry.restore("Kari7");
    expect(await first).toBe("same-user");
    expect(await second).toBe("same-user");

    const other = expiry.expire("/plans", "Kari7");
    expiry.restore("Ola");
    expect(await other).toBe("other-user");

    const caseDiffers = expiry.expire("/plans", "Kari7");
    expiry.restore("kari7");
    expect(await caseDiffers).toBe("other-user");
  });

  it("fr40_unknown_previous_user_counts_as_another_user", async () => {
    const expiry = new SessionExpiry();
    const unknown = expiry.expire("/plans", null);
    const later = expiry.expire("/plans", "Kari7"); // only the first user is remembered
    expiry.restore("Kari7");
    expect(await unknown).toBe("other-user");
    expect(await later).toBe("other-user");

    const noNewUser = expiry.expire("/plans", "Kari7");
    expiry.restore(null);
    expect(await noNewUser).toBe("other-user");
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
      sessionExpired: vi.fn(() => expiry.expire(`/plans/${PLAN}/locations`, "Kari7")),
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

    expect(h.expiry.restore("Kari7")).toBe(`/plans/${PLAN}/locations`);
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
    h.expiry.restore("Kari7");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.effects.sessionExpired).toHaveBeenCalledTimes(2);
    expect(h.client.getState(PLAN).pending).toBe(true);
    h.expiry.restore("Kari7");
    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fr40_same_user_still_saves_held_change", async () => {
    const h = setup();
    const fetchMock = mockFetch(json(401, LOG_IN), json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();

    h.expiry.restore("Kari7");

    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.effects.notify).not.toHaveBeenCalled();
  });

  it("fr40_held_change_is_dropped_when_another_user_logs_in", async () => {
    const h = setup();
    const fetchMock = mockFetch(json(401, LOG_IN));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();

    h.expiry.restore("Ola");

    expect(await sending).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(1); // never posted again, so never saved as Ola
    expect(h.effects.notify).toHaveBeenCalledExactlyOnceWith(HELD_CHANGE_DROPPED);
    expect(HELD_CHANGE_DROPPED).toBe("The last change was not saved: a different user logged in.");
    expect(h.client.getState(PLAN)).toEqual({ pending: false, notice: null, saved: false });
  });

  it("fr40_held_change_is_dropped_when_the_previous_user_is_unknown", async () => {
    const h = setup();
    h.effects.sessionExpired = vi.fn(() => h.expiry.expire(`/plans/${PLAN}/locations`, null));
    h.client.setEffects(h.effects);
    const fetchMock = mockFetch(json(401, LOG_IN));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();

    h.expiry.restore("Kari7");

    expect(await sending).toBe("dropped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.effects.notify).toHaveBeenCalledExactlyOnceWith(HELD_CHANGE_DROPPED);
  });

  it("fr40_held_change_without_a_verdict_is_sent_as_the_same_user", async () => {
    // A test double that resolves with nothing (void) keeps the Story 9.3 behaviour.
    const h = setup();
    let resume: () => void = () => {};
    h.effects.sessionExpired = vi.fn(() => new Promise<void>((resolve) => (resume = resolve)));
    h.client.setEffects(h.effects);
    const fetchMock = mockFetch(json(401, LOG_IN), json(200, { version: 5, events: [] }));
    const sending = h.client.send(PLAN, MARK_A);
    await flush();

    resume();

    expect(await sending).toBe("confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
