"use client";

// React bindings for the command flow (AD-12): one `CommandClient` per app, the per-plan save
// state through `useSyncExternalStore`, and the version-consistent view of several plan queries
// (refetching the stale ones a bounded number of times).

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { QueryErrorEffects } from "@/lib/api/query-errors";
import {
  type CommandBody,
  CommandClient,
  isConsistent,
  MAX_STALE_REFETCHES,
  type PlanCommandState,
  SAVING_REASON,
  type SendOutcome,
  type SendResult,
  staleIndexes,
} from "@/lib/commands/client";

const CommandsContext = createContext<CommandClient | null>(null);
const EffectsContext = createContext<QueryErrorEffects | null>(null);

export type CommandsProviderProps = {
  effects: QueryErrorEffects;
  children: ReactNode;
  /** A prebuilt client (tests); by default one is built from the surrounding QueryClient. */
  client?: CommandClient;
};

export function CommandsProvider({ effects, children, client: given }: CommandsProviderProps) {
  const queryClient = useQueryClient();
  // The client is built once; it always calls the latest effects passed in.
  const [client] = useState(() => given ?? new CommandClient(queryClient, effects));
  useEffect(() => client.setEffects(effects), [client, effects]);
  return (
    <CommandsContext.Provider value={client}>
      <EffectsContext.Provider value={effects}>{children}</EffectsContext.Provider>
    </CommandsContext.Provider>
  );
}

/**
 * The shared ended-session flow (Story 9.3, FR-40) for a write outside the command flow (New Plan's
 * upload, Delete plan): remember this page, mark the session logged out and open Log in, as a 401
 * GET or command does. The write is not held or sent again; the planner returns to this page.
 */
export function useSessionExpired(): () => void {
  const effects = useContext(EffectsContext);
  if (!effects) throw new Error("useSessionExpired must be used inside <CommandsProvider>");
  return useCallback(() => void effects.sessionExpired(), [effects]);
}

export function useCommandClient(): CommandClient {
  const client = useContext(CommandsContext);
  if (!client) throw new Error("useCommandClient must be used inside <CommandsProvider>");
  return client;
}

export type PlanCommands = PlanCommandState & {
  send: (body: CommandBody) => Promise<SendOutcome>;
  /** `send` plus the confirmed response's events (for toasts that name what changed). */
  sendWithEvents: (body: CommandBody) => Promise<SendResult>;
  /** Pass to every plan-changing `Button` as `disabledReason`. */
  disabledReason: string | undefined;
};

export function usePlanCommands(planId: string): PlanCommands {
  const client = useCommandClient();
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client]);
  const getState = useCallback(() => client.getState(planId), [client, planId]);
  const state = useSyncExternalStore(subscribe, getState, getState);
  const send = useCallback((body: CommandBody) => client.send(planId, body), [client, planId]);
  const sendWithEvents = useCallback((body: CommandBody) => client.sendWithEvents(planId, body), [client, planId]);
  return { ...state, send, sendWithEvents, disabledReason: state.pending ? SAVING_REASON : undefined };
}

type Versioned = { version: number };
type Defined<T extends readonly unknown[]> = { [K in keyof T]: NonNullable<T[K]> };

/** `datas` when all are defined with one `version`, else `previous` (the last such set). */
export function latestConsistent<T extends readonly (Versioned | undefined)[]>(
  datas: T,
  previous: Defined<T> | undefined,
): Defined<T> | undefined {
  return isConsistent(datas) ? (datas as unknown as Defined<T>) : previous;
}

function sameItems(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
}

/**
 * Renders only version-consistent sets of plan views (AD-12): the latest `datas` whose items are
 * all defined with an equal `version`, else the previous such set, else `undefined`.
 */
export function useConsistentPlanData<T extends readonly (Versioned | undefined)[]>(
  datas: readonly [...T],
): Defined<T> | undefined {
  const [last, setLast] = useState<Defined<T> | undefined>(undefined);
  const result = latestConsistent(datas as T, last);
  // Remember the newest consistent set (render-time state update; stops once the items match).
  if (sameItems(result, last)) return last;
  setLast(result);
  return result;
}

/** What `useConsistentPlanQueries` reads of a plan query (a `useQuery` result fits). */
export type PlanQueryLike<D extends Versioned = Versioned> = {
  data: D | undefined;
  isFetching: boolean;
  refetch: () => unknown;
};

type DatasOf<Q extends readonly PlanQueryLike[]> = {
  [K in keyof Q]: Q[K] extends PlanQueryLike<infer D> ? D | undefined : never;
};

/**
 * `useConsistentPlanData` over the queries' data (AD-12), and the repair: while every query has
 * data but their versions differ and none is fetching, the queries below the highest version are
 * refetched, at most `MAX_STALE_REFETCHES` times per highest version seen (a newer version earns
 * a fresh budget; a view that stays behind cannot loop).
 */
export function useConsistentPlanQueries<Q extends readonly PlanQueryLike[]>(
  queries: readonly [...Q],
): Defined<DatasOf<Q>> | undefined {
  const datas = queries.map((query) => query.data);
  const consistent = useConsistentPlanData<readonly (Versioned | undefined)[]>(datas);
  const staleKey = staleIndexes(datas).join(",");
  const fetching = queries.some((query) => query.isFetching);
  const highest = Math.max(0, ...datas.map((data) => data?.version ?? 0));
  const latest = useRef(queries);
  const budget = useRef({ version: -1, used: 0 });
  useEffect(() => {
    latest.current = queries;
  });
  useEffect(() => {
    if (staleKey === "" || fetching) return;
    if (budget.current.version !== highest) budget.current = { version: highest, used: 0 };
    if (budget.current.used >= MAX_STALE_REFETCHES) return;
    budget.current.used += 1;
    for (const index of staleKey.split(",").map(Number)) void latest.current[index]?.refetch();
  }, [staleKey, fetching, highest]);
  return consistent as Defined<DatasOf<Q>> | undefined;
}
