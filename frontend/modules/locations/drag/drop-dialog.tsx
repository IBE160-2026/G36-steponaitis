"use client";

// The drop dialog (Story 12.2, FR-51, UX-DR50): a drop on an empty location from a location that
// holds several parts asks which parts move. A popover anchored to the dropped-on cell, "Move to
// <to>", with one checkbox per part of the from-location (the dragged part checked), **Move** and
// **Cancel**. Move sends the checked parts in from-location order; with none checked it is
// aria-disabled with its reason, and while a command is unconfirmed it shows the saving reason.
// `Esc` or Cancel closes it with nothing sent, and focus returns to the cell. All by keyboard.

import { useId } from "react";

import { Button } from "@/components/common/button";
import type { WallPart } from "@/lib/api/plans";
import { CHOOSE_PART_TO_MOVE, dropDialogTitle, partsToMoveFrom } from "@/lib/copy";

import { checkedInOrder, DropPopover, PartCheckboxes, useCheckedParts } from "./drop-popover";

/** Why Move cannot be pressed (saving first, then nothing checked), or undefined. */
export function dropMoveReason(checkedCount: number, savingReason: string | undefined): string | undefined {
  if (savingReason !== undefined) return savingReason;
  return checkedCount === 0 ? CHOOSE_PART_TO_MOVE : undefined;
}

export type DropDialogBodyProps = {
  titleId: string;
  from: string;
  to: string;
  /** The from-location's parts (most picks first). */
  parts: readonly WallPart[];
  checked: ReadonlySet<string>;
  onToggle: (part: string) => void;
  savingReason?: string;
  onMove: (parts: string[]) => void;
  onCancel: () => void;
};

/** The dialog's content (no popover), so its markup can be checked without a DOM. */
export function DropDialogBody({
  titleId,
  from,
  to,
  parts,
  checked,
  onToggle,
  savingReason,
  onMove,
  onCancel,
}: DropDialogBodyProps) {
  const reason = dropMoveReason(checked.size, savingReason);
  return (
    <div className="flex flex-col gap-3" data-drop-dialog={to}>
      <h2 id={titleId} className="type-rank">
        {dropDialogTitle(to)}
      </h2>
      <PartCheckboxes legend={partsToMoveFrom(from)} parts={parts} checked={checked} onToggle={onToggle} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          disabledReason={reason}
          onClick={() => onMove(checkedInOrder(parts, checked))}
        >
          Move
        </Button>
      </div>
    </div>
  );
}

export type DropDialogProps = {
  /** The dropped-on cell: the popover's anchor, and where focus returns on close. */
  anchor: HTMLElement;
  from: string;
  to: string;
  parts: readonly WallPart[];
  /** The dragged part: checked when the dialog opens. */
  dragged: string;
  savingReason?: string;
  onMove: (parts: string[]) => void;
  /** `Esc`, Cancel or a press outside: nothing is sent. */
  onClose: () => void;
};

export function DropDialog({ anchor, from, to, parts, dragged, savingReason, onMove, onClose }: DropDialogProps) {
  const titleId = useId();
  const [checked, toggle] = useCheckedParts([dragged]);

  return (
    <DropPopover anchor={anchor} titleId={titleId} onClose={onClose}>
      <DropDialogBody
        titleId={titleId}
        from={from}
        to={to}
        parts={parts}
        checked={checked}
        onToggle={toggle}
        savingReason={savingReason}
        onMove={onMove}
        onCancel={onClose}
      />
    </DropPopover>
  );
}
