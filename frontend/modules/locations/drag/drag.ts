// The drag slice's pure rules (Story 12.2, FR-51, UX-DR50, AD-3). Which part a press lifts, what
// a target shows and what a drop does come from the wall view's `parts` and the server's move
// preview only: the client never works out occupancy or a move's effect.

import { moveToast } from "@/components/common/manual-move-dialog";
import type { WallDropHint } from "@/components/common/wall";
import { type CommandEvent, type MovePreview, planMovePreviewKey, type WallPart } from "@/lib/api/plans";
import { moveEventStep } from "@/lib/commands/undo";
import { movedPartsToast, swappedToast } from "@/lib/copy";

/** The half of a bin's label the press landed on (a split label holds two parts). */
export type PointerHalf = "left" | "right";

/** The half of `box` that `x` is in (the left half includes the middle). */
export function pointerHalf(x: number, box: { left: number; width: number }): PointerHalf {
  return x <= box.left + box.width / 2 ? "left" : "right";
}

/**
 * The part a press lifts: the only part; with two (split label) the half under the press (left =
 * `parts[0]`, right = `parts[1]`); with three or more the first (most picks). None when empty.
 */
export function draggedPart(parts: readonly Pick<WallPart, "part">[], half: PointerHalf): string | undefined {
  if (parts.length === 2) return parts[half === "left" ? 0 : 1].part;
  return parts[0]?.part;
}

/**
 * The hint on the cell under the pointer: none on the own slot; undefined while its preview loads;
 * none for a failed fetch (`null`), a refusal or a target that is no location (`none`); else
 * "move" on an empty target and "swap" on an occupied one.
 */
export function dropHint(preview: MovePreview | null | undefined, isOwnSlot: boolean): WallDropHint | undefined {
  if (isOwnSlot) return "none";
  if (preview === undefined) return undefined;
  if (preview === null || !preview.allowed) return "none";
  switch (preview.target) {
    case "empty":
      return "move";
    case "occupied":
      return "swap";
    default:
      return "none";
  }
}

/**
 * What a drop does: send `move_parts` at once, open the "Move to" drop dialog, open the occupied
 * drop dialog (Swap / Put together / Cancel), or nothing.
 */
export type DropAction = "send" | "dialog" | "occupied" | "none";

/**
 * A drop on another location with its preview: an empty target sends at once when the from-location
 * holds one part and opens the dialog when it holds several; an allowed occupied target always opens
 * the occupied dialog (nothing changes until Swap or Put together); anything else does nothing.
 */
export function dropAction(preview: MovePreview | null | undefined, fromPartCount: number): DropAction {
  const hint = dropHint(preview, false);
  if (hint === "swap") return "occupied";
  if (hint !== "move") return "none";
  return fromPartCount > 1 ? "dialog" : "send";
}

/**
 * The drag preview's query key: the manual move preview's key plus the wall's version, so a target
 * is asked at most once per plan version (it is cached with `staleTime: Infinity`).
 */
export function dragPreviewKey(planId: string, part: string, from: string, to: string, version: number) {
  return [...planMovePreviewKey(planId, part, from, to), version] as const;
}

/** The command's move events (`move_made`, `moves_combined`, `move_removed`), in order. */
function moveEvents(events: readonly CommandEvent[]): CommandEvent[] {
  return events.filter((event) => moveEventStep(event) !== undefined);
}

/** The last move event: a drop's toast undoes that step (FR-35 is one step at a time). */
export function lastMoveEvent(events: readonly CommandEvent[]): CommandEvent | undefined {
  return moveEvents(events).at(-1);
}

/**
 * A confirmed drop's toast: one move event words it as a manual move does (FR-34's combine and
 * remove included); several give "Moved N parts: <from> → <to> (Manual, round R).".
 */
export function dragMoveToast(events: readonly CommandEvent[], drop: { from: string; to: string }): string | null {
  const moves = moveEvents(events);
  if (moves.length <= 1) return moveToast(events);
  const round = moveEventStep(moves[0])?.round ?? 0;
  return movedPartsToast(moves.length, drop.from, drop.to, round);
}

/**
 * A confirmed swap's toast from its `swap_made` event: "Swapped <from> ↔ <to> · N manual moves,
 * round R.", N being the swap's move numbers. Null without a `swap_made`.
 */
export function swapToast(events: readonly CommandEvent[]): string | null {
  const swap = events.find((event) => event.type === "swap_made");
  if (swap?.type !== "swap_made") return null;
  return swappedToast(swap.from_location, swap.to_location, swap.move_numbers.length, swap.round);
}
