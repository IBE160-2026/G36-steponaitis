"use client";

// Button (UX-DR10). A disabled button keeps its label, stays focusable and says why it is
// disabled: aria-disabled plus a reason linked by aria-describedby, shown on hover and focus. An
// enabled button can carry a `description` the same way (e.g. what Undo last move would do).

import { type ComponentProps, type KeyboardEvent, type MouseEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "link" | "destructive";
export type ButtonSize = "lg" | "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface border border-ink",
  destructive: "bg-ink text-surface border border-ink",
  secondary: "bg-surface text-ink border border-ink",
  tertiary: "bg-surface text-ink border border-border",
  link: "bg-transparent text-ink underline underline-offset-2",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "h-control-lg px-4",
  md: "h-control-md px-3",
  sm: "h-control-sm px-2",
};

const DISABLED: Record<ButtonVariant, string> = {
  primary: "bg-surface-disabled text-ink-disabled border border-border cursor-not-allowed",
  destructive: "bg-surface-disabled text-ink-disabled border border-border cursor-not-allowed",
  secondary: "bg-surface-disabled text-ink-disabled border border-border cursor-not-allowed",
  tertiary: "bg-surface-disabled text-ink-disabled border border-border cursor-not-allowed",
  link: "bg-transparent text-ink-disabled underline underline-offset-2 cursor-not-allowed",
};

/** A button's classes, also for a link that looks like a button (e.g. New Plan, a navigation). */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "lg",
  isDisabled = false,
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg type-button whitespace-nowrap",
    variant !== "link" && SIZES[size],
    isDisabled ? DISABLED[variant] : VARIANTS[variant],
    variant === "link" && "px-0",
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and explains why. The button stays focusable; never sets native `disabled`. */
  disabledReason?: string;
  /** The enabled button's tooltip and accessible description; the reason replaces it while disabled. */
  description?: string;
};

export function Button({
  variant = "primary",
  size = "lg",
  disabledReason,
  description,
  className,
  onClick,
  onKeyDown,
  onBlur,
  disabled,
  type = "button",
  children,
  "aria-describedby": describedBy,
  ...rest
}: ButtonProps) {
  const tipId = useId();
  const [tipDismissed, setTipDismissed] = useState(false);
  const isDisabled = disabledReason !== undefined;
  const tip = disabledReason ?? description;

  const classes = buttonClassName(variant, size, isDisabled, className);

  function suppress(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") setTipDismissed(true);
    onKeyDown?.(event);
  }

  // The same element tree with or without a tooltip: a button that becomes disabled while it saves
  // (Keep in place, Apply, Manual move…) stays mounted, so keyboard focus stays on it. Without a
  // tooltip the wrapper is `display: contents` and the button lays out as if it had none.
  return (
    <span
      className={tip === undefined ? "contents" : "group relative inline-flex"}
      onMouseLeave={tip === undefined ? undefined : () => setTipDismissed(false)}
    >
      <button
        type={type}
        className={classes}
        aria-disabled={isDisabled ? "true" : undefined}
        disabled={isDisabled ? undefined : disabled}
        aria-describedby={[describedBy, tip === undefined ? undefined : tipId].filter(Boolean).join(" ") || undefined}
        {...rest}
        onClick={isDisabled ? suppress : onClick}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setTipDismissed(false);
          onBlur?.(event);
        }}
      >
        {children}
      </button>
      {tip !== undefined && (
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            "hidden absolute top-full left-0 z-40 mt-1 w-max max-w-64 rounded-lg border border-border bg-surface px-2 py-1 text-ink shadow-overlay type-caption",
            !tipDismissed && "group-hover:block group-has-[:focus-visible]:block",
          )}
        >
          {tip}
        </span>
      )}
    </span>
  );
}
