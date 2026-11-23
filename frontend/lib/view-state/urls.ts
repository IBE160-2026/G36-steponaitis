// Plan URLs (AD-20): `/plans/{id}/{view}` and its view-state query (`?aisle=&loc=`, UX-DR9, and
// the open part panel `?part=`, UX-DR24) are built and read here and nowhere else. The
// recommendations tab (`?tab=`, Story 5.7) and selected recommendation (`?rec=`, Story 10.3) are
// built and parsed here too, as are the saved-plans list (`/plans`, FR-8) and New Plan
// (`/plans/new`, with `?from=<planId>` to reuse that plan's import, FR-2). So is the plan's last view, kept per browser (`swp:plan:<id>:view`, Story 6.2),
// which the bare `/plans/<id>` opens.

import { type StepKey, stepFromKey, stepFromSegment, stepSegment } from "@/lib/view-state/steps";
import { planViewKey, readStored, writeStored } from "@/lib/view-state/storage";

/**
 * The view state carried in the URL: the Locations aisle (the wall's open aisle, or the table's
 * aisle filter), a location to open (the wall pins its tooltip, the table focuses its row),
 * `mode=list` for the table (Story 10.2), and the part whose panel is open.
 */
export type LocationParams = {
  aisle?: string;
  loc?: string;
  mode?: string;
  part?: string;
  /** The wall's selected move (Story 10.4): a recommendation by id, or a manual move by number. */
  rec?: string;
  move?: string;
};

/** The query that selects a wall move: `?rec=<recommendation id>` or `?move=<move number>`. */
export function wallMoveQuery(move: {
  kind: "recommendation" | "manual";
  recommendation_id: string | null;
  move_number: number | null;
}): Pick<LocationParams, "rec" | "move"> {
  if (move.kind === "recommendation" && move.recommendation_id !== null) return { rec: move.recommendation_id };
  return move.move_number === null ? {} : { move: String(move.move_number) };
}

/** Whether `move` is the one `params` select (`?rec=` first, else `?move=`, which names only manual moves). */
export function isSelectedWallMove(
  move: { kind: "recommendation" | "manual"; recommendation_id: string | null; move_number: number | null },
  params: Pick<LocationParams, "rec" | "move">,
): boolean {
  if (params.rec !== undefined) return move.recommendation_id === params.rec;
  if (params.move !== undefined) {
    return move.kind === "manual" && move.move_number !== null && String(move.move_number) === params.move;
  }
  return false;
}

/** The saved-plans list, the start page (FR-8, AD-20). */
export const SAVED_PLANS_HREF = "/plans";

/** Create account (FR-39, Story 9.1). */
export const SIGNUP_HREF = "/signup";

/** Log in (FR-40, Story 9.2). */
export const LOGIN_HREF = "/login";

/** The start page `/`: the demo front page on the public deployment, else the saved-plans list (Story 9.6). */
export const FRONT_PAGE_HREF = "/";

/** True on `/` only: the page that shows the demo front page (FR-50, Story 9.6). */
export function isFrontPagePath(pathname: string): boolean {
  return pathname === FRONT_PAGE_HREF;
}

/** True on the Log in and Create account pages, whose toolbar holds only the logo and name. */
export function isAuthPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === SIGNUP_HREF || path === LOGIN_HREF;
}

/** New Plan (FR-1). */
export const NEW_PLAN_HREF = "/plans/new";

/** New Plan reusing the import of the saved plan `planId` (`/plans/new?from=<id>`, FR-2). */
export function newPlanFromHref(planId: string): string {
  return `${NEW_PLAN_HREF}?${new URLSearchParams({ from: planId })}`;
}

/** The query keys that make up a plan view (and the only ones its stored last view keeps). */
export const VIEW_QUERY_KEYS = ["aisle", "loc", "mode", "part", "tab", "rec", "move"] as const;

export type ViewQueryKey = (typeof VIEW_QUERY_KEYS)[number];

/** A view's query values: any of the view keys, each one string. */
export type ViewQuery = Partial<Record<ViewQueryKey, string>>;

/** `/plans/<id>/<segment>` of `step` (`print` for Move list), with only the non-empty `params` appended as a query. */
export function planStepHref(planId: string, step: StepKey, params?: ViewQuery): string {
  const path = `/plans/${encodeURIComponent(planId)}/${stepSegment(step)}`;
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
 * paths `/plans/<id>/<segment>` count (`/print` is recorded as `move-list`): settings, the list, New Plan and the bare plan URL are not
 * recorded. Only the view keys of the query are kept. Stays in this browser; never sent anywhere.
 */
export function rememberPlanView(pathname: string, search: string | URLSearchParams): void {
  const path = parsePlanPath(pathname);
  const step = path ? stepFromSegment(path.view) : undefined;
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
  const key = stepFromKey(step);
  if (!key) return planStepHref(planId, "overview");
  const values = typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};
  return planStepHref(planId, key, viewQuery((name) => (Object.hasOwn(values, name) ? values[name] : undefined)));
}

/** The tabs of the Recommendations step (Open · Applied · Kept in place · Outdated · No space). */
export type RecommendationsTab = "open" | "applied" | "kept" | "outdated" | "no-space";

/** `/plans/<id>/recommendations?tab=<tab>`: the Recommendations step on one tab. */
export function recommendationsTabHref(planId: string, tab: RecommendationsTab): string {
  return `${planStepHref(planId, "recommendations")}?${new URLSearchParams({ tab })}`;
}

/**
 * `/plans/<id>/recommendations?tab=<tab>&rec=<id>`: one recommendation, selected on the tab of its
 * server status (Story 10.3, the wall's Show recommendation #n).
 */
export function recommendationHref(
  planId: string,
  row: { id: string; status: "open" | "applied" | "kept" | "outdated" },
): string {
  return planStepHref(planId, "recommendations", { tab: row.status, rec: row.id });
}

/** `?rec=` → the recommendation to select; undefined when missing or empty. */
export function parseRecommendationId(searchParams: SearchParamsInput): string | undefined {
  return firstValue(searchParams, "rec");
}

const RECOMMENDATIONS_TABS: readonly RecommendationsTab[] = ["open", "applied", "kept", "outdated", "no-space"];

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

/** New Plan's `?from=` → the saved plan whose import to reuse; undefined when missing or empty. */
export function parseNewPlanFrom(searchParams: SearchParamsInput): string | undefined {
  return firstValue(searchParams, "from");
}

/** `?aisle=&loc=&mode=&part=&rec=&move=` → `{aisle?, loc?, mode?, part?, rec?, move?}`: the first value of each; empty values are dropped. */
export function parseLocationParams(searchParams: SearchParamsInput): LocationParams {
  const params: LocationParams = {};
  for (const key of ["aisle", "loc", "mode", "part", "rec", "move"] as const) {
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
