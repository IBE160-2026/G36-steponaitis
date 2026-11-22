// The one shared error hook for GETs and commands (AD-12): a plan that no longer exists sends the
// planner to the saved-plans list with a toast (FR-8). Every other error stays with the view that
// asked for the data.

import { ApiError } from "@/lib/api/errors";
import { SAVED_PLANS_HREF } from "@/lib/view-state/urls";

export const PLAN_DELETED = "This plan was deleted.";

export type QueryErrorEffects = {
  notify: (message: string) => void;
  navigate: (href: string) => void;
};

export function handleQueryError(error: unknown, { notify, navigate }: QueryErrorEffects): void {
  if (error instanceof ApiError && error.code === "plan_not_found") {
    notify(PLAN_DELETED);
    navigate(SAVED_PLANS_HREF);
  }
}
