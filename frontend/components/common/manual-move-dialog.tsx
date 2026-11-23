"use client";

// ManualMoveDialog (FR-33, FR-34, UX-DR24, UX-DR26, Story 4.3): moves a part from one of its
// locations to any location in the Locations file. The server preview
// (GET /api/plans/{id}/moves/preview) drives the dialog: it says whether the move is allowed, the
// refusal sentence and the effect; the client never computes occupancy or the move's effect
// (AD-3). The to-location field is an ARIA combobox over the Locations file codes in server order
// (AD-14). Confirm sends `manual_move` through lib/commands; a confirmed move closes the dialog and
// a toast names it. Shared: the part panel, the recommendation detail and the wall's pinned
// tooltip (Story 10.3) open it; `ManualMoveAction` is the button plus dialog for a part by number,
// with the from-location optionally preselected.

import { Dialog } from "radix-ui";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/common/button";
import { Input, InputError } from "@/components/common/input";
import { showsLoadError } from "@/components/common/plan-status";
import { showToast } from "@/components/common/toast";
import {
  type CommandEvent,
  type MovePreview,
  type PartDetail,
  useMovePreview,
  usePlanLocations,
  usePlanPart,
} from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import { LOADING_PART, RULE_LABELS } from "@/lib/copy";
import { moveEventStep, moveUndoAction } from "@/lib/commands/undo";
import { cn } from "@/lib/utils";

export const TO_LABEL = "To-location";
export const FROM_LABEL = "From-location";
export const ENTER_TO = "Enter a to-location.";
export const CHECKING = "Checking the move…";
export const PREVIEW_DEBOUNCE_MS = 200;
export const MATCH_LIMIT = 8;
export const NO_CURRENT_LOCATION = "No current location (no stock above zero)";
export const MANUAL_MOVE_LABEL = "Manual move…";

/** Why Manual move… cannot open: no current location first, else the command flow's reason. */
export function manualMoveReason(detail: Pick<PartDetail, "current_location">, savingReason?: string): string | undefined {
  return detail.current_location === null ? NO_CURRENT_LOCATION : savingReason;
}

/** The part's locations to move from: the current location first, then the other locations. */
export function fromChoices(detail: Pick<PartDetail, "current_location" | "other_locations">): string[] {
  const current = detail.current_location ? [detail.current_location.code] : [];
  return [...current, ...detail.other_locations.map((other) => other.location.code)];
}

/** The from-location a dialog starts on: `initialFrom` when it is one of `choices`, else the first. */
export function initialFromChoice(choices: readonly string[], initialFrom?: string): string {
  return initialFrom !== undefined && choices.includes(initialFrom) ? initialFrom : (choices[0] ?? "");
}

