// Movement-class glyph (UX-DR3): filled SVG shapes, never emoji or Unicode symbols.
// fast = triangle up, medium = diamond, slow = triangle down, dead = ring with a 45° slash.

import type { MovementClass } from "@/lib/copy";

export type { MovementClass };

type ClassGlyphProps = {
  movementClass: MovementClass;
  size?: number;
  /** When given, the glyph is announced as an image with this name; otherwise it is decorative. */
  label?: string;
  color?: string;
  className?: string;
};

export function ClassGlyph({
  movementClass,
  size = 9,
  label,
  color = "var(--color-glyph)",
  className,
}: ClassGlyphProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      className={className}
      style={{ color, flexShrink: 0 }}
      focusable="false"
      data-class={movementClass}
      {...a11y}
    >
      {movementClass === "fast" && <path d="M5 0.8 L9.6 9.2 H0.4 Z" fill="currentColor" />}
      {movementClass === "medium" && <path d="M5 0.2 L9.8 5 L5 9.8 L0.2 5 Z" fill="currentColor" />}
      {movementClass === "slow" && <path d="M5 9.2 L9.6 0.8 H0.4 Z" fill="currentColor" />}
      {movementClass === "dead" && (
        <>
          <circle
            cx="5"
            cy="5"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M2.17 7.83 L7.83 2.17"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
