"use client";

// Plan-changed dialog (FR-41, Story 15.1): someone else saved the plan after this planner opened
// it, so the held change waits for a choice. Reload plan (Cancel position, default focus) drops it;
// Keep going (primary) sends it again on top of the other changes. Escape or closing is Reload
// plan. `askPlanChanged()` is module-level like the toast: the command client's `planChanged`
// effect calls it and the one mounted `PlanChangedDialogHost` shows the dialog.

import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PLAN_CHANGED_KEEP, PLAN_CHANGED_RELOAD, PLAN_CHANGED_TEXT, PLAN_CHANGED_TITLE } from "@/lib/copy";

export type PlanChangedChoice = "reload" | "keep";

type Ask = (resolve: (choice: PlanChangedChoice) => void) => void;

let host: Ask | null = null;

/** Opens the dialog and resolves with the planner's choice; "reload" when no host is mounted. */
export function askPlanChanged(): Promise<PlanChangedChoice> {
  return new Promise((resolve) => {
    if (host) host(resolve);
    else resolve("reload");
  });
}

export function PlanChangedDialogHost() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((choice: PlanChangedChoice) => void) | null>(null);

  useEffect(() => {
    const ask: Ask = (resolve) => {
      // One command at a time per plan: a second ask while one is open answers the first as reload.
      pending.current?.("reload");
      pending.current = resolve;
      setOpen(true);
    };
    host = ask;
    return () => {
      if (host === ask) host = null;
      pending.current?.("reload");
      pending.current = null;
    };
  }, []);

  const choose = (choice: PlanChangedChoice) => {
    const resolve = pending.current;
    pending.current = null;
    resolve?.(choice);
  };

  return (
    <PlanChangedDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Escape, the overlay or Reload plan: whatever closes the dialog without Keep going reloads.
        if (!next) choose("reload");
      }}
      onReload={() => choose("reload")}
      onKeepGoing={() => choose("keep")}
    />
  );
}

type PlanChangedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onKeepGoing: () => void;
};

export function PlanChangedDialog({ open, onOpenChange, onReload, onKeepGoing }: PlanChangedDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={PLAN_CHANGED_TITLE}
      description={PLAN_CHANGED_TEXT}
      cancelLabel={PLAN_CHANGED_RELOAD}
      onCancel={onReload}
      confirmLabel={PLAN_CHANGED_KEEP}
      onConfirm={onKeepGoing}
      destructive={false}
    />
  );
}
