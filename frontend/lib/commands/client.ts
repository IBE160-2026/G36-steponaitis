// Client command flow (AD-12, Story 3.3): the one way the client changes a plan. One command at a
// time per plan, each with a new `command_id` and the current `base_version`; transient failures
// retry with the same body; a command that meets an ended session waits for Log in and is then
// sent again unchanged (Story 9.3); a command built on an older version than the plan's
// (`plan_changed`, FR-41) is held while the planner chooses Reload plan (drop it) or Keep going (send
// it again with the new `base_version`); nothing changes on screen until the server confirms and the plan
// queries are refetched. Framework-free: React bindings live in `./react.tsx`, effects (toast,
// navigation) are injected so `lib/` never imports `components/`.

import type { Query, QueryClient } from "@tanstack/react-query";

import { ApiError, internalError, isErrorEnvelope, parseErrorBody } from "@/lib/api/errors";
import { type Command, type CommandEvent, type CommandResult, planRootKey } from "@/lib/api/plans";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";

/** A command as a caller builds it; the flow adds `command_id` and `base_version`. */
export type CommandBody = DistributiveOmit<Command, "command_id" | "base_version">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SendOutcome = "confirmed" | "dropped" | "busy";
/** The outcome plus the confirmed response's events (`[]` unless confirmed). */
export type SendResult = { outcome: SendOutcome; events: CommandEvent[] };
export type SaveNotice = null | "retrying" | "failed";
export type PlanCommandState = { pending: boolean; notice: SaveNotice; saved: boolean };

export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;
/** At most this many extra refetch rounds when a refetched view is older than the confirmed version. */
export const MAX_STALE_REFETCHES = 2;

export const SAVING_REASON = "Saving the last change…";
export const SAVED_TEXT = "Saved automatically";
export const RETRYING_TEXT = "The last change was not saved yet. Trying again.";
export const FAILED_TEXT = "The change was not saved. Try again.";
/** Story 16.0: a change held after the session ended is never saved under another user's name. */
export const HELD_CHANGE_DROPPED = "The last change was not saved: a different user logged in.";

const TRANSIENT_STATUSES = new Set([502, 503, 504]);

export function noticeText(notice: SaveNotice): string | null {
  if (notice === "retrying") return RETRYING_TEXT;
  if (notice === "failed") return FAILED_TEXT;
  return null;
}

