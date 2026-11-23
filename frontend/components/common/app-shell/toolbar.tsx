"use client";

// App toolbar (UX-DR4): 64px louvre-panel graphite with the product mark, the product name, the
// plan plate and the flow bar. Sticky while the viewport is at least 500px tall; below that it
// scrolls with the page. It lives in the root layout, so it learns the open plan from the URL
// (AD-20) and reads only the plan summary and saved-plans queries (AD-3). Off plan paths the steps are plain text.
// On plan paths the launcher slot (Story 6.5) follows the flow bar; the toolbar never imports a module.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FlowBar } from "@/components/common/app-shell/flow-bar";
import { PlanPlate, planMenuItems } from "@/components/common/app-shell/plan-plate";
import { ProductMark } from "@/components/common/app-shell/product-mark";
import { usePlans, usePlanSummary } from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import { type StepKey, stepFromSegment } from "@/lib/view-state/steps";
import { parsePlanPath, planStepHref, SAVED_PLANS_HREF } from "@/lib/view-state/urls";

function PlanToolbarParts({ planId, view }: { planId: string; view: string }) {
  const summary = usePlanSummary(planId);
  // The saved plans for the plate menu's recent plans (UX-DR5); the menu works without them.
  const plans = usePlans();
  const { saved } = usePlanCommands(planId);
  const doneSteps = summary.data?.steps.filter((step) => step.checked).map((step) => step.key as StepKey) ?? [];
  return (
    <>
      {summary.data && (
        <PlanPlate
          name={summary.data.name}
          menu={planMenuItems(planId, plans.data)}
          dataAsOf={summary.data.data_as_of}
          uploadedAt={summary.data.uploaded_at}
          round={summary.data.current_round}
          saved={saved}
        />
      )}
      <FlowBar
        currentStep={stepFromSegment(view)}
        doneSteps={doneSteps}
        hrefFor={(step) => planStepHref(planId, step)}
      />
    </>
  );
}

export type ToolbarProps = {
  /** The launcher's grid button (app/layout.tsx passes it in); rendered after the flow bar on plan paths only. */
  launcher?: ReactNode;
};

export function Toolbar({ launcher }: ToolbarProps) {
  const planPath = parsePlanPath(usePathname() ?? "");
  return (
    <header
      data-surface="graphite"
      className="static z-40 flex print:hidden min-h-toolbar-height flex-wrap items-center gap-x-6 gap-y-2 border-b border-shell-edge bg-louvre-shell px-page-gutter py-3 tall:sticky tall:top-0"
    >
      <Link href={SAVED_PLANS_HREF} className="flex shrink-0 items-center gap-2 rounded-sm">
        <ProductMark />
        <span className="font-code text-[15px] leading-none font-bold whitespace-nowrap text-white">
          Smart Warehouse Planner
        </span>
      </Link>
      {planPath ? (
        <>
          <PlanToolbarParts key={planPath.planId} planId={planPath.planId} view={planPath.view} />
          {launcher}
        </>
      ) : (
        <FlowBar />
      )}
    </header>
  );
}
