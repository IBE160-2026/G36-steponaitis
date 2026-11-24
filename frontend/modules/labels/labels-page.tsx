"use client";

// Location labels print view (Story 14.1, FR-48, NFR-9): an aisle picker, a paper preview of one
// label per location of the chosen aisle, and Print (the only primary button). Aisles and their
// locations render exactly in response order: the server owns membership and Walk Path order, and
// the client never sorts, filters or parses codes (AD-3). An import never changes, so Print needs
// no refetch. In print media only the paper prints: the toolbar is `print:hidden`, the paper drops
// its gutter and shadow, and each row of 3 labels avoids a page break; `@page` is in globals.css.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { type AisleLabels, type LabelsView as LabelsData, useImportLabels } from "@/lib/api/imports";
import { usePlanSummary } from "@/lib/api/plans";
import {
  BACK_TO_OVERVIEW,
  LABELS_AISLE,
  LABELS_LOAD_FAILED,
  labelsCountLine,
  labelsHeading,
  PRINT_LABEL,
} from "@/lib/copy";
import { parseLocationParams, planLabelsHref, planStepHref } from "@/lib/view-state/urls";
import { QrCode } from "@/modules/labels/qr-code";

/** The aisle picker's id: the page has one picker. */
const PICKER_ID = "labels-aisle";

/** Labels per printed row. */
export const LABELS_PER_ROW = 3;

/** The aisle to show: `requested` when the server lists it, else the first server aisle. */
export function chooseAisle(aisles: readonly AisleLabels[], requested: string | undefined): AisleLabels | undefined {
  return aisles.find((aisle) => aisle.aisle === requested) ?? aisles[0];
}

/** The locations in rows of `LABELS_PER_ROW`, in response order. */
function rows<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += LABELS_PER_ROW) {
    result.push(items.slice(start, start + LABELS_PER_ROW));
  }
  return result;
}

export function printLabels(): void {
  window.print();
}

export type LabelsViewProps = {
  planId: string;
  labels: LabelsData;
  /** The aisle on the paper; one of `labels.aisles`. */
  aisle: AisleLabels;
  onAisleChange?: (aisle: string) => void;
  onPrint?: () => void;
};

/** The print view: toolbar (Print, Back to Overview, aisle picker, heading, count), then the paper. */
export function LabelsView({ planId, labels, aisle, onAisleChange, onPrint = printLabels }: LabelsViewProps) {
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5 print:p-0">
      <div data-labels-toolbar className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={onPrint}>
            {PRINT_LABEL}
          </Button>
          <Link href={planStepHref(planId, "overview")} className={buttonClassName("tertiary")}>
            {BACK_TO_OVERVIEW}
          </Link>
          <div className="flex items-center gap-2">
            <label htmlFor={PICKER_ID} className="type-body text-ink">
              {LABELS_AISLE}
            </label>
            <select
              id={PICKER_ID}
              data-labels-aisle
              value={aisle.aisle}
              onChange={(event) => onAisleChange?.(event.target.value)}
              className="h-control-sm rounded-sm border border-border bg-surface px-2 type-body text-ink"
            >
              {labels.aisles.map((option) => (
                <option key={option.aisle} value={option.aisle}>
                  {option.aisle}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="type-page-title">{labelsHeading(aisle.aisle)}</h1>
          <p data-labels-count className="type-body text-ink-secondary">
            {labelsCountLine(aisle.locations.length)}
          </p>
        </div>
      </div>
      <div
        data-paper
        className="mx-auto flex w-full max-w-[210mm] flex-col gap-[2mm] bg-print-paper p-[12mm] text-print-ink shadow-overlay print:max-w-none print:p-0 print:shadow-none"
      >
        {rows(aisle.locations).map((row) => (
          <div key={row[0].code} data-label-row className="grid break-inside-avoid grid-cols-3 gap-[2mm]">
            {row.map((location) => (
              <div
                key={location.code}
                data-label={location.code}
                className="flex h-[36mm] flex-col items-center justify-center gap-[1mm] overflow-hidden border border-print-ink"
              >
                <span className="font-code text-[20pt] leading-none font-bold whitespace-nowrap tabular-nums">
                  {location.code}
                </span>
                <QrCode value={location.code} className="size-[24mm]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A failed summary or labels fetch: the message, and no paper. */
export function LabelsLoadFailed({ error }: { error: Error }) {
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <PlanLoadError message={error.message || LABELS_LOAD_FAILED} />
    </div>
  );
}

function LabelsForImport({ planId, importId, requested }: { planId: string; importId: string; requested?: string }) {
  const router = useRouter();
  const labels = useImportLabels(importId);
  const aisle = labels.data ? chooseAisle(labels.data.aisles, requested) : undefined;
  const replaceWith = aisle !== undefined && aisle.aisle !== requested ? aisle.aisle : undefined;
  useEffect(() => {
    // A missing or unknown `?aisle=` names the aisle on the paper instead.
    if (replaceWith !== undefined) router.replace(planLabelsHref(planId, replaceWith), { scroll: false });
  }, [router, planId, replaceWith]);
  if (labels.error) return <LabelsLoadFailed error={labels.error} />;
  if (!labels.data) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        <PlanOpening planId={planId} />
      </div>
    );
  }
  // An import always has locations; an empty answer is a failed load, not an empty paper.
  if (aisle === undefined) return <LabelsLoadFailed error={new Error(LABELS_LOAD_FAILED)} />;
  return (
    <LabelsView
      planId={planId}
      labels={labels.data}
      aisle={aisle}
      onAisleChange={(next) => router.replace(planLabelsHref(planId, next), { scroll: false })}
    />
  );
}

export function LabelsPage({ planId }: { planId: string }) {
  const { aisle: requested } = parseLocationParams(useSearchParams());
  const summary = usePlanSummary(planId);
  if (summary.data) return <LabelsForImport planId={planId} importId={summary.data.import_id} requested={requested} />;
  if (showsLoadError(summary.error)) return <LabelsLoadFailed error={summary.error} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <PlanOpening planId={planId} />
    </div>
  );
}
