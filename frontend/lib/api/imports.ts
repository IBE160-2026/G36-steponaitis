"use client";

// Import reads (Story 10.1, AD-3): the wall layout (FR-42, AD-15) and the location labels (FR-48)
// of an import. An import never changes, so its queries live under `['import', importId]`, outside
// every `['plan', planId]` key: a confirmed command never refetches them, and they are cached for
// the whole session.

import { queryOptions, useQuery } from "@tanstack/react-query";

import { getJson } from "@/lib/api/plans";
import type { components } from "@/lib/api/schema";

/** Every aisle's logical wall cells, in server order; the frontend never derives cells. */
export type LayoutView = components["schemas"]["LayoutView"];
export type AisleLayout = components["schemas"]["AisleLayout"];
export type LayoutRun = components["schemas"]["LayoutRun"];
/** One cell `(run, row, column)`: a location, or a gap (`location` null). */
export type LayoutCell = components["schemas"]["LayoutCell"];
export type SectionSpan = components["schemas"]["SectionSpan"];

/** `['import', importId]`: the prefix of every import query key, the one place it is spelled out. */
export function importRootKey(importId: string) {
  return ["import", importId] as const;
}

export function importLayoutKey(importId: string) {
  return [...importRootKey(importId), "layout"] as const;
}

export function fetchImportLayout(importId: string): Promise<LayoutView> {
  return getJson<LayoutView>(`/api/imports/${encodeURIComponent(importId)}/layout`);
}

/** Immutable: fetched once per import and never refetched or garbage-collected. */
export function importLayoutQueryOptions(importId: string) {
  return queryOptions({
    queryKey: importLayoutKey(importId),
    queryFn: () => fetchImportLayout(importId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useImportLayout(importId: string) {
  return useQuery(importLayoutQueryOptions(importId));
}

/** Location labels (FR-48): every aisle with its locations in Walk Path order, in server order. */
export type LabelsView = components["schemas"]["LabelsView"];
export type AisleLabels = components["schemas"]["AisleLabels"];

export function importLabelsKey(importId: string) {
  return [...importRootKey(importId), "labels"] as const;
}

export function fetchImportLabels(importId: string): Promise<LabelsView> {
  return getJson<LabelsView>(`/api/imports/${encodeURIComponent(importId)}/labels`);
}

/** Immutable like the layout: fetched once per import and never refetched or garbage-collected. */
export function importLabelsQueryOptions(importId: string) {
  return queryOptions({
    queryKey: importLabelsKey(importId),
    queryFn: () => fetchImportLabels(importId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useImportLabels(importId: string) {
  return useQuery(importLabelsQueryOptions(importId));
}
