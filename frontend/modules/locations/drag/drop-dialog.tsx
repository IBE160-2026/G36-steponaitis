"use client";

// The drop dialog (Story 12.2, FR-51, UX-DR50): a drop on an empty location from a location that
// holds several parts asks which parts move. A popover anchored to the dropped-on cell, "Move to
// <to>", with one checkbox per part of the from-location (the dragged part checked), **Move** and
// **Cancel**. Move sends the checked parts in from-location order; with none checked it is
// aria-disabled with its reason, and while a command is unconfirmed it shows the saving reason.
// `Esc` or Cancel closes it with nothing sent, and focus returns to the cell. All by keyboard.

import { Popover } from "radix-ui";
import { useId, useState } from "react";

import { Button } from "@/components/common/button";
import { ClassGlyph } from "@/components/common/class-glyph";
import type { WallPart } from "@/lib/api/plans";
import { CHOOSE_PART_TO_MOVE, dropDialogTitle, dropPartStats, partsToMoveFrom } from "@/lib/copy";

/** Why Move cannot be pressed (saving first, then nothing checked), or undefined. */
export function dropMoveReason(checkedCount: number, savingReason: string | undefined): string | undefined {
  if (savingReason !== undefined) return savingReason;
  return checkedCount === 0 ? CHOOSE_PART_TO_MOVE : undefined;
}

/** The checked parts in from-location order. */
export function checkedInOrder(parts: readonly Pick<WallPart, "part">[], checked: ReadonlySet<string>): string[] {
  return parts.filter((entry) => checked.has(entry.part)).map((entry) => entry.part);
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
      <fieldset className="flex min-w-0 flex-col gap-1">
        <legend className="mb-1 type-body text-ink-secondary">{partsToMoveFrom(from)}</legend>
        {parts.map((entry) => (
          <label
            key={entry.part}
            className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 hover:bg-ground"
            data-drop-part={entry.part}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-ink"
              checked={checked.has(entry.part)}
              onChange={() => onToggle(entry.part)}
            />
            <span className="mt-1">
              <ClassGlyph movementClass={entry.movement_class} size={9} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="type-code-table text-ink">{entry.part}</span>
                <span className="min-w-0 truncate type-body text-ink">{entry.description}</span>
              </span>
              <span className="type-caption text-ink-secondary">
                {dropPartStats(entry.movement_class, entry.stock)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
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
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set([dragged]));
  const [anchorRef] = useState(() => ({ current: anchor }));

  function toggle(part: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal>
        <Popover.Content
          aria-labelledby={titleId}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[min(360px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-4 text-ink shadow-overlay"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (anchor.isConnected) anchor.focus({ preventScroll: true });
          }}
        >
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
