"use client";

// The milestone 1 start (AD-20): `/` opens the most recently edited plan, or New Plan when there
// is none. Epic 6 replaces this with the saved-plans list.

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePlans } from "@/lib/api/plans";
import { NEW_PLAN_HREF } from "@/lib/api/query-errors";
import { planStepHref } from "@/lib/view-state/urls";

export default function HomePage() {
  const router = useRouter();
  const plans = usePlans();
  const redirected = useRef(false);
  // Only fresh data counts: a cached list from earlier in the session may miss a new plan or
  // still hold a deleted one. Redirect once.
  const fresh = plans.isFetchedAfterMount && !plans.isFetching && plans.isSuccess;

  useEffect(() => {
    if (!fresh || !plans.data || redirected.current) return;
    redirected.current = true;
    const latest = plans.data[0];
    router.replace(latest ? planStepHref(latest.id, "overview") : NEW_PLAN_HREF);
  }, [fresh, plans.data, router]);

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {plans.isError ? (
        <p role="alert" className="type-body text-ink">
          {plans.error.message}
        </p>
      ) : (
        <p role="status" className="type-body text-ink-secondary">
          Opening the latest plan…
        </p>
      )}
    </div>
  );
}
