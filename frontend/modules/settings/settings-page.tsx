"use client";

// Settings (FR-18, UX-DR22): the analysis settings stored with the plan, read-only.

import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SettingsList } from "@/components/common/settings-list";
import { type PlanSummary, usePlanSummary } from "@/lib/api/plans";

export const SETTINGS_NOTE = "Changed in the config file, not in the app.";

export function SettingsView({ summary }: { summary: PlanSummary }) {
  return (
    <div className="flex max-w-[960px] flex-col gap-6 px-page-gutter py-5">
      <h1 className="type-page-title">Settings</h1>
      <SettingsList settings={summary.settings} />
      <p className="type-body text-ink-secondary">{SETTINGS_NOTE}</p>
    </div>
  );
}

export function SettingsPage({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  if (summary.data) return <SettingsView summary={summary.data} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(summary.error) ? <PlanLoadError message={summary.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}
