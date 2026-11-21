"use client";

// Button (UX-DR10). A disabled button keeps its label, stays focusable and says why it is
// disabled: aria-disabled plus a reason linked by aria-describedby, shown on hover and focus.

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

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and explains why. The button stays focusable; never sets native `disabled`. */
  disabledReason?: string;
};

export function Button({
  variant = "primary",
  size = "lg",
  disabledReason,
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
  const reasonId = useId();
  const [reasonDismissed, setReasonDismissed] = useState(false);
  const isDisabled = disabledReason !== undefined;

  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg type-button whitespace-nowrap",
    variant !== "link" && SIZES[size],
    isDisabled ? DISABLED[variant] : VARIANTS[variant],
    variant === "link" && "px-0",
    className,
  );

  if (!isDisabled) {
    return (
      <button
        type={type}
        className={classes}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        disabled={disabled}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </button>
    );
  }

  function suppress(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") setReasonDismissed(true);
    onKeyDown?.(event);
  }

  return (
    <span className="group relative inline-flex" onMouseLeave={() => setReasonDismissed(false)}>
      <button
        type={type}
        className={classes}
        aria-disabled="true"
        aria-describedby={[describedBy, reasonId].filter(Boolean).join(" ")}
        {...rest}
        onClick={suppress}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setReasonDismissed(false);
          onBlur?.(event);
        }}
      >
        {children}
      </button>
      <span
        id={reasonId}
        role="tooltip"
        className={cn(
          "hidden absolute top-full left-0 z-40 mt-1 w-max max-w-64 rounded-lg border border-border bg-surface px-2 py-1 text-ink shadow-overlay type-caption",
          !reasonDismissed && "group-hover:block group-has-[:focus-visible]:block",
        )}
      >
        {disabledReason}
      </span>
    </span>
  );
}
