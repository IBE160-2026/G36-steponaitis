"use client";

// Categories API (FR-43, FR-45, Story 13.2): the global keyword rules and aisle categories. Reads
// are queries under `CATEGORIES_KEY`; every write goes to the server and then refetches them, so
// the page shows only what the server confirmed (no optimistic update). A failed write throws its
// AD-11 `ApiError` (a network failure throws `internal`). The category check (FR-46) is a plan view:
// its query sits under `planRootKey`, so every confirmed move, undo or reset refetches it (AD-3).

import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getJson, planRootKey } from "@/lib/api/plans";
import type { components } from "@/lib/api/schema";
import { sendJson } from "@/lib/api/send-json";

export type KeywordRule = components["schemas"]["KeywordRule"];
export type KeywordRules = components["schemas"]["KeywordRules"];
export type AisleCategory = components["schemas"]["AisleCategory"];
export type AisleCategories = components["schemas"]["AisleCategories"];
export type PlanAisleCategories = components["schemas"]["PlanAisleCategories"];
export type CategoryCheck = components["schemas"]["CategoryCheck"];
export type CategoryCheckRow = components["schemas"]["CategoryCheckRow"];

/** The prefix of every categories query: rules and aisle categories are refetched together. */
export const CATEGORIES_KEY = ["categories"] as const;

export function keywordRulesKey() {
  return [...CATEGORIES_KEY, "keyword-rules"] as const;
}

export function planAisleCategoriesKey(planId: string) {
  return [...CATEGORIES_KEY, "aisles", planId] as const;
}

/** Under `['plan', planId]`, so a confirmed command refetches it. */
export function planCategoryCheckKey(planId: string) {
  return [...planRootKey(planId), "category-check"] as const;
}

/** True for the category check query of any plan (`planCategoryCheckKey`'s shape). */
export function isCategoryCheckKey(queryKey: readonly unknown[]): boolean {
  const [root, , view] = queryKey;
  return queryKey.length === 3 && root === planRootKey("")[0] && view === "category-check";
}

export function usePlanCategoryCheck(planId: string) {
  return useQuery({
    queryKey: planCategoryCheckKey(planId),
    queryFn: () => getJson<CategoryCheck>(`/api/plans/${encodeURIComponent(planId)}/category-check`),
  });
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

function ruleUrl(id: string): string {
  return `/api/keyword-rules/${encodeURIComponent(id)}`;
}

/** The fields of a rule the Edit dialog can change; an omitted field keeps its stored value. */
export type RuleChanges = Partial<Pick<KeywordRule, "keyword" | "category">>;

/** Only the fields whose value differs from the stored rule, so Edit never writes back a stale value. */
export function changedFields(rule: Pick<KeywordRule, "keyword" | "category">, values: Required<RuleChanges>): RuleChanges {
  const changes: RuleChanges = {};
  if (values.keyword !== rule.keyword) changes.keyword = values.keyword;
  if (values.category !== rule.category) changes.category = values.category;
  return changes;
}

export const categoriesApi = {
  createRule: (keyword: string, category: string) =>
    sendJson<KeywordRule>("POST", "/api/keyword-rules", { keyword, category }),
  editRule: (id: string, changes: RuleChanges) => sendJson<KeywordRule>("PATCH", ruleUrl(id), changes),
  deleteRule: (id: string) => sendJson<void>("DELETE", ruleUrl(id)),
  /** `baseIds` is the order the list had when the planner moved a rule; a changed list answers 409. */
  reorderRules: (ids: readonly string[], baseIds: readonly string[]) =>
    sendJson<KeywordRules>("PUT", "/api/keyword-rules/order", { ids, base_ids: baseIds }),
  setAisleCategories: (aisle: string, categories: readonly string[]) =>
    sendJson<AisleCategories>("PUT", `/api/aisle-categories/${encodeURIComponent(aisle)}`, { categories }),
};

/**
 * Runs a write, then waits for the categories queries (and every category check) to refetch; rethrows a failed write. A failed
 * write refetches too, so a rule someone else deleted or moved (a stale reorder answers 409) shows as the server has it.
 */
export async function runCategoriesWrite<T>(queryClient: QueryClient, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } finally {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
      // Every plan's check reads the rules and aisle categories: a write makes it stale.
      queryClient.invalidateQueries({ predicate: (query) => isCategoryCheckKey(query.queryKey) }),
    ]);
  }
}

/** `runCategoriesWrite` with the app's query client. */
export function useCategoriesWrite() {
  const queryClient = useQueryClient();
  return useCallback(<T>(write: () => Promise<T>): Promise<T> => runCategoriesWrite(queryClient, write), [queryClient]);
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
