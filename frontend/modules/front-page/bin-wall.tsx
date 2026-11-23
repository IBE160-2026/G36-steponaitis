// The demo front page's bin wall (Story 9.6, UX-DR54): one section of aisle G drawn at large scale
// as a static picture. Four levels L4–L1, 56px bins in their class colours with the class glyph and
// its three-letter code in the label window, open slots as dark recesses, BEST rails and tags on L2
// and L1, the demo part's bin lifted out of L4 with an accent arrow to a dashed empty best target on
// L1. Every colour is a DESIGN.md token read as a CSS variable, so the picture follows the theme.
// Bins and slots are the shared wall primitives (components/common/wall) at the large size.

import type { MovementClass } from "@/components/common/class-glyph";
import { Bin, Slot } from "@/components/common/wall";

import { BEST_TAG, WALL_LABEL, WALL_SECTION } from "./copy";

/** The front page draws bins at the large size, where the shared Bin shows its class code. */
export const BIN_WIDTH = 56;
export const BIN_HEIGHT = 54;

type SlotContent = MovementClass | null;

/** The section's levels, top (L4) to bottom (L1); null is an open slot. */
const LEVELS: readonly { label: string; best: boolean; slots: readonly [SlotContent, SlotContent, SlotContent, SlotContent] }[] = [
  { label: "L4", best: false, slots: ["dead", null, null, "slow"] },
  { label: "L3", best: false, slots: ["fast", "medium", null, "slow"] },
  { label: "L2", best: true, slots: ["slow", "medium", "dead", "fast"] },
  { label: "L1", best: true, slots: ["medium", "dead", null, null] },
];

const WALL_WIDTH = 330;
const WALL_HEIGHT = 352;
const LEVEL_TOP = 42;
const LEVEL_PITCH = 76;
const SLOT_LEFT = 56;
const SLOT_PITCH = 64;

const slotX = (position: number) => SLOT_LEFT + SLOT_PITCH * position;
const levelY = (level: number) => LEVEL_TOP + LEVEL_PITCH * level;

// The demo move: from L4 position 2 (G-14-04-02) to L1 position 4 (G-14-01-04).
const LIFTED = { x: slotX(1) + 8, y: levelY(0) - 16 };
const TARGET = { x: slotX(3), y: levelY(3) };
const ARROW = `M${LIFTED.x + BIN_WIDTH + 4} ${LIFTED.y + 26} C 318 68, 350 220, ${TARGET.x + 38} ${TARGET.y - 8}`;
const ARROW_HEAD = `M${TARGET.x + 30} ${TARGET.y - 20} L${TARGET.x + 38} ${TARGET.y - 6} L${TARGET.x + 52} ${TARGET.y - 14}`;

const SLATS_ID = "front-page-wall-slats";
const LIFT_ID = "front-page-lift";

export function BinWall({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 360 ${WALL_HEIGHT}`}
      role="img"
      aria-label={WALL_LABEL}
      className={className}
      focusable="false"
      data-bin-wall=""
    >
      <defs>
        <pattern id={SLATS_ID} width={14} height={10} patternUnits="userSpaceOnUse">
          <rect width={14} height={10} fill="var(--color-wall)" />
          <rect x={2} y={3.5} width={9} height={2.6} rx={1.3} fill="var(--color-wall-slat)" />
        </pattern>
        <filter id={LIFT_ID} x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx={0} dy={6} stdDeviation={5} floodColor="#000" floodOpacity={0.45} />
        </filter>
      </defs>
      <rect width={WALL_WIDTH} height={WALL_HEIGHT} rx={8} fill={`url(#${SLATS_ID})`} />
      <text
        x={181}
        y={23}
        textAnchor="middle"
        fontSize={13}
        className="font-code font-semibold"
        fill="var(--color-on-dark-secondary)"
      >
        {WALL_SECTION}
      </text>
      <rect x={42} y={34} width={6} height={304} fill="var(--color-upright)" />
      <rect x={308} y={34} width={6} height={304} fill="var(--color-upright)" />
      {LEVELS.map((level, index) => {
        const top = levelY(index);
        return (
          <g key={level.label} data-level={level.label}>
            <text x={12} y={top + 32} fontSize={15} className="font-code font-bold" fill="var(--color-on-dark)">
              {level.label}
            </text>
            {level.best && (
              <g data-best-tag="">
                <rect x={6} y={top + 41} width={32} height={16} rx={2} fill="var(--color-best)" />
                <text
                  x={22}
                  y={top + 53}
                  textAnchor="middle"
                  fontSize={11}
                  className="font-code font-bold"
                  fill="var(--color-ink)"
                >
                  {BEST_TAG}
                </text>
              </g>
            )}
            <rect
              x={48}
              y={top + 60}
              width={260}
              height={6}
              fill={level.best ? "var(--color-best)" : "var(--color-beam)"}
            />
            {level.slots.map((slot, position) =>
              slot === null ? (
                <Slot key={position} x={slotX(position)} y={top} width={BIN_WIDTH} height={BIN_HEIGHT} />
              ) : (
                <Bin key={position} parts={[slot]} x={slotX(position)} y={top} width={BIN_WIDTH} height={BIN_HEIGHT} />
              ),
            )}
          </g>
        );
      })}
      {/* The dashed best-location target with a plus glyph. */}
      <g data-move-target="">
        <rect
          x={TARGET.x - 2}
          y={TARGET.y - 2}
          width={BIN_WIDTH + 4}
          height={BIN_HEIGHT + 4}
          rx={3}
          fill="none"
          stroke="var(--color-on-dark)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <path
          d={`M${TARGET.x + 28} ${TARGET.y + 20} V${TARGET.y + 34} M${TARGET.x + 21} ${TARGET.y + 27} H${TARGET.x + 35}`}
          stroke="var(--color-on-dark)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
      {/* The accent arrow, in its dark casing. */}
      <g data-move-arrow="" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={ARROW} stroke="var(--color-wall-edge)" strokeWidth={7} />
        <path d={ARROW_HEAD} stroke="var(--color-wall-edge)" strokeWidth={7} />
        <path d={ARROW} stroke="var(--color-accent)" strokeWidth={4} />
        <path d={ARROW_HEAD} stroke="var(--color-accent)" strokeWidth={4} />
      </g>
      {/* The demo part's bin, lifted above its slot on L4. */}
      <g filter={`url(#${LIFT_ID})`} data-lifted="">
        <Bin parts={["fast"]} x={LIFTED.x} y={LIFTED.y} width={BIN_WIDTH} height={BIN_HEIGHT} />
      </g>
    </svg>
  );
}
