"use client";

// WallCell (Story 10.3's cell markup, split out of WallGrid in Story 12.2): one gridcell of the
// wall's keyboard grid, at the bin's scaled rectangle. A located cell is named in words, carries its
// description and the grid's roving tab stop; a gap cell is never focusable.
//
// Drag (Story 12.2, FR-51, UX-DR50): only a grid given a `WallDrag` binding (the Locations wall in
// One aisle) renders `DraggableWallCell`, the one place dnd-kit hooks run, so the marking wall,
// the warehouse and the crops never call them. Its pointer listeners are spread on the cell; dnd-kit's
// `attributes` never are, so the grid's roles, names and tab stop stay as they are. While a drag is
// on, the from-cell shows the vacated slot's dashed outline, and the cell under the pointer shows
// the server's target kind: a frame with a plus glyph and "Move here", a frame with ⇄ and "Swap or
// put together", or nothing with the not-allowed cursor.

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type KeyboardEvent, type ReactNode, useCallback } from "react";

import type { WallLocation } from "@/lib/api/plans";
import { GAP_CELL_LABEL, MOVE_HERE, SWAP_OR_PUT_TOGETHER } from "@/lib/copy";
import { cn } from "@/lib/utils";

import { BIN_HEIGHT, BIN_WIDTH } from "./bin";
import { VacatedOutline } from "./moves-layer";
import { Slot } from "./slot";

/** What a drop on the cell under the pointer would do: move there, swap or put together, or nothing. */
export type WallDropHint = "move" | "swap" | "none";

/** The drag binding a grid gets from its page (only the Locations wall in One aisle passes one). */
export type WallDrag = {
  /** The location being dragged from, while a drag is on. */
  activeCode: string | null;
  /** The located cell under the pointer during a drag, and its hint (undefined while it is checked). */
  over: { code: string; hint: WallDropHint | undefined } | null;
  /** Whether a press on `location` may start a drag (an occupied bin, nothing saving). */
  canDrag: (location: WallLocation) => boolean;
};

/** A cell's drag state, drawn on it. */
export type WallCellDrop = {
  /** A drag is on (any cell). */
  dragging: boolean;
  /** This cell's bin is the dragged one: its slot shows the vacated outline. */
  vacated: boolean;
  /** Set on the cell under the pointer once its target kind is known. */
  hint: WallDropHint | undefined;
};

type CellBox = { left: number; top: number; width: number; height: number };

const HINT_LABEL: Record<Exclude<WallDropHint, "none">, string> = { move: MOVE_HERE, swap: SWAP_OR_PUT_TOGETHER };
const CASING = "var(--color-slot-empty)";
const SURFACE = "var(--color-surface)";

export function WallGapCell({
  rowIndex,
  colIndex,
  style,
  dragging = false,
}: {
  rowIndex: number;
  colIndex: number;
  style?: CellBox;
  /** While a drag is on, a gap takes the pointer to show it is no target. */
  dragging?: boolean;
}) {
  return (
    <div
      role="gridcell"
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      aria-label={GAP_CELL_LABEL}
      className={cn("absolute", dragging && "pointer-events-auto cursor-not-allowed")}
      style={style}
      data-grid-gap=""
    />
  );
}

