// Plan URLs (AD-20): `/plans/{id}/{view}` and its view-state query (`?aisle=&loc=`, UX-DR9, and
// the open part panel `?part=`, UX-DR24) are built and read here and nowhere else.

import type { StepKey } from "@/lib/view-state/steps";

/**
 * The view state carried in the URL: the Locations aisle filter and a location to focus, and the
 * part whose panel is open.
 */
export type LocationParams = { aisle?: string; loc?: string; part?: string };

/** `/plans/<id>/<step>`, with only the non-empty `params` appended as a query. */
export function planStepHref(planId: string, step: StepKey, params?: LocationParams): string {
  const path = `/plans/${encodeURIComponent(planId)}/${step}`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) query.append(key, value);
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function firstValue(searchParams: SearchParamsInput, key: string): string | undefined {
  const value = searchParams instanceof URLSearchParams ? searchParams.get(key) : searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : undefined;
}

/** `?aisle=&loc=&part=` → `{aisle?, loc?, part?}`: the first value of each; empty values are dropped. */
export function parseLocationParams(searchParams: SearchParamsInput): LocationParams {
  const params: LocationParams = {};
  for (const key of ["aisle", "loc", "part"] as const) {
    const value = firstValue(searchParams, key);
    if (value !== undefined) params[key] = value;
  }
  return params;
}

/** Settings is not a flow step, so it has its own link. */
export function planSettingsHref(planId: string): string {
  return `/plans/${encodeURIComponent(planId)}/settings`;
}

export type PlanPath = { planId: string; view: string };

/** `/plans/<id>/<view>` → `{planId, view}`; anything else (including `/plans/new`) → null. */
export function parsePlanPath(pathname: string): PlanPath | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 3 || segments[0] !== "plans") return null;
  let planId: string;
  try {
    planId = decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  return { planId, view: segments[2] };
}
