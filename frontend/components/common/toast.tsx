"use client";

// Toast (UX-DR14): bottom-left, one at a time, shown for at least 10 seconds, longer for long
// messages, paused while hovered or while keyboard focus is inside it. sonner's own timer does not
// pause on focus, so ToastBody owns the timer and sonner only places and announces the toast
// (its container is aria-live="polite").

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

import { Icon, type IconName } from "@/components/common/icons";

const MIN_TOAST_MS = 10_000;
const MS_PER_CHARACTER = 100;

export function toastDurationMs(message: string): number {
  return Math.max(MIN_TOAST_MS, MS_PER_CHARACTER * message.length);
}

export type ToastAction = { label: string; onClick: () => void };
export type ToastOptions = { action?: ToastAction; icon?: IconName };

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-left"
      offset={24}
      mobileOffset={16}
      visibleToasts={1}
      duration={Infinity}
      style={{ "--width": "min(560px, calc(100vw - 32px))" } as CSSProperties}
      toastOptions={{ unstyled: true }}
    />
  );
}

/** Shows one toast, replacing any toast already showing. */
export function showToast(message: string, options: ToastOptions = {}) {
  toast.dismiss();
  return toast.custom(
    (id) => <ToastBody id={id} message={message} action={options.action} icon={options.icon} />,
    { duration: Infinity },
  );
}

type ToastBodyProps = { id: string | number; message: string } & ToastOptions;

export function ToastBody({ id, message, action, icon }: ToastBodyProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(toastDurationMs(message));
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => toast.dismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, id]);

  return (
    <div
      className="flex min-h-11 w-fit max-w-[560px] items-center gap-3 rounded-lg bg-ink px-3.5 py-2 text-surface shadow-overlay type-body font-medium"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      data-surface="graphite"
    >
      {icon && <Icon name={icon} size={18} className="text-on-dark" />}
      <span className="min-w-0 flex-1">{message}</span>
      {action && (
        <button
          type="button"
          className="shrink-0 rounded-sm text-surface underline underline-offset-2 type-button"
          onClick={() => {
            try {
              action.onClick();
            } finally {
              toast.dismiss(id);
            }
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
