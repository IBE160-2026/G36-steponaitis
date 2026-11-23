"use client";

// The Best locations marking wall (Story 10.7, FR-21, FR-29, FR-42, UX-DR14/47): the default view
// of the Best locations step. Aisle tabs, the open aisle's wall with its Key, the Marking mode
// (Whole aisle | Level | Single location, with "in this aisle | in all aisles" in Level mode), a
// visible preview and the marks panel with the live counts. A hover or focus on a cell (or, in
// Level mode, on a level row's button) previews the mark; a click or `Enter` sets it, or removes an
// exactly equal mark, through lib/commands. Marking replaces pinning: no dialog, no moves.
//
// One read holds everything: the plan's wall view of the open aisle (its marks, counts, rails,
// frames and tab BEST tags, at one version) over the import's layout. Nothing here computes best
// status or counts; the rails, frames, tags, list and counts redraw only from the refetched view.

import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState } from "react";

import { Button } from "@/components/common/button";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SegmentedControl } from "@/components/common/segmented-control";
import { showToast } from "@/components/common/toast";
import {
  aisleTabId,
  AisleTabs,
  AisleWall,
  Key,
  LABEL_WIDTH,
  PAD,
  ROW_HEIGHT,
  runTops,
  runWidth,
  SECTION_HEADER,
  type WallMarking,
} from "@/components/common/wall";
import { type AisleLayout, type LayoutView, useImportLayout } from "@/lib/api/imports";
import { type BestMark, usePlanWall, type WallLocation, type WallView } from "@/lib/api/plans";
import { type CommandBody, type SendResult, usePlanCommands } from "@/lib/commands";
import { aisleHeading, OPEN_AS_LIST, OPENING_AISLE_REASON, wallAisleLine } from "@/lib/copy";
import { bestLocationsModeKey, writeStored } from "@/lib/view-state/storage";
import { type LocationParams, planStepHref, recommendationsTabHref } from "@/lib/view-state/urls";

import { MODES, readMode, SCOPES, sendMarkChange } from "./marking";
import {
  type LevelScope,
  levelMark,
  markCommand,
  markFor,
  type MarkingMode,
  markPreview,
  type MarkPreview,
} from "./marks";
import { MarksPanel } from "./marks-panel";

/** The aisle the wall opens on: `?aisle=` when the layout has it, else the first layout aisle. */
export function markingAisle(requested: string | undefined, aisles: readonly string[]): string | undefined {
  return requested !== undefined && aisles.includes(requested) ? requested : aisles[0];
}

/** What a click on a cell does in `mode`/`scope`, against the plan's current marks. */
export function cellPreview(
  mode: MarkingMode,
  scope: LevelScope,
  location: Pick<WallLocation, "location">,
  marks: readonly BestMark[],
): MarkPreview {
  return markPreview(markFor(mode, scope, location.location), marks);
}

/**
 * The wall grid's `marking` prop: previews and marks a cell in `mode`/`scope`. A click while
 * `disabledReason` is set sends nothing (the grid also holds it back).
 */
export function wallMarking({
  mode,
  scope,
  marks,
  disabledReason,
  send,
  onPreview,
}: {
  mode: MarkingMode;
  scope: LevelScope;
  marks: readonly BestMark[];
  disabledReason?: string;
  send: (body: CommandBody) => void;
  onPreview?: (location: WallLocation | null) => void;
}): WallMarking {
  return {
    preview: (location) => cellPreview(mode, scope, location, marks).text,
    onMark: (location) => {
      if (disabledReason !== undefined) return;
      send(markCommand(cellPreview(mode, scope, location, marks)));
    },
    disabledReason,
    onPreview,
  };
}

/** A level row's hit area in drawn pixels: from the level label to the run's right edge. */
export function levelRowBoxes(
  layout: Pick<AisleLayout, "runs">,
  scale: number,
): { key: string; level: string; left: number; top: number; width: number; height: number }[] {
  const tops = runTops(layout);
  return layout.runs.flatMap((run, runIndex) =>
    run.levels.map((level, row) => ({
      key: `${runIndex}-${level}`,
      level,
      left: PAD * scale,
      top: ((tops[runIndex] ?? 0) + SECTION_HEADER + row * ROW_HEIGHT) * scale,
      width: (LABEL_WIDTH + runWidth(run)) * scale,
      height: ROW_HEIGHT * scale,
    })),
  );
}

