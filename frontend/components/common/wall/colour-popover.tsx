"use client";

// Key colour popover (Story 11.3, FR-42, UX-DR49): a Key colour entry as a button that opens a
// non-modal popover above it. The popover is one editing session: the presets (arrow keys move
// and preview), the hex field, the native picker and Reset this colour only preview the pending
// pick on the real wall through the `--colour-*` variables; Done or a click outside keeps and
// stores it (one write); `Esc` restores the colour the entry had when the popover opened. Either
// way focus returns to the entry. Warnings never block keeping a colour.

import { Popover, RadioGroup } from "radix-ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Input, InputError } from "@/components/common/input";
import {
  COLOUR_PRESETS,
  colourWarnings,
  contrastRatio,
  DEFAULT_COLOURS,
  getKeyColours,
  INK,
  isColourStorageAvailable,
  type KeyColourEntry,
  type KeyColours,
  normaliseHex,
  previewKeyColour,
  setKeyColour,
  subscribeKeyColours,
  WHITE,
} from "@/lib/colours";
import {
  COLOUR_CODE_LABEL,
  COLOUR_TITLE_WORD,
  colourChanged,
  colourPickerName,
  colourPresetsName,
  colourWarningText,
  COLOURS_NOT_KEPT,
  DEFAULT_CHIP_LABEL,
  DEFAULT_PRESET_NAME,
  DONE,
  HEX_INVALID,
  keyEntryButtonName,
  presetName,
  RESET_THIS_COLOUR,
} from "@/lib/copy";

/** The hex field accepts only `#RRGGBB` (any case); `normaliseHex` alone would also take `RRGGBB`. */
const HEX_FIELD = /^#[0-9a-fA-F]{6}$/;

/** Keys with which Radix moves focus inside the presets (and should check the focused radio). */
const MOVE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];

// The Key's polite live region: an entry announces "Slow-moving colour changed" through it.

type Announce = (text: string) => void;

const AnnounceContext = createContext<Announce>(() => {});

/** Wraps a Key: its colour entries announce a kept change in the polite live region it renders. */
export function KeyColourAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState({ text: "", count: 0 });
  const announce = useCallback<Announce>((text) => setMessage((last) => ({ text, count: last.count + 1 })), []);
  return (
    <AnnounceContext value={announce}>
      {children}
      <p role="status" aria-live="polite" className="sr-only" data-key-announcer="">
        {/* A new span each time, so the same sentence twice is announced twice. */}
        <span key={message.count}>{message.text}</span>
      </p>
    </AnnounceContext>
  );
}

function checkColour(hex: string): string {
  return contrastRatio(hex, INK) >= contrastRatio(hex, WHITE) ? INK : WHITE;
}

export type ColourPopoverBodyProps = {
  entry: KeyColourEntry;
  /** The entry's Key label ("Slow-moving", "Selected"). */
  label: string;
  /** The entry's miniature, a decorative SVG (the title's glyph cue). */
  swatch: ReactNode;
  titleId: string;
  /** The pending pick, uppercase `#RRGGBB`. */
  pick: string;
  /** The hex field's text. */
  text: string;
  /** The six colours now kept (the other five are checked against the pick). */
  current: Readonly<KeyColours>;
  storageAvailable: boolean;
  onPick: (hex: string) => void;
  onText: (text: string) => void;
  onDone: () => void;
};

