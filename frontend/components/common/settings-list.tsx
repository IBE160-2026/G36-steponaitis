// The plan's analysis settings, read-only (FR-18, UX-DR22). Used by the overview and settings
// modules. Every number comes from the plan's stored snapshot, never from the config file.

import type { AnalysisSettings } from "@/lib/api/plans";
import { CLASS_LABELS } from "@/lib/copy";
import { formatNumber } from "@/lib/format";

export type SettingsRow = { term: string; value: string };

function picks(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "pick" : "picks"}`;
}

function pickRange(from: number, to: number): string {
  return from === to ? picks(from) : `${formatNumber(from)}–${formatNumber(to)} picks`;
}

/** The rows of the settings list, in display order. */
export function settingsRows(settings: AnalysisSettings): SettingsRow[] {
  const months = settings.period_months;
  return [
    { term: "Period", value: `${formatNumber(months)} ${months === 1 ? "month" : "months"}` },
    { term: CLASS_LABELS.fast, value: `${formatNumber(settings.fast_min_picks)} or more picks` },
    { term: CLASS_LABELS.medium, value: pickRange(settings.medium_min_picks, settings.fast_min_picks - 1) },
    { term: CLASS_LABELS.slow, value: pickRange(settings.slow_min_picks, settings.medium_min_picks - 1) },
    { term: CLASS_LABELS.dead, value: pickRange(0, settings.slow_min_picks - 1) },
    { term: "Pick group", value: `${formatNumber(settings.pick_group_min_shared_jobs)} or more shared jobs` },
  ];
}

export function SettingsList({ settings }: { settings: AnalysisSettings }) {
  return (
    <dl className="grid max-w-[480px] grid-cols-[auto_1fr] gap-x-6 gap-y-2 type-body">
      {settingsRows(settings).map((row) => (
        <div key={row.term} className="contents">
          <dt className="text-ink-secondary">{row.term}</dt>
          <dd className="text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
