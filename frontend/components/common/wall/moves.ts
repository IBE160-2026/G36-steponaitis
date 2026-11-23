// Moves on the wall (Story 10.4, FR-42, UX-DR44): pure helpers that turn the server's move entries
// (`WallView.moves`, in drawer order) into what the wall draws and names. Nothing here computes a
// status, an aisle or a count: each entry already carries them; this file only decides which end
// of a move is drawn on which cell, and where the selected move's arrow and hover note go. Story
// 10.5 reuses it for the wall crops.

import type { WallMove } from "@/lib/api/plans";
import type { MoveMarkEnd, MoveMarkKind } from "@/lib/copy";

export type Rect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** A move's stable key on the page: its recommendation id, or `move:<n>` for a manual move. */
export function moveKey(move: Pick<WallMove, "kind" | "recommendation_id" | "move_number">): string {
  return move.kind === "recommendation" && move.recommendation_id !== null
    ? move.recommendation_id
    : `move:${move.move_number ?? ""}`;
}

/** One end of a move drawn on one cell (and named in that cell's accessible name). */
export type MoveMark = {
  kind: MoveMarkKind;
  /** The end of the move this cell is. */
  end: MoveMarkEnd;
  code: string;
  key: string;
  /** The recommendation's server number; null for a manual move. */
  number: number | null;
  selected: boolean;
};

/**
 * The ends of `moves` drawn on this wall, in drawer order (UX-DR44): an open or kept
 * recommendation lifts its from-cell's bin and marks its target; an applied one shows the check
 * at its to-cell, a manual move "M" at its to-cell, an outdated one the grey marker on its
 * from-cell. An end whose cell is not on this wall is not drawn; when an applied, manual or
 * outdated move's marked end is in another aisle, its marker goes on its other end (on this wall),
 * so every listed entry shows on the wall.
 */
export function moveMarks(
  moves: readonly WallMove[],
  onWall: (code: string) => boolean,
  selectedKey: string | undefined,
): MoveMark[] {
  const marks: MoveMark[] = [];
  for (const move of moves) {
    const key = moveKey(move);
    const base = { key, number: move.number, selected: key === selectedKey };
    const from = move.from_location.code;
    const to = move.to_location.code;
    switch (move.status) {
      case "open":
      case "kept":
        if (onWall(from)) marks.push({ ...base, kind: "lift", end: "from", code: from });
        if (onWall(to)) marks.push({ ...base, kind: "target", end: "to", code: to });
        break;
      case "applied":
      case "manual":
        if (onWall(to)) marks.push({ ...base, kind: move.status, end: "to", code: to });
        else if (onWall(from)) marks.push({ ...base, kind: move.status, end: "from", code: from });
        break;
      case "outdated":
        if (onWall(from)) marks.push({ ...base, kind: "outdated", end: "from", code: from });
        else if (onWall(to)) marks.push({ ...base, kind: "outdated", end: "to", code: to });
        break;
    }
  }
  return marks;
}

/** The marks of each cell, in drawer order. */
export function marksByCode(marks: readonly MoveMark[]): Map<string, MoveMark[]> {
  const byCode = new Map<string, MoveMark[]>();
  for (const mark of marks) {
    const list = byCode.get(mark.code);
    if (list) list.push(mark);
    else byCode.set(mark.code, [mark]);
  }
  return byCode;
}

/**
 * The move a click or `Enter` on a cell selects: its first mark's move in drawer order, unless one
 * of its marks is already the selected move (then undefined: nothing changes).
 */
export function cellMoveSelection(marks: readonly MoveMark[] | undefined, selectedKey: string | undefined): string | undefined {
  if (!marks || marks.length === 0) return undefined;
  if (marks.some((mark) => mark.key === selectedKey)) return undefined;
  return marks[0].key;
}

/** The value of a marker's `data-move-marker`: its number, "M" for a manual move, "applied". */
export function markerText(mark: Pick<MoveMark, "kind" | "number">): string {
  if (mark.kind === "manual") return "M";
  if (mark.kind === "applied") return "applied";
  return mark.number === null ? "" : String(mark.number);
}

/** The lifted bin's rectangle: 33 × 34 natural px, offset up and left of its slot. */
export const LIFT_WIDTH = 33;
export const LIFT_HEIGHT = 34;
export function liftedRect(rect: Pick<Rect, "x" | "y">): Rect {
  return { x: rect.x - 4, y: rect.y - 6, width: LIFT_WIDTH, height: LIFT_HEIGHT };
}

