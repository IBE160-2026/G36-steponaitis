"use client";

// React bindings for the command flow (AD-12): one `CommandClient` per app, the per-plan save
// state through `useSyncExternalStore`, and the version-consistent view of several plan queries.

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import type { QueryErrorEffects } from "@/lib/api/query-errors";
import {
  type CommandBody,
  CommandClient,
  isConsistent,
  type PlanCommandState,
  SAVING_REASON,
  type SendOutcome,
} from "@/lib/commands/client";

const CommandsContext = createContext<CommandClient | null>(null);

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
  return <CommandsContext.Provider value={client}>{children}</CommandsContext.Provider>;
}

export function useCommandClient(): CommandClient {
  const client = useContext(CommandsContext);
  if (!client) throw new Error("useCommandClient must be used inside <CommandsProvider>");
  return client;
}

export type PlanCommands = PlanCommandState & {
  send: (body: CommandBody) => Promise<SendOutcome>;
  /** Pass to every plan-changing `Button` as `disabledReason`. */
  disabledReason: string | undefined;
};

export function usePlanCommands(planId: string): PlanCommands {
  const client = useCommandClient();
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client]);
  const getState = useCallback(() => client.getState(planId), [client, planId]);
  const state = useSyncExternalStore(subscribe, getState, getState);
  const send = useCallback((body: CommandBody) => client.send(planId, body), [client, planId]);
  return { ...state, send, disabledReason: state.pending ? SAVING_REASON : undefined };
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
