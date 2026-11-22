"use client";

// Listbox (UX-DR17): a single-select list that is one tab stop. The list holds the focus and
// points at the selected option with `aria-activedescendant`; `↑`/`↓` move the selection,
// `Home`/`End` jump to the first and last option, and a click selects. Rows are `h-control-md`;
// the selected row has the selected tint and an ink bar on its left edge.

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

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

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
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
            data-listbox-index={position}
            onClick={() => {
              if (!disabled) onSelect(option);
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
