// App shell: the skip link, the toolbar and the page below it. Wraps every page (app/layout.tsx).
// The last-view recorder reads the query (`useSearchParams`), so it sits in its own Suspense
// boundary and the rest of the shell can still be prerendered.

import { type ReactNode, Suspense } from "react";

import { RememberPlanView } from "@/components/common/app-shell/remember-plan-view";
import { PlanSaveStatus } from "@/components/common/app-shell/save-status";
import { Toolbar } from "@/components/common/app-shell/toolbar";

/**
 * `launcher` is the toolbar's launcher slot (Story 6.5) and `account` its account slot (the avatar
 * user menu, Story 9.3), both passed in by app/layout.tsx.
 */
export function AppShell({
  children,
  launcher,
  account,
}: {
  children: ReactNode;
  launcher?: ReactNode;
  account?: ReactNode;
}) {
  return (
    <>
      <a
        href="#content"
        className="sr-only rounded-lg print:hidden bg-surface px-3 py-2 text-ink type-button focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Toolbar launcher={launcher} account={account} />
      <Suspense fallback={null}>
        <RememberPlanView />
      </Suspense>
      <PlanSaveStatus />
      <main id="content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
