"use client";

// Wall crops in the recommendation detail (Story 10.5, FR-42, UX-DR34/57/58): a recommendation's
// move drawn in its shelf context with the shared wall primitives. Each end's aisle, level and
// cell come from the import layout (AD-15: no code is parsed here); the occupancy, best and moves
// come from the plan's wall view of that aisle, shown only at the recommendations view's version
// (AD-12). The crops are pictures (`role="img"`, no tab stops); Show on the Locations wall opens
// the wall itself with the move selected. Under the crops, the planning copy's last moves (the
// server's `recent_moves`, in server order) and what Undo reverses first.

import Link from "next/link";
import { useId, useSyncExternalStore } from "react";

import {
  cellGeometry,
  cropLayout,
  Key,
  moveKey,
  moveMarks,
  WallMoveMarkers,
  WallPanel,
  wallCells,
  wallNaturalSize,
} from "@/components/common/wall";
import { type AisleLayout, type LayoutView, useImportLayout } from "@/lib/api/imports";
import {
  type LocationRef,
  type RecentMove,
  type RecommendationRow,
  type UndoPreview,
  usePlanWall,
  type WallView,
} from "@/lib/api/plans";
import {
  type CropEnd,
  cropCaption,
  cropFromHeading,
  cropName,
  cropToHeading,
  NO_RECENT_MOVES,
  RECENT_MOVES_TITLE,
  recentMoveText,
  SHOW_ON_LOCATIONS_WALL,
  undoFirstText,
} from "@/lib/copy";
import { planStepHref } from "@/lib/view-state/urls";

import { effectiveTo } from "./list";

// --- Sections per crop (UX-DR58): 2 at 1280–1439px, otherwise 3 ---

export const CROP_NARROW_QUERY = "(min-width: 1280px) and (max-width: 1439px)";

/** The sections (or positions) a crop shows: 2 when the viewport is 1280–1439px wide, else 3. */
export function cropSections(narrow: boolean): number {
  return narrow ? 2 : 3;
}

function narrowMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(CROP_NARROW_QUERY);
}

/** The crops' sections for the current viewport; read on the client, 3 on the server (SSR-safe). */
export function currentCropSections(): number {
  return cropSections(narrowMedia()?.matches ?? false);
}

function subscribeNarrow(onChange: () => void): () => void {
  const media = narrowMedia();
  if (media === null) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useCropSections(): number {
  return useSyncExternalStore(subscribeNarrow, currentCropSections, () => cropSections(false));
}

// --- Which crops a recommendation gets (pure) ---

/** A location found in the import layout: its aisle's layout and its `LocationRef`. */
export type LayoutEnd = { layout: AisleLayout; location: LocationRef };

/** The layout cell holding `code`, by its `LocationRef` (never by parsing the code). */
export function findLayoutEnd(layout: LayoutView, code: string): LayoutEnd | undefined {
  for (const aisle of layout.aisles) {
    const cell = aisle.cells.find((candidate) => candidate.location?.code === code);
    if (cell?.location) return { layout: aisle, location: cell.location };
  }
  return undefined;
}

export type CropSpec = {
  aisle: string;
  layout: AisleLayout;
  /** "From aisle G" / "To aisle A" over a cross-aisle move's crops; none for a single crop. */
  heading?: string;
};

export type CropPlan = {
  crops: CropSpec[];
  /** Every crop's accessible name: the whole move with each end's aisle and level. */
  name: string;
};

/**
 * The crops of `row` (UX-DR57): one crop around both ends when they share an aisle, else a From
 * crop over a To crop. An end not in the layout gets no crop; null when neither is.
 */
export function cropPlan(layout: LayoutView, row: RecommendationRow, sections: number): CropPlan | null {
  const toCode = effectiveTo(row).location;
  const from = findLayoutEnd(layout, row.from_location);
  const to = findLayoutEnd(layout, toCode);
  if (!from && !to) return null;
  const end = (code: string, found: LayoutEnd | undefined, best: boolean): CropEnd =>
    found ? { code, aisle: found.location.aisle, level: found.location.level, best } : { code, best };
  const name = cropName(end(row.from_location, from, row.from_best), end(toCode, to, effectiveTo(row).best));
  const crops: CropSpec[] = [];
  if (from && to && from.layout.aisle === to.layout.aisle) {
    const crop = cropLayout(from.layout, [row.from_location, toCode], sections);
    if (crop) crops.push({ aisle: from.layout.aisle, layout: crop });
  } else {
    const fromCrop = from && cropLayout(from.layout, [row.from_location], sections);
    const toCrop = to && cropLayout(to.layout, [toCode], sections);
    if (from && fromCrop) crops.push({ aisle: from.layout.aisle, layout: fromCrop, heading: cropFromHeading(from.layout.aisle) });
    if (to && toCrop) crops.push({ aisle: to.layout.aisle, layout: toCrop, heading: cropToHeading(to.layout.aisle) });
  }
  if (crops.length === 0) return null;
  return { crops, name };
}

// --- Drawing ---

/** One crop: the wall view's cells, the moves' marks and the selected move's arrow; a placeholder until the versions agree. */
export function CropWall({
  crop,
  wall,
  version,
  recId,
  name,
}: {
  crop: CropSpec;
  /** The plan's wall view of `crop.aisle`; drawn only at `version` (AD-12). */
  wall: WallView | undefined;
  version: number;
  recId: string;
  name: string;
}) {
  const size = wallNaturalSize(crop.layout);
  if (wall === undefined || wall.version !== version || wall.aisle !== crop.aisle) {
    return (
      <div
        aria-hidden="true"
        className="shrink-0 rounded-lg bg-band"
        style={{ width: size.width, height: size.height }}
        data-crop-placeholder={crop.aisle}
      />
    );
  }
  const cells = wallCells(crop.layout, wall);
  const geometry = cellGeometry(crop.layout, cells);
  const marks = moveMarks(wall.moves, (code) => geometry.has(code), recId);
  const selected = wall.moves.find((move) => moveKey(move) === recId);
  const selectedEnds = selected && { from: selected.from_location.code, to: selected.to_location.code };
  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }} data-crop={crop.aisle}>
      <WallPanel
        layout={crop.layout}
        cells={cells}
        railLevels={wall.rail_levels}
        label={name}
        marks={marks}
        selectedEnds={selectedEnds}
        endCap={false}
      />
      {marks.length > 0 && (
        <WallMoveMarkers marks={marks} geometry={geometry} size={size} scale={1} interactive={false} />
      )}
    </div>
  );
}

