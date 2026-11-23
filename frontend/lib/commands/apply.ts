// Apply a recommendation (Stories 5.5, 7.2, 10.4; FR-30, FR-31): the one command flow behind the
// Recommendations detail and the wall's "Moves touching aisle" drawer. Apply sends `apply`, Other
// location sends `apply_other_location`; a confirmed `move_made` is toasted with its Undo. Why
// Apply is disabled (outdated, kept, saving) is worded here too, so both surfaces say the same.

import type { CommandEvent, OutdatedInfo, RecommendationRow } from "@/lib/api/plans";
import type { CommandBody, SendResult } from "@/lib/commands/client";
import { moveUndoAction } from "@/lib/commands/undo";
import { appliedToast, keptApplyReason, outdatedText } from "@/lib/copy";

export type ApplySend = (body: CommandBody) => Promise<SendResult>;
export type ApplyNotify = (message: string, options?: { action?: { label: string; onClick: () => void } }) => void;

/** The `apply` command of a recommendation. */
export function applyCommand(recommendationId: string): CommandBody {
  return { type: "apply", recommendation_id: recommendationId };
}

/** The `apply_other_location` command of a recommendation to `location`. */
export function applyOtherCommand(recommendationId: string, location: string): CommandBody {
  return { type: "apply_other_location", recommendation_id: recommendationId, to_location: location };
}

function moveMade(events: readonly CommandEvent[]) {
  return events.find((event): event is Extract<CommandEvent, { type: "move_made" }> => event.type === "move_made");
}

/** Sends an apply (to the suggested or another location) and toasts its `move_made` with Undo. */
export async function sendApply(send: ApplySend, body: CommandBody, notify: ApplyNotify): Promise<SendResult> {
  const result = await send(body);
  if (result.outcome !== "confirmed") return result;
  const moved = moveMade(result.events);
  if (moved) notify(appliedToast(moved), { action: moveUndoAction(moved, send, notify) });
  return result;
}

/** Why Apply is disabled: the outdated cause, else "<part> is kept in place.", else the saving
 * reason; undefined when it can apply. */
export function applyReason(
  row: Pick<RecommendationRow, "status" | "part"> & { outdated: OutdatedInfo | null },
  savingReason: string | undefined,
): string | undefined {
  if (row.status === "outdated" && row.outdated) return outdatedText(row.part, row.outdated);
  if (row.status === "kept") return keptApplyReason(row.part);
  return savingReason;
}