/** The popover's body: title, presets, Default chip, hex field and picker, warnings and actions. */
export function ColourPopoverBody({
  entry,
  label,
  swatch,
  titleId,
  pick,
  text,
  current,
  storageAvailable,
  onPick,
  onText,
  onDone,
}: ColourPopoverBodyProps) {
  const statusId = useId();
  const errorId = useId();
  const fieldId = useId();
  const presets = COLOUR_PRESETS[entry];
  const fallback = DEFAULT_COLOURS[entry];
  const invalid = !HEX_FIELD.test(text);
  const warnings = colourWarnings(entry, pick, current);
  const checked = presets.includes(pick) ? pick : "";
  // Radix checks a radio that arrow keys focus only while the key is still down (and never for
  // Home/End); the focus moves a tick later, so a quick press (or a test) can miss it. The group
  // remembers the key itself.
  const arrowed = useRef(false);

  return (
    <>
      <h2 id={titleId} className="flex items-center gap-1.5 type-body font-medium text-ink">
        <span>{label}</span> {swatch} <span>{COLOUR_TITLE_WORD}</span>
      </h2>
      <div className="flex items-start gap-3">
        <RadioGroup.Root
          aria-label={colourPresetsName(label)}
          value={checked}
          onValueChange={onPick}
          className="grid shrink-0 grid-cols-4 gap-1"
          data-colour-presets=""
          onKeyDown={(event) => {
            const plain = !(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey);
            arrowed.current = plain && MOVE_KEYS.includes(event.key);
          }}
        >
          {presets.map((hex, i) => {
            const isChecked = hex === checked;
            return (
              <RadioGroup.Item
                key={hex}
                value={hex}
                aria-label={hex === fallback ? DEFAULT_PRESET_NAME : presetName(label, i + 1)}
                className="grid size-6 place-items-center rounded-full"
                data-colour-preset={i + 1}
                onFocus={() => {
                  if (!arrowed.current) return;
                  arrowed.current = false;
                  if (hex !== pick) onPick(hex);
                }}
              >
                <span
                  aria-hidden="true"
                  className={
                    isChecked
                      ? "grid size-[22px] place-items-center rounded-full ring-2 ring-ink"
                      : "grid size-[22px] place-items-center rounded-full border border-border"
                  }
                  style={{ backgroundColor: hex, color: checkColour(hex) }}
                >
                  {isChecked && <Icon name="check" size={14} />}
                </span>
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
        <div className="flex min-w-0 flex-col gap-1 type-caption text-ink-secondary" data-colour-default="">
          <span>{DEFAULT_CHIP_LABEL}</span>
          <span className="flex items-center gap-1.5 type-code-table text-ink">
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: fallback }}
            />
            {fallback}
          </span>
        </div>
      </div>
      {/* Always present (an empty live region costs no space), so a new warning is announced. */}
      <div id={statusId} role="status" className="flex flex-col gap-1 empty:-mt-3" data-colour-warnings="">
        {warnings.map((warning) => {
          const sentence = colourWarningText(warning);
          return (
            <p key={sentence} className="flex items-start gap-2 type-caption text-ink">
              <Icon name="warning" size={16} className="mt-px text-ink-secondary" />
              <span>{sentence}</span>
            </p>
          );
        })}
      </div>
      <div className="flex flex-col">
        <label htmlFor={fieldId} className="type-caption font-medium text-ink">
          {COLOUR_CODE_LABEL}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            id={fieldId}
            value={text}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            className="w-[104px] type-code-table"
            errorId={invalid ? errorId : undefined}
            aria-describedby={statusId}
            data-colour-hex=""
            onChange={(event) => onText(event.target.value)}
            onKeyDown={(event) => {
              // Esc restores the colour (the popover handles it); the field must not clear first.
              if (event.key === "Escape") event.preventDefault();
            }}
          />
          <input
            type="color"
            aria-label={colourPickerName(label)}
            value={pick.toLowerCase()}
            onChange={(event) => onPick(normaliseHex(event.target.value))}
            className="size-[22px] shrink-0 cursor-pointer appearance-none overflow-hidden rounded-full border border-border bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
            data-colour-picker=""
          />
        </div>
        {invalid && <InputError id={errorId}>{HEX_INVALID}</InputError>}
      </div>
      {!storageAvailable && (
        <p className="type-caption text-ink-secondary" data-colours-not-kept="">
          {COLOURS_NOT_KEPT}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="tertiary" size="sm" onClick={() => onPick(fallback)}>
          {RESET_THIS_COLOUR}
        </Button>
        <Button variant="primary" size="sm" onClick={onDone}>
          {DONE}
        </Button>
      </div>
    </>
  );
}

export type KeyColourButtonProps = {
  entry: KeyColourEntry;
  label: string;
  /** The entry's miniature (shown in the button and the popover title). */
  swatch: ReactNode;
};

/** A Key colour entry: the button and its popover. */
export function KeyColourButton({ entry, label, swatch }: KeyColourButtonProps) {
  const current = useSyncExternalStore(subscribeKeyColours, getKeyColours, () => DEFAULT_COLOURS);
  const announce = useContext(AnnounceContext);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [openColour, setOpenColour] = useState(current[entry]);
  const [pick, setPick] = useState(current[entry]);
  const [text, setText] = useState(current[entry]);

  function start() {
    const colour = current[entry];
    escaped.current = false;
    setOpenColour(colour);
    setPick(colour);
    setText(colour);
    setOpen(true);
  }

  // A popover that unmounts while open (navigation, another recommendation) keeps nothing.
  const isOpen = useRef(false);
  useEffect(() => {
    isOpen.current = open;
  }, [open]);
  useEffect(
    () => () => {
      if (isOpen.current) previewKeyColour(entry, null);
    },
    [entry],
  );

  function finish(mode: "keep" | "restore") {
    escaped.current = false;
    isOpen.current = false;
    setOpen(false);
    // An unchanged pick is not stored again: nothing is written and nobody is told.
    if (mode === "restore" || pick === openColour) {
      previewKeyColour(entry, null);
      return;
    }
    setKeyColour(entry, pick);
    announce(colourChanged(label));
  }

  function preview(hex: string) {
    setPick(hex);
    setText(hex);
    previewKeyColour(entry, hex);
  }

  function edit(value: string) {
    setText(value);
    if (!HEX_FIELD.test(value)) return;
    const hex = normaliseHex(value);
    setPick(hex);
    previewKeyColour(entry, hex);
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? start() : finish(escaped.current ? "restore" : "keep"))}>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={keyEntryButtonName(label)}
          className="group -mx-1 flex items-center gap-1.5 rounded-sm px-1 type-caption font-medium text-ink hover:bg-selected-tint"
        >
          {swatch}
          {label}
          <Icon
            name="palette"
            size={14}
            className="invisible text-ink-secondary group-hover:visible group-focus-visible:visible"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          side="top"
          sideOffset={6}
          collisionPadding={16}
          aria-labelledby={titleId}
          className="z-50 flex max-h-(--radix-popover-content-available-height) w-[min(264px,calc(100vw-32px))] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-3 text-ink shadow-overlay"
          data-colour-popover={entry}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const first =
              content.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
              content.current?.querySelector<HTMLElement>("[data-colour-hex]");
            first?.focus();
          }}
          onEscapeKeyDown={() => {
            escaped.current = true;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <ColourPopoverBody
            entry={entry}
            label={label}
            swatch={swatch}
            titleId={titleId}
            pick={pick}
            text={text}
            current={current}
            storageAvailable={isColourStorageAvailable()}
            onPick={preview}
            onText={edit}
            onDone={() => finish("keep")}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
