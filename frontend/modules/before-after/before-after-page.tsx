"use client";

// Before/after (FR-37, UX-DR51): one row per aisle in server order plus a total row. Each count
// cell reads "Before → After", the after value in body-strong when it differs; each aisle lists
// the parts moving in and out. Every count, list and whether there are moves comes from the
// server (AD-3); the page computes none of them. "best" is a word in the column head, never a
// colour. The table is one tab stop with ↑/↓ between rows (DataTable).

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import {
  type AisleBeforeAfter,
  type BeforeAfterCount,
  type BeforeAfterView as BeforeAfterData,
  usePlanBeforeAfter,
} from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";

export const NO_MOVES = "No moves yet: before and after are the same.";

type CountField = "fast_in_best" | "pick_groups_together" | "occupied" | "empty";

/** A table row: an aisle (with its in/out lists) or the total (no lists). */
type Row = { key: string; label: string; aisle: AisleBeforeAfter | null } & Record<CountField, BeforeAfterCount>;

function CountCell({ field, count }: { field: CountField; count: BeforeAfterCount }) {
  const changed = count.after !== count.before;
  return (
    <span data-count={field} className="whitespace-nowrap tabular-nums">
      {formatNumber(count.before)} →{" "}
      {changed ? <span className="type-body-strong">{formatNumber(count.after)}</span> : formatNumber(count.after)}
    </span>
  );
}

function PartList({ parts }: { parts: readonly string[] }) {
  if (parts.length === 0) return <span className="text-ink-secondary">None</span>;
  return <span className="type-code-table text-ink">{parts.join(", ")}</span>;
}

function countColumn(field: CountField, header: string): DataTableColumn<Row> {
  return { key: field, header, align: "end", cell: (row) => <CountCell field={field} count={row[field]} /> };
}

export const COLUMNS: readonly DataTableColumn<Row>[] = [
  {
    key: "aisle",
    header: "Aisle",
    cell: (row) => (row.aisle === null ? <span className="type-body-strong">{row.label}</span> : row.label),
  },
  { key: "moved_in", header: "Moved in", cell: (row) => (row.aisle ? <PartList parts={row.aisle.moved_in} /> : null) },
  {
    key: "moved_out",
    header: "Moved out",
    cell: (row) => (row.aisle ? <PartList parts={row.aisle.moved_out} /> : null),
  },
  countColumn("fast_in_best", "Fast-moving in best locations"),
  countColumn("pick_groups_together", "Pick groups in the same aisle"),
  countColumn("occupied", "Occupied"),
  countColumn("empty", "Empty"),
];

/** The server's aisles in server order, then the total row. */
export function beforeAfterRows(view: BeforeAfterData): Row[] {
  const counts = (from: Record<CountField, BeforeAfterCount>) => ({
    fast_in_best: from.fast_in_best,
    pick_groups_together: from.pick_groups_together,
    occupied: from.occupied,
    empty: from.empty,
  });
  return [
    ...view.aisles.map((aisle) => ({ key: `aisle:${aisle.aisle}`, label: aisle.aisle, aisle, ...counts(aisle) })),
    { key: "total", label: "Total", aisle: null, ...counts(view.total) },
  ];
}

export function BeforeAfterView({ view }: { view: BeforeAfterData }) {
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <h1 className="type-page-title">Before/after</h1>
      {view.has_moves ? null : <p className="type-body text-ink-secondary">{NO_MOVES}</p>}
      <DataTable
        label="Before/after"
        columns={COLUMNS}
        rows={beforeAfterRows(view)}
        rowKey={(row) => row.key}
        className="bg-surface"
      />
    </div>
  );
}

export function BeforeAfterPage({ planId }: { planId: string }) {
  const beforeAfter = usePlanBeforeAfter(planId);
  if (beforeAfter.data) return <BeforeAfterView view={beforeAfter.data} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(beforeAfter.error) ? (
        <PlanLoadError message={beforeAfter.error.message} />
      ) : (
        <PlanOpening planId={planId} />
      )}
    </div>
  );
}
