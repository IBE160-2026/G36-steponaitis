"use client";

// Plan reads (Story 1.9, AD-3): the plan summary behind every plan surface, the saved-plans list
// with its delete (Story 6.4), the parts roster (Story 2.3), the locations table (Story 2.4), the
// pick groups table (Story 2.5), the part detail and search (Story 2.6), the manual move
// preview (Story 4.3), before/after (Story 4.6), the recommendations view (Stories 5.5,
// 5.7), a recommendation's other locations (Story 7.2), the move list (Story 8.3) and an aisle's
// wall (Story 10.2) and the whole warehouse (Story 10.6). The reads are GETs and never
// change the plan (FR-9); `deletePlan` is the one write here.

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { internalError, parseErrorBody } from "@/lib/api/errors";
import type { components, operations } from "@/lib/api/schema";

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
export type PickGroupsView = components["schemas"]["PickGroupsView"];
export type PickGroupRow = components["schemas"]["PickGroupRow"];
export type PickGroupPart = components["schemas"]["PickGroupPart"];
export type PartDetail = components["schemas"]["PartDetail"];
export type ClassThreshold = components["schemas"]["ClassThreshold"];
export type StockedLocation = components["schemas"]["StockedLocation"];
export type PartPickGroup = components["schemas"]["PartPickGroup"];
export type SearchView = components["schemas"]["SearchView"];
export type PartMatch = components["schemas"]["PartMatch"];
export type LocationMatch = components["schemas"]["LocationMatch"];
/** A best-location mark (AD-4): a whole aisle, a level (in one aisle or all aisles) or one location. */
export type BestMark = LocationsView["marks"][number];

/** The body of `POST /api/plans/{id}/commands` (AD-6): one of the closed command union. */
export type Command =
  operations["post_command_api_plans__plan_id__commands_post"]["requestBody"]["content"]["application/json"];
export type CommandResult = components["schemas"]["CommandResult"];
/** One event of a confirmed command (`mark_set`, `move_made`, `moves_combined`, …). */
export type CommandEvent = CommandResult["events"][number];
/** The server's read-only preview of a manual move (Story 4.2, FR-33/FR-34). */
export type MovePreview = components["schemas"]["MovePreview"];
/** What the previewed move does: `new`, `adds_to_stock`, `combines_with(n)` or `removes_move(n)`. */
export type MoveEffect = NonNullable<MovePreview["effect"]>;
export type TargetPart = components["schemas"]["TargetPart"];
/** Before/after per aisle and in total (FR-37); every count and list comes from the server. */
export type BeforeAfterView = components["schemas"]["BeforeAfterView"];
export type AisleBeforeAfter = components["schemas"]["AisleBeforeAfter"];
export type BeforeAfterCount = components["schemas"]["Count"];
/** The latest run's recommendations and "no space" entries (FR-28, FR-29), in server order. */
export type RecommendationsView = components["schemas"]["RecommendationsView"];
export type RunMeta = components["schemas"]["RunMeta"];
/** One of the last effective moves of the planning copy (FR-34), newest first (Story 10.5). */
export type RecentMove = components["schemas"]["RecentMove"];
export type RecommendationRow = components["schemas"]["RecommendationRow"];
export type NoSpaceRow = components["schemas"]["NoSpaceRow"];
/** A kept part with no kept row in the latest run (FR-32), in part-number order. */
export type KeptPartRow = components["schemas"]["KeptPartRow"];
export type AppliedInfo = components["schemas"]["AppliedInfo"];
export type OutdatedInfo = components["schemas"]["OutdatedInfo"];
export type NoSpaceCause = components["schemas"]["NoSpaceCause"];
export type ClassReason = components["schemas"]["ClassReason"];
export type PickGroupReason = components["schemas"]["PickGroupReason"];
/** A recommendation's reason: its class and picks (rules 1, 2) or its pick group (rule 3). */
export type RecommendationReason = ClassReason | PickGroupReason;
/** `recommendations_outdated{count, cause}`: a command outdated this many recommendations. */
export type RecommendationsOutdatedEvent = components["schemas"]["RecommendationsOutdated"];
/** `apply_all_done{applied, skipped}`: the numbers apply all applied and those it skipped, with the cause. */
export type ApplyAllDoneEvent = components["schemas"]["ApplyAllDone"];
export type ApplyAllSkipped = components["schemas"]["ApplyAllSkipped"];
/** FR-31's allowed set for one recommendation, in location-code order; empty when it cannot be applied. */
export type OtherLocationsView = components["schemas"]["OtherLocationsView"];
/** The last step and what undoing it would do (AD-5): `reverts_move`, `splits_combined_move` or `restores_removed_move`. */
export type UndoPreview = components["schemas"]["UndoPreview"];
/** `step_undone{undone}`: the last step was undone; `undone` is the undo preview it had (FR-35). */
export type StepUndoneEvent = components["schemas"]["StepUndone"];
/** `plan_reset{moves_removed}`: every step and run was deleted; marks stayed (FR-35). */
export type PlanResetEvent = components["schemas"]["PlanReset"];

