"use client";

// Input and InputError (UX-DR11). Esc clears a non-empty field, or leaves an empty one.
// An error is never colour alone: the 1.5px error border comes with a warning icon and a sentence.

import { type ComponentProps, type KeyboardEvent, type ReactNode } from "react";

import { Icon } from "@/components/common/icons";
import { cn } from "@/lib/utils";

export type InputProps = ComponentProps<"input"> & {
  /** Id of the InputError that describes what is wrong; marks the field invalid. */
  errorId?: string;
};

function clearNativeValue(input: HTMLInputElement) {
  // Set the value through the native setter so React's onChange sees the change.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function Input({ errorId, className, onKeyDown, "aria-describedby": describedBy, ...rest }: InputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Escape") return;
    const input = event.currentTarget;
    if (input.readOnly || input.disabled || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (input.value !== "") {
      clearNativeValue(input);
    } else {
      input.blur();
    }
  }

  const describedByIds = [describedBy, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <input
      className={cn(
        "h-control-lg w-full min-w-0 rounded-lg border border-input-border bg-surface px-3 text-ink type-body placeholder:text-ink-muted",
        errorId && "border-[1.5px] border-error",
        className,
      )}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={describedByIds}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
}

export function InputError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 flex items-start gap-2 text-ink type-caption">
      <Icon name="warning" size={16} className="text-error" />
      <span>{children}</span>
    </p>
  );
}
