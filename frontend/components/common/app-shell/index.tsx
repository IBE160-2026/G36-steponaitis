// App shell: the skip link, the toolbar and the page below it. Wraps every page (app/layout.tsx).
// The last-view recorder reads the query (`useSearchParams`), so it sits in its own Suspense
// boundary and the rest of the shell can still be prerendered.

import { type ReactNode, Suspense } from "react";

import { RememberPlanView } from "@/components/common/app-shell/remember-plan-view";
import { PlanSaveStatus } from "@/components/common/app-shell/save-status";
import { Toolbar } from "@/components/common/app-shell/toolbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#content"
        className="sr-only rounded-lg bg-surface px-3 py-2 text-ink type-button focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Toolbar />
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
