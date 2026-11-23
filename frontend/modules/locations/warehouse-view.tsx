"use client";

// Whole warehouse (Story 10.6, FR-42, UX-DR45/58, AD-15): the Locations wall's second scope. Four
// figures from the server, then nine aisle cards in server order (letter plate, BEST tag, %, counts,
// moves and a decorative mini-wall), then the Key. Selecting a card opens that aisle. The selected
// move (`?rec=` / `?move=`) is drawn as one cased violet route from its from-cell to its to-cell,
// across cards when it crosses aisles, in an `aria-hidden` overlay; a text line names it, so the
// route is never the only cue. Every count, occupancy, class and move comes from the server's
// warehouse view; the cells come from the import layout; only pixels are computed here.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/common/segmented-control";
import { arrowPath, cellRect, Key, MOVE_ARROW, type Rect, runTops, wallNaturalSize } from "@/components/common/wall";
import type { AisleLayout, LayoutView } from "@/lib/api/imports";
import type { WallMove, WarehouseView } from "@/lib/api/plans";
import {
  aisleCardLine,
  aisleTabMoves,
  BEST_TAG,
  LOCATIONS_VIEW_LABEL,
  percentText,
  SCOPE_LABELS,
  selectedMoveLine,
  warehouseBestFigure,
  warehouseEmptyFigure,
  warehouseOccupiedFigure,
  warehouseRunFigure,
} from "@/lib/copy";

import type { WallScope } from "./aisle-choice";
import { MiniWall } from "./mini-wall";

const SCOPE_OPTIONS = [
  { value: "aisle", label: SCOPE_LABELS.aisle },
  { value: "warehouse", label: SCOPE_LABELS.warehouse },
] as const;

/**
 * The header's One aisle | Whole warehouse control (a radio group with arrow keys). A scope switch
 * unmounts the control that had focus, so the newly mounted one takes it with `focusOnMount`.
 */
