"use client";

// Plan reads (Story 1.9, AD-3): the plan summary behind every plan surface, the saved-plans list
// used by the `/` redirect, the parts roster (Story 2.3) and the locations table (Story 2.4). All
// are GETs and never change the plan (FR-9).

import { useQuery } from "@tanstack/react-query";

import { internalError, parseErrorBody } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type PlanSummary = components["schemas"]["PlanSummary"];
export type AnalysisSettings = components["schemas"]["AnalysisSettings"];
export type SavedPlanRow = components["schemas"]["SavedPlanRow"];
export type PartsView = components["schemas"]["PartsView"];
export type PartRow = components["schemas"]["PartRow"];
export type LocationRef = components["schemas"]["LocationRef"];
export type LocationsView = components["schemas"]["LocationsView"];
export type LocationRow = components["schemas"]["LocationRow"];
export type LocationContent = components["schemas"]["LocationContent"];
export type Occupancy = components["schemas"]["Occupancy"];
export type AisleOccupancy = components["schemas"]["AisleOccupancy"];

export const PLANS_KEY = ["plans"] as const;

export function planSummaryKey(planId: string) {
  return ["plan", planId, "summary"] as const;
}

export function planPartsKey(planId: string) {
  return ["plan", planId, "parts"] as const;
}

export function planLocationsKey(planId: string) {
  return ["plan", planId, "locations"] as const;
}

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw internalError();
  }
  if (!response.ok) throw parseErrorBody(response.status, await response.text());
  return (await response.json()) as T;
}

export function fetchPlanSummary(planId: string): Promise<PlanSummary> {
  return getJson<PlanSummary>(`/api/plans/${encodeURIComponent(planId)}`);
}

export function usePlanSummary(planId: string) {
  return useQuery({ queryKey: planSummaryKey(planId), queryFn: () => fetchPlanSummary(planId) });
}

export function fetchPlanParts(planId: string): Promise<PartsView> {
  return getJson<PartsView>(`/api/plans/${encodeURIComponent(planId)}/parts`);
}

export function usePlanParts(planId: string) {
  return useQuery({ queryKey: planPartsKey(planId), queryFn: () => fetchPlanParts(planId) });
}

export function fetchPlanLocations(planId: string): Promise<LocationsView> {
  return getJson<LocationsView>(`/api/plans/${encodeURIComponent(planId)}/locations`);
}

export function usePlanLocations(planId: string) {
  return useQuery({ queryKey: planLocationsKey(planId), queryFn: () => fetchPlanLocations(planId) });
}

export function fetchPlans(): Promise<SavedPlanRow[]> {
  return getJson<SavedPlanRow[]>("/api/plans");
}

export function usePlans() {
  return useQuery({ queryKey: PLANS_KEY, queryFn: fetchPlans });
}
