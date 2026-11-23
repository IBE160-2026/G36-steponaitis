"use client";

// The drop dialogs' shared parts (Stories 12.2 and 12.3, FR-51, UX-DR50, NFR-10): the popover shell
// anchored to the dropped-on cell and the checkbox rows that choose parts.
//
// - `DropPopover`: a Radix popover anchored to the cell. On open, focus goes to the first checkbox,
//   else to the popover content itself, never to a button. `Esc` or a press outside closes it and
//   focus returns to the cell.
// - `PartCheckboxes`: a fieldset with its legend and one checkbox row per part (glyph, number,
//   description, "<Class> · <stock>"; a part without a class shows no glyph and its stock alone).

import { Popover } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";

import { ClassGlyph } from "@/components/common/class-glyph";
import type { TargetPart } from "@/lib/api/plans";
import { dropPartStats } from "@/lib/copy";

/** A row's facts: a wall part or a target part from the move preview (class may be null). */
export type DropPart = Pick<TargetPart, "part" | "description" | "movement_class" | "stock">;

/** The checked parts in list order. */
export function checkedInOrder(parts: readonly Pick<DropPart, "part">[], checked: ReadonlySet<string>): string[] {
  return parts.filter((entry) => checked.has(entry.part)).map((entry) => entry.part);
}

/** A set of checked part numbers and its toggle. */
export function useCheckedParts(initial: Iterable<string>) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(initial));
  function toggle(part: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }
  return [checked, toggle] as const;
}

export function PartCheckboxes({
  legend,
  parts,
  checked,
  onToggle,
  group,
}: {
  legend: string;
  parts: readonly DropPart[];
  checked: ReadonlySet<string>;
  onToggle: (part: string) => void;
  /** Names the group in the markup (`data-drop-group`), e.g. "from" or "back". */
  group?: string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1" data-drop-group={group}>
      <legend className="mb-1 type-body text-ink-secondary">{legend}</legend>
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
          <span className="mt-1 inline-flex w-[9px] shrink-0">
            {entry.movement_class !== null && <ClassGlyph movementClass={entry.movement_class} size={9} />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="type-code-table text-ink">{entry.part}</span>
              <span className="min-w-0 truncate type-body text-ink">{entry.description}</span>
            </span>
            <span className="type-caption text-ink-secondary">{dropPartStats(entry.movement_class, entry.stock)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function DropPopover({
  anchor,
  titleId,
  onClose,
  children,
}: {
  /** The dropped-on cell: the popover's anchor, and where focus returns on close. */
  anchor: HTMLElement;
  titleId: string;
  /** `Esc` or a press outside. */
  onClose: () => void;
  children: ReactNode;
}) {
  const [anchorRef] = useState(() => ({ current: anchor }));
  const content = useRef<HTMLDivElement>(null);

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
          ref={content}
          tabIndex={-1}
          aria-labelledby={titleId}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[min(360px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-4 text-ink shadow-overlay outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const box = content.current?.querySelector<HTMLInputElement>('input[type="checkbox"]');
            (box ?? content.current)?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (anchor.isConnected) anchor.focus({ preventScroll: true });
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
