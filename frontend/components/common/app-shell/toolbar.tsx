"use client";

// App toolbar (UX-DR4): 64px louvre-panel graphite with the product mark, the product name, the
// plan plate and the flow bar. Sticky while the viewport is at least 500px tall; below that it
// scrolls with the page. It lives in the root layout, so it learns the open plan from the URL
// (AD-20) and reads only the plan summary query (AD-3). Off plan paths the steps are plain text.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FlowBar } from "@/components/common/app-shell/flow-bar";
import { PlanPlate } from "@/components/common/app-shell/plan-plate";
import { ProductMark } from "@/components/common/app-shell/product-mark";
import { usePlanSummary } from "@/lib/api/plans";
import { FLOW_STEPS, type StepKey } from "@/lib/view-state/steps";
import { parsePlanPath, planStepHref } from "@/lib/view-state/urls";

function asStepKey(view: string): StepKey | undefined {
  return FLOW_STEPS.find((step) => step.key === view)?.key;
}

function PlanToolbarParts({ planId, view }: { planId: string; view: string }) {
  const summary = usePlanSummary(planId);
  const doneSteps = summary.data?.steps.filter((step) => step.checked).map((step) => step.key as StepKey) ?? [];
  return (
    <>
      {summary.data && (
        <PlanPlate
          name={summary.data.name}
          dataAsOf={summary.data.data_as_of}
          uploadedAt={summary.data.uploaded_at}
          round={summary.data.current_round}
        />
      )}
      <FlowBar
        currentStep={asStepKey(view)}
        doneSteps={doneSteps}
        hrefFor={(step) => planStepHref(planId, step)}
      />
    </>
  );
}

export function Toolbar() {
  const planPath = parsePlanPath(usePathname() ?? "");
  return (
    <header
      data-surface="graphite"
      className="static z-40 flex min-h-toolbar-height flex-wrap items-center gap-x-6 gap-y-2 border-b border-shell-edge bg-louvre-shell px-page-gutter py-3 tall:sticky tall:top-0"
    >
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm">
        <ProductMark />
        <span className="font-code text-[15px] leading-none font-bold whitespace-nowrap text-white">
          Smart Warehouse Planner
        </span>
      </Link>
      {planPath ? <PlanToolbarParts key={planPath.planId} planId={planPath.planId} view={planPath.view} /> : <FlowBar />}
    </header>
  );
}
