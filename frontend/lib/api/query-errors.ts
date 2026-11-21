// The one shared error hook for GETs (AD-12): a plan that no longer exists sends the planner to
// New Plan with a toast. Every other error stays with the view that asked for the data.

import { ApiError } from "@/lib/api/errors";

export const PLAN_DELETED = "This plan was deleted.";
export const NEW_PLAN_HREF = "/plans/new";

export type QueryErrorEffects = {
  notify: (message: string) => void;
  navigate: (href: string) => void;
};

export function handleQueryError(error: unknown, { notify, navigate }: QueryErrorEffects): void {
  if (error instanceof ApiError && error.code === "plan_not_found") {
    notify(PLAN_DELETED);
    navigate(NEW_PLAN_HREF);
  }
}