function hex(bytes: Uint8Array, from: number, to: number): string {
  return Array.from(bytes.subarray(from, to), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * A new `command_id`: `crypto.randomUUID()` where it exists (secure contexts only), else an
 * RFC 4122 version 4 UUID built from `crypto.getRandomValues`.
 */
export function newCommandId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return `${hex(bytes, 0, 4)}-${hex(bytes, 4, 6)}-${hex(bytes, 6, 8)}-${hex(bytes, 8, 10)}-${hex(bytes, 10, 16)}`;
}

export const IDLE_STATE: PlanCommandState = Object.freeze({ pending: false, notice: null, saved: false });

export type CommandClientOptions = {
  sleep?: (ms: number) => Promise<void>;
  randomId?: () => string;
};

function versionOf(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const version = (data as { version?: unknown }).version;
  return typeof version === "number" ? version : undefined;
}

/** The highest `version` among the cached `['plan', planId]` query data; 0 when none is cached. */
export function baseVersion(queryClient: QueryClient, planId: string): number {
  let highest = 0;
  for (const [, data] of queryClient.getQueriesData({ queryKey: planRootKey(planId) })) {
    const version = versionOf(data);
    if (version !== undefined && version > highest) highest = version;
  }
  return highest;
}

/** True when every item is defined and all carry the same `version`. */
export function isConsistent(datas: readonly unknown[]): boolean {
  const versions = datas.map(versionOf);
  if (versions.some((version) => version === undefined)) return false;
  return versions.every((version) => version === versions[0]);
}

/**
 * The indexes whose `version` is below the highest in `datas`: `[]` unless every item is defined
 * with a `version` and the versions differ (AD-12).
 */
export function staleIndexes(datas: readonly unknown[]): number[] {
  const versions = datas.map(versionOf);
  if (versions.some((version) => version === undefined)) return [];
  const defined = versions as number[];
  const highest = Math.max(...defined);
  return defined.flatMap((version, index) => (version < highest ? [index] : []));
}

/** `details[0].current_version` of a `plan_changed` error, when it is a number. */
function currentVersionOf(error: ApiError): number | undefined {
  const version = (error.details[0] as { current_version?: unknown } | undefined)?.current_version;
  return typeof version === "number" ? version : undefined;
}

type PostOutcome = { ok: CommandResult } | "transient" | ApiError;

export class CommandClient {
  private readonly queryClient: QueryClient;
  private effects: QueryErrorEffects;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly randomId: () => string;
  private readonly states = new Map<string, PlanCommandState>();
  private readonly listeners = new Set<() => void>();
  /** The last version per plan this client saw confirmed or reported by `plan_changed` (FR-41). */
  private readonly seenVersions = new Map<string, number>();

  constructor(queryClient: QueryClient, effects: QueryErrorEffects, options: CommandClientOptions = {}) {
    this.queryClient = queryClient;
    this.effects = effects;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.randomId = options.randomId ?? newCommandId;
  }

  /** Swap the injected effects (the router may change between renders). */
  setEffects(effects: QueryErrorEffects): void {
    this.effects = effects;
  }

  getState(planId: string): PlanCommandState {
    return this.states.get(planId) ?? IDLE_STATE;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async send(planId: string, body: CommandBody): Promise<SendOutcome> {
    return (await this.sendWithEvents(planId, body)).outcome;
  }

  /** Like `send`, plus the events of the confirmed response (`[]` for any other outcome). */
  async sendWithEvents(planId: string, body: CommandBody): Promise<SendResult> {
    if (this.getState(planId).pending) return { outcome: "busy", events: [] };
    // A new send clears a previous "failed" notice when it starts; the change is not saved yet.
    this.update(planId, { pending: true, notice: null, saved: false });
    try {
      // Built inside the `try`: a failing id or version read drops the send instead of leaving it pending.
      let command: Command;
      try {
        command = {
          ...body,
          command_id: this.randomId(),
          base_version: this.baseFor(planId),
        } as Command;
      } catch {
        return { outcome: await this.fail(planId), events: [] };
      }
      let outcome: PostOutcome;
      for (let attempt = 0; ; ) {
        outcome = await this.post(planId, command);
        if (outcome instanceof ApiError && outcome.code === "unauthenticated") {
          // The session ended (Story 9.3, FR-40): hold the command, still pending, until Log in
          // succeeds, then post the identical body again. Not a transient attempt. When a different
          // user logged in (Story 16.0), drop it with a toast and refetch the plan instead.
          this.update(planId, { notice: null });
          if ((await this.effects.sessionExpired()) === "other-user") {
            this.effects.notify(HELD_CHANGE_DROPPED);
            return { outcome: await this.dropForReload(planId), events: [] };
          }
          continue;
        }
        if (outcome instanceof ApiError && outcome.code === "plan_changed") {
          // Someone else saved the plan (FR-41): hold the command, still pending, until the planner
          // chooses. Reload plan drops it; Keep going refetches and sends the same `command_id` again
          // with the new `base_version`, so it is applied on top of the other changes.
          const current = currentVersionOf(outcome);
          if (current !== undefined) this.see(planId, current);
          this.update(planId, { notice: null });
          if ((await this.askPlanChanged()) !== "keep") {
            return { outcome: await this.dropForReload(planId), events: [] };
          }
          await this.refetchPlan(planId);
          command = { ...command, base_version: this.baseFor(planId) } as Command;
          attempt = 0;
          continue;
        }
        if (outcome !== "transient") break;
        if (attempt === RETRY_DELAYS_MS.length) return { outcome: await this.fail(planId), events: [] };
        this.update(planId, { notice: "retrying" });
        await this.sleep(RETRY_DELAYS_MS[attempt]);
        attempt++;
      }
      if (outcome instanceof ApiError) return { outcome: await this.reject(planId, outcome), events: [] };
      this.see(planId, outcome.ok.version);
      await this.refetchConsistent(planId, outcome.ok.version);
      this.update(planId, { pending: false, notice: null, saved: true });
      return { outcome: "confirmed", events: Array.isArray(outcome.ok.events) ? outcome.ok.events : [] };
    } finally {
      // Whatever happened, the plan is no longer waiting on this command.
      if (this.getState(planId).pending) this.update(planId, { pending: false });
    }
  }

  private async post(planId: string, command: Command): Promise<PostOutcome> {
    let response: Response;
    try {
      response = await fetch(`/api/plans/${encodeURIComponent(planId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
    } catch {
      return "transient";
    }
    if (TRANSIENT_STATUSES.has(response.status)) return "transient";
    // A body that cannot be read (or a 2xx that is not JSON) goes the 500 way: drop, refetch, failed.
    try {
      if (!response.ok) {
        const text = await response.text();
        // The backend answers every 500 with the AD-11 envelope; a bare 500 is the `/api` proxy
        // failing to reach it, and is retried like a network error (idempotent per `command_id`).
        if (response.status === 500 && !isErrorEnvelope(text)) return "transient";
        return parseErrorBody(response.status, text);
      }
      const result = (await response.json()) as CommandResult;
      if (typeof result?.version !== "number") return internalError(500);
      return { ok: result };
    } catch {
      return internalError(500);
    }
  }

  /**
   * The `base_version` to send: the highest cached plan version or the last version this client saw
   * confirmed or reported, so a refetch that failed after an own command never warns falsely.
   */
  private baseFor(planId: string): number {
    return Math.max(baseVersion(this.queryClient, planId), this.seenVersions.get(planId) ?? 0);
  }

  private see(planId: string, version: number): void {
    if (version > (this.seenVersions.get(planId) ?? 0)) this.seenVersions.set(planId, version);
  }

  /** The planner's choice on `plan_changed`; no effect (or a failing one) means Reload plan. */
  private async askPlanChanged(): Promise<"reload" | "keep"> {
    if (!this.effects.planChanged) return "reload";
    try {
      return await this.effects.planChanged();
    } catch {
      return "reload";
    }
  }

  /** Reload plan: drop the held command, refetch every plan query, clear the notice. */
  private async dropForReload(planId: string): Promise<"dropped"> {
    await this.refetchPlan(planId);
    this.update(planId, { pending: false, notice: null, saved: false });
    return "dropped";
  }

  /** 500 or retries exhausted: drop, refetch, show the failed notice. */
  private async fail(planId: string): Promise<"dropped"> {
    await this.refetchPlan(planId);
    this.update(planId, { pending: false, notice: "failed", saved: false });
    return "dropped";
  }

  private async reject(planId: string, error: ApiError): Promise<"dropped"> {
    if (error.status === 500) return this.fail(planId);
    if (error.code === "plan_not_found") {
      this.update(planId, { pending: false, notice: null, saved: false });
      handleQueryError(error, this.effects);
      return "dropped";
    }
    this.effects.notify(error.message);
    await this.refetchPlan(planId);
    this.update(planId, { pending: false, notice: null, saved: false });
    return "dropped";
  }

  private refetchPlan(planId: string): Promise<void> {
    return this.queryClient.invalidateQueries({ queryKey: planRootKey(planId), refetchType: "active" });
  }

  /**
   * Refetch every active plan query, then re-refetch those still older than the highest version
   * seen: the confirmed `version` or a newer one any plan query now carries (another writer).
   * At most `MAX_STALE_REFETCHES` extra rounds.
   */
  private async refetchConsistent(planId: string, version: number): Promise<void> {
    await this.refetchPlan(planId);
    for (let round = 0; round < MAX_STALE_REFETCHES; round++) {
      const target = Math.max(version, baseVersion(this.queryClient, planId));
      const stale = (query: Query) => {
        const seen = versionOf(query.state.data);
        return seen !== undefined && seen < target;
      };
      const staleQueries = this.queryClient
        .getQueryCache()
        .findAll({ queryKey: planRootKey(planId), type: "active", predicate: stale });
      if (staleQueries.length === 0) return;
      await this.queryClient.refetchQueries({ queryKey: planRootKey(planId), type: "active", predicate: stale });
    }
  }

  private update(planId: string, patch: Partial<PlanCommandState>): void {
    this.states.set(planId, { ...this.getState(planId), ...patch });
    for (const listener of this.listeners) listener();
  }
}
