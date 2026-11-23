"use client";

// Best locations step (FR-21, FR-22, UX-DR, Story 3.4). By default it is the marking wall (Story
// 10.7, `marking-wall.tsx`); **Open as list** (`?mode=list`) shows the milestone 1 table: the
// Locations table in marking mode. A segmented control picks Whole aisle | Level | Single location
// (remembered per plan in this browser); beside the table, the plan's marks with remove buttons and
// the "N best · M empty" counts. Every change goes through lib/commands; best status, counts and
// marks come only from the refetched server views, rendered as one version-consistent set.

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useId, useState } from "react";

import { Button } from "@/components/common/button";
import type { DataTableColumn } from "@/components/common/data-table";
import {
  aisleFromParams,
  ALL_AISLES,
  type LocationFilters,
  LocationsTable,
  NO_FILTERS,
} from "@/components/common/locations-table";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SegmentedControl } from "@/components/common/segmented-control";
import { showToast } from "@/components/common/toast";
import {
  type BestMark,
  type LocationRow,
  type LocationsView as LocationsData,
  type PlanSummary,
  usePlanLocations,
  usePlanSummary,
} from "@/lib/api/plans";
import { type CommandBody, type SendResult, useConsistentPlanQueries, usePlanCommands } from "@/lib/commands";
import { markLabel, OPEN_AS_WALL } from "@/lib/copy";
import { bestLocationsModeKey, writeStored } from "@/lib/view-state/storage";
import { type LocationParams, parseLocationParams, planStepHref, recommendationsTabHref } from "@/lib/view-state/urls";
import { hasLocationMark, type LevelScope, levelsInAisle, type MarkingMode, sameMark } from "./marks";
import { MarksPanel } from "./marks-panel";
import { MODES, SCOPES, readMode, sendMarkChange } from "./marking";
import { BestLocationsWall } from "./marking-wall";

export type { LevelScope, MarkingMode } from "./marks";
export { NO_MARKS } from "./marks-panel";
export { MODES, outdatedCount, readMode, SCOPES, sendMarkChange } from "./marking";
export const CHOOSE_AISLE = "Choose an aisle in the aisle filter.";

/** The mark the mode's Mark button sets, its button text, and why it cannot (if so). */
export type MarkAction = { mark: BestMark | null; text: string; reason?: string };

function alreadyMarked(marks: readonly BestMark[], mark: BestMark): string | undefined {
  return marks.some((existing) => sameMark(existing, mark)) ? `${markLabel(mark)} is already marked.` : undefined;
}

export function aisleAction(aisle: string, marks: readonly BestMark[]): MarkAction {
  if (aisle === ALL_AISLES) return { mark: null, text: "Mark aisle", reason: CHOOSE_AISLE };
  const mark: BestMark = { kind: "aisle", aisle };
  return { mark, text: `Mark aisle ${aisle}`, reason: alreadyMarked(marks, mark) };
}

export function levelAction(level: string, scope: LevelScope, aisle: string, marks: readonly BestMark[]): MarkAction {
  if (scope === "aisle" && aisle === ALL_AISLES) {
    return { mark: null, text: `Mark level ${level} in this aisle`, reason: CHOOSE_AISLE };
  }
  const mark: BestMark = { kind: "level", level, aisle: scope === "all" ? null : aisle };
  const where = scope === "all" ? "in all aisles" : `in aisle ${aisle}`;
  return { mark, text: `Mark level ${level} ${where}`, reason: alreadyMarked(marks, mark) };
}

