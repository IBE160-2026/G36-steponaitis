"use client";

// Plan plate (UX-DR5): the open plan's name and "Data as of YYYY-MM-DD · round N" on the toolbar.
// The upload date (and "Saved automatically" after a confirmed change) shows in a tooltip on hover
// and focus. It opens a menu that in M1 holds only
// New Plan (the launcher and "New Plan from this import" arrive in later epics).

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { type KeyboardEvent, useId, useState } from "react";

import { Icon } from "@/components/common/icons";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { SAVED_TEXT } from "@/lib/commands/client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NEW_PLAN_HREF } from "@/lib/view-state/urls";

export const PLAN_MENU = [{ label: "New Plan", href: NEW_PLAN_HREF }] as const;

export type PlanPlateProps = {
  name: string;
  dataAsOf: string;
  uploadedAt: string;
  round: number;
  /** After a confirmed change the tooltip also says "Saved automatically" (autosave, no Save button). */
  saved?: boolean;
};

export function plateMeta(dataAsOf: string, round: number): string {
  return `Data as of ${formatDate(dataAsOf)} · round ${round}`;
}

export function uploadedText(uploadedAt: string): string {
  return `Uploaded ${formatDate(uploadedAt)}`;
}

export function PlanPlate({ name, dataAsOf, uploadedAt, round, saved = false }: PlanPlateProps) {
  const tooltipId = useId();
  // Escape hides the tooltip until the pointer leaves or focus moves away (WCAG 1.4.13).
  const [dismissed, setDismissed] = useState(false);
  return (
    <span className="group relative inline-flex min-w-0" onMouseLeave={() => setDismissed(false)}>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-describedby={tooltipId}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "Escape") setDismissed(true);
            }}
            onBlur={() => setDismissed(false)}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-flow-track-edge bg-flow-track px-3 py-1 text-left"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate type-body-strong text-white">{name}</span>
              <span className="truncate type-caption text-on-dark-secondary">{plateMeta(dataAsOf, round)}</span>
            </span>
            <Icon name="chevron" size={16} className="shrink-0 text-on-dark-nav" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className={MENU_CONTENT_CLASS}
          >
            {PLAN_MENU.map((item) => (
              <DropdownMenu.Item key={item.href} asChild>
                <Link
                  href={item.href}
                  className={MENU_ITEM_CLASS}
                >
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full left-0 z-40 mt-1 hidden w-max rounded-lg border border-border bg-surface px-2 py-1 text-ink shadow-overlay type-caption",
          !dismissed && "group-hover:block group-has-[:focus-visible]:block",
        )}
      >
        <span className="block">{uploadedText(uploadedAt)}</span>
        {saved && <span className="block">{SAVED_TEXT}</span>}
      </span>
    </span>
  );
}