/** Codes starting with the typed text (case-insensitive, trimmed), in the given order; none for blank. */
export function matchLocations(codes: readonly string[], typed: string, limit = MATCH_LIMIT): string[] {
  const prefix = typed.trim().toUpperCase();
  if (prefix === "") return [];
  const matches: string[] = [];
  for (const code of codes) {
    if (code.toUpperCase().startsWith(prefix)) {
      matches.push(code);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

/** The trimmed input, or the Locations code it names when it matches one ignoring case. */
export function locationCode(codes: readonly string[], typed: string): string {
  const trimmed = typed.trim();
  const upper = trimmed.toUpperCase();
  return codes.find((code) => code.toUpperCase() === upper) ?? trimmed;
}

/** The sentence under the field for an allowed preview (null when refused or without an effect). */
export function effectLine(preview: MovePreview, part: string, to: string): string | null {
  if (!preview.allowed || preview.effect === null) return null;
  switch (preview.effect.kind) {
    case "new": {
      if (preview.target !== "occupied") return "to an empty location";
      const parts = preview.target_parts.map((target) => target.part);
      const verb = parts.length >= 2 ? "stay there too" : "stays there too";
      return `to an occupied location: ${parts.join(", ")} ${verb}`;
    }
    case "adds_to_stock":
      return "to an occupied location: stock is added together";
    case "combines_with":
      return `This combines with move ${preview.effect.move_number} into one move.`;
    case "removes_move":
      return `This undoes move ${preview.effect.move_number}: ${part} returns to ${to} and the move is removed.`;
  }
}

/** The toast for a confirmed manual move, from its first move event; null when there is none. */
export function moveToast(events: readonly CommandEvent[]): string | null {
  for (const event of events) {
    switch (event.type) {
      case "move_made":
        return `Moved ${event.part}: ${event.from_location} → ${event.to_location} (${RULE_LABELS[event.rule]}, round ${event.round}).`;
      case "moves_combined":
        return `Combined into one move: ${event.from_location} → ${event.to_location} (Manual).`;
      case "move_removed":
        return `Removed move ${event.move_number}: ${event.part} returns to ${event.location}.`;
    }
  }
  return null;
}

/** Why Move cannot be pressed yet (first that applies), or undefined when it can. */
export function confirmReason({
  savingReason,
  to,
  preview,
  previewError,
}: {
  savingReason: string | undefined;
  to: string;
  /** The preview for the current from/to, or null while it is not there yet. */
  preview: MovePreview | null;
  previewError?: string;
}): string | undefined {
  if (savingReason) return savingReason;
  if (to.trim() === "") return ENTER_TO;
  if (preview === null) return previewError ?? CHECKING;
  if (!preview.allowed) return preview.refusal_message ?? CHECKING;
  return undefined;
}

export type ToLocationFieldProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  matches: readonly string[];
  /** Whether the option list is shown (it also needs at least one match). */
  listOpen: boolean;
  highlight: number;
  onPick: (code: string) => void;
  /** The server's refusal sentence (shown as an input error). */
  error?: string | null;
  /** The effect sentence for an allowed move. */
  effect?: string | null;
};

/** The labelled to-location combobox, its option list and the error or effect line (no fetching). */
export function ToLocationField({
  value,
  onChange,
  onKeyDown,
  inputRef,
  matches,
  listOpen,
  highlight,
  onPick,
  error,
  effect,
}: ToLocationFieldProps) {
  const inputId = useId();
  const listId = useId();
  const errorId = useId();
  const effectId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const shown = listOpen && matches.length > 0;
  const active = shown && highlight >= 0 && highlight < matches.length ? optionId(highlight) : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="type-body text-ink">
        {TO_LABEL}
      </label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={active}
          aria-describedby={effect && !error ? effectId : undefined}
          errorId={error ? errorId : undefined}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          className="type-code"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={TO_LABEL}
          hidden={!shown}
          // Keep focus in the field while an option is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-overlay"
        >
          {shown &&
            matches.map((code, index) => (
              <li
                key={code}
                id={optionId(index)}
                role="option"
                aria-selected={index === highlight}
                data-location-option={code}
                onClick={() => onPick(code)}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1 type-code text-ink",
                  index === highlight ? "bg-selected-tint" : "hover:bg-ground",
                )}
              >
                {code}
              </li>
            ))}
        </ul>
      </div>
      <div aria-live="polite">
        {error ? (
          <InputError id={errorId}>{error}</InputError>
        ) : effect ? (
          <p id={effectId} className="mt-1 type-body text-ink" data-move-effect="">
            {effect}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type ManualMoveDialogProps = {
  planId: string;
  detail: PartDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the focus back on close (the opener may have re-rendered while the move was saving). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** The from-location to start on, when it is one of the part's locations (else the first). */
  initialFrom?: string;
};

const FADE =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150";

export function ManualMoveDialog({
  planId,
  detail,
  open,
  onOpenChange,
  returnFocusRef,
  initialFrom,
}: ManualMoveDialogProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 bg-ink/45 ${FADE}`} />
        <Dialog.Content
          aria-modal="true"
          className={`fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 text-ink shadow-overlay ${FADE}`}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            input.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current;
            if (target && target.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            // Esc closes an open option list first, then clears the field, then closes the dialog.
            // Radix sees the key first (on the document); the field's own handler does the rest.
            const field = input.current;
            if (field && event.target === field && (field.getAttribute("aria-expanded") === "true" || field.value !== "")) {
              event.preventDefault();
            }
          }}
        >
          <Dialog.Title className="type-rank">Manual move · {detail.part}</Dialog.Title>
          <Dialog.Description className="mt-1 type-body text-ink-secondary">{detail.description}</Dialog.Description>
          <ManualMoveForm
            planId={planId}
            detail={detail}
            inputRef={input}
            initialFrom={initialFrom}
            onDone={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The dialog body; mounted while the dialog is open, so each opening starts fresh. */
function ManualMoveForm({
  planId,
  detail,
  inputRef,
  initialFrom,
  onDone,
}: {
  planId: string;
  detail: PartDetail;
  inputRef: RefObject<HTMLInputElement | null>;
  initialFrom?: string;
  onDone: () => void;
}) {
  const part = detail.part;
  // The choices follow the current detail (a refetch after a command may change them); the chosen
  // from-location stays while it is still a choice, else the first one is used.
  const choices = fromChoices(detail);
  const [chosen, setFrom] = useState(() => initialFromChoice(choices, initialFrom));
  const from = choices.includes(chosen) ? chosen : (choices[0] ?? "");
  const [to, setTo] = useState("");
  const [debounced, setDebounced] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // While a confirmed move refetches the plan, keep showing the preview it was sent with.
  const [sentWith, setSentWith] = useState<MovePreview | null>(null);
  const fromSelect = useId();

  const { sendWithEvents, disabledReason: savingReason } = usePlanCommands(planId);
  const locations = usePlanLocations(planId);
  const codes = locations.data?.locations.map((row) => row.location.code) ?? [];
  const matches = matchLocations(codes, to);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(to), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [to]);

  const target = locationCode(codes, to);
  const preview = useMovePreview(planId, part, from, locationCode(codes, debounced));
  // The preview counts only once it answers the value in the field (not a debounced or kept one).
  const settled = to.trim() !== "" && debounced.trim() === to.trim();
  // A cached preview invalidated by an earlier command does not count while it refetches.
  const current = settled && !preview.isPlaceholderData && !preview.isFetching ? (preview.data ?? null) : null;
  const previewError =
    settled && current === null && !preview.isFetching && showsLoadError(preview.error) ? preview.error.message : undefined;
  const shown = sentWith ?? current;
  const reason = confirmReason({ savingReason, to, preview: shown, previewError });
  const removes = shown?.allowed === true && shown.effect?.kind === "removes_move";
  const error = shown && !shown.allowed ? shown.refusal_message : previewError;
  const effect = shown ? effectLine(shown, part, target) : null;

  function change(event: ChangeEvent<HTMLInputElement>) {
    setTo(event.target.value);
    setListOpen(true);
    setHighlight(-1);
  }

  function pick(code: string) {
    setTo(code);
    setDebounced(code);
    setListOpen(false);
    setHighlight(-1);
  }

  async function confirm() {
    if (reason !== undefined || shown === null) return;
    setSentWith(shown);
    const result = await sendWithEvents({ type: "manual_move", part, from, to: target });
    // A second press while the first send is pending: leave the first send's state alone.
    if (result.outcome === "busy") return;
    if (result.outcome === "confirmed") {
      onDone();
      const message = moveToast(result.events);
      const moved = result.events.find((event) => moveEventStep(event) !== undefined);
      if (message) showToast(message, { action: moved && moveUndoAction(moved, sendWithEvents, showToast) });
    } else {
      // The flow already toasted and refetched; the dialog stays open on the new preview.
      setSentWith(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      setListOpen(true);
      const last = matches.length - 1;
      const current = listOpen ? highlight : -1;
      if (event.key === "ArrowDown") setHighlight(current >= last ? 0 : current + 1);
      else setHighlight(current <= 0 ? last : current - 1);
      return;
    }
    if (event.key === "Escape") {
      // The dialog kept itself open for this Esc (see `onEscapeKeyDown`), which also stops the
      // field's own clearing, so close the list or clear the field here.
      if (listOpen && matches.length > 0) {
        setListOpen(false);
        setHighlight(-1);
      } else if (to !== "") {
        setTo("");
        setDebounced("");
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (listOpen && highlight >= 0 && highlight < matches.length) {
        pick(matches[highlight]);
        return;
      }
      void confirm();
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {choices.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={fromSelect} className="type-body text-ink">
            {FROM_LABEL}
          </label>
          <select
            id={fromSelect}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-control-lg rounded-lg border border-input-border bg-surface px-3 type-code text-ink"
          >
            {choices.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="type-body text-ink" data-move-from={from}>
          From <span className="type-code">{from}</span>
        </p>
      )}
      <ToLocationField
        value={to}
        onChange={change}
        onKeyDown={onKeyDown}
        inputRef={inputRef}
        matches={matches}
        listOpen={listOpen}
        highlight={highlight}
        onPick={pick}
        error={to.trim() === "" ? null : error}
        effect={effect}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Dialog.Close asChild>
          <Button variant="tertiary">Cancel</Button>
        </Dialog.Close>
        <Button variant="primary" disabledReason={reason} onClick={() => void confirm()}>
          {removes ? "Remove move" : "Move"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Manual move… for a part by number (the recommendation detail, the wall's pinned tooltip): loads
 * the part, is disabled with the reason while it loads, has no current location, has no part
 * (`emptyReason`, an empty location) or a command is unconfirmed, and opens the shared dialog,
 * optionally on `initialFrom`. The last loaded part stays behind the dialog, so a move that empties
 * the location lets the dialog close normally and return focus.
 */
export function ManualMoveAction({
  planId,
  part,
  savingReason,
  initialFrom,
  returnFocusRef,
  label = MANUAL_MOVE_LABEL,
  emptyReason,
}: {
  planId: string;
  /** The part to move; undefined when there is none (then disabled with `emptyReason`). */
  part: string | undefined;
  savingReason?: string;
  initialFrom?: string;
  /** Where focus goes when the dialog closes (default: this button). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  label?: string;
  emptyReason?: string;
}) {
  const detail = usePlanPart(planId, part);
  const [open, setOpen] = useState(false);
  const [kept, setKept] = useState<PartDetail | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const current = part !== undefined && detail.data && detail.data.part === part ? detail.data : undefined;
  if (current !== undefined && current !== kept) setKept(current);
  const dialogDetail = current ?? kept;
  const reason =
    part === undefined ? (emptyReason ?? LOADING_PART) : current ? manualMoveReason(current, savingReason) : LOADING_PART;
  return (
    <>
      <Button ref={button} variant="tertiary" size="md" disabledReason={reason} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {dialogDetail && (
        <ManualMoveDialog
          planId={planId}
          detail={dialogDetail}
          open={open}
          onOpenChange={setOpen}
          returnFocusRef={returnFocusRef ?? button}
          initialFrom={initialFrom}
        />
      )}
    </>
  );
}
