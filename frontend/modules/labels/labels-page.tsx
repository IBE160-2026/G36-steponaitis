"use client";

// Location labels print view (Story 14.1, FR-48, NFR-9): an aisle picker, a paper preview of the
// chosen aisle's labels, and Print (the only primary button). A label is one (location, part) the
// plan stocks: the location code in large text, a QR code that encodes exactly the part number,
// and the part number in small text (decided 2026-11-28). Aisles and their labels render exactly
// in response order: the server owns membership, Walk Path order and part order, and the client
// never sorts, filters or parses codes (AD-3). The labels are a plan view: a confirmed command
// refetches them, and Print prints what the page shows. So Print is disabled while they are being
// fetched, after a failed refetch (its error shows above the stale paper) and on an aisle without
// labels. In print media only the paper prints: the toolbar and the error are `print:hidden`, the
// paper drops its gutter and shadow, and each row of 3 labels avoids a page break; `@page` is in
// globals.css.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { type AisleLabels, type Label, type LabelsView as LabelsData, usePlanLabels } from "@/lib/api/plans";
import {
  BACK_TO_OVERVIEW,
  LABELS_AFTER_MOVES,
  LABELS_AISLE,
  LABELS_EMPTY_AISLE,
  LABELS_LOAD_FAILED,
  LABELS_PRINT_BUSY,
  labelsCountLine,
  labelsHeading,
  NO_LABELS_TO_PRINT,
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

/** A label's React key: a (location, part) pair is one label. */
function labelKey(label: Label): string {
  return JSON.stringify([label.location.code, label.part]);
}

/** The labels in rows of `LABELS_PER_ROW`, in response order. */
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
  /** True while the labels are being fetched: the paper may be older than the plan, so Print waits. */
  fetching?: boolean;
  /** The error of the latest fetch (a failed refetch of labels still shown): shown above the paper. */
  error?: Error | null;
};

/** The print view: toolbar (Print, Back to Overview, aisle picker, heading, count), any fetch error, then the paper. */
export function LabelsView({
  planId,
  labels,
  aisle,
  onAisleChange,
  onPrint = printLabels,
  fetching = false,
  error = null,
}: LabelsViewProps) {
  const failed = showsLoadError(error);
  const disabledReason = fetching
    ? LABELS_PRINT_BUSY
    : failed
      ? LABELS_LOAD_FAILED
      : aisle.labels.length === 0
        ? NO_LABELS_TO_PRINT
        : undefined;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5 print:p-0">
      <div data-labels-toolbar className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabledReason={disabledReason} aria-busy={fetching || undefined} onClick={onPrint}>
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
            {labelsCountLine(aisle.labels.length)}
          </p>
          {aisle.labels.length === 0 && (
            <p data-labels-empty className="type-body text-ink">
              {LABELS_EMPTY_AISLE}
            </p>
          )}
          <p data-labels-note className="type-body text-ink-secondary">
            {LABELS_AFTER_MOVES}
          </p>
        </div>
      </div>
      {failed ? (
        <div data-labels-error className="print:hidden">
          <PlanLoadError message={error.message || LABELS_LOAD_FAILED} />
        </div>
      ) : null}
      <div
        data-paper
        className="mx-auto flex w-full max-w-[210mm] flex-col gap-[2mm] bg-print-paper p-[12mm] text-print-ink shadow-overlay print:max-w-none print:p-0 print:shadow-none"
      >
        {rows(aisle.labels).map((row) => (
          <div key={labelKey(row[0])} data-label-row className="grid break-inside-avoid grid-cols-3 gap-[2mm]">
            {row.map((label) => (
              // 36mm holds the 20pt code line, a 22mm QR code and the 9pt part line with 1mm gaps. A
              // part number wider than the card ends with an ellipsis (the QR code holds all of it);
              // the part line's taller line box keeps `truncate` from cutting descenders.
              <div
                key={labelKey(label)}
                data-label={label.location.code}
                data-label-part={label.part}
                className="flex h-[36mm] flex-col items-center justify-center gap-[1mm] overflow-hidden border border-print-ink"
              >
                <span className="font-code text-[20pt] leading-none font-bold whitespace-nowrap tabular-nums">
                  {label.location.code}
                </span>
                <QrCode value={label.part} className="size-[22mm] shrink-0" />
                <span
                  data-label-part-text
                  className="max-w-full truncate px-[1mm] font-code text-[9pt] leading-tight tabular-nums"
                >
                  {label.part}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A failed labels fetch: the message, and no paper. */
export function LabelsLoadFailed({ error }: { error: Error }) {
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <PlanLoadError message={error.message || LABELS_LOAD_FAILED} />
    </div>
  );
}

export function LabelsPage({ planId }: { planId: string }) {
  const router = useRouter();
  const { aisle: requested } = parseLocationParams(useSearchParams());
  const labels = usePlanLabels(planId);
  const aisle = labels.data ? chooseAisle(labels.data.aisles, requested) : undefined;
  const replaceWith = aisle !== undefined && aisle.aisle !== requested ? aisle.aisle : undefined;
  useEffect(() => {
    // A missing or unknown `?aisle=` names the aisle on the paper instead.
    if (replaceWith !== undefined) router.replace(planLabelsHref(planId, replaceWith), { scroll: false });
  }, [router, planId, replaceWith]);
  if (!labels.data) {
    // A deleted plan (`plan_not_found`) stays on the opening text: the shared query hook handles it.
    if (showsLoadError(labels.error)) return <LabelsLoadFailed error={labels.error} />;
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        <PlanOpening planId={planId} />
      </div>
    );
  }
  // An import always has locations; an answer without aisles is a failed load, not an empty paper.
  if (aisle === undefined) return <LabelsLoadFailed error={new Error(LABELS_LOAD_FAILED)} />;
  return (
    <LabelsView
      planId={planId}
      labels={labels.data}
      aisle={aisle}
      onAisleChange={(next) => router.replace(planLabelsHref(planId, next), { scroll: false })}
      fetching={labels.isFetching}
      error={labels.error}
    />
  );
}
