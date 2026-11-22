"use client";

// Records the planner's last flow-step view per plan (AD-20, Story 6.2): on every URL change
// under `/plans/<id>/<step>` it stores the step and its view query in this browser, so opening the
// plan from the saved-plans list comes back to it. Renders nothing. `useSearchParams` also follows
// the part panel's native history updates, so an opened or closed panel is recorded too.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { rememberPlanView } from "@/lib/view-state/urls";

export function RememberPlanView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  useEffect(() => {
    if (pathname) rememberPlanView(pathname, search);
  }, [pathname, search]);
  return null;
}
