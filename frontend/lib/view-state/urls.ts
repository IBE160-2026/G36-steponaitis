// Plan URLs (AD-20): `/plans/{id}/{step}` is built here and nowhere else.

import type { StepKey } from "@/lib/view-state/steps";

export function planStepHref(planId: string, step: StepKey): string {
  return `/plans/${encodeURIComponent(planId)}/${step}`;
}
