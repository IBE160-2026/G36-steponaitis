// The one shared error hook for GETs and commands (AD-12): a plan that no longer exists sends the
// planner to the saved-plans list with a toast (FR-8); an ended session opens Log in and returns to
// the same page afterwards (FR-40, Story 9.3). Every other error stays with the view that asked
// for the data.

import { ApiError } from "@/lib/api/errors";
import type { ResumeVerdict } from "@/lib/api/session-expiry";
import { SAVED_PLANS_HREF } from "@/lib/view-state/urls";

export const PLAN_DELETED = "This plan was deleted.";

export type QueryErrorEffects = {
  notify: (message: string) => void;
  navigate: (href: string) => void;
  /**
   * The session has ended: remember the open page and user, mark the session logged out and open
   * Log in. Resolves after the next successful Log in, with whether the same user logged back in
   * (Story 16.0). `void` (no verdict, e.g. a test double) counts as the same user.
   */
  sessionExpired: () => Promise<ResumeVerdict | void>;
  /**
   * Someone else saved the plan since this planner's command was built (FR-41): ask whether to
   * reload the plan (drop the command) or keep going (send it again on top). Absent: reload.
   */
  planChanged?: () => Promise<"reload" | "keep">;
};

/** A 401: the session has ended (expiry, deleted user, Log out in another tab). */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.code === "unauthenticated";
}

export function handleQueryError(error: unknown, effects: QueryErrorEffects): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === "plan_not_found") {
    effects.notify(PLAN_DELETED);
    effects.navigate(SAVED_PLANS_HREF);
  } else if (isSessionExpired(error)) {
    void effects.sessionExpired();
  }
}
