"use client";

// The page guard (Story 9.2, FR-40, AD-10): with FEATURE_AUTH on, every page but Log in and Create
// account needs a session. Mounted in app/layout.tsx around the shell, so a logged-out visitor
// never sees the toolbar, the launcher or plan data, and no plan query fires. While the session
// is pending nothing renders; a failed session read still renders the app (the API guard keeps
// the data protected).

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { type Session, useSession } from "@/lib/api/session";
import { isAuthPath, LOGIN_HREF } from "@/lib/view-state/urls";

export type GuardDecision = "render" | "wait" | "redirect";

export type GuardSession = { isPending: boolean; data?: Session };

/** What the guard does on `pathname` for this session state. */
export function guardDecision(pathname: string, session: GuardSession): GuardDecision {
  if (isAuthPath(pathname)) return "render";
  if (session.isPending) return "wait";
  if (session.data?.feature_auth && session.data.user == null) return "redirect";
  return "render";
}

/** Act on a decision: a visitor without a session is sent to Log in (replacing the page). */
export function followGuard(decision: GuardDecision, router: { replace: (href: string) => void }): void {
  if (decision === "redirect") router.replace(LOGIN_HREF);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const session = useSession();
  const router = useRouter();
  const decision = guardDecision(pathname, session);

  useEffect(() => followGuard(decision, router), [decision, router]);

  return decision === "render" ? children : null;
}