/** The move list (FR-38): header and rounds with their lines, in server order (AD-3, AD-17). */
export type MoveListView = components["schemas"]["MoveListView"];
export type MoveListHeader = components["schemas"]["MoveListHeader"];
export type MoveListRound = components["schemas"]["MoveListRound"];
export type MoveListLine = components["schemas"]["MoveListLine"];
/** A line's place in an intact swap: line `index` of `size`, between `locations[0]` and `locations[1]`. */
export type MoveListSwap = components["schemas"]["MoveListSwap"];

/** One aisle's wall (FR-42): its locations with occupancy, parts and best, and every aisle's counts. */
export type WallView = components["schemas"]["WallView"];
export type WallLocation = components["schemas"]["WallLocation"];
/** A part with stock at a wall location, most picks first; `top_part` is the first. */
export type WallPart = components["schemas"]["WallPart"];
export type WallMove = components["schemas"]["WallMove"];
export type WallMoveStatus = WallMove["status"];
/** An aisle's counts on the wall: occupancy, best, its aisle mark, and `moves`: the number of wall move entries touching it (latest-run recommendations plus current-round manual moves). */
export type AisleCounts = components["schemas"]["AisleCounts"];
export type WarehouseCounts = components["schemas"]["WarehouseCounts"];
/** The whole warehouse (Story 10.6): every location's occupancy and top class, every wall move entry, the latest run and the same counts as the wall. */
export type WarehouseView = components["schemas"]["WarehouseView"];
/** One location of the mini-walls: occupied or not, and the top part's class (null when empty). */
export type WarehouseLocation = components["schemas"]["WarehouseLocation"];
/** The latest run: its round and its number of recommendations. */
export type WarehouseRun = components["schemas"]["WarehouseRun"];

export const PLANS_KEY = ["plans"] as const;

/** `['plan', planId]`: the prefix of every plan query key, the one place it is spelled out. */
export function planRootKey(planId: string) {
  return ["plan", planId] as const;
}

export function planSummaryKey(planId: string) {
  return [...planRootKey(planId), "summary"] as const;
}

export function planPartsKey(planId: string) {
  return [...planRootKey(planId), "parts"] as const;
}

export function planLocationsKey(planId: string) {
  return [...planRootKey(planId), "locations"] as const;
}

export function planPickGroupsKey(planId: string) {
  return [...planRootKey(planId), "pick-groups"] as const;
}

export function planBeforeAfterKey(planId: string) {
  return [...planRootKey(planId), "before-after"] as const;
}

export function planRecommendationsKey(planId: string) {
  return [...planRootKey(planId), "recommendations"] as const;
}

export function planMoveListKey(planId: string) {
  return [...planRootKey(planId), "move-list"] as const;
}

