"use client";

// The occupied drop dialog (Story 12.3, FR-51, FR-32, UX-DR50, UX-DR10, NFR-10): a drop on an
// occupied location always asks before anything changes. A popover anchored to the dropped-on cell,
// "<to> is occupied", with:
//
// - "Parts to move from <from>" only when the from-location holds several parts (the dragged part
//   checked), and "Parts to move back to <from>" only when the target holds several (all checked
//   but the dragged part; the list is the server preview's `target_parts`). A side with one part
//   moves that part, without a checkbox.
// - A kept-in-place warning when a part the swap would move is kept (Swap stays enabled; the server
//   keeps the mark).
// - **Swap** and **Put together** (both secondary, neither the default) and **Cancel**. Their
//   disabled reasons: saving first, then no part to move, then (Swap only) no part to move back,
//   then (Swap only) a part chosen on both sides, which the server refuses ("cannot move both
//   ways", drag.py). The dragged part also stored at the target starts unchecked on the back side;
//   a target whose only part is the dragged part offers Swap disabled with that reason.
//
// On open, focus goes to the first checkbox, else the popover; `Esc`, Cancel or a press outside
// closes it with nothing sent and focus returns to the cell.

import { useId } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import type { TargetPart, WallPart } from "@/lib/api/plans";
import {
  cannotMoveBothWays,
  CHOOSE_PART_TO_MOVE,
  CHOOSE_PART_TO_MOVE_BACK,
  keptSwapWarning,
  occupiedDialogTitle,
  PUT_TOGETHER,
  partsToMoveBackTo,
  partsToMoveFrom,
  SWAP,
} from "@/lib/copy";

import { checkedInOrder, DropPopover, PartCheckboxes, useCheckedParts } from "./drop-popover";

/** A side's chosen parts in list order: its only part, else the checked ones. */
export function chosenParts(parts: readonly Pick<TargetPart, "part">[], checked: ReadonlySet<string>): string[] {
  return parts.length < 2 ? parts.map((entry) => entry.part) : checkedInOrder(parts, checked);
}

/** Why Put together cannot be pressed (saving first, then no part to move), or undefined. */
export function putTogetherReason(chosenCount: number, savingReason: string | undefined): string | undefined {
  if (savingReason !== undefined) return savingReason;
  return chosenCount === 0 ? CHOOSE_PART_TO_MOVE : undefined;
}

/** The first chosen part that is also chosen to move back, or undefined (the server refuses it). */
export function partBothWays(chosen: readonly string[], chosenBack: readonly string[]): string | undefined {
  return chosen.find((part) => chosenBack.includes(part));
}

/**
 * Why Swap cannot be pressed (saving, no part to move, no part to move back, `bothWays`: a part
 * chosen on both sides), or undefined.
 */
export function swapReason(
  chosenCount: number,
  chosenBackCount: number,
  savingReason: string | undefined,
  bothWays?: string,
): string | undefined {
  const reason = putTogetherReason(chosenCount, savingReason);
  if (reason !== undefined) return reason;
  if (chosenBackCount === 0) return CHOOSE_PART_TO_MOVE_BACK;
  return bothWays === undefined ? undefined : cannotMoveBothWays(bothWays);
}

/** The back-parts checked when the dialog opens: every target part but the dragged one. */
export function initialBackParts(targetParts: readonly Pick<TargetPart, "part">[], dragged: string): string[] {
  return targetParts.map((entry) => entry.part).filter((part) => part !== dragged);
}

/** The kept-in-place parts a swap of the chosen parts and back-parts would move, in that order. */
export function keptInSwap(
  parts: readonly Pick<TargetPart, "part" | "kept_in_place">[],
  chosen: readonly string[],
  targetParts: readonly Pick<TargetPart, "part" | "kept_in_place">[],
  chosenBack: readonly string[],
): string[] {
  const kept = (list: typeof parts, picked: readonly string[]) =>
    list.filter((entry) => entry.kept_in_place && picked.includes(entry.part)).map((entry) => entry.part);
  return [...kept(parts, chosen), ...kept(targetParts, chosenBack)];
}

