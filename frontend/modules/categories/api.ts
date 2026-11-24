"use client";

// Categories API (FR-43, FR-45, Story 13.2): the global keyword rules and aisle categories. Reads
// are queries under `CATEGORIES_KEY`; every write goes to the server and then refetches them, so
// the page shows only what the server confirmed (no optimistic update). A failed write throws its
// AD-11 `ApiError` (a network failure throws `internal`).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { internalError, parseErrorBody } from "@/lib/api/errors";
import { getJson } from "@/lib/api/plans";
import type { components } from "@/lib/api/schema";

export type KeywordRule = components["schemas"]["KeywordRule"];
export type KeywordRules = components["schemas"]["KeywordRules"];
export type AisleCategory = components["schemas"]["AisleCategory"];
export type AisleCategories = components["schemas"]["AisleCategories"];
export type PlanAisleCategories = components["schemas"]["PlanAisleCategories"];

/** The prefix of every categories query: rules and aisle categories are refetched together. */
export const CATEGORIES_KEY = ["categories"] as const;

export function keywordRulesKey() {
  return [...CATEGORIES_KEY, "keyword-rules"] as const;
}

export function planAisleCategoriesKey(planId: string) {
  return [...CATEGORIES_KEY, "aisles", planId] as const;
}

export function useKeywordRules() {
  return useQuery({
    queryKey: keywordRulesKey(),
    queryFn: () => getJson<KeywordRules>("/api/keyword-rules"),
  });
}

export function usePlanAisleCategories(planId: string) {
  return useQuery({
    queryKey: planAisleCategoriesKey(planId),
    queryFn: () => getJson<PlanAisleCategories>(`/api/plans/${encodeURIComponent(planId)}/aisle-categories`),
  });
}

/** One write: resolves with the parsed body (undefined for 204), else throws its `ApiError`. */
export async function sendJson<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw internalError();
  }
  if (!response.ok) throw parseErrorBody(response.status, await response.text());
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function ruleUrl(id: string): string {
  return `/api/keyword-rules/${encodeURIComponent(id)}`;
}

export const categoriesApi = {
  createRule: (keyword: string, category: string) =>
    sendJson<KeywordRule>("POST", "/api/keyword-rules", { keyword, category }),
  editRule: (id: string, keyword: string, category: string) =>
    sendJson<KeywordRule>("PATCH", ruleUrl(id), { keyword, category }),
  deleteRule: (id: string) => sendJson<void>("DELETE", ruleUrl(id)),
  reorderRules: (ids: readonly string[]) => sendJson<KeywordRules>("PUT", "/api/keyword-rules/order", { ids }),
  setAisleCategories: (aisle: string, categories: readonly string[]) =>
    sendJson<AisleCategories>("PUT", `/api/aisle-categories/${encodeURIComponent(aisle)}`, { categories }),
};

/**
 * Runs a write, then waits for the categories queries to refetch; rethrows a failed write. A failed
 * write refetches too, so a rule someone else deleted or moved shows as the server has it.
 */
export function useCategoriesWrite() {
  const queryClient = useQueryClient();
  return useCallback(
    async <T>(write: () => Promise<T>): Promise<T> => {
      try {
        return await write();
      } finally {
        await queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      }
    },
    [queryClient],
  );
}

/** The `{field, message}` details of a `validation_failed` error, by field. */
export function fieldErrors(details: readonly Record<string, unknown>[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of details) {
    const { field, message } = detail;
    if (typeof field === "string" && typeof message === "string" && !(field in errors)) errors[field] = message;
  }
  return errors;
}

/** Moves the id at `index` by `delta` (−1 up, +1 down) in a copy of `ids`. */
export function movedIds(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const next = [...ids];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