export function BestLocationsView({
  planId,
  summary,
  view,
  disabledReason,
  onSend,
  onViewOutdated,
  initialAisle,
  onOpenWall,
}: {
  planId: string;
  summary: PlanSummary;
  view: LocationsData;
  /** The aisle filter's first value (`?aisle=` when it is a known aisle). */
  initialAisle?: string;
  /** **Open as wall** with the filter's aisle (undefined for all aisles). */
  onOpenWall?: (aisle: string | undefined) => void;
  /** "Saving the last change…" while a command is unconfirmed (lib/commands). */
  disabledReason?: string;
  onSend: (body: CommandBody) => Promise<SendResult>;
  /** Opens the Outdated recommendations (the mark toast's **View**). */
  onViewOutdated?: () => void;
}) {
  // Mounted only once the views have loaded (client side), so reading storage here is safe.
  const [mode, setMode] = useState<MarkingMode>(() => readMode(planId));
  const [filters, setFilters] = useState<LocationFilters>(() => ({
    ...NO_FILTERS,
    aisle: aisleFromParams({ aisle: initialAisle }, view.aisles),
  }));
  const [scope, setScope] = useState<LevelScope>("aisle");
  const [level, setLevel] = useState("");
  const levelSelect = useId();

  const levelOptions = scope === "aisle" ? levelsInAisle(view.levels, view.locations, filters.aisle) : view.levels;
  const chosenLevel = levelOptions.includes(level) ? level : (levelOptions[0] ?? "");

  async function change(body: CommandBody) {
    await sendMarkChange(onSend, body, showToast, onViewOutdated);
  }

  function changeMode(next: MarkingMode) {
    setMode(next);
    writeStored(bestLocationsModeKey(planId), next);
  }

  const action =
    mode === "aisle"
      ? aisleAction(filters.aisle, view.marks)
      : mode === "level" && chosenLevel !== ""
        ? levelAction(chosenLevel, scope, filters.aisle, view.marks)
        : null;

  const markColumn: DataTableColumn<LocationRow> = {
    key: "mark",
    header: "Mark",
    cell: (row) => {
      const code = row.location.code;
      const marked = hasLocationMark(row);
      return (
        <Button
          variant="tertiary"
          size="sm"
          aria-label={`${marked ? "Unmark" : "Mark"} ${code}`}
          disabledReason={disabledReason}
          onClick={() =>
            void change({
              type: marked ? "remove_best_mark" : "set_best_mark",
              mark: { kind: "location", location: code },
            })
          }
        >
          {marked ? "Unmark" : "Mark"}
        </Button>
      );
    },
  };

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="type-page-title">Best locations</h1>
        {onOpenWall && (
          <Button
            variant="tertiary"
            size="md"
            onClick={() => onOpenWall(filters.aisle === ALL_AISLES ? undefined : filters.aisle)}
          >
            {OPEN_AS_WALL}
          </Button>
        )}
      </div>
      <SegmentedControl label="Marking mode" options={MODES} value={mode} onChange={changeMode} />
      {mode === "level" && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor={levelSelect} className="type-body text-ink">
              Level
            </label>
            <select
              id={levelSelect}
              value={chosenLevel}
              onChange={(event) => setLevel(event.target.value)}
              className="h-control-sm rounded-sm border border-border bg-surface px-2 type-body text-ink"
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <SegmentedControl label="Level scope" options={SCOPES} value={scope} onChange={setScope} />
        </div>
      )}
      {action && (
        <Button
          variant="primary"
          size="md"
          className="w-fit"
          disabledReason={action.reason ?? disabledReason}
          onClick={() => action.mark && void change({ type: "set_best_mark", mark: action.mark })}
        >
          {action.text}
        </Button>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MarksPanel
          marks={view.marks}
          best={summary.best_locations}
          emptyBest={summary.empty_best_locations}
          disabledReason={disabledReason}
          onRemove={(mark) => void change({ type: "remove_best_mark", mark })}
        />
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <LocationsTable
            view={view}
            filters={filters}
            onFiltersChange={setFilters}
            extraColumns={mode === "single" ? [markColumn] : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** The milestone 1 table (`?mode=list`): its own summary + locations consistency, unchanged. */
function BestLocationsList({ planId, params }: { planId: string; params: LocationParams }) {
  const summary = usePlanSummary(planId);
  const locations = usePlanLocations(planId);
  const data = useConsistentPlanQueries([summary, locations]);
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const router = useRouter();
  if (data) {
    const [summaryData, view] = data;
    return (
      <BestLocationsView
        planId={planId}
        summary={summaryData}
        view={view}
        disabledReason={disabledReason}
        onSend={sendWithEvents}
        onViewOutdated={() => router.push(recommendationsTabHref(planId, "outdated"))}
        initialAisle={params.aisle}
        onOpenWall={(aisle) =>
          window.history.replaceState(null, "", planStepHref(planId, "best-locations", { aisle }))
        }
      />
    );
  }
  const error = summary.error ?? locations.error;
  return <StepStatus>{showsLoadError(error) ? <PlanLoadError message={error.message} /> : <PlanOpening planId={planId} />}</StepStatus>;
}

function StepStatus({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 px-page-gutter py-5">{children}</div>;
}

export function BestLocationsPage({ planId }: { planId: string }) {
  // The URL is the one source of the view state: `?aisle=` and `?mode=list` (lib/view-state).
  const params = parseLocationParams(useSearchParams());
  const summary = usePlanSummary(planId);
  if (params.mode === "list") return <BestLocationsList planId={planId} params={params} />;
  if (!summary.data) {
    return (
      <StepStatus>
        {showsLoadError(summary.error) ? <PlanLoadError message={summary.error.message} /> : <PlanOpening planId={planId} />}
      </StepStatus>
    );
  }
  return <BestLocationsWall planId={planId} params={params} importId={summary.data.import_id} />;
}
