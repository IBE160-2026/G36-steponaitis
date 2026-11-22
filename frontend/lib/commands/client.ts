// Client command flow (AD-12, Story 3.3): the one way the client changes a plan. One command at a
// time per plan, each with a new `command_id` and the current `base_version`; transient failures
// retry with the same body; nothing changes on screen until the server confirms and the plan
// queries are refetched. Framework-free: React bindings live in `./react.tsx`, effects (toast,
// navigation) are injected so `lib/` never imports `components/`.

import type { Query, QueryClient } from "@tanstack/react-query";

import { ApiError, internalError, parseErrorBody } from "@/lib/api/errors";
import { type Command, type CommandResult, planRootKey } from "@/lib/api/plans";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";

/** A command as a caller builds it; the flow adds `command_id` and `base_version`. */
export type CommandBody = DistributiveOmit<Command, "command_id" | "base_version">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SendOutcome = "confirmed" | "dropped" | "busy";
export type SaveNotice = null | "retrying" | "failed";
export type PlanCommandState = { pending: boolean; notice: SaveNotice; saved: boolean };

export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;
/** At most this many extra refetch rounds when a refetched view is older than the confirmed version. */
export const MAX_STALE_REFETCHES = 2;

export const SAVING_REASON = "Saving the last change…";
export const SAVED_TEXT = "Saved automatically";
export const RETRYING_TEXT = "The last change was not saved yet. Trying again.";
export const FAILED_TEXT = "The change was not saved. Try again.";

const TRANSIENT_STATUSES = new Set([502, 503, 504]);

export function noticeText(notice: SaveNotice): string | null {
  if (notice === "retrying") return RETRYING_TEXT;
  if (notice === "failed") return FAILED_TEXT;
  return null;
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

type PostOutcome = { ok: CommandResult } | "transient" | ApiError;

export class CommandClient {
  private readonly queryClient: QueryClient;
  private effects: QueryErrorEffects;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly randomId: () => string;
  private readonly states = new Map<string, PlanCommandState>();
  private readonly listeners = new Set<() => void>();

  constructor(queryClient: QueryClient, effects: QueryErrorEffects, options: CommandClientOptions = {}) {
    this.queryClient = queryClient;
    this.effects = effects;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
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
    if (this.getState(planId).pending) return "busy";
    // A new send clears a previous "failed" notice when it starts; the change is not saved yet.
    this.update(planId, { pending: true, notice: null, saved: false });
    const command = {
      ...body,
      command_id: this.randomId(),
      base_version: baseVersion(this.queryClient, planId),
    } as Command;
    try {
      let outcome: PostOutcome;
      for (let attempt = 0; ; attempt++) {
        outcome = await this.post(planId, command);
        if (outcome !== "transient") break;
        if (attempt === RETRY_DELAYS_MS.length) return await this.fail(planId);
        this.update(planId, { notice: "retrying" });
        await this.sleep(RETRY_DELAYS_MS[attempt]);
      }
      if (outcome instanceof ApiError) return await this.reject(planId, outcome);
      await this.refetchConsistent(planId, outcome.ok.version);
      this.update(planId, { pending: false, notice: null, saved: true });
      return "confirmed";
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
      if (!response.ok) return parseErrorBody(response.status, await response.text());
      const result = (await response.json()) as CommandResult;
      if (typeof result?.version !== "number") return internalError(500);
      return { ok: result };
    } catch {
      return internalError(500);
    }
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

  /** Refetch every active plan query, then re-refetch those still older than `version` (≤ 2 rounds). */
  private async refetchConsistent(planId: string, version: number): Promise<void> {
    await this.refetchPlan(planId);
    for (let round = 0; round < MAX_STALE_REFETCHES; round++) {
      const stale = (query: Query) => {
        const seen = versionOf(query.state.data);
        return seen !== undefined && seen < version;
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
