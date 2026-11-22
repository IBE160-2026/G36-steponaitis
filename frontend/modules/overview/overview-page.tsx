"use client";

// Overview (FR-7, FR-18, FR-22, UX-DR21/22): the plan's dates, period, best and empty best
// location counts (from the server), parts per movement class and the settings it was computed with.

import Link from "next/link";

import { CLASS_LABELS, ClassGlyph, type MovementClass } from "@/components/common/class-glyph";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SettingsList } from "@/components/common/settings-list";
import { type PlanSummary, usePlanSummary } from "@/lib/api/plans";
import { formatDate, formatNumber } from "@/lib/format";
import { planSettingsHref } from "@/lib/view-state/urls";

const CLASS_ROWS: { key: MovementClass; label: string }[] = (["fast", "medium", "slow", "dead"] as const).map(
  (key) => ({ key, label: CLASS_LABELS[key] }),
);

export function OverviewView({ summary }: { summary: PlanSummary }) {
  const facts = [
    { term: "Data as of", value: formatDate(summary.data_as_of) },
    { term: "Uploaded", value: formatDate(summary.uploaded_at) },
    { term: "Period", value: `${formatDate(summary.period_start)} to ${formatDate(summary.period_end)}` },
    { term: "Best locations", value: formatNumber(summary.best_locations) },
    { term: "Empty best locations", value: formatNumber(summary.empty_best_locations) },
  ];
  return (
    <div className="flex max-w-[960px] flex-col gap-6 px-page-gutter py-5">
      <h1 className="type-page-title">Overview</h1>
      <dl className="grid max-w-[480px] grid-cols-[auto_1fr] gap-x-6 gap-y-2 type-body">
        {facts.map((fact) => (
          <div key={fact.term} className="contents">
            <dt className="text-ink-secondary">{fact.term}</dt>
            <dd className="text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="overview-classes" className="flex flex-col gap-3">
        <h2 id="overview-classes" className="type-section-title">
          Parts by movement class
        </h2>
        <ul className="flex max-w-[480px] flex-col gap-2 type-body">
          {CLASS_ROWS.map((row) => (
            <li key={row.key} data-class={row.key} className="flex items-center gap-2">
              <ClassGlyph movementClass={row.key} size={10} />
              <span className="flex-1">{row.label}</span>
              <span className="type-code">{formatNumber(summary.class_counts[row.key])}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="overview-settings" className="flex flex-col gap-3">
        <h2 id="overview-settings" className="type-section-title">
          Settings
        </h2>
        <SettingsList settings={summary.settings} />
        <Link href={planSettingsHref(summary.id)} className="w-fit rounded-sm text-ink underline underline-offset-2 type-button">
          Settings
        </Link>
      </section>
    </div>
  );
}

export function OverviewPage({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  if (summary.data) return <OverviewView summary={summary.data} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(summary.error) ? <PlanLoadError message={summary.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}
