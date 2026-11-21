// Plan URLs (AD-20): `/plans/{id}/{view}` is built and read here and nowhere else.

import type { StepKey } from "@/lib/view-state/steps";

export function planStepHref(planId: string, step: StepKey): string {
  return `/plans/${encodeURIComponent(planId)}/${step}`;
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
