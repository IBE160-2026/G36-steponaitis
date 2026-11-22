// App shell: the skip link, the toolbar and the page below it. Wraps every page (app/layout.tsx).

import type { ReactNode } from "react";

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
      <PlanSaveStatus />
      <main id="content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
