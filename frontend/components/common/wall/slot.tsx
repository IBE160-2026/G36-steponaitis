// Slot (DESIGN.md "slot-empty"/"slot-none", UX-DR40): an empty location is a dark recess with a
// light rim, a slat near the top and a base line; a cell with no location is hatched.

import { useId } from "react";

import { BIN_HEIGHT, BIN_WIDTH, CODE_MIN_WIDTH } from "./bin";

type SlotProps = { x?: number; y?: number; width?: number; height?: number };

/** An empty location. At the large size (≥56px) it keeps the front page's proportions. */
export function Slot({ x = 0, y = 0, width = BIN_WIDTH, height = BIN_HEIGHT }: SlotProps) {
  const large = width >= CODE_MIN_WIDTH;
  const slat = large ? 26 : Math.round(width / 2);
  const inset = large ? 4 : 3;
  return (
    <g data-slot="empty">
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={width - 1}
        height={height - 1}
        rx={2}
        fill="var(--color-slot-empty)"
        stroke="var(--color-slot-rim)"
        strokeWidth={1}
      />
      <rect x={x + (width - slat) / 2} y={y + inset} width={slat} height={2.6} rx={1.3} fill="var(--color-wall-slat)" />
      <path d={`M${x + 3} ${y + height - inset} H${x + width - 3}`} stroke="var(--color-slot-line)" strokeWidth={1} />
    </g>
  );
}

/** The hatch of a no-location cell; `WallPanel` defines it once and passes its id to each gap. */
export function SlotNoneHatch({ id }: { id: string }) {
  return (
    <pattern id={id} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={5} height={5} fill="var(--color-slot-empty)" />
      <rect width={1.6} height={5} fill="var(--color-slot-none-stripe)" />
    </pattern>
  );
}

/** A cell with no location (a gap in a section): hatched. Without `hatchId` it defines its own hatch. */
export function SlotNone({
  x = 0,
  y = 0,
  width = BIN_WIDTH,
  height = BIN_HEIGHT,
  hatchId,
}: SlotProps & { hatchId?: string }) {
  const ownId = useId();
  const id = hatchId ?? ownId;
  return (
    <g data-slot="none">
      {hatchId === undefined && (
        <defs>
          <SlotNoneHatch id={id} />
        </defs>
      )}
      <rect x={x} y={y} width={width} height={height} rx={2} fill={`url(#${id})`} />
    </g>
  );
}
