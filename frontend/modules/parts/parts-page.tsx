"use client";

// Parts roster (FR-13, UX-DR18/23/24): every Inventory part in server order (most picks first),
// with its class, picks, current location, total stock, other locations and pick groups. The
// server decides current and other locations; this view only filters by class and sorts. A row
// (click or `Enter`) or a part search result opens the part panel (`?part=`, UX-DR24). The
// "Kept in place" column sets or removes a part's keep mark (Story 7.1); a click on its link never
// opens the panel (DataTable skips buttons).

import { createContext, memo, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import { BinSwatch } from "@/components/common/bin-swatch";
import { ClassGlyph, type MovementClass } from "@/components/common/class-glyph";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { KeepInPlaceButton, KeptInPlaceMark, useKeepInPlace } from "@/components/common/keep-in-place";
import { NO_CURRENT_LOCATION, usePanelPlanData, usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SearchField } from "@/components/common/search-field";
import { type PartRow, type PartsView as PartsData, usePlanParts } from "@/lib/api/plans";
import { CLASS_LABELS, KEPT_IN_PLACE } from "@/lib/copy";
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

/** The roster's keep action. A context, not a prop: a change of the saving reason re-renders only
 * the keep cells, never the memoized 1,545-row table. Without a provider the link does nothing. */
export type RosterKeep = { toggle: (part: string, kept: boolean) => unknown; savingReason: string | undefined };
const RosterKeepContext = createContext<RosterKeep>({ toggle: () => undefined, savingReason: undefined });

/** The pin when kept and the link; the link is tabbable only in the active row (`Tab` from the
 * row reaches it, the next `Tab` leaves the table). */
function KeepCell({ row, isActive }: { row: Pick<PartRow, "part" | "kept_in_place">; isActive: boolean }) {
  const { toggle, savingReason } = useContext(RosterKeepContext);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {row.kept_in_place && <KeptInPlaceMark />}
      <KeepInPlaceButton
        kept={row.kept_in_place}
        savingReason={savingReason}
        tabIndex={isActive ? 0 : -1}
        onClick={() => void toggle(row.part, row.kept_in_place)}
      />
    </span>
  );
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
    header: KEPT_IN_PLACE,
    cell: (row, { isActive }) => <KeepCell row={row} isActive={isActive} />,
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

// Memoized: opening or closing the part panel re-renders `PartsPage`, and re-rendering the
// 1,545-row table each time made the panel slow to appear.
export const PartsView = memo(function PartsView({
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
});

export function PartsPage({ planId }: { planId: string; params?: LocationParams }) {
  const parts = usePlanParts(planId);
  const panel = usePartPanel(planId, "parts");
  const open = panel.open;
  // Stable across panel changes so the memoized table does not re-render when a part opens.
  const onOpen = useCallback((row: PartRow) => open(row.part), [open]);
  const search = useMemo(() => <SearchField planId={planId} onOpenPart={open} />, [planId, open]);
  const data = usePanelPlanData(planId, parts, panel.part);
  const { toggle, savingReason } = useKeepInPlace(planId);
  const keep = useMemo(() => ({ toggle, savingReason }), [toggle, savingReason]);
  if (data) {
    return (
      <RosterKeepContext.Provider value={keep}>
        <WithPartPanel
          planId={planId}
          part={panel.part}
          detail={data.detail}
          detailError={data.detailError}
          onClose={panel.close}
        >
          <PartsView view={data.view} search={search} onOpen={onOpen} />
        </WithPartPanel>
      </RosterKeepContext.Provider>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(parts.error) ? <PlanLoadError message={parts.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}
