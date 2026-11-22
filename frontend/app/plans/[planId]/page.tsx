"use client";

// The bare plan URL `/plans/<id>` (Story 6.2, AD-20): what opening a saved plan links to. The
// server cannot see the browser's stored last view, so this page replaces itself with it (or the
// overview) on the client; `replace` keeps it out of the history, so Back skips it.

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { storedPlanViewHref } from "@/lib/view-state/urls";

const OPENING_PLAN_TEXT = "Opening plan…";

export default function Page() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(storedPlanViewHref(planId));
  }, [planId, router]);
  return <p className="px-page-gutter py-5 type-body text-ink-secondary">{OPENING_PLAN_TEXT}</p>;
}