export type WallCellProps = {
  code: string;
  rowIndex: number;
  colIndex: number;
  style?: CellBox;
  name: string;
  descriptionId?: string;
  /** The hidden description's lines. */
  description?: ReactNode;
  /** The cell opens a dialog (pinned tooltip) on `Enter` or a click. */
  hasPopup: boolean;
  expanded?: boolean;
  active: boolean;
  selected: boolean;
  /** Called with the cell's element (and null when it unmounts); stable across renders. */
  cellRef: (code: string, element: HTMLDivElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  /** Under a drag binding: whether a press may lift this bin, and the cell's drag state. */
  drag?: { draggable: boolean; drop: WallCellDrop };
};

type CellMarkupProps = Omit<WallCellProps, "drag"> & {
  drop?: WallCellDrop;
  /** dnd-kit's pointer listeners (`onPointerDown`), never its attributes. */
  listeners?: Record<string, (event: never) => void>;
};

/** A located cell: plain, or (under a drag binding) a dnd-kit draggable and droppable. */
export function WallCell({ drag, ...props }: WallCellProps) {
  if (drag) return <DraggableWallCell {...props} draggable={drag.draggable} drop={drag.drop} />;
  return <CellMarkup {...props} />;
}

function CellMarkup({
  code,
  rowIndex,
  colIndex,
  style,
  name,
  descriptionId,
  description,
  hasPopup,
  expanded,
  active,
  selected,
  cellRef,
  onFocus,
  onKeyDown,
  onClick,
  onPointerEnter,
  onPointerLeave,
  drop,
  listeners,
}: CellMarkupProps) {
  const ref = useCallback((element: HTMLDivElement | null) => cellRef(code, element), [cellRef, code]);
  const hint = drop?.hint;
  const shown = hint === "move" || hint === "swap" ? hint : undefined;
  return (
    <div
      ref={ref}
      role="gridcell"
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      aria-label={name}
      aria-describedby={descriptionId}
      aria-haspopup={hasPopup ? "dialog" : undefined}
      aria-expanded={expanded}
      tabIndex={active ? 0 : -1}
      data-grid-cell={code}
      data-active={active ? "" : undefined}
      data-selected={selected ? "" : undefined}
      data-drag-vacated={drop?.vacated ? "" : undefined}
      data-drop-target={hint}
      className={cn(
        "pointer-events-auto absolute rounded-[3px] outline-none",
        !drop?.dragging ? "cursor-pointer" : hint === "none" ? "cursor-not-allowed" : "cursor-grabbing",
        // Over its neighbours, so the hint's label is not covered.
        shown && "z-10",
      )}
      style={style}
      {...listeners}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {drop?.vacated && (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${BIN_WIDTH} ${BIN_HEIGHT}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <Slot />
          <VacatedOutline x={0} y={0} number="" />
        </svg>
      )}
      {shown && <DropHint hint={shown} />}
      {description}
    </div>
  );
}

/** The target frame, its glyph and its label (all decorative: drag is mouse-only, NFR-10). */
function DropHint({ hint }: { hint: "move" | "swap" }) {
  const cx = BIN_WIDTH / 2;
  const cy = BIN_HEIGHT / 2;
  const glyph =
    hint === "move"
      ? `M${cx - 6.5} ${cy} H${cx + 6.5} M${cx} ${cy - 6.5} V${cy + 6.5}`
      : `M${cx - 7} ${cy - 3.5} H${cx + 7} M${cx + 4} ${cy - 6.5} L${cx + 7} ${cy - 3.5} L${cx + 4} ${cy - 0.5} M${cx + 7} ${cy + 3.5} H${cx - 7} M${cx - 4} ${cy + 0.5} L${cx - 7} ${cy + 3.5} L${cx - 4} ${cy + 6.5}`;
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${BIN_WIDTH} ${BIN_HEIGHT}`}
        overflow="visible"
        className="pointer-events-none absolute inset-0 h-full w-full"
        data-drop-hint={hint}
      >
        <rect
          x={-1.5}
          y={-1.5}
          width={BIN_WIDTH + 3}
          height={BIN_HEIGHT + 3}
          rx={4}
          fill="rgba(255,255,255,0.16)"
          stroke={CASING}
          strokeWidth={4}
        />
        <rect
          x={-1.5}
          y={-1.5}
          width={BIN_WIDTH + 3}
          height={BIN_HEIGHT + 3}
          rx={4}
          fill="none"
          stroke={SURFACE}
          strokeWidth={1.6}
          strokeDasharray="3 2.5"
        />
        <path d={glyph} fill="none" stroke={CASING} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={glyph} fill="none" stroke={SURFACE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-sm bg-ink px-1.5 py-0.5 type-body whitespace-nowrap text-surface shadow-overlay"
        data-drop-label=""
      >
        {HINT_LABEL[hint]}
      </span>
    </>
  );
}

/**
 * A located cell under a drag binding: a dnd-kit draggable (only when `draggable`) and droppable,
 * both with the location code as id, on the cell's own element.
 */
function DraggableWallCell({
  draggable,
  cellRef,
  ...props
}: Omit<CellMarkupProps, "listeners"> & { draggable: boolean }) {
  const drag = useDraggable({ id: props.code, disabled: !draggable });
  const drop = useDroppable({ id: props.code });
  const { setNodeRef: setDragNode } = drag;
  const { setNodeRef: setDropNode } = drop;
  const { code } = props;
  const ref = useCallback(
    (_code: string, element: HTMLDivElement | null) => {
      setDragNode(element);
      setDropNode(element);
      cellRef(code, element);
    },
    [setDragNode, setDropNode, cellRef, code],
  );
  return (
    <CellMarkup
      {...props}
      cellRef={ref}
      listeners={draggable ? (drag.listeners as CellMarkupProps["listeners"]) : undefined}
    />
  );
}
