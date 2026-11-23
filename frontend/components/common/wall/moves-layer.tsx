// The wall's moves (Story 10.4, FR-42, UX-DR44, DESIGN.md "bin-lifted", "move-target",
// "move-marker", "move-arrow", "hover-note"). Three pieces, all `aria-hidden` (the grid cells and
// the drawer say the same in words):
// - `WallMovesLayer`, inside the wall's SVG: lifted bins (the only content shadow), dashed
//   targets with a plus glyph, outdated outlines, and the selected move's frames and cased arrow;
// - `WallMoveMarkers`, an SVG over the keyboard grid: the 17px markers, which are pointer targets
//   (a click selects the move) but never tab stops;
// - `WallHoverNote`, the selected move's two-line note beside its target (`placeNote`).
// Which ends are drawn comes from `moveMarks`; this file owns only pixels.

import type { CSSProperties } from "react";

import type { AisleLayout } from "@/lib/api/imports";

import { BIN_HEIGHT, BIN_WIDTH, Bin } from "./bin";
import { cellRect, runTops, type WallCellModel } from "./model";
import {
  arrowPath,
  liftedRect,
  MARKER_RADIUS,
  markerCenter,
  markerText,
  type MoveMark,
  type Rect,
} from "./moves";

const CASING = "var(--color-slot-empty)";
const ACCENT = "var(--color-accent)";
const LIFT_SHADOW = "drop-shadow(0 6px 10px rgba(0,0,0,0.45))";

/** A mark's stable React key: its move, its kind and the end it is drawn on. */
function markId(mark: MoveMark): string {
  return `${mark.key}:${mark.kind}:${mark.end}`;
}

/** Each located cell's model and bin rectangle, by code. */
export type CellGeometry = Map<string, { cell: WallCellModel; rect: Rect }>;

export function cellGeometry(layout: Pick<AisleLayout, "runs">, cells: readonly WallCellModel[]): CellGeometry {
  const tops = runTops(layout);
  const geometry: CellGeometry = new Map();
  for (const cell of cells) {
    if (cell.code === null) continue;
    const rect = cellRect(layout, tops, cell);
    if (rect) geometry.set(cell.code, { cell, rect });
  }
  return geometry;
}

/** The codes whose bin is lifted: an occupied from-cell of an open or kept recommendation. */
export function liftedCodes(marks: readonly MoveMark[], geometry: CellGeometry): Set<string> {
  return new Set(
    marks.filter((mark) => mark.kind === "lift" && geometry.get(mark.code)?.cell.occupied).map((mark) => mark.code),
  );
}

/** The rectangle the selected move leaves from or arrives at: the lifted bin, else the cell's bin. */
function endRect(code: string, geometry: CellGeometry, lifted: ReadonlySet<string>): Rect | undefined {
  const rect = geometry.get(code)?.rect;
  if (!rect) return undefined;
  return lifted.has(code) ? liftedRect(rect) : rect;
}

/** The cased frame (accent over a dark casing) of a selected lifted bin or target. */
function CasedFrame({ rect, strokeWidth, fill }: { rect: Rect; strokeWidth: number; fill?: string }) {
  const box = { x: rect.x - 1.5, y: rect.y - 1.5, width: rect.width + 3, height: rect.height + 3 };
  return (
    <>
      <rect {...box} rx={4} fill={fill ?? "none"} stroke={CASING} strokeWidth={strokeWidth + 3} />
      <rect {...box} rx={4} fill="none" stroke={ACCENT} strokeWidth={strokeWidth} />
    </>
  );
}

function PlusGlyph({ rect }: { rect: Rect }) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const arm = 6.5;
  return (
    <path
      d={`M${cx - arm} ${cy} H${cx + arm} M${cx} ${cy - arm} V${cy + arm}`}
      stroke="var(--color-surface)"
      strokeWidth={1.6}
      strokeLinecap="round"
      data-move-plus=""
    />
  );
}

export type WallMovesLayerProps = {
  marks: readonly MoveMark[];
  geometry: CellGeometry;
  /** The selected move's from- and to-location codes, for its arrow. */
  selectedEnds?: { from: string; to: string };
  /** The drawn bin width, so a lifted bin keeps the small label until it is drawn ≥56px. */
  scale?: number;
};

