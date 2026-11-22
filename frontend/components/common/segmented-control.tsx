"use client";

// Segmented control (UX-DR, Story 3.4): a radio group of pill buttons. One tab stop (roving
// tabindex on the checked item); Arrow keys move and select, wrapping at the ends; Home/End jump
// to the first and last item. Selection is always shown in text weight and fill, plus aria-checked.

import { type KeyboardEvent, useRef } from "react";

import { cn } from "@/lib/utils";

/** The item an arrow, Home or End key selects (wrapping); `null` for any other key. */
export function nextRadioIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export type SegmentedOption<V extends string> = { value: V; label: string };

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextRadioIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    items.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit flex-wrap rounded-lg border border-border bg-surface p-0.5"
    >
      {options.map((option, index) => {
        const checked = index === checkedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              items.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "inline-flex h-control-md items-center rounded-md px-3 type-button",
              checked ? "bg-ink text-surface" : "bg-surface text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
