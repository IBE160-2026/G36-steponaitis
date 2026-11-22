"use client";

// Keep in place (Story 7.1, FR-32, UX-DR37): the one link and the one command flow behind the
// recommendation detail, the part panel and the roster row. The link sets or removes the mark at
// once through lib/commands; the confirmed event words the toast (never with Undo: a keep mark is
// not a move, AD-5). The server decides what is kept; this only sends and reports.

import { useCallback } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { showToast } from "@/components/common/toast";
import { type CommandBody, type SendResult, usePlanCommands } from "@/lib/commands";
import { KEEP_IN_PLACE, KEPT_IN_PLACE_STATE, keepRemovedToast, keptToast, REMOVE_KEEP_IN_PLACE } from "@/lib/copy";
import type { CommandEvent } from "@/lib/api/plans";
import { cn } from "@/lib/utils";

/** The command that flips the mark: `remove_keep` for a kept part, else `set_keep`. */
export function keepCommand(part: string, kept: boolean): CommandBody {
  return kept ? { type: "remove_keep", part } : { type: "set_keep", part };
}

/** The toast of a confirmed keep command's events; undefined for a no-op (no event). */
export function keepToastText(events: readonly CommandEvent[]): string | undefined {
  for (const event of events) {
    if (event.type === "keep_set") return keptToast(event.part);
    if (event.type === "keep_removed") return keepRemovedToast(event.part);
  }
  return undefined;
}

/** Sends the flip through `send` and toasts the confirmed outcome (no Undo action). */
export async function sendKeep(
  send: (body: CommandBody) => Promise<SendResult>,
  part: string,
  kept: boolean,
  notify: (message: string) => void = showToast,
): Promise<SendResult> {
  const result = await send(keepCommand(part, kept));
  if (result.outcome === "confirmed") {
    const message = keepToastText(result.events);
    if (message) notify(message);
  }
  return result;
}

/** `toggle(part, kept)` sets or removes the part's mark; `savingReason` disables the link meanwhile. */
export function useKeepInPlace(planId: string) {
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const toggle = useCallback((part: string, kept: boolean) => sendKeep(sendWithEvents, part, kept), [sendWithEvents]);
  return { toggle, savingReason: disabledReason };
}

/** "Keep in place" or "Remove keep in place". */
export function keepLabel(kept: boolean): string {
  return kept ? REMOVE_KEEP_IN_PLACE : KEEP_IN_PLACE;
}

/** The link: disabled with the saving reason while a command is unconfirmed. */
export function KeepInPlaceButton({
  kept,
  savingReason,
  onClick,
  keyShortcut,
  tabIndex,
}: {
  kept: boolean;
  savingReason: string | undefined;
  onClick: () => void;
  /** `aria-keyshortcuts` where the region handles one (the recommendations' `Alt+K`). */
  keyShortcut?: string;
  /** -1 outside a table's active row (one tab stop per table, UX-DR18). */
  tabIndex?: number;
}) {
  return (
    <Button
      variant="link"
      size="md"
      aria-keyshortcuts={keyShortcut}
      disabledReason={savingReason}
      tabIndex={tabIndex}
      data-keep-in-place=""
      onClick={onClick}
    >
      {keepLabel(kept)}
    </Button>
  );
}

/** The pin glyph with "kept in place" (roster row, part panel), or with `label` ("Kept in place"
 * on a recommendation row and detail). */
export function KeptInPlaceMark({
  label = KEPT_IN_PLACE_STATE,
  size = 14,
  className = "text-ink",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} data-kept-in-place="">
      <Icon name="pin" size={size} />
      <span>{label}</span>
    </span>
  );
}
