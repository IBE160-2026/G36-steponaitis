"use client";

// The drag on the One aisle wall (Story 12.2, FR-51, UX-DR50, AD-3, AD-12). `WallDragProvider`
// holds dnd-kit's context for the open aisle's wall and hands the grid its `WallDrag` binding:
//
// - Start: a pointer press on an occupied bin that moves more than 4px (the pointer sensor only,
//   never the keyboard: Manual move… is the keyboard path, NFR-10). A press without that movement
//   stays a click; after a drag, dnd-kit swallows the click. Nothing starts while a command is
//   unconfirmed. The lifted bin follows the pointer (`DragOverlay`).
// - Targets: the located cells of the open aisle's grid only (ids = codes). The hint comes from the
//   server's move preview for (dragged part, from, target), fetched once per target and plan version
//   (`dragPreviewKey`, `staleTime: Infinity`); no hint while it loads.
// - Drop: on an empty target with one part at the from-location, `move_parts` is sent at once;
//   with several parts the drop dialog asks which. A drop on the own slot, an occupied or refused
//   target, or outside the grid, and `Esc`, send nothing. A drop before the target's preview has
//   arrived waits for it (`fetchQuery` on the same key) and never guesses from occupancy.
// - Every send goes through `usePlanCommands(planId).sendWithEvents`; a confirmed one shows the
//   move toast with the Undo of its last move.

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";

import { showToast } from "@/components/common/toast";
import { BIN_WIDTH, LiftedBin, type WallDrag } from "@/components/common/wall";
import { fetchMovePreview, type MovePreview, type WallPart, type WallView } from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import { moveUndoAction } from "@/lib/commands/undo";
import type { MovementClass } from "@/lib/copy";

import { dragMoveToast, draggedPart, dragPreviewKey, dropAction, dropHint, lastMoveEvent, pointerHalf } from "./drag";
import { DropDialog } from "./drop-dialog";

/** The pointer must move this far (px) before a press becomes a drag. */
export const DRAG_DISTANCE_PX = 4;

/** Drag is mouse-only and its result is announced by the toast: dnd-kit's own live texts are off. */
const SILENT: Announcements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

type Lifted = {
  from: string;
  part: string;
  /** The from-location's part classes, for the lifted bin. */
  classes: MovementClass[];
  /** The drawn bin width over its natural width. */
  scale: number;
};

type OpenDialog = { from: string; to: string; dragged: string; parts: WallPart[]; anchor: HTMLElement };

function previewQuery(planId: string, part: string, from: string, to: string, version: number) {
  return {
    queryKey: dragPreviewKey(planId, part, from, to, version),
    queryFn: () => fetchMovePreview(planId, part, from, to),
    staleTime: Infinity,
    retry: false,
  } as const;
}

export function WallDragProvider({
  planId,
  wall,
  children,
}: {
  planId: string;
  /** The open aisle's wall view: its locations' parts and its version. */
  wall: WallView;
  children: (drag: WallDrag) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }));
  const root = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const version = wall.version;

  const target = lifted !== null && over !== null && over !== lifted.from ? over : null;
  const preview = useQuery({
    ...previewQuery(planId, lifted?.part ?? "", lifted?.from ?? "", target ?? "", version),
    enabled: target !== null,
  });
  const previewData: MovePreview | null | undefined = preview.isError ? null : preview.data;
  const drag: WallDrag = {
    activeCode: lifted?.from ?? null,
    over:
      lifted !== null && over !== null
        ? { code: over, hint: dropHint(over === lifted.from ? undefined : previewData, over === lifted.from) }
        : null,
    canDrag: (location) => disabledReason === undefined && dialog === null && location.parts.length > 0,
  };

  function locationAt(code: string) {
    return wall.locations.find((entry) => entry.location.code === code);
  }

  function cellElement(code: string): HTMLElement | null {
    return root.current?.querySelector<HTMLElement>(`[data-grid-cell="${CSS.escape(code)}"]`) ?? null;
  }

  function reset() {
    setLifted(null);
    setOver(null);
  }

  function onDragStart(event: DragStartEvent) {
    const from = String(event.active.id);
    const entry = locationAt(from);
    // The pressed bin's box now (dnd-kit measures its own rect only after this callback).
    const box = cellElement(from)?.getBoundingClientRect();
    const pointer = event.activatorEvent as PointerEvent | null;
    const half = pointer && box ? pointerHalf(pointer.clientX, box) : "left";
    const part = entry ? draggedPart(entry.parts, half) : undefined;
    if (!entry || part === undefined) return;
    setLifted({
      from,
      part,
      classes: entry.parts.map((p) => p.movement_class),
      scale: box ? box.width / BIN_WIDTH : 1,
    });
    setOver(from);
  }

  function onDragOver(event: DragOverEvent) {
    setOver(event.over ? String(event.over.id) : null);
  }

  /** Sends `move_parts`; a confirmed drop shows its toast with the Undo of its last move. */
  async function send(from: string, to: string, parts: string[]) {
    const result = await sendWithEvents({ type: "move_parts", from, to, parts });
    if (result.outcome === "confirmed") {
      const message = dragMoveToast(result.events, { from, to });
      const last = lastMoveEvent(result.events);
      if (message) showToast(message, { action: last && moveUndoAction(last, sendWithEvents, showToast) });
    }
    return result.outcome;
  }

  async function onDragEnd(event: DragEndEvent) {
    const current = lifted;
    reset();
    const to = event.over ? String(event.over.id) : null;
    if (current === null || to === null || to === current.from) return;
    const entry = locationAt(current.from);
    if (!entry) return;
    let answer: MovePreview | null;
    try {
      answer = await queryClient.fetchQuery(previewQuery(planId, current.part, current.from, to, version));
    } catch {
      answer = null;
    }
    const action = dropAction(answer, entry.parts.length);
    if (action === "send") {
      await send(current.from, to, [current.part]);
    } else if (action === "dialog") {
      const anchor = cellElement(to);
      if (anchor) setDialog({ from: current.from, to, dragged: current.part, parts: entry.parts, anchor });
    }
  }

  async function moveChecked(open: OpenDialog, parts: string[]) {
    const outcome = await send(open.from, open.to, parts);
    // A second press while the first send is pending leaves the dialog to the first.
    if (outcome !== "busy") setDialog(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{ announcements: SILENT, screenReaderInstructions: { draggable: "" } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(event) => void onDragEnd(event)}
      onDragCancel={reset}
    >
      <div ref={root} className="contents" data-wall-drag="">
        {children(drag)}
      </div>
      <DragOverlay dropAnimation={null} className="pointer-events-none">
        {lifted && <LiftedBin parts={lifted.classes} scale={lifted.scale} />}
      </DragOverlay>
      {dialog && (
        <DropDialog
          key={`${dialog.from}>${dialog.to}`}
          anchor={dialog.anchor}
          from={dialog.from}
          to={dialog.to}
          parts={dialog.parts}
          dragged={dialog.dragged}
          savingReason={disabledReason}
          onMove={(parts) => void moveChecked(dialog, parts)}
          onClose={() => setDialog(null)}
        />
      )}
    </DndContext>
  );
}
