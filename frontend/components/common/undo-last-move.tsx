"use client";

// Undo last move (Story 7.3, FR-35, UX-DR38): the tertiary control in the Recommendations header
// and the part panel, on the lib/commands/undo flow (which the launcher and the move toasts also
// use). Its tooltip and accessible description are the server's `undo_preview`,
// worded in lib/copy.

import { Button } from "@/components/common/button";
import { showToast } from "@/components/common/toast";
import { type UndoPreview, usePlanSummary } from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import { sendUndo, type UndoNotify, undoReason, type UndoSend } from "@/lib/commands/undo";
import { UNDO_LAST_MOVE, undoLabel } from "@/lib/copy";

/** The tertiary control; its tooltip and accessible description say what the undo would do. */
export function UndoLastMove({
  preview,
  savingReason,
  send,
  notify = showToast,
  loading = false,
}: {
  preview: UndoPreview | null;
  savingReason: string | undefined;
  send: UndoSend;
  notify?: UndoNotify;
  /** The plan summary is still loading: disabled with a neutral reason, not "No moves to undo". */
  loading?: boolean;
}) {
  return (
    <Button
      variant="tertiary"
      size="md"
      disabledReason={undoReason(preview, savingReason, loading)}
      description={preview === null ? undefined : undoLabel(preview)}
      onClick={() => {
        if (preview !== null) void sendUndo(send, preview.move_number, notify);
      }}
    >
      {UNDO_LAST_MOVE}
    </Button>
  );
}

/** Undo last move for a plan: reads the plan summary and sends through lib/commands. */
export function UndoLastMoveButton({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  return (
    <UndoLastMove
      preview={summary.data?.undo_preview ?? null}
      savingReason={disabledReason}
      send={sendWithEvents}
      loading={summary.isPending}
    />
  );
}
