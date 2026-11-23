// Mini-wall (Story 10.6, FR-42, UX-DR45/58): an aisle card's decorative picture of its wall. The
// cells come from the import layout and are placed with the wall's own geometry (`cellRect`,
// `runTops`, `wallNaturalSize`), scaled to the card's width by the viewBox. An occupied location is
// a small bin in its top part's class colour with a light label stripe; an empty one is a slot
// recess; gaps are not drawn. No glyphs, text, tooltips, grid, drag or marking: it is `aria-hidden`,
// and the card's text carries every fact.

import type { Ref } from "react";

import { CLASS_FILL, cellRect, runTops, wallNaturalSize } from "@/components/common/wall";
import type { AisleLayout } from "@/lib/api/imports";
import type { WarehouseLocation } from "@/lib/api/plans";

export function MiniWall({
  layout,
  locations,
  ref,
}: {
  layout: AisleLayout;
  /** The warehouse view's locations by code; a code missing here is drawn empty. */
  locations: ReadonlyMap<string, WarehouseLocation>;
  ref?: Ref<SVGSVGElement>;
}) {
  const size = wallNaturalSize(layout);
  const tops = runTops(layout);
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${size.width} ${size.height}`}
      className="block h-auto w-full"
      data-mini-wall={layout.aisle}
    >
      <rect width={size.width} height={size.height} rx={8} fill="var(--color-wall)" />
      {layout.cells.map((cell) => {
        if (cell.gap || cell.location === null) return null;
        const rect = cellRect(layout, tops, cell);
        if (rect === null) return null;
        const entry = locations.get(cell.location.code);
        const key = cell.location.code;
        if (entry === undefined || !entry.occupied) {
          return (
            <rect
              key={key}
              x={rect.x + 0.5}
              y={rect.y + 0.5}
              width={rect.width - 1}
              height={rect.height - 1}
              rx={2}
              fill="var(--color-slot-empty)"
              stroke="var(--color-slot-rim)"
              strokeWidth={1}
              data-mini-cell="empty"
            />
          );
        }
        const movementClass = entry.movement_class ?? "dead";
        return (
          <g key={key} data-mini-cell={movementClass}>
            <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={2} fill={CLASS_FILL[movementClass]} />
            <rect
              x={rect.x + 5}
              y={rect.y + rect.height / 2 - 3}
              width={rect.width - 10}
              height={6}
              rx={1}
              fill="var(--color-label-window)"
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}
