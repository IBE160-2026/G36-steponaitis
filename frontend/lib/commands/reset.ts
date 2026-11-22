// Reset the planning copy (Story 7.4, FR-35, UX-DR38): the one command flow behind the
// Recommendations header's "⋯" menu and the launcher. The toast words the server's
// `plan_reset{moves_removed}`; a no-op reset has no event and toasts 0 moves (AD-3, AD-6).

import type { CommandBody, SendResult } from "@/lib/commands/client";
import { resetToast } from "@/lib/copy";

export type ResetSend = (body: CommandBody) => Promise<SendResult>;
export type ResetNotify = (message: string) => void;

/** Sends `reset` and notifies the confirmed outcome (never with an Undo action). */
export async function sendReset(send: ResetSend, notify: ResetNotify): Promise<SendResult> {
  const result = await send({ type: "reset" });
  if (result.outcome === "confirmed") {
    const event = result.events.find((candidate) => candidate.type === "plan_reset");
    notify(resetToast(event?.type === "plan_reset" ? event.moves_removed : 0));
  }
  return result;
}
