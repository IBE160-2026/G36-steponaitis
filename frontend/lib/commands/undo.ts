// Undo last move (Story 7.3, FR-35, UX-DR38): the one command flow behind the Recommendations
// header, the part panel, the launcher and the Undo action of a move toast. The server's
// `undo_preview` words the control and its `step_undone` words the toast (lib/copy); the client
// never works out what an undo does or what it outdates (AD-3). A toast's Undo sends that move's
// number: when it is no longer the last move, the server rejects it and the command flow says so.

import type { CommandEvent, UndoPreview } from "@/lib/api/plans";
import type { CommandBody, SendResult } from "@/lib/commands/client";
import { LOADING_LAST_MOVE, NO_MOVES_TO_UNDO, UNDO_ACTION, undoneToast } from "@/lib/copy";

export type UndoSend = (body: CommandBody) => Promise<SendResult>;
export type UndoNotify = (message: string) => void;

/** The toast of a confirmed undo's events; undefined when there is no `step_undone`. */
export function undoToastText(events: readonly CommandEvent[], round: number): string | undefined {
  const undone = events.find((event) => event.type === "step_undone");
  if (undone?.type !== "step_undone") return undefined;
  const outdated = events.reduce(
    (count, event) =>
      event.type === "recommendations_outdated" && event.cause === "undo" ? count + event.count : count,
    0,
  );
  return undoneToast(undone, outdated, round);
}

/** Sends `undo` of move `moveNumber` and notifies the confirmed outcome (never with an Undo action). */
export async function sendUndo(
  send: UndoSend,
  moveNumber: number,
  round: number,
  notify: UndoNotify,
): Promise<SendResult> {
  const result = await send({ type: "undo", expected_move_number: moveNumber });
  if (result.outcome === "confirmed") {
    const message = undoToastText(result.events, round);
    if (message) notify(message);
  }
  return result;
}

/** The step move number a move event is about: its own, or the step of a combined or removed move. */
export function moveEventStep(event: CommandEvent): { moveNumber: number; round: number } | undefined {
  switch (event.type) {
    case "move_made":
      return { moveNumber: event.move_number, round: event.round };
    case "moves_combined":
    case "move_removed":
      return { moveNumber: event.step_move_number, round: event.round };
    default:
      return undefined;
  }
}

/** A move toast's `{label: "Undo", onClick}`, which undoes that move's step; undefined for any other event. */
export function moveUndoAction(
  event: CommandEvent,
  send: UndoSend,
  notify: UndoNotify,
): { label: string; onClick: () => void } | undefined {
  const step = moveEventStep(event);
  if (step === undefined) return undefined;
  return { label: UNDO_ACTION, onClick: () => void sendUndo(send, step.moveNumber, step.round, notify) };
}

/** Why Undo last move cannot run now: no moves first, else the command flow's reason. */
export function undoReason(
  preview: UndoPreview | null,
  savingReason: string | undefined,
  loading = false,
): string | undefined {
  if (loading) return LOADING_LAST_MOVE;
  return preview === null ? NO_MOVES_TO_UNDO : savingReason;
}