/** The crops of a planned move, the caption between (or under) them and the Key once under them. */
export function CropsView({
  plan,
  walls,
  version,
  row,
  round,
}: {
  plan: CropPlan;
  /** The plan's wall views by aisle. */
  walls: Readonly<Record<string, WallView | undefined>>;
  version: number;
  row: RecommendationRow;
  round: number;
}) {
  const caption = (
    <p className="type-caption font-medium text-ink-secondary" data-crop-caption="">
      {cropCaption(row.rule, round)}
    </p>
  );
  return (
    <div
      tabIndex={-1}
      className="flex max-h-[80vh] max-w-full flex-col gap-2 overflow-auto outline-none"
      data-crops=""
    >
      {plan.crops.map((crop, index) => (
        <div key={`${index}:${crop.aisle}`} className="flex flex-col gap-2">
          {crop.heading && <p className="type-caption font-medium text-ink">{crop.heading}</p>}
          <CropWall crop={crop} wall={walls[crop.aisle]} version={version} recId={row.id} name={plan.name} />
          {index === 0 && caption}
        </div>
      ))}
      <Key />
    </div>
  );
}

/** A fixed-height space while the layout loads, so the detail does not jump. */
function CropsLoading() {
  return <div aria-hidden="true" className="h-40 rounded-lg bg-band" data-crop-placeholder="" />;
}

/** The page's crops for one recommendation: the layout and the walls of its aisles, read by hooks. */
export function RecommendationCrops({
  planId,
  importId,
  row,
  version,
  round,
}: {
  planId: string;
  importId: string;
  row: RecommendationRow;
  version: number;
  round: number;
}) {
  const sections = useCropSections();
  const layout = useImportLayout(importId);
  const plan = layout.data ? cropPlan(layout.data, row, sections) : null;
  const first = plan?.crops[0]?.aisle ?? "";
  const second = plan?.crops[1]?.aisle ?? "";
  const firstWall = usePlanWall(planId, first, first !== "");
  const secondWall = usePlanWall(planId, second, second !== "");
  if (layout.isPending) return <CropsLoading />;
  if (plan === null) return null;
  const walls: Record<string, WallView | undefined> = {};
  if (first) walls[first] = firstWall.data;
  if (second) walls[second] = secondWall.data;
  return <CropsView plan={plan} walls={walls} version={version} row={row} round={round} />;
}

/** The Locations wall's URL for `row`: its from-location's aisle with the move selected; null when neither end is on the wall. */
export function showOnWallHref(planId: string, layout: LayoutView, row: RecommendationRow): string | null {
  const end = findLayoutEnd(layout, row.from_location) ?? findLayoutEnd(layout, effectiveTo(row).location);
  if (!end) return null;
  return planStepHref(planId, "locations", { aisle: end.layout.aisle, rec: row.id });
}

export function ShowOnWallLinkView({ href }: { href: string }) {
  return (
    <Link href={href} className="type-button text-ink underline underline-offset-2" data-show-on-wall="">
      {SHOW_ON_LOCATIONS_WALL}
    </Link>
  );
}

/** Show on the Locations wall, once the layout shows an end of `row` on the wall. */
export function ShowOnWallLink({ planId, importId, row }: { planId: string; importId: string; row: RecommendationRow }) {
  const layout = useImportLayout(importId);
  const href = layout.data ? showOnWallHref(planId, layout.data, row) : null;
  return href === null ? null : <ShowOnWallLinkView href={href} />;
}

// --- Moves in the planning copy ---

/** The planning copy's last moves (server order, newest first) and what Undo reverses first. */
export function RecentMoves({ moves, undoPreview }: { moves: readonly RecentMove[]; undoPreview: UndoPreview | null }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1" data-recent-moves="">
      <h3 id={titleId} className="type-body-strong text-ink">
        {RECENT_MOVES_TITLE}
      </h3>
      {moves.length === 0 ? (
        <p className="type-body text-ink-secondary">{NO_RECENT_MOVES}</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {moves.map((move) => (
            <li key={move.move_number} className="type-code-table text-ink" data-recent-move={move.move_number}>
              {recentMoveText(move)}
            </li>
          ))}
        </ol>
      )}
      {undoPreview && (
        <p className="type-caption text-ink-secondary" data-undo-first="">
          {undoFirstText(undoPreview)}
        </p>
      )}
    </section>
  );
}
