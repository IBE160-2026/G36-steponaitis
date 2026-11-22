"use client";

// Best locations step (FR-21, FR-22, UX-DR, Story 3.4): the Locations table in marking mode. A
// segmented control picks Whole aisle | Level | Single location (remembered per plan in this
// browser); beside the table, the plan's marks with remove buttons and the "N best · M empty"
// counts. Every change goes through lib/commands; best status, counts and marks come only from the
// refetched server views, rendered as one version-consistent set.

import { useId, useState } from "react";

import { Button } from "@/components/common/button";
import type { DataTableColumn } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { ALL_AISLES, type LocationFilters, LocationsTable, NO_FILTERS } from "@/components/common/locations-table";
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
import { bestLocationsModeKey, readStored, writeStored } from "@/lib/view-state/storage";
import { bestCountsLine, hasLocationMark, levelsInAisle, markLabel, sameMark } from "./marks";

export type MarkingMode = "aisle" | "level" | "single";
export type LevelScope = "aisle" | "all";

export const MARKS_CHANGED = "Best-location marks changed.";
export const NO_MARKS = "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations.";
export const CHOOSE_AISLE = "Choose an aisle in the aisle filter.";

const MODES: readonly { value: MarkingMode; label: string }[] = [
  { value: "aisle", label: "Whole aisle" },
  { value: "level", label: "Level" },
  { value: "single", label: "Single location" },
];

const SCOPES: readonly { value: LevelScope; label: string }[] = [
  { value: "aisle", label: "in this aisle" },
  { value: "all", label: "in all aisles" },
];

/** The plan's remembered marking mode; Whole aisle when none is stored or storage fails. */
export function readMode(planId: string): MarkingMode {
  const stored = readStored(bestLocationsModeKey(planId));
  return MODES.find((mode) => mode.value === stored)?.value ?? "aisle";
}

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

/**
 * Sends one mark change; the toast shows only for a confirmed change that produced events
 * ("dropped"/"busy" and a confirmed no-op show none).
 */
export async function sendMarkChange(
  send: (body: CommandBody) => Promise<SendResult>,
  body: CommandBody,
  notify: (message: string) => void = showToast,
): Promise<SendResult> {
  const result = await send(body);
  if (result.outcome === "confirmed" && result.events.length > 0) notify(MARKS_CHANGED);
  return result;
}

export function BestLocationsView({
  planId,
  summary,
  view,
  disabledReason,
  onSend,
}: {
  planId: string;
  summary: PlanSummary;
  view: LocationsData;
  /** "Saving the last change…" while a command is unconfirmed (lib/commands). */
  disabledReason?: string;
  onSend: (body: CommandBody) => Promise<SendResult>;
}) {
  // Mounted only once the views have loaded (client side), so reading storage here is safe.
  const [mode, setMode] = useState<MarkingMode>(() => readMode(planId));
  const [filters, setFilters] = useState<LocationFilters>(NO_FILTERS);
  const [scope, setScope] = useState<LevelScope>("aisle");
  const [level, setLevel] = useState("");
  const levelSelect = useId();
  const marksHeading = useId();

  const levelOptions = scope === "aisle" ? levelsInAisle(view.levels, view.locations, filters.aisle) : view.levels;
  const chosenLevel = levelOptions.includes(level) ? level : (levelOptions[0] ?? "");

  async function change(body: CommandBody) {
    await sendMarkChange(onSend, body);
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
      <h1 className="type-page-title">Best locations</h1>
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
        <section
          aria-labelledby={marksHeading}
          className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:self-start"
        >
          <h2 id={marksHeading} className="type-section-title">
            Marks
          </h2>
          <p className="type-body text-ink" aria-live="polite" data-testid="best-counts">
            {bestCountsLine(summary.best_locations, summary.empty_best_locations)}
          </p>
          {view.marks.length === 0 ? (
            <p className="type-body text-ink-secondary">{NO_MARKS}</p>
          ) : (
            <ul className="flex flex-col gap-1" aria-label="Best-location marks">
              {view.marks.map((mark) => {
                const label = markLabel(mark);
                return (
                  <li key={label} className="flex items-center justify-between gap-2 type-body text-ink">
                    <span>{label}</span>
                    <Button
                      variant="tertiary"
                      size="sm"
                      className="w-control-sm min-w-control-sm px-0"
                      aria-label={`Remove mark ${label}`}
                      disabledReason={disabledReason}
                      onClick={() => void change({ type: "remove_best_mark", mark })}
                    >
                      <Icon name="close" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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

export function BestLocationsPage({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  const locations = usePlanLocations(planId);
  const data = useConsistentPlanQueries([summary, locations]);
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  if (data) {
    const [summaryData, view] = data;
    return (
      <BestLocationsView
        planId={planId}
        summary={summaryData}
        view={view}
        disabledReason={disabledReason}
        onSend={sendWithEvents}
      />
    );
  }
  const error = summary.error ?? locations.error;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(error) ? <PlanLoadError message={error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}
