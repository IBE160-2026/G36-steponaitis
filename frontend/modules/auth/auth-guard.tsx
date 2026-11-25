"use client";

// The page guard (Story 9.2, FR-40, AD-10): with FEATURE_AUTH on, every page but Log in and Create
// account (and, with FEATURE_DEMO on, the demo front page `/`, Story 9.6) needs a session. Mounted
// in app/layout.tsx around the shell, so a logged-out visitor never sees the toolbar, the launcher
// or plan data, and no plan query fires. While the session is pending nothing renders; a failed
// session read still renders the app (the API guard keeps the data protected).

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { type Session, useSession } from "@/lib/api/session";
import { isAuthPath, isFrontPagePath, LOGIN_HREF } from "@/lib/view-state/urls";

export type GuardDecision = "render" | "wait" | "redirect";

export type GuardSession = { isPending: boolean; data?: Session };

/** What the guard does on `pathname` for this session state. */
export function guardDecision(pathname: string, session: GuardSession): GuardDecision {
  if (isAuthPath(pathname)) return "render";
  if (session.isPending) return "wait";
  // The demo front page (Story 9.6, FR-50): `/` is public when FEATURE_DEMO is on.
  if (isFrontPagePath(pathname) && session.data?.feature_auth === true && session.data.feature_demo === true) {
    return "render";
  }
  if (session.data?.feature_auth && session.data.user == null) return "redirect";
  return "render";
}

/** Act on a decision: a visitor without a session is sent to Log in (replacing the page). */
export function followGuard(decision: GuardDecision, router: { replace: (href: string) => void }): void {
  if (decision === "redirect") router.replace(LOGIN_HREF);
}

/**
 * The page Log out is opening, if any. Log out marks the cached session logged out before it opens
 * its page (Log in, or the demo front page with FEATURE_DEMO on, Story 9.6), so for a moment the
 * guard sees a visitor without a session on the page being left. While this is set the guard does
 * not race Log out's navigation with its own redirect to Log in; it is cleared once that page opens,
 * or once `LEAVE_HOLD_MS` pass without it opening (an aborted navigation), after which the guard
 * redirects as usual. Session expiry never sets it, so a 401 still opens Log in.
 */
const leaving: { href: string | null; until: number } = { href: null, until: 0 };

/** How long Log out's navigation may take before the guard stops waiting for it. */
export const LEAVE_HOLD_MS = 5_000;

/** Log out is about to open `href` (called just before it marks the session logged out). */
export function leaveTo(href: string, now: number = Date.now()): void {
  leaving.href = href;
  leaving.until = now + LEAVE_HOLD_MS;
}

/** The ms left of a Log out hold, or 0 when none is in place (it ends on arrival or expiry). */
function holdLeft(pathname: string, now: number): number {
  if (leaving.href !== null && (pathname === leaving.href || now >= leaving.until)) leaving.href = null;
  return leaving.href === null ? 0 : leaving.until - now;
}

/**
 * Act on a decision unless Log out is on its way out: once its page is open, or the hold has run
 * out, the hold ends; until then a redirect is left to Log out. Returns the ms left of a hold that
 * is still in place (0 when none), so the caller can look again when it runs out.
 */
export function followGuardAfterLogout(
  decision: GuardDecision,
  pathname: string,
  router: { replace: (href: string) => void },
  now: number = Date.now(),
): number {
  if (holdLeft(pathname, now) > 0 && decision === "redirect") return holdLeft(pathname, now);
  followGuard(decision, router);
  return holdLeft(pathname, now);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const session = useSession();
  const router = useRouter();
  const decision = guardDecision(pathname, session);

  useEffect(() => {
    const left = followGuardAfterLogout(decision, pathname, router);
    if (left === 0) return;
    // Log out's navigation may never arrive (aborted): look again once the hold runs out.
    const timer = setTimeout(() => followGuardAfterLogout(decision, pathname, router), left);
    return () => clearTimeout(timer);
  }, [decision, pathname, router]);

  return decision === "render" ? children : null;
}
