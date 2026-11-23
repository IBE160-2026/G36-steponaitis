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
//   with several parts the drop dialog asks which. On an occupied target (Story 12.3) the occupied
//   drop dialog asks Swap / Put together / Cancel and which parts move on each side; nothing is
//   sent until Swap or Put together. A drop on the own slot, a refused target, or outside the grid,
//   and `Esc`, send nothing. A drop before the target's preview has arrived waits for it
//   (`fetchQuery` on the same key) and never guesses from occupancy.
// - Every send (`move_parts`, `swap`, `put_together`) goes through
//   `usePlanCommands(planId).sendWithEvents`; a confirmed one shows its toast with the Undo of its
//   last move. No drag starts while a dialog is open.

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
import {
  type CommandEvent,
  fetchMovePreview,
  type MovePreview,
  type TargetPart,
  type WallPart,
  type WallView,
} from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import type { CommandBody } from "@/lib/commands/client";
import { moveUndoAction } from "@/lib/commands/undo";
import type { MovementClass } from "@/lib/copy";

import {
  dragMoveToast,
  draggedPart,
  dragPreviewKey,
  dropAction,
  dropHint,
  lastMoveEvent,
  pointerHalf,
  swapToast,
} from "./drag";
import { DropDialog } from "./drop-dialog";
import { OccupiedDialog } from "./occupied-dialog";

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

type DropAt = { from: string; to: string; dragged: string; parts: WallPart[]; anchor: HTMLElement };

/** The open drop dialog: "Move to" (empty target) or the occupied one with the preview's target parts. */
type OpenDialog = (DropAt & { kind: "move" }) | (DropAt & { kind: "occupied"; targetParts: TargetPart[] });

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

  /** Sends a drop's command; a confirmed one shows its toast with the Undo of its last move. */
  async function send(command: CommandBody, toast: (events: readonly CommandEvent[]) => string | null) {
    const result = await sendWithEvents(command);
    if (result.outcome === "confirmed") {
      const message = toast(result.events);
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
      await sendMove(current.from, to, [current.part]);
      return;
    }
    if (action === "none") return;
    const anchor = cellElement(to);
    if (!anchor) return;
    const at = { from: current.from, to, dragged: current.part, parts: entry.parts, anchor };
    if (action === "dialog") setDialog({ ...at, kind: "move" });
    else setDialog({ ...at, kind: "occupied", targetParts: answer?.target_parts ?? [] });
  }

  function sendMove(from: string, to: string, parts: string[]) {
    return send({ type: "move_parts", from, to, parts }, (events) => dragMoveToast(events, { from, to }));
  }

  /** Sends from an open dialog; it closes on every outcome but `busy`. */
  async function sendFromDialog(outcome: Promise<string>) {
    // A second press while the first send is pending leaves the dialog to the first.
    if ((await outcome) !== "busy") setDialog(null);
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
      {dialog?.kind === "move" && (
        <DropDialog
          key={`${dialog.from}>${dialog.to}`}
          anchor={dialog.anchor}
          from={dialog.from}
          to={dialog.to}
          parts={dialog.parts}
          dragged={dialog.dragged}
          savingReason={disabledReason}
          onMove={(parts) => void sendFromDialog(sendMove(dialog.from, dialog.to, parts))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "occupied" && (
        <OccupiedDialog
          key={`${dialog.from}>${dialog.to}`}
          anchor={dialog.anchor}
          from={dialog.from}
          to={dialog.to}
          parts={dialog.parts}
          dragged={dialog.dragged}
          targetParts={dialog.targetParts}
          savingReason={disabledReason}
          onSwap={(parts, backParts) =>
            void sendFromDialog(
              send({ type: "swap", from: dialog.from, to: dialog.to, parts, back_parts: backParts }, swapToast),
            )
          }
          onPutTogether={(parts) =>
            void sendFromDialog(
              send({ type: "put_together", from: dialog.from, to: dialog.to, parts }, (events) =>
                dragMoveToast(events, { from: dialog.from, to: dialog.to }),
              ),
            )
          }
          onClose={() => setDialog(null)}
        />
      )}
    </DndContext>
  );
}