/** Level mode: one button per run's level row, under the grid cells (a cell click marks the same level). */
function LevelButtons({
  layout,
  scale,
  preview,
  onMark,
  onHover,
  onFocusLevel,
  disabledReason,
}: {
  layout: AisleLayout;
  scale: number;
  preview: (level: string) => string;
  onMark: (level: string) => void;
  onHover: (level: string | null) => void;
  onFocusLevel: (level: string | null) => void;
  disabledReason?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" data-surface="graphite" data-level-marks="">
      {levelRowBoxes(layout, scale).map((box) => (
        <button
          key={box.key}
          type="button"
          aria-label={preview(box.level)}
          aria-disabled={disabledReason !== undefined ? true : undefined}
          data-level-mark={box.level}
          className="pointer-events-auto absolute cursor-pointer rounded-sm bg-transparent outline-none"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onClick={() => {
            if (disabledReason === undefined) onMark(box.level);
          }}
          onPointerEnter={() => onHover(box.level)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onFocusLevel(box.level)}
          onBlur={() => onFocusLevel(null)}
        />
      ))}
    </div>
  );
}

export function MarkingWall({
  planId,
  view,
  layout,
  selected,
  onSelect,
  onOpenList,
  disabledReason,
  onSend,
  onViewOutdated,
}: {
  planId: string;
  /** The plan's wall view of the open aisle (may still be the previous aisle while the next loads). */
  view: WallView;
  layout: LayoutView | undefined;
  /** The chosen aisle (its tab is selected). */
  selected: string;
  onSelect: (aisle: string) => void;
  onOpenList: () => void;
  /** "Saving the last change…" while a command is unconfirmed (lib/commands). */
  disabledReason?: string;
  onSend: (body: CommandBody) => Promise<SendResult>;
  /** Opens the Outdated recommendations (the mark toast's **View**). */
  onViewOutdated?: () => void;
}) {
  // Mounted only once the views have loaded (client side), so reading storage here is safe.
  const [mode, setMode] = useState<MarkingMode>(() => readMode(planId));
  const [scope, setScope] = useState<LevelScope>("aisle");
  // What the visible preview names: the hovered level button, else the hovered or focused cell,
  // else the focused level button. Each remembers its aisle, so another aisle's target never shows.
  const [cellTarget, setCellTarget] = useState<WallLocation | null>(null);
  const [levelHover, setLevelHover] = useState<string | null>(null);
  const [levelFocus, setLevelFocus] = useState<string | null>(null);
  const idPrefix = useId();
  const panelId = `${idPrefix}-panel`;
  const aisle = view.aisle;
  const counts = view.aisles.find((entry) => entry.aisle === aisle);
  const aisleLayout = layout?.aisles.find((entry) => entry.aisle === aisle);
  // While the chosen aisle's view loads, the previous aisle is still drawn: marking it is held back.
  const markReason = disabledReason ?? (aisle !== selected ? OPENING_AISLE_REASON : undefined);

  function change(body: CommandBody) {
    void sendMarkChange(onSend, body, showToast, onViewOutdated);
  }

  function changeMode(next: MarkingMode) {
    setMode(next);
    setLevelHover(null);
    setLevelFocus(null);
    writeStored(bestLocationsModeKey(planId), next);
  }

  function select(next: string) {
    setCellTarget(null);
    setLevelHover(null);
    setLevelFocus(null);
    onSelect(next);
  }

  const levelPreview = (level: string) => markPreview(levelMark(level, scope, aisle), view.marks);
  const marking = wallMarking({
    mode,
    scope,
    marks: view.marks,
    disabledReason: markReason,
    send: change,
    onPreview: setCellTarget,
  });

  const levelButtonTarget = mode === "level" ? levelHover : null;
  const levelFocusTarget = mode === "level" ? levelFocus : null;
  const cell = cellTarget !== null && cellTarget.location.aisle === aisle ? cellTarget : null;
  const previewText =
    levelButtonTarget !== null
      ? levelPreview(levelButtonTarget).text
      : cell !== null
        ? marking.preview(cell)
        : levelFocusTarget !== null
          ? levelPreview(levelFocusTarget).text
          : "";

  const overlay =
    mode === "level" && aisleLayout
      ? (scale: number): ReactNode => (
          <LevelButtons
            layout={aisleLayout}
            scale={scale}
            preview={(level) => levelPreview(level).text}
            onMark={(level) => change(markCommand(levelPreview(level)))}
            onHover={setLevelHover}
            onFocusLevel={setLevelFocus}
            disabledReason={markReason}
          />
        )
      : undefined;

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="type-page-title">Best locations</h1>
        <Button variant="tertiary" size="md" onClick={onOpenList}>
          {OPEN_AS_LIST}
        </Button>
      </div>
      <AisleTabs aisles={view.aisles} selected={selected} onSelect={select} idPrefix={idPrefix} panelId={panelId} />
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl label="Marking mode" options={MODES} value={mode} onChange={changeMode} />
        {mode === "level" && <SegmentedControl label="Level scope" options={SCOPES} value={scope} onChange={setScope} />}
      </div>
      <p className="min-h-[1lh] type-body-strong text-ink" data-mark-preview="">
        {previewText}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MarksPanel
          marks={view.marks}
          best={view.warehouse.best}
          emptyBest={view.warehouse.empty_best}
          disabledReason={disabledReason}
          onRemove={(mark) => change({ type: "remove_best_mark", mark })}
        />
        <section
          role="tabpanel"
          id={panelId}
          aria-labelledby={aisleTabId(idPrefix, selected)}
          aria-busy={aisle !== selected ? true : undefined}
          className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1"
          data-wall-aisle={aisle}
        >
          <div className="flex flex-col gap-1">
            <h2 className="type-section-title">{aisleHeading(aisle)}</h2>
            {counts && aisleLayout && (
              <p className="type-body text-ink-secondary" data-aisle-line="">
                {wallAisleLine(counts, aisleLayout.walk_path_first, aisleLayout.walk_path_last)}
              </p>
            )}
          </div>
          {aisleLayout && (
            <AisleWall
              key={aisle}
              layout={aisleLayout}
              wall={view}
              showMoves={false}
              overlay={overlay}
              marking={marking}
            />
          )}
          <Key />
        </section>
      </div>
    </div>
  );
}

