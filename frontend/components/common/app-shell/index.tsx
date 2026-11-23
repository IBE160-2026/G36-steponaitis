// App shell: the skip link, the toolbar and the page below it. Wraps every page (app/layout.tsx).
// The last-view recorder reads the query (`useSearchParams`), so it sits in its own Suspense
// boundary and the rest of the shell can still be prerendered. On the demo front page `/` the
// shell renders only the page (Story 9.6), which owns its header and main.

import { type ReactNode, Suspense } from "react";

import { BareOnFrontPage } from "@/components/common/app-shell/bare-on-front-page";
import { RememberPlanView } from "@/components/common/app-shell/remember-plan-view";
import { PlanSaveStatus } from "@/components/common/app-shell/save-status";
import { SkipLink } from "@/components/common/app-shell/skip-link";
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
    <BareOnFrontPage page={children}>
      <SkipLink />
      <Toolbar launcher={launcher} account={account} />
      <Suspense fallback={null}>
        <RememberPlanView />
      </Suspense>
      <PlanSaveStatus />
      <main id="content" tabIndex={-1}>
        {children}
      </main>
    </BareOnFrontPage>
  );
}
