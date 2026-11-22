"use client";

// Reset… (Story 7.4, FR-35, UX-DR38, UX-DR16): the Recommendations header's "⋯" menu holds one
// item, Reset…, which asks the shared destructive confirm (Cancel first with the focus) with the
// server's effective move count (AD-3). Cancel, `Esc` and a confirm return focus to "⋯". The page
// sends the command (lib/commands/reset) and resets its own selection.

import { DropdownMenu } from "radix-ui";
import { type RefObject, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { MORE_ACTIONS, RESET_CONFIRM, RESET_ITEM, RESET_TITLE, resetQuestion } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type ResetPlanMenuProps = {
  /** The plan summary's `move_count`: effective moves, never counted in the client. */
  moveCount: number;
  /** Set while a command is pending; Reset… is disabled then and says why. */
  savingReason: string | undefined;
  /** Runs on confirm only. */
  onConfirm: () => void;
};

export type ResetPlanMenuViewProps = ResetPlanMenuProps & {
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  trigger: RefObject<HTMLButtonElement | null>;
};

/** The "⋯" menu and its confirm dialog, without state (rendered and tested as a plain tree). */
export function ResetPlanMenuView({
  moveCount,
  savingReason,
  onConfirm,
  dialogOpen,
  onDialogOpenChange,
  trigger,
}: ResetPlanMenuViewProps) {
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button ref={trigger} variant="tertiary" size="md" aria-label={MORE_ACTIONS}>
            <span aria-hidden="true">⋯</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={16} className={MENU_CONTENT_CLASS}>
            <DropdownMenu.Item
              className={cn(MENU_ITEM_CLASS, "data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-disabled")}
              disabled={savingReason !== undefined}
              title={savingReason}
              onSelect={() => onDialogOpenChange(true)}
            >
              {RESET_ITEM}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        title={RESET_TITLE}
        description={resetQuestion(moveCount)}
        confirmLabel={RESET_CONFIRM}
        destructive
        onConfirm={onConfirm}
        onCloseAutoFocus={(event) => {
          // The menu closed before the dialog opened, so radix would not return focus to "⋯".
          event.preventDefault();
          trigger.current?.focus();
        }}
      />
    </>
  );
}

export function ResetPlanMenu(props: ResetPlanMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <ResetPlanMenuView {...props} dialogOpen={dialogOpen} onDialogOpenChange={setDialogOpen} trigger={trigger} />;
}
