"use client";

// The start page `/` (FR-8, FR-50, Story 9.6). The flags are known only at runtime from
// GET /api/session (AD-10), so `/` decides on the client: with FEATURE_AUTH and FEATURE_DEMO on and
// no user it is the demo front page; otherwise it replaces itself with the saved-plans list, as the
// old server redirect did. Nothing renders while the session is pending. A failed session read
// opens the saved-plans list (the API guard keeps the data protected). With FEATURE_AUTH on,
// FEATURE_DEMO off and no user, the page guard sends `/` to Log in before this page renders.

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { type Session, useSession } from "@/lib/api/session";
import { SAVED_PLANS_HREF } from "@/lib/view-state/urls";

import { FrontPage } from "./front-page";

export type HomeDecision = "front-page" | "saved-plans";

/** What `/` shows for an answered (or failed, `undefined`) session read. */
export function homeDecision(session: Session | undefined): HomeDecision {
  return session?.feature_auth === true && session.feature_demo === true && session.user == null
    ? "front-page"
    : "saved-plans";
}

/** `demoAction` is the front page's Demo version button (app/page.tsx passes it in). */
export function HomePage({ demoAction }: { demoAction?: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const decision = session.isPending ? null : homeDecision(session.data);

  useEffect(() => {
    if (decision === "saved-plans") router.replace(SAVED_PLANS_HREF);
  }, [decision, router]);

  return decision === "front-page" ? <FrontPage demoAction={demoAction} /> : null;
}
