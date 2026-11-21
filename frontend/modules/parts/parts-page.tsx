"use client";

// Parts roster (FR-13, UX-DR18/23/24): every Inventory part in server order (most picks first),
// with its class, picks, current location, total stock, other locations and pick groups. The
// server decides current and other locations; this view only filters by class and sorts. A row
// (click or `Enter`) or a part search result opens the part panel (`?part=`, UX-DR24).

import { type ReactNode, useState } from "react";

import { BinSwatch } from "@/components/common/bin-swatch";
import { CLASS_LABELS, ClassGlyph, type MovementClass } from "@/components/common/class-glyph";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { NO_CURRENT_LOCATION, usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SearchField } from "@/components/common/search-field";
import { type PartRow, type PartsView as PartsData, usePlanParts } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LocationParams } from "@/lib/view-state/urls";

const CLASS_ORDER: readonly MovementClass[] = ["fast", "medium", "slow", "dead"];

export { NO_CURRENT_LOCATION };

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** "Fast-moving · 61 picks · G-14-04-02", or the no-current-location text instead of a code. */
export function whyLine(row: Pick<PartRow, "movement_class" | "picks" | "current_location">): string {
  const where = row.current_location ? row.current_location.code : NO_CURRENT_LOCATION;
  return `${CLASS_LABELS[row.movement_class]} · ${plural(row.picks, "pick", "picks")} · ${where}`;
}

/** The rows of the pressed classes, in the given order; none pressed shows every row. */
export function filterByClass<T extends Pick<PartRow, "movement_class">>(
  rows: readonly T[],
  pressed: ReadonlySet<MovementClass>,
): T[] {
  return pressed.size === 0 ? [...rows] : rows.filter((row) => pressed.has(row.movement_class));
}

/** "1,545 parts", or "80 of 1,545 parts" while a filter is on. */
export function countLine(shown: number, total: number, filtered: boolean): string {
  const noun = total === 1 ? "part" : "parts";
  return filtered ? `${formatNumber(shown)} of ${formatNumber(total)} ${noun}` : `${formatNumber(total)} ${noun}`;
}

export const COLUMNS: readonly DataTableColumn<PartRow>[] = [
  {
    key: "rank",
    header: "#",
    align: "end",
    sortValue: (row) => row.rank,
    sortKind: "number",
    className: "w-12",
    cell: (row) => <span className="type-rank">{row.rank}</span>,
  },
  {
    key: "part",
    header: "Part",
    cell: (row) => (
      <div className="flex items-start gap-2">
        <BinSwatch movementClass={row.movement_class} className="mt-0.5" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="type-part-number text-ink">{row.part}</span>
          <span className="type-body text-ink">{row.description}</span>
          <span className="type-meta text-ink-secondary" data-why-line="">
            {whyLine(row)}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "picks",
    header: "Picks",
    align: "end",
    sortValue: (row) => row.picks,
    sortKind: "number",
    cell: (row) => formatNumber(row.picks),
  },
  {
    key: "total_stock",
    header: "Total stock",
    align: "end",
    sortValue: (row) => row.total_stock_sort_rank,
    sortKind: "number",
    cell: (row) => formatNumber(row.total_stock),
  },
  {
    key: "other_locations",
    header: "Other locations",
    cell: (row) =>
      row.other_locations.length > 0 ? (
        <span className="type-code-table">{row.other_locations.map((ref) => ref.code).join(", ")}</span>
      ) : (
        <span className="text-ink-secondary">None</span>
      ),
  },
  {
    key: "pick_group_count",
    header: "Pick groups",
    align: "end",
    cell: (row) => formatNumber(row.pick_group_count),
  },
  {
    key: "kept_in_place",
    header: "Kept in place",
    cell: (row) =>
      row.kept_in_place ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="pin" size={14} />
          kept in place
        </span>
      ) : null,
  },
];

function ClassChip({
  movementClass,
  pressed,
  onToggle,
}: {
  movementClass: MovementClass;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-class={movementClass}
      onClick={onToggle}
      className={cn(
        "inline-flex h-control-sm items-center gap-1.5 rounded-full border px-2.5 type-button",
        pressed ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink",
      )}
    >
      <ClassGlyph movementClass={movementClass} size={10} color={pressed ? "var(--color-surface)" : undefined} />
      {CLASS_LABELS[movementClass]}
    </button>
  );
}

export function PartsView({
  view,
  search,
  onOpen,
}: {
  view: PartsData;
  /** The header's search field. */
  search?: ReactNode;
  /** Opens a part's panel (row click or `Enter`). */
  onOpen?: (row: PartRow) => void;
}) {
  const [pressed, setPressed] = useState<ReadonlySet<MovementClass>>(new Set());
  const rows = filterByClass(view.parts, pressed);

  function toggle(movementClass: MovementClass) {
    setPressed((current) => {
      const next = new Set(current);
      if (next.has(movementClass)) next.delete(movementClass);
      else next.add(movementClass);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="type-page-title">Parts</h1>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {countLine(rows.length, view.parts.length, pressed.size > 0)}
          </p>
        </div>
        {search}
      </div>
      <div role="group" aria-label="Filter by movement class" className="flex flex-wrap gap-2">
        {CLASS_ORDER.map((movementClass) => (
          <ClassChip
            key={movementClass}
            movementClass={movementClass}
            pressed={pressed.has(movementClass)}
            onToggle={() => toggle(movementClass)}
          />
        ))}
      </div>
      <DataTable
        label="Parts"
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.part}
        onOpen={onOpen}
        className="bg-surface"
      />
    </div>
  );
}

export function PartsPage({ planId, params = {} }: { planId: string; params?: LocationParams }) {
  const parts = usePlanParts(planId);
  const panel = usePartPanel(planId, "parts", params);
  if (parts.data) {
    return (
      <WithPartPanel planId={planId} part={panel.part} onClose={panel.close}>
        <PartsView
          view={parts.data}
          search={<SearchField planId={planId} onOpenPart={panel.open} />}
          onOpen={(row) => panel.open(row.part)}
        />
      </WithPartPanel>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(parts.error) ? <PlanLoadError message={parts.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}