export type OccupiedDialogBodyProps = {
  titleId: string;
  from: string;
  to: string;
  /** The from-location's parts (most picks first). */
  parts: readonly WallPart[];
  /** The target's parts from the move preview. */
  targetParts: readonly TargetPart[];
  checked: ReadonlySet<string>;
  checkedBack: ReadonlySet<string>;
  onToggle: (part: string) => void;
  onToggleBack: (part: string) => void;
  savingReason?: string;
  onSwap: (parts: string[], backParts: string[]) => void;
  onPutTogether: (parts: string[]) => void;
  onCancel: () => void;
};

/** The dialog's content (no popover), so its markup can be checked without a DOM. */
export function OccupiedDialogBody({
  titleId,
  from,
  to,
  parts,
  targetParts,
  checked,
  checkedBack,
  onToggle,
  onToggleBack,
  savingReason,
  onSwap,
  onPutTogether,
  onCancel,
}: OccupiedDialogBodyProps) {
  const chosen = chosenParts(parts, checked);
  const chosenBack = chosenParts(targetParts, checkedBack);
  const bothWays = partBothWays(chosen, chosenBack);
  // Warn only when a swap is possible: something to move, something else to move back.
  const kept =
    chosen.length > 0 && chosenBack.length > 0 && bothWays === undefined
      ? keptInSwap(parts, chosen, targetParts, chosenBack)
      : [];
  const warningId = useId();
  return (
    <div className="flex flex-col gap-3" data-occupied-dialog={to}>
      <h2 id={titleId} className="type-rank">
        {occupiedDialogTitle(to)}
      </h2>
      {parts.length > 1 && (
        <PartCheckboxes
          group="from"
          legend={partsToMoveFrom(from)}
          parts={parts}
          checked={checked}
          onToggle={onToggle}
        />
      )}
      {targetParts.length > 1 && (
        <PartCheckboxes
          group="back"
          legend={partsToMoveBackTo(from)}
          parts={targetParts}
          checked={checkedBack}
          onToggle={onToggleBack}
        />
      )}
      {kept.length > 0 && (
        <p id={warningId} className="flex items-start gap-2 text-ink type-body" data-kept-warning="">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{keptSwapWarning(kept)}</span>
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          disabledReason={swapReason(chosen.length, chosenBack.length, savingReason, bothWays)}
          aria-describedby={kept.length > 0 ? warningId : undefined}
          onClick={() => onSwap(chosen, chosenBack)}
        >
          {SWAP}
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabledReason={putTogetherReason(chosen.length, savingReason)}
          onClick={() => onPutTogether(chosen)}
        >
          {PUT_TOGETHER}
        </Button>
        <Button variant="tertiary" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export type OccupiedDialogProps = {
  /** The dropped-on cell: the popover's anchor, and where focus returns on close. */
  anchor: HTMLElement;
  from: string;
  to: string;
  parts: readonly WallPart[];
  /** The dragged part: checked when the dialog opens. */
  dragged: string;
  targetParts: readonly TargetPart[];
  savingReason?: string;
  onSwap: (parts: string[], backParts: string[]) => void;
  onPutTogether: (parts: string[]) => void;
  /** `Esc`, Cancel or a press outside: nothing is sent. */
  onClose: () => void;
};

export function OccupiedDialog({
  anchor,
  from,
  to,
  parts,
  dragged,
  targetParts,
  savingReason,
  onSwap,
  onPutTogether,
  onClose,
}: OccupiedDialogProps) {
  const titleId = useId();
  const [checked, toggle] = useCheckedParts([dragged]);
  const [checkedBack, toggleBack] = useCheckedParts(initialBackParts(targetParts, dragged));

  return (
    <DropPopover anchor={anchor} titleId={titleId} onClose={onClose}>
      <OccupiedDialogBody
        titleId={titleId}
        from={from}
        to={to}
        parts={parts}
        targetParts={targetParts}
        checked={checked}
        checkedBack={checkedBack}
        onToggle={toggle}
        onToggleBack={toggleBack}
        savingReason={savingReason}
        onSwap={onSwap}
        onPutTogether={onPutTogether}
        onCancel={onClose}
      />
    </DropPopover>
  );
}
