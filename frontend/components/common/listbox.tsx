"use client";

// Listbox (UX-DR17): a single-select list that is one tab stop. The list holds the focus and
// points at the selected option with `aria-activedescendant`; `↑`/`↓` move the selection,
// `Home`/`End` jump to the first and last option, and a click selects. Rows are `h-control-md`;
// the selected row has the selected tint and an ink bar on its left edge. With `onActivate`,
// `Enter` and a click also activate the option (a menu-like pick, Story 7.2); with
// `typeaheadText`, typing moves the selection to the next option whose text starts with what
// was typed.

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

/** How long typed characters keep adding to one typeahead prefix. */
export const TYPEAHEAD_RESET_MS = 500;

/**
 * The option index a typeahead `prefix` selects: the first text after `index` that starts with
 * it (case-insensitive), wrapping around; for a repeated single character, the next match
 * after the current one, so pressing it again cycles. Null when none matches.
 */
export function typeaheadIndex(texts: readonly string[], prefix: string, index: number): number | null {
  if (texts.length === 0 || prefix === "") return null;
  const wanted = prefix.toLowerCase();
  const repeated = [...wanted].every((char) => char === wanted[0]);
  const search = repeated && wanted.length > 1 ? wanted[0] : wanted;
  // A single (or repeated) character cycles from the next option; only a multi-character prefix
  // may stay on the current one.
  const start = repeated ? index + 1 : Math.max(index, 0);
  for (let offset = 0; offset < texts.length; offset += 1) {
    const position = (start + offset) % texts.length;
    if (texts[position].toLowerCase().startsWith(search)) return position;
  }
  return null;
}

/**
 * The option index a key selects, clamped to the list; null for any other key. With nothing
 * selected (`index` -1), `↓` selects the first option and `↑` the last.
 */
export function nextListboxIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return index < 0 ? 0 : Math.min(index + 1, count - 1);
    case "ArrowUp":
      return index < 0 ? count - 1 : Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export type ListboxProps<T> = {
  /** The accessible name of the list. */
  label: string;
  options: readonly T[];
  optionKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  /** The key of the selected option; undefined (or an unknown key) selects nothing. */
  selectedKey: string | undefined;
  onSelect: (option: T) => void;
  /** `Enter` or a click on an option activates it (after selecting it). */
  onActivate?: (option: T) => void;
  /** The text typeahead matches; typing moves the selection only when it is given. */
  typeaheadText?: (option: T) => string;
  /** An option's accessible name, when its rendered text is not a good one. */
  optionLabel?: (option: T) => string;
  id?: string;
  /** An error or hint the list is described by. */
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Listbox<T>({
  label,
  options,
  optionKey,
  renderOption,
  selectedKey,
  onSelect,
  onActivate,
  typeaheadText,
  optionLabel,
  id,
  describedBy,
  invalid = false,
  disabled = false,
  className,
}: ListboxProps<T>) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const index = options.findIndex((option) => optionKey(option) === selectedKey);
  const optionId = (position: number) => `${baseId}-option-${position}`;

  // Keep the selected option in view as the keys move it.
  useEffect(() => {
    if (index < 0) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-listbox-index="${index}"]`);
    element?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  const typed = useRef({ prefix: "", at: 0 });

  function onTypeahead(event: KeyboardEvent<HTMLDivElement>): boolean {
    if (!typeaheadText || event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return false;
    if (event.key === " " && typed.current.prefix === "") return false;
    const now = event.timeStamp;
    const prefix = now - typed.current.at > TYPEAHEAD_RESET_MS ? event.key : typed.current.prefix + event.key;
    typed.current = { prefix, at: now };
    event.preventDefault();
    const next = typeaheadIndex(options.map(typeaheadText), prefix, index);
    if (next !== null) onSelect(options[next]);
    return true;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Enter" && onActivate) {
      if (index < 0) return;
      event.preventDefault();
      onActivate(options[index]);
      return;
    }
    if (onTypeahead(event)) return;
    const next = nextListboxIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(options[next]);
  }

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      aria-activedescendant={index >= 0 ? optionId(index) : undefined}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-surface py-1",
        invalid ? "border-error" : "border-border",
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map((option, position) => {
        const selected = position === index;
        return (
          <div
            key={optionKey(option)}
            id={optionId(position)}
            role="option"
            aria-selected={selected}
            aria-label={optionLabel?.(option)}
            data-listbox-index={position}
            onClick={() => {
              if (disabled) return;
              onSelect(option);
              onActivate?.(option);
            }}
            className={cn(
              "relative flex h-control-md shrink-0 cursor-pointer items-center gap-3 pr-3 pl-4 text-ink",
              selected ? "bg-selected-tint" : "hover:bg-ground",
            )}
          >
            {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-ink" />}
            {renderOption(option)}
          </div>
        );
      })}
    </div>
  );
}