/** Under `['plan', planId]`, so a confirmed command refetches every aisle's wall. */
export function planWallKey(planId: string, aisle: string) {
  return [...planRootKey(planId), "wall", aisle] as const;
}

/** Under `['plan', planId]`, so a confirmed command refetches the whole warehouse. */
export function planWarehouseKey(planId: string) {
  return [...planRootKey(planId), "warehouse"] as const;
}

/** Under `planRecommendationsKey`, so the command refetch of `['plan', planId]` refreshes it. */
export function planOtherLocationsKey(planId: string, recId: string) {
  return [...planRecommendationsKey(planId), "other-locations", recId] as const;
}

export function planPartKey(planId: string, part: string) {
  return [...planRootKey(planId), "part", part] as const;
}

export function planSearchKey(planId: string, q: string) {
  return [...planRootKey(planId), "search", q] as const;
}

export function planMovePreviewKey(planId: string, part: string, from: string, to: string) {
  return [...planRootKey(planId), "move-preview", part, from, to] as const;
}

/** GET `url` as JSON; an error status throws its AD-11 error, a network failure `internal`. */
export async function getJson<T>(url: string): Promise<T> {
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

export function fetchPlanWall(planId: string, aisle: string): Promise<WallView> {
  return getJson<WallView>(`/api/plans/${encodeURIComponent(planId)}/wall?${new URLSearchParams({ aisle })}`);
}

/**
 * One aisle's wall (Story 10.2); runs only while `enabled` (an aisle is chosen). The previous
 * aisle's wall stays shown while the next one loads.
 */
export function usePlanWall(planId: string, aisle: string, enabled: boolean) {
  return useQuery({
    queryKey: planWallKey(planId, aisle),
    queryFn: () => fetchPlanWall(planId, aisle),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function fetchPlanWarehouse(planId: string): Promise<WarehouseView> {
  return getJson<WarehouseView>(`/api/plans/${encodeURIComponent(planId)}/warehouse`);
}

/** The whole warehouse (Story 10.6); runs only while `enabled` (Whole warehouse is shown). */
export function usePlanWarehouse(planId: string, enabled: boolean) {
  return useQuery({ queryKey: planWarehouseKey(planId), queryFn: () => fetchPlanWarehouse(planId), enabled });
}

export function fetchPlanPickGroups(planId: string): Promise<PickGroupsView> {
  return getJson<PickGroupsView>(`/api/plans/${encodeURIComponent(planId)}/pick-groups`);
}

export function usePlanPickGroups(planId: string) {
  return useQuery({ queryKey: planPickGroupsKey(planId), queryFn: () => fetchPlanPickGroups(planId) });
}

export function fetchPlanBeforeAfter(planId: string): Promise<BeforeAfterView> {
  return getJson<BeforeAfterView>(`/api/plans/${encodeURIComponent(planId)}/before-after`);
}

/** Under `['plan', planId]`, so a confirmed command refetches it. */
export function usePlanBeforeAfter(planId: string) {
  return useQuery({ queryKey: planBeforeAfterKey(planId), queryFn: () => fetchPlanBeforeAfter(planId) });
}

export function fetchPlanRecommendations(planId: string): Promise<RecommendationsView> {
  return getJson<RecommendationsView>(`/api/plans/${encodeURIComponent(planId)}/recommendations`);
}

/** The latest run's recommendations (FR-28); under `['plan', planId]`, so a confirmed command refetches it. */
export function usePlanRecommendations(planId: string) {
  return useQuery({ queryKey: planRecommendationsKey(planId), queryFn: () => fetchPlanRecommendations(planId) });
}

export function fetchPlanOtherLocations(planId: string, recId: string): Promise<OtherLocationsView> {
  return getJson<OtherLocationsView>(
    `/api/plans/${encodeURIComponent(planId)}/recommendations/${encodeURIComponent(recId)}/other-locations`,
  );
}

/** FR-31's allowed set for `recId` from the server (AD-3); runs only while `enabled` (the listbox is open). */
export function usePlanOtherLocations(planId: string, recId: string, enabled: boolean) {
  return useQuery({
    queryKey: planOtherLocationsKey(planId, recId),
    queryFn: () => fetchPlanOtherLocations(planId, recId),
    enabled,
  });
}

export function fetchPlanMoveList(planId: string): Promise<MoveListView> {
  return getJson<MoveListView>(`/api/plans/${encodeURIComponent(planId)}/move-list`);
}

/**
 * The move list (FR-38). Always fetched on mount, even with a cached view, so the print view shows
 * a fresh `generated_at` (AD-17); under `['plan', planId]`, so a confirmed command refetches it.
 */
export function usePlanMoveList(planId: string) {
  return useQuery({
    queryKey: planMoveListKey(planId),
    queryFn: () => fetchPlanMoveList(planId),
    refetchOnMount: "always",
  });
}

export function fetchPlanPart(planId: string, part: string): Promise<PartDetail> {
  return getJson<PartDetail>(`/api/plans/${encodeURIComponent(planId)}/parts/${encodeURIComponent(part)}`);
}

/** Runs only with a part (the part panel is closed otherwise). */
export function usePlanPart(planId: string, part: string | undefined) {
  return useQuery({
    queryKey: planPartKey(planId, part ?? ""),
    queryFn: () => fetchPlanPart(planId, part ?? ""),
    enabled: part !== undefined,
  });
}

export function fetchPlanSearch(planId: string, q: string): Promise<SearchView> {
  return getJson<SearchView>(`/api/plans/${encodeURIComponent(planId)}/search?${new URLSearchParams({ q })}`);
}

/**
 * Runs only for a non-blank query, keyed and fetched on the trimmed query (the server strips it);
 * the previous results stay shown while the next one loads.
 */
export function usePlanSearch(planId: string, q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: planSearchKey(planId, trimmed),
    queryFn: () => fetchPlanSearch(planId, trimmed),
    enabled: trimmed !== "",
    placeholderData: keepPreviousData,
  });
}

export function fetchMovePreview(planId: string, part: string, from: string, to: string): Promise<MovePreview> {
  return getJson<MovePreview>(
    `/api/plans/${encodeURIComponent(planId)}/moves/preview?${new URLSearchParams({ part, from, to })}`,
  );
}

/**
 * The preview of moving `part` from `from` to `to` (FR-33, FR-34). Runs only with a from-location
 * and a non-blank to-location, keyed and fetched on the trimmed `to`; the previous preview stays
 * while the next one loads. Under `['plan', planId]`, so a confirmed command refetches it.
 */
export function useMovePreview(planId: string, part: string, from: string, to: string) {
  const trimmed = to.trim();
  return useQuery({
    queryKey: planMovePreviewKey(planId, part, from, trimmed),
    queryFn: () => fetchMovePreview(planId, part, from, trimmed),
    enabled: trimmed !== "" && from !== "",
    placeholderData: keepPreviousData,
  });
}

export function fetchPlans(): Promise<SavedPlanRow[]> {
  return getJson<SavedPlanRow[]>("/api/plans");
}

export function usePlans() {
  return useQuery({ queryKey: PLANS_KEY, queryFn: fetchPlans });
}

/**
 * `DELETE /api/plans/{id}` (FR-12): resolves on 204. Any other status throws its AD-11 error
 * (`plan_not_found`, `unavailable`, …); a network failure throws `internal`. Same origin, so the
 * origin guard passes; not a query, so the shared `plan_not_found` hook never sees it.
 */
export async function deletePlan(planId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/plans/${encodeURIComponent(planId)}`, { method: "DELETE" });
  } catch {
    throw internalError();
  }
  if (response.status !== 204) throw parseErrorBody(response.status, await response.text());
}
