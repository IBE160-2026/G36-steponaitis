// Bin swatch (UX-DR23): a 16px miniature bin in the class colour with an ink outline and the
// class glyph in its white label window. Mirrors the product mark. Decorative unless `label` is given.

import { ClassGlyph, type MovementClass } from "@/components/common/class-glyph";
import { CLASS_FILL } from "@/components/common/wall/class-fill";

type BinSwatchProps = {
  movementClass: MovementClass;
  /** When given, the swatch is announced as an image with this name; otherwise it is decorative. */
  label?: string;
  className?: string;
};

const WIDTH = 16;
const HEIGHT = 17;

export function BinSwatch({ movementClass, label, className }: BinSwatchProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox="0 0 24 26"
      className={className}
      style={{ flexShrink: 0 }}
      focusable="false"
      data-class={movementClass}
      {...a11y}
    >
      {/* Bin body in the class colour */}
      <rect x="0.75" y="0.75" width="22.5" height="24.5" rx="2" fill={CLASS_FILL[movementClass]} />
      {/* Darker top lip and bottom line */}
      <rect x="0.75" y="0.75" width="22.5" height="3.5" rx="1.5" fill="rgba(0,0,0,0.22)" />
      <rect x="0.75" y="23.75" width="22.5" height="1.5" fill="rgba(0,0,0,0.18)" />
      {/* White label window with the class glyph */}
      <rect x="3.5" y="7" width="17" height="13" rx="1" fill="var(--color-label-window)" />
      <g transform="translate(7 8.5)">
        <ClassGlyph movementClass={movementClass} size={10} />
      </g>
      {/* Ink outline */}
      <rect
        x="0.75"
        y="0.75"
        width="22.5"
        height="24.5"
        rx="2"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.3}
        vectorEffect="non-scaling-stroke"
        data-outline=""
      />
    </svg>
  );
}
