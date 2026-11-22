"use client";

// Confirm dialog (UX-DR16): Cancel comes first and has the focus when the dialog opens; the
// destructive action names what is lost. Focus returns to the opener on close (radix default),
// unless `onCloseAutoFocus` places it (call `event.preventDefault()` there to skip the default).

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "@/components/common/button";

/** Button order in the dialog footer: Cancel first, then the confirm action. */
export const CONFIRM_BUTTON_ORDER = ["cancel", "confirm"] as const;

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Runs when the dialog closes, before focus returns to the opener; see AlertDialog.Content. */
  onCloseAutoFocus?: (event: Event) => void;
};

const FADE =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={`fixed inset-0 z-50 bg-ink/45 ${FADE}`} />
        <AlertDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={`fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 text-ink shadow-overlay ${FADE}`}
        >
          <AlertDialog.Title className="type-rank">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-3 type-body">{description}</AlertDialog.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {CONFIRM_BUTTON_ORDER.map((kind) =>
              kind === "cancel" ? (
                <AlertDialog.Cancel key={kind} asChild>
                  <Button variant="tertiary">Cancel</Button>
                </AlertDialog.Cancel>
              ) : (
                <AlertDialog.Action key={kind} asChild>
                  <Button variant="destructive" onClick={onConfirm}>
                    {confirmLabel}
                  </Button>
                </AlertDialog.Action>
              ),
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
