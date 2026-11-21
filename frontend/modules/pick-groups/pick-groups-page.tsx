"use client";

// Pick groups table (FR-20, UX-DR29): every stored pick group in server order (most shared jobs
// first) with both parts, the shared jobs, each part's aisle and whether the two share an aisle.
// Aisles and same aisle come from the server (AD-3); the page never computes them and offers no
// sorts or filters.

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import {
  type PickGroupPart,
  type PickGroupRow,
  type PickGroupsView as PickGroupsData,
  usePlanPickGroups,
} from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";

export const EMPTY_MESSAGE = "No pick groups: no two parts share 5 or more jobs in the period.";

/** "10 pick groups" (singular "1 pick group"). */
export function groupCountLine(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "pick group" : "pick groups"}`;
}

function PartCell({ part }: { part: PickGroupPart }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="type-code-table text-ink">{part.part}</span>
      <span className="type-body text-ink">{part.description}</span>
    </div>
  );
}

function AisleCell({ aisle }: { aisle: string | null }) {
  return aisle === null ? <span className="text-ink-secondary">No current location</span> : aisle;
}

export const COLUMNS: readonly DataTableColumn<PickGroupRow>[] = [
  { key: "part_a", header: "Part A", cell: (row) => <PartCell part={row.part_a} /> },
  { key: "part_b", header: "Part B", cell: (row) => <PartCell part={row.part_b} /> },
  { key: "shared_jobs", header: "Shared jobs", align: "end", cell: (row) => formatNumber(row.shared_jobs) },
  { key: "aisle_a", header: "Aisle of part A", cell: (row) => <AisleCell aisle={row.part_a.aisle} /> },
  { key: "aisle_b", header: "Aisle of part B", cell: (row) => <AisleCell aisle={row.part_b.aisle} /> },
  {
    key: "same_aisle",
    header: "Same aisle",
    cell: (row) =>
      row.same_aisle ? (
        <span className="inline-flex items-center gap-1 text-ink" data-same-aisle="true">
          <Icon name="link" size={14} />
          Same aisle
        </span>
      ) : (
        <span className="text-ink-secondary" data-same-aisle="false">
          Different aisles
        </span>
      ),
  },
];

export function PickGroupsView({ view }: { view: PickGroupsData }) {
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <h1 className="type-page-title">Pick groups</h1>
      {view.pick_groups.length === 0 ? (
        <p className="type-body text-ink-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{groupCountLine(view.pick_groups.length)}</p>
          <DataTable
            label="Pick groups"
            columns={COLUMNS}
            rows={view.pick_groups}
            rowKey={(row) => `${row.part_a.part}\u0000${row.part_b.part}`}
            className="bg-surface"
          />
        </>
      )}
    </div>
  );
}

export function PickGroupsPage({ planId }: { planId: string }) {
  const pickGroups = usePlanPickGroups(planId);
  if (pickGroups.data) return <PickGroupsView view={pickGroups.data} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(pickGroups.error) ? (
        <PlanLoadError message={pickGroups.error.message} />
      ) : (
        <PlanOpening planId={planId} />
      )}
    </div>
  );
}