/** The marking wall step: the layout and the plan's wall view of the chosen aisle. */
export function BestLocationsWall({
  planId,
  params,
  importId,
}: {
  planId: string;
  params: LocationParams;
  importId: string;
}) {
  const layout = useImportLayout(importId);
  const aisles = layout.data?.aisles.map((entry) => entry.aisle) ?? [];
  const aisle = markingAisle(params.aisle, aisles);
  const wall = usePlanWall(planId, aisle ?? "", aisle !== undefined);
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const router = useRouter();

  if (!wall.data || aisle === undefined) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        {showsLoadError(layout.error) ? (
          <PlanLoadError message={layout.error.message} />
        ) : showsLoadError(wall.error) ? (
          <PlanLoadError message={wall.error.message} />
        ) : (
          <PlanOpening planId={planId} />
        )}
      </div>
    );
  }
  return (
    <MarkingWall
      planId={planId}
      view={wall.data}
      layout={layout.data}
      selected={aisle}
      onSelect={(next) =>
        window.history.replaceState(null, "", planStepHref(planId, "best-locations", { aisle: next }))
      }
      onOpenList={() =>
        window.history.replaceState(null, "", planStepHref(planId, "best-locations", { aisle, mode: "list" }))
      }
      disabledReason={disabledReason}
      onSend={sendWithEvents}
      onViewOutdated={() => router.push(recommendationsTabHref(planId, "outdated"))}
    />
  );
}
