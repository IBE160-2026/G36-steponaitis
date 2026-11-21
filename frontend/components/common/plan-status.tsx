"use client";

// What a plan view shows before its summary is ready (UX-DR21): plain text "Opening <name>…"
// (no spinner), the name taken from the saved-plans list if it is already cached; or the error.
// A deleted plan (`plan_not_found`) never shows as an error here: it stays on the opening text
// while the shared query hook shows the toast and moves on to New Plan.

import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

import { PLANS_KEY, type SavedPlanRow } from "@/lib/api/plans";

export function openingText(planId: string, plans: readonly SavedPlanRow[] | undefined): string {
  const name = plans?.find((plan) => plan.id === planId)?.name;
  return name ? `Opening ${name}…` : "Opening the plan…";
}

/** Whether a failed summary shows its message; `plan_not_found` is left to the shared hook. */
export function showsLoadError(error: Error | null): error is Error {
  return error !== null && !(error instanceof ApiError && error.code === "plan_not_found");
}

export function PlanOpening({ planId }: { planId: string }) {
  const plans = useQueryClient().getQueryData<SavedPlanRow[]>(PLANS_KEY);
  return (
    <p role="status" className="type-body text-ink-secondary">
      {openingText(planId, plans)}
    </p>
  );
}

export function PlanLoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="type-body text-ink">
      {message}
    </p>
  );
}
