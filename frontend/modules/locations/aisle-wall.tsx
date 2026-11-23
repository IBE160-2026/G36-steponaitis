"use client";

// The open aisle's wall (Stories 10.2, 10.3; FR-42, UX-DR41/42): the layout's cells joined to the
// wall view, drawn at clamp(container / natural, 1, 35/27). The panel scrolls in 2D inside a bounded
// box rather than shrinking bins below their natural 27px. The SVG is the picture only; the
// keyboard grid over it is the wall's one tab stop and carries the names, tooltips and dialogs.

import { useEffect, useRef, useState } from "react";

import {
  WallGrid,
  type WallGridProps,
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

export type AisleWallProps = Omit<WallGridProps, "layout" | "cells" | "locations" | "scale"> & {
  layout: AisleLayout;
  wall: WallView;
};

export function AisleWall({ layout, wall, ...grid }: AisleWallProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const cells = wallCells(layout, wall);
  const natural = wallNaturalSize(layout);
  const scale = wallScale(width, natural.width);
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
        />
        <WallGrid layout={layout} cells={cells} locations={wall.locations} scale={scale} {...grid} />
      </div>
    </div>
  );
}