/** Targets, outdated outlines, lifted bins and the selected move's frames and arrow (inside the wall SVG). */
export function WallMovesLayer({ marks, geometry, selectedEnds, scale = 1 }: WallMovesLayerProps) {
  const lifted = liftedCodes(marks, geometry);
  const drawnLift = new Set<string>();
  const from = selectedEnds ? endRect(selectedEnds.from, geometry, lifted) : undefined;
  const to = selectedEnds ? endRect(selectedEnds.to, geometry, lifted) : undefined;
  const arrow = from && to ? arrowPath(from, to) : undefined;
  return (
    <g data-wall-moves="">
      {marks.map((mark) => {
        const geo = geometry.get(mark.code);
        if (!geo) return null;
        const { rect, cell } = geo;
        const number = mark.number ?? "";
        switch (mark.kind) {
          case "target":
            return (
              <g key={markId(mark)} data-move-target={number} data-selected={mark.selected ? "" : undefined}>
                {mark.selected ? (
                  <CasedFrame rect={rect} strokeWidth={2.2} fill="rgba(255,255,255,0.16)" />
                ) : (
                  <rect
                    x={rect.x + 0.5}
                    y={rect.y + 0.5}
                    width={rect.width - 1}
                    height={rect.height - 1}
                    rx={3}
                    fill="none"
                    stroke="var(--color-surface)"
                    strokeWidth={1.6}
                    strokeDasharray="3 2.5"
                  />
                )}
                {!cell.occupied && <PlusGlyph rect={rect} />}
              </g>
            );
          case "outdated":
            return (
              <rect
                key={markId(mark)}
                x={rect.x - 1}
                y={rect.y - 1}
                width={rect.width + 2}
                height={rect.height + 2}
                rx={3}
                fill="none"
                stroke="var(--color-outdated)"
                strokeWidth={1.4}
                strokeDasharray="2 2"
                data-move-outdated={number}
              />
            );
          case "lift": {
            if (!lifted.has(mark.code) || drawnLift.has(mark.code)) {
              // A second move from the same bin: its frame only, when selected.
              return mark.selected && lifted.has(mark.code) ? (
                <g key={markId(mark)} data-lift-frame={number}>
                  <CasedFrame rect={liftedRect(rect)} strokeWidth={2} />
                </g>
              ) : null;
            }
            drawnLift.add(mark.code);
            const lift = liftedRect(rect);
            const selectedHere = marks.some((other) => other.kind === "lift" && other.code === mark.code && other.selected);
            return (
              <g key={markId(mark)}>
                <g data-lifted={number} style={{ filter: LIFT_SHADOW } as CSSProperties}>
                  <Bin
                    parts={cell.parts}
                    x={lift.x}
                    y={lift.y}
                    width={lift.width}
                    height={lift.height}
                    drawnWidth={BIN_WIDTH * scale}
                  />
                </g>
                {selectedHere && (
                  <g data-lift-frame={number}>
                    <CasedFrame rect={lift} strokeWidth={2} />
                  </g>
                )}
              </g>
            );
          }
          default:
            return null;
        }
      })}
      {arrow && (
        <g data-move-arrow="">
          <path d={arrow.d} fill="none" stroke={CASING} strokeWidth={6} strokeLinecap="round" />
          <path d={arrow.head} fill={CASING} stroke={CASING} strokeWidth={3} strokeLinejoin="round" />
          <path d={arrow.d} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />
          <path d={arrow.head} fill={ACCENT} />
        </g>
      )}
    </g>
  );
}

/** The vacated slot's dashed white outline (drawn by the cell in place of its bin). */
export function VacatedOutline({ x, y, number }: { x: number; y: number; number: string }) {
  return (
    <rect
      x={x + 1}
      y={y + 1}
      width={BIN_WIDTH - 2}
      height={BIN_HEIGHT - 2}
      rx={3}
      fill="none"
      stroke="var(--color-surface)"
      strokeWidth={1.4}
      strokeDasharray="2 2"
      data-vacated={number}
    />
  );
}

type MarkerKind = "recommended" | "selected" | "applied" | "manual" | "outdated";