/** The 17px marker's radius and its centre for the `index`-th mark of a cell (top right, then leftwards). */
export const MARKER_RADIUS = 8.5;
export function markerCenter(rect: Rect, index: number): Point {
  return { x: rect.x + rect.width - 1 - index * (2 * MARKER_RADIUS + 1), y: rect.y + 1 };
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * The selected move's arrow from the centre of `from` to the edge of `to`: a quadratic curve bent
 * to one side (`d`), and its head as a closed triangle (`head`) pointing along the curve's end.
 */
export function arrowPath(from: Rect, to: Rect): { d: string; head: string } {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // Bend the curve by a fifth of its length, always to the same side (upwards for a level move).
  const bend = Math.min(60, length * 0.2);
  const control = { x: (a.x + b.x) / 2 + (dy / length) * bend, y: (a.y + b.y) / 2 - (Math.abs(dx) / length) * bend };
  // End at the target's edge, along the line from the control point.
  const tx = b.x - control.x;
  const ty = b.y - control.y;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const inset = Math.min(to.width, to.height) / 2;
  const end = { x: b.x - ux * inset, y: b.y - uy * inset };
  const size = 7;
  const base = { x: end.x - ux * size, y: end.y - uy * size };
  const left = { x: base.x - uy * (size / 2), y: base.y + ux * (size / 2) };
  const right = { x: base.x + uy * (size / 2), y: base.y - ux * (size / 2) };
  const f = (n: number) => Number(n.toFixed(2));
  return {
    d: `M${f(a.x)} ${f(a.y)} Q${f(control.x)} ${f(control.y)} ${f(base.x)} ${f(base.y)}`,
    head: `M${f(end.x)} ${f(end.y)} L${f(left.x)} ${f(left.y)} L${f(right.x)} ${f(right.y)} Z`,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(rect: Rect, box: { width: number; height: number }): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= box.width && rect.y + rect.height <= box.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export type NoteSide = "right" | "left" | "below" | "above";
export type NotePlacement = Point & { side: NoteSide };

/**
 * Where the hover note goes (UX-DR44): beside `anchor` (the target, else the from-cell) on the
 * right, flipped to the left when it would leave the wall's `box`, then below or above. It is
 * slid along its side to stay in the box, and a place that overlaps any of `avoid` (the from-
 * and to-cell rectangles) is never taken. With no such place, the first corner of the box clear
 * of them; the top left as a last resort.
 */
export function placeNote(
  anchor: Rect,
  avoid: readonly Rect[],
  box: { width: number; height: number },
  size: { width: number; height: number },
  gap = 8,
): NotePlacement {
  const { width, height } = size;
  const middle = center(anchor);
  const candidates: NotePlacement[] = [
    { side: "right", x: anchor.x + anchor.width + gap, y: middle.y - height / 2 },
    { side: "left", x: anchor.x - gap - width, y: middle.y - height / 2 },
    { side: "below", x: middle.x - width / 2, y: anchor.y + anchor.height + gap },
    { side: "above", x: middle.x - width / 2, y: anchor.y - gap - height },
  ];
  const blocked = [anchor, ...avoid];
  const clear = (place: Point) => {
    const rect = { x: place.x, y: place.y, width, height };
    return inside(rect, box) && !blocked.some((other) => rectsOverlap(rect, other));
  };
  for (const candidate of candidates) {
    // The side's own axis must fit; the other axis slides into the box.
    const sideways = candidate.side === "right" || candidate.side === "left";
    const place: NotePlacement = sideways
      ? { ...candidate, y: clamp(candidate.y, 0, box.height - height) }
      : { ...candidate, x: clamp(candidate.x, 0, box.width - width) };
    if (clear(place)) return place;
  }
  const corners: NotePlacement[] = [
    { side: "right", x: box.width - width, y: 0 },
    { side: "left", x: 0, y: 0 },
    { side: "right", x: box.width - width, y: box.height - height },
    { side: "left", x: 0, y: box.height - height },
  ];
  return corners.find(clear) ?? { side: "left", x: 0, y: 0 };
}

/** Smooth scrolling, unless the planner asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
