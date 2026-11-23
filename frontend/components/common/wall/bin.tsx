// Bin (DESIGN.md "Bin", UX-DR40): one location holding stock. The body is the top part's class
// colour with a darker lip and bottom line, and a white label window holds the class glyph. Two
// parts split the window, one glyph per half; three or more show the top part's glyph and a "+"
// tick. The three-letter class code shows only when the bin is drawn at least 56px wide, which
// also uses the large bin's proportions (the front page's picture).

import { ClassGlyph } from "@/components/common/class-glyph";
import { CLASS_CODES, type MovementClass } from "@/lib/copy";

import { CLASS_FILL } from "./class-fill";

/** A wall bin's natural size (`--spacing-bin-width` × `--spacing-bin-height`). */
export const BIN_WIDTH = 27;
export const BIN_HEIGHT = 29;
/** The drawn width from which a bin shows its class code. */
export const CODE_MIN_WIDTH = 56;

type BinProps = {
  /** The movement class of every part with stock, top part (most picks) first; at least one. */
  parts: readonly MovementClass[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** The width the bin ends up drawn at, after any scaling (defaults to `width`). */
  drawnWidth?: number;
};

function Plus({ cx, cy, arm, strokeWidth }: { cx: number; cy: number; arm: number; strokeWidth: number }) {
  return (
    <path
      d={`M${cx - arm} ${cy} H${cx + arm} M${cx} ${cy - arm} V${cy + arm}`}
      stroke="var(--color-glyph)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      data-more-parts=""
    />
  );
}

export function Bin({ parts, x = 0, y = 0, width = BIN_WIDTH, height = BIN_HEIGHT, drawnWidth = width }: BinProps) {
  const top = parts[0] ?? "dead";
  const split = parts.length === 2;
  const more = parts.length >= 3;
  const large = drawnWidth >= CODE_MIN_WIDTH;
  const lip = large ? { height: 6, rx: 2 } : { height: 3.5, rx: 1.5 };
  const bottom = large ? 2 : 1.5;
  const win = large
    ? { x: x + 4, y: y + 15, width: width - 8, height: 26, rx: 1.5 }
    : { x: x + (width - 21) / 2, y: y + (height - 13) / 2, width: 21, height: 13, rx: 1 };
  const glyph = large ? 10 : 9;
  const glyphY = win.y + (win.height - glyph) / 2;
  return (
    <g data-bin={top}>
      <rect x={x} y={y} width={width} height={height} rx={large ? 3 : 2} fill={CLASS_FILL[top]} />
      <rect x={x} y={y} width={width} height={lip.height} rx={lip.rx} fill="rgba(0,0,0,0.22)" />
      <rect x={x} y={y + height - bottom} width={width} height={bottom} fill="rgba(0,0,0,0.18)" />
      <rect
        x={win.x}
        y={win.y}
        width={win.width}
        height={win.height}
        rx={win.rx}
        fill="var(--color-label-window)"
      />
      {split ? (
        <>
          {parts.slice(0, 2).map((movementClass, half) => (
            <g
              key={half}
              transform={`translate(${win.x + (win.width / 2) * half + (win.width / 2 - glyph) / 2} ${glyphY})`}
            >
              <ClassGlyph movementClass={movementClass} size={glyph} />
            </g>
          ))}
          <path
            d={`M${win.x + win.width / 2} ${win.y + 2} V${win.y + win.height - 2}`}
            stroke="var(--color-glyph)"
            strokeWidth={0.75}
            data-split=""
          />
        </>
      ) : large ? (
        <>
          <g transform={`translate(${x + 8} ${y + 23})`}>
            <ClassGlyph movementClass={top} size={glyph} />
          </g>
          <text x={x + 21} y={y + 32.5} fontSize={12} className="font-code font-bold" fill="var(--color-glyph)">
            {CLASS_CODES[top]}
          </text>
          {more && <Plus cx={win.x + win.width - 6} cy={win.y + win.height / 2} arm={3.5} strokeWidth={2} />}
        </>
      ) : (
        <>
          <g transform={`translate(${more ? win.x + 2.5 : win.x + (win.width - glyph) / 2} ${glyphY})`}>
            <ClassGlyph movementClass={top} size={glyph} />
          </g>
          {more && <Plus cx={win.x + win.width - 5} cy={win.y + win.height / 2} arm={2.5} strokeWidth={1.4} />}
        </>
      )}
    </g>
  );
}
