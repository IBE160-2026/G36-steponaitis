"use client";

// The open aisle's wall (Story 10.2, FR-42, UX-DR41): the layout's cells joined to the wall view,
// drawn at clamp(container / natural, 1, 35/27). The panel scrolls in 2D inside a bounded box
// rather than shrinking bins below their natural 27px.

import { useEffect, useRef, useState } from "react";

import { WallPanel, wallCells, wallNaturalSize, wallScale } from "@/components/common/wall";
import type { AisleLayout } from "@/lib/api/imports";
import type { WallView } from "@/lib/api/plans";
import { wallImageLabel, wallScrollLabel } from "@/lib/copy";

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

export function AisleWall({ layout, wall }: { layout: AisleLayout; wall: WallView }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const cells = wallCells(layout, wall);
  const scale = wallScale(width, wallNaturalSize(layout).width);
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label={wallScrollLabel(layout.aisle)}
      className="max-h-[70vh] overflow-auto rounded-lg [scrollbar-gutter:stable]"
      data-wall-scroll=""
    >
      <WallPanel layout={layout} cells={cells} railLevels={wall.rail_levels} scale={scale} label={wallImageLabel(layout.aisle)} />
    </div>
  );
}