export function ScopeControl({
  scope,
  onChange,
  focusOnMount = false,
  onFocused,
}: {
  scope: WallScope;
  onChange: (scope: WallScope) => void;
  focusOnMount?: boolean;
  onFocused?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Only at mount: the control still shown while the URL catches up with a switch must not take
  // the flag meant for the control the switch mounts next.
  const atMount = useRef({ focusOnMount, onFocused });
  useEffect(() => {
    const { focusOnMount: focus, onFocused: done } = atMount.current;
    if (!focus) return;
    box.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    done?.();
  }, []);
  return (
    <div ref={box} className="contents">
      <SegmentedControl label={LOCATIONS_VIEW_LABEL} options={SCOPE_OPTIONS} value={scope} onChange={onChange} />
    </div>
  );
}

/** Where a mini-wall is drawn inside the card grid: its top-left corner and its scale. */
export type MiniWallBox = { x: number; y: number; scale: number };

function cellBox(layout: AisleLayout, code: string, box: MiniWallBox): Rect | null {
  const cell = layout.cells.find((entry) => !entry.gap && entry.location?.code === code);
  if (cell === undefined) return null;
  const rect = cellRect(layout, runTops(layout), cell);
  if (rect === null) return null;
  return {
    x: box.x + rect.x * box.scale,
    y: box.y + rect.y * box.scale,
    width: rect.width * box.scale,
    height: rect.height * box.scale,
  };
}

/**
 * The selected move's route in card-grid pixels, from its from-cell to its to-cell; null when there
 * is no move, or either end is not in the layout or its mini-wall is not measured.
 */
export function warehouseRoute(
  layouts: readonly AisleLayout[],
  move: Pick<WallMove, "from_location" | "to_location"> | undefined,
  boxes: ReadonlyMap<string, MiniWallBox>,
): { d: string; head: string } | null {
  if (move === undefined) return null;
  const end = (location: WallMove["from_location"]) => {
    const layout = layouts.find((entry) => entry.aisle === location.aisle);
    const box = boxes.get(location.aisle);
    return layout && box ? cellBox(layout, location.code, box) : null;
  };
  const from = end(move.from_location);
  const to = end(move.to_location);
  return from && to ? arrowPath(from, to) : null;
}

function sameBoxes(a: ReadonlyMap<string, MiniWallBox>, b: ReadonlyMap<string, MiniWallBox>): boolean {
  if (a.size !== b.size) return false;
  for (const [aisle, box] of a) {
    const other = b.get(aisle);
    if (!other || other.x !== box.x || other.y !== box.y || other.scale !== box.scale) return false;
  }
  return true;
}

export function WholeWarehouse({
  view,
  layout,
  selectedMove,
  onSelectAisle,
}: {
  view: WarehouseView;
  /** The import's layout; the mini-walls are drawn once it is here. */
  layout: LayoutView | undefined;
  /** The move `?rec=` / `?move=` selects among `view.moves`, if any. */
  selectedMove?: WallMove;
  onSelectAisle: (aisle: string) => void;
}) {
  const layouts = useMemo(() => layout?.aisles ?? [], [layout]);
  const locations = useMemo(() => new Map(view.locations.map((entry) => [entry.code, entry])), [view.locations]);
  const grid = useRef<HTMLDivElement>(null);
  const walls = useRef(new Map<string, SVGSVGElement>());
  const [boxes, setBoxes] = useState<ReadonlyMap<string, MiniWallBox>>(() => new Map());

  const measure = useCallback(() => {
    const container = grid.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next = new Map<string, MiniWallBox>();
    for (const [aisle, element] of walls.current) {
      const aisleLayout = layouts.find((entry) => entry.aisle === aisle);
      if (!aisleLayout) continue;
      const rect = element.getBoundingClientRect();
      const natural = wallNaturalSize(aisleLayout).width;
      if (!(natural > 0) || !(rect.width > 0)) continue;
      next.set(aisle, { x: rect.left - origin.left, y: rect.top - origin.top, scale: rect.width / natural });
    }
    setBoxes((current) => (sameBoxes(current, next) ? current : next));
  }, [layouts]);

  // Measured after every layout change and on resize, so the route follows the cards.
  useLayoutEffect(() => {
    measure();
    const container = grid.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure, view]);

  const route = warehouseRoute(layouts, selectedMove, boxes);
  const figures = [
    warehouseOccupiedFigure(view.warehouse),
    warehouseEmptyFigure(view.warehouse),
    warehouseBestFigure(view.warehouse),
    warehouseRunFigure(view.run),
  ];

  return (
    <section className="flex flex-col gap-4" data-whole-warehouse-view="">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={SCOPE_LABELS.warehouse}>
        {figures.map((figure, index) => (
          <li
            key={index}
            className="rounded-xl border border-border bg-surface px-4 py-3 type-section-title text-ink"
            data-warehouse-figure={index}
          >
            {figure}
          </li>
        ))}
      </ul>
      {selectedMove && (
        <p className="type-body text-ink" data-selected-move="">
          {selectedMoveLine(selectedMove)}
        </p>
      )}
      <div ref={grid} className="relative">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" data-aisle-cards="">
          {view.aisles.map((counts) => {
            const aisleLayout = layouts.find((entry) => entry.aisle === counts.aisle);
            return (
              <button
                key={counts.aisle}
                type="button"
                onClick={() => onSelectAisle(counts.aisle)}
                data-aisle-card={counts.aisle}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-3 text-left text-ink hover:border-ink"
              >
                <span className="flex w-full items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border-[1.4px] border-ink bg-surface type-plate-code">
                    {counts.aisle}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 type-body-strong">
                      {percentText(counts.occupied_percent)}
                      {counts.aisle_marked && (
                        <span className="rounded-sm bg-best-on-light px-1 type-tag text-surface" data-best-tag="">
                          {BEST_TAG}
                        </span>
                      )}
                    </span>
                    <span className="type-caption text-ink-secondary">{aisleCardLine(counts)}</span>
                  </span>
                  <span className="ml-auto shrink-0 type-caption text-ink-secondary">{aisleTabMoves(counts.moves)}</span>
                </span>
                {aisleLayout && (
                  <MiniWall
                    layout={aisleLayout}
                    locations={locations}
                    ref={(element) => {
                      if (element) walls.current.set(counts.aisle, element);
                      else walls.current.delete(counts.aisle);
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {route && (
          <svg
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            data-warehouse-route=""
          >
            <path d={route.d} fill="none" stroke={MOVE_ARROW.casing} strokeWidth={6} strokeLinecap="round" />
            <path d={route.head} fill={MOVE_ARROW.casing} stroke={MOVE_ARROW.casing} strokeWidth={3} strokeLinejoin="round" />
            <path d={route.d} fill="none" stroke={MOVE_ARROW.accent} strokeWidth={3} strokeLinecap="round" />
            <path d={route.head} fill={MOVE_ARROW.accent} />
          </svg>
        )}
      </div>
      <Key />
    </section>
  );
}