function markerKind(mark: MoveMark): MarkerKind {
  if (mark.kind === "applied" || mark.kind === "manual") return mark.kind;
  if (mark.selected) return "selected";
  return mark.kind === "outdated" ? "outdated" : "recommended";
}

function Marker({ mark, cx, cy, onSelect }: { mark: MoveMark; cx: number; cy: number; onSelect?: (key: string) => void }) {
  const kind = markerKind(mark);
  const ink = kind === "applied" || kind === "manual";
  const ring =
    kind === "selected" ? ACCENT : kind === "outdated" ? "var(--color-outdated)" : ink ? "var(--color-surface)" : "var(--color-ink)";
  const text = markerText(mark);
  // A round chip; a pill when a number of three or more digits needs the room.
  const half = Math.max(0, (text.length - 2) * 3.2);
  const pill = (r: number) => ({ x: cx - r - half, y: cy - r, width: 2 * (r + half), height: 2 * r, rx: r });
  return (
    <g
      data-move-marker={text}
      data-marker-kind={kind}
      data-selected={mark.selected ? "" : undefined}
      style={{ pointerEvents: "auto", cursor: "pointer" }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(mark.key);
      }}
    >
      {mark.selected && (
        <>
          <rect {...pill(MARKER_RADIUS + 3)} fill={CASING} />
          {ink && <rect {...pill(MARKER_RADIUS + 1.5)} fill="none" stroke={ACCENT} strokeWidth={2} />}
        </>
      )}
      <rect
        {...pill(MARKER_RADIUS - 0.6)}
        fill={ink ? "var(--color-ink)" : "var(--color-surface)"}
        stroke={ring}
        strokeWidth={kind === "selected" ? 2 : 1.2}
      />
      {kind === "applied" ? (
        <path
          d={`M${cx - 4} ${cy + 0.3} L${cx - 1.2} ${cy + 3} L${cx + 4} ${cy - 2.8}`}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="type-marker"
          fill={ink ? "var(--color-surface)" : "var(--color-ink)"}
        >
          {text}
        </text>
      )}
    </g>
  );
}

/**
 * The markers, in an SVG over the keyboard grid (natural size × `scale`). Pointer events reach only
 * the markers: a click selects that move. `aria-hidden`, never a tab stop: the cell and the drawer
 * row are their keyboard and target-size equivalents.
 */
export function WallMoveMarkers({
  marks,
  geometry,
  size,
  scale,
  onSelect,
}: {
  marks: readonly MoveMark[];
  geometry: CellGeometry;
  size: { width: number; height: number };
  scale: number;
  onSelect?: (key: string) => void;
}) {
  const lifted = liftedCodes(marks, geometry);
  const perCell = new Map<string, number>();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size.width * scale}
      height={size.height * scale}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className="pointer-events-none absolute inset-0"
      data-wall-markers=""
    >
      {marks.map((mark) => {
        const rect = geometry.get(mark.code)?.rect;
        if (!rect) return null;
        const onLift = mark.kind === "lift" && lifted.has(mark.code);
        // One counter per cell, so two markers on one cell never share a place.
        const at = perCell.get(mark.code) ?? 0;
        perCell.set(mark.code, at + 1);
        const { x, y } = markerCenter(onLift ? liftedRect(rect) : rect, at);
        return <Marker key={markId(mark)} mark={mark} cx={x} cy={y} onSelect={onSelect} />;
      })}
    </svg>
  );
}

/** The hover note's size in CSS px (fixed, so its placement is known before it renders). */
export const NOTE_WIDTH = 300;
export const NOTE_HEIGHT = 46;

/** The selected move's two-line note, `aria-hidden`, at a place from `placeNote` (CSS px). */
export function WallHoverNote({ lines, x, y }: { lines: readonly [string, string]; x: number; y: number }) {
  return (
    <div
      aria-hidden="true"
      data-hover-note=""
      className="pointer-events-none absolute flex flex-col justify-center gap-0.5 overflow-hidden rounded border-l-[6px] border-accent bg-surface px-2 text-ink shadow-overlay"
      style={{ left: x, top: y, width: NOTE_WIDTH, height: NOTE_HEIGHT }}
    >
      <p className="truncate type-caption font-semibold">{lines[0]}</p>
      <p className="truncate type-meta text-ink-secondary">{lines[1]}</p>
    </div>
  );
}
