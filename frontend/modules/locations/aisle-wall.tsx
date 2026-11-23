"use client";

// The open aisle's wall (Stories 10.2–10.4; FR-42, UX-DR41/42/44): the layout's cells joined to the
// wall view, drawn at clamp(container / natural, 1, 35/27). The panel scrolls in 2D inside a bounded
// box rather than shrinking bins below their natural 27px. The SVG is the picture only; the
// keyboard grid over it is the wall's one tab stop and carries the names, tooltips and dialogs.
// The moves touching the aisle (the server's entries) are drawn in the SVG, their markers in an
// SVG over the grid, and the selected move's hover note beside its target.

import { useEffect, useRef, useState } from "react";

import {
  cellGeometry,
  liftedRect,
  moveKey,
  moveMarks,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  placeNote,
  type Rect,
  WallGrid,
  type WallGridProps,
  WallHoverNote,
  WallMoveMarkers,
  WallPanel,
  wallCells,
  wallNaturalSize,
  wallScale,
} from "@/components/common/wall";
import type { AisleLayout } from "@/lib/api/imports";
import type { WallView } from "@/lib/api/plans";
import { wallScrollLabel } from "@/lib/copy";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export type AisleWallProps = Omit<WallGridProps, "layout" | "cells" | "locations" | "scale" | "moves" | "marks"> & {
  layout: AisleLayout;
  wall: WallView;
  /** The selected move (`moveKey`): its arrow, frames and hover note are drawn. */
  selectedMoveKey?: string;
  /** The selected move's hover note lines (`hoverNoteLines`). */
  noteLines?: readonly [string, string];
};

export function AisleWall({ layout, wall, selectedMoveKey, noteLines, ...grid }: AisleWallProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const cells = wallCells(layout, wall);
  const natural = wallNaturalSize(layout);
  const scale = wallScale(width, natural.width);
  const geometry = cellGeometry(layout, cells);
  const marks = moveMarks(wall.moves, (code) => geometry.has(code), selectedMoveKey);
  const selected = wall.moves.find((move) => moveKey(move) === selectedMoveKey);
  const selectedEnds = selected && { from: selected.from_location.code, to: selected.to_location.code };

  // The note beside the target (else the from-cell), never over either end.
  let note: { x: number; y: number } | undefined;
  if (selected && noteLines) {
    const lifted = marks.some((mark) => mark.kind === "lift" && mark.code === selected.from_location.code);
    const fromRect = geometry.get(selected.from_location.code)?.rect;
    const toRect = geometry.get(selected.to_location.code)?.rect;
    const avoid: Rect[] = [];
    if (fromRect) avoid.push(fromRect, ...(lifted ? [liftedRect(fromRect)] : []));
    if (toRect) avoid.push(toRect);
    const anchor = toRect ?? fromRect;
    if (anchor) {
      const place = placeNote(anchor, avoid, natural, { width: NOTE_WIDTH / scale, height: NOTE_HEIGHT / scale });
      note = { x: place.x * scale, y: place.y * scale };
    }
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={wallScrollLabel(layout.aisle)}
      className="max-h-[70vh] overflow-auto rounded-lg [scrollbar-gutter:stable]"
      data-wall-scroll=""
    >
      <div className="relative" style={{ width: natural.width * scale, height: natural.height * scale }}>
        <WallPanel
          layout={layout}
          cells={cells}
          railLevels={wall.rail_levels}
          scale={scale}
          selectedCode={grid.selectedCode}
          marks={marks}
          selectedEnds={selectedEnds}
        />
        <WallGrid
          layout={layout}
          cells={cells}
          locations={wall.locations}
          scale={scale}
          moves={wall.moves}
          marks={marks}
          {...grid}
        />
        {marks.length > 0 && (
          <WallMoveMarkers
            marks={marks}
            geometry={geometry}
            size={natural}
            scale={scale}
            onSelect={grid.onSelectMove}
          />
        )}
        {note && noteLines && <WallHoverNote lines={noteLines} x={note.x} y={note.y} />}
      </div>
    </div>
  );
}
