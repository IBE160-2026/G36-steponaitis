// Plan URLs (AD-20): `/plans/{id}/{view}` and its view-state query (`?aisle=&loc=`, UX-DR9, and
// the open part panel `?part=`, UX-DR24) are built and read here and nowhere else. The
// recommendations tab (`?tab=`, Story 5.7) is built and parsed here too, as are the saved-plans
// list (`/plans`, FR-8) and New Plan (`/plans/new`). So is the plan's last view, kept per browser
// (`swp:plan:<id>:view`, Story 6.2), which the bare `/plans/<id>` opens.

import { FLOW_STEPS, type StepKey } from "@/lib/view-state/steps";
import { planViewKey, readStored, writeStored } from "@/lib/view-state/storage";

/**
 * The view state carried in the URL: the Locations aisle filter and a location to focus, and the
 * part whose panel is open.
 */
export type LocationParams = { aisle?: string; loc?: string; part?: string };

/** The saved-plans list, the start page (FR-8, AD-20). */
export const SAVED_PLANS_HREF = "/plans";

/** New Plan (FR-1). */
export const NEW_PLAN_HREF = "/plans/new";

/** The query keys that make up a plan view (and the only ones its stored last view keeps). */
export const VIEW_QUERY_KEYS = ["aisle", "loc", "part", "tab", "rec", "move"] as const;

export type ViewQueryKey = (typeof VIEW_QUERY_KEYS)[number];

/** A view's query values: any of the view keys, each one string. */
export type ViewQuery = Partial<Record<ViewQueryKey, string>>;

/** `/plans/<id>/<step>`, with only the non-empty `params` appended as a query. */
export function planStepHref(planId: string, step: StepKey, params?: ViewQuery): string {
  const path = `/plans/${encodeURIComponent(planId)}/${step}`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) query.append(key, value);
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Where opening a saved plan goes (FR-9): the bare `/plans/<id>`, which replaces itself with the
 * plan's stored last view (`storedPlanViewHref`). Every "open this plan" goes through here.
 */
export function planOpenHref(planId: string): string {
  return `/plans/${encodeURIComponent(planId)}`;
}

function asStepKey(view: unknown): StepKey | undefined {
  return FLOW_STEPS.find((step) => step.key === view)?.key;
}

/** Only the view keys of `query`, each a non-empty string; everything else is dropped. */
function viewQuery(query: (key: ViewQueryKey) => unknown): ViewQuery {
  const kept: ViewQuery = {};
  for (const key of VIEW_QUERY_KEYS) {
    const value = query(key);
    if (typeof value === "string" && value) kept[key] = value;
  }
  return kept;
}

/**
 * Remember the view at `pathname` + `search` as its plan's last view (AD-20). Only flow-step
 * paths `/plans/<id>/<step>` count: settings, the list, New Plan and the bare plan URL are not
 * recorded. Only the view keys of the query are kept. Stays in this browser; never sent anywhere.
 */
export function rememberPlanView(pathname: string, search: string | URLSearchParams): void {
  const path = parsePlanPath(pathname);
  const step = path ? asStepKey(path.view) : undefined;
  if (!path || !step) return;
  const params = new URLSearchParams(search);
  const query = viewQuery((key) => params.get(key));
  writeStored(planViewKey(path.planId), JSON.stringify({ step, query }));
}

/**
 * The href of the plan's stored last view; the overview when nothing is stored, storage is
 * blocked or the stored value is not valid JSON of a known step (AD-20).
 */
export function storedPlanViewHref(planId: string): string {
  const raw = readStored(planViewKey(planId));
  let stored: unknown = null;
  try {
    stored = raw === null ? null : JSON.parse(raw);
  } catch {
    stored = null;
  }
  if (typeof stored !== "object" || stored === null) return planStepHref(planId, "overview");
  const { step, query } = stored as { step?: unknown; query?: unknown };
  const key = asStepKey(step);
  if (!key) return planStepHref(planId, "overview");
  const values = typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};
  return planStepHref(planId, key, viewQuery((name) => (Object.hasOwn(values, name) ? values[name] : undefined)));
}

/** The tabs of the Recommendations step (Open · Applied · Outdated · No space). */
export type RecommendationsTab = "open" | "applied" | "outdated" | "no-space";

/** `/plans/<id>/recommendations?tab=<tab>`: the Recommendations step on one tab. */
export function recommendationsTabHref(planId: string, tab: RecommendationsTab): string {
  return `${planStepHref(planId, "recommendations")}?${new URLSearchParams({ tab })}`;
}

const RECOMMENDATIONS_TABS: readonly RecommendationsTab[] = ["open", "applied", "outdated", "no-space"];

/** `?tab=` → the Recommendations tab; Open when missing or unknown. */
export function parseRecommendationsTab(searchParams: SearchParamsInput): RecommendationsTab {
  const value = firstValue(searchParams, "tab");
  return RECOMMENDATIONS_TABS.find((tab) => tab === value) ?? "open";
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
