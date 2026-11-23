"use client";

// Plan plate (UX-DR5): the open plan's name and "Data as of YYYY-MM-DD · round N" on the toolbar.
// The upload date (and "Saved automatically" after a confirmed change) shows in a tooltip on hover
// and focus. Its menu (click or `Enter`) lists up to five other recent plans, "All saved plans" and
// "New Plan from this import" (FR-2, FR-8); `Esc` closes it and returns focus to the plate. The
// toolbar passes the saved plans in; the plate only shows them.

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Fragment, type KeyboardEvent, useId, useState } from "react";

import { Icon } from "@/components/common/icons";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { SAVED_TEXT } from "@/lib/commands/client";
import { NEW_PLAN_FROM_IMPORT } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { newPlanFromHref, planOpenHref, SAVED_PLANS_HREF } from "@/lib/view-state/urls";

/** How many other plans the menu lists (UX-DR5). */
export const RECENT_PLANS_MAX = 5;
export const ALL_SAVED_PLANS = "All saved plans";

export type PlanMenuItem = { label: string; href: string; kind: "recent" | "action" };

/**
 * The plate menu of the open plan `planId`: up to five other plans in the order given (the
 * server's, most recently edited first), then "All saved plans" and "New Plan from this import".
 */
export function planMenuItems(
  planId: string,
  plans: readonly { id: string; name: string }[] = [],
): PlanMenuItem[] {
  const recent = plans
    .filter((plan) => plan.id !== planId)
    .slice(0, RECENT_PLANS_MAX)
    .map((plan): PlanMenuItem => ({ label: plan.name, href: planOpenHref(plan.id), kind: "recent" }));
  return [
    ...recent,
    { label: ALL_SAVED_PLANS, href: SAVED_PLANS_HREF, kind: "action" },
    { label: NEW_PLAN_FROM_IMPORT, href: newPlanFromHref(planId), kind: "action" },
  ];
}

export type PlanPlateProps = {
  name: string;
  /** The plate menu's items (`planMenuItems`). */
  menu: readonly PlanMenuItem[];
  dataAsOf: string;
  uploadedAt: string;
  round: number;
  /** After a confirmed change the tooltip also says "Saved automatically" (autosave, no Save button). */
  saved?: boolean;
};

/**
 * The plate's fixed slot (UX-DR5: at least 214px wide): 240px whether the plan has loaded or not, so
 * the flow bar after it never moves when the summary arrives (a click aimed at a step while the
 * plan loads lands on that step). A long name is truncated; the button's name keeps all of it.
 */
export const PLATE_SLOT_CLASS = "w-60 shrink-0";

/** The plate button's box (border, padding, two text lines); the placeholder copies it. */
const PLATE_BOX_CLASS = "flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1 text-left";

/**
 * Holds the plate's place in the toolbar while the plan summary loads: the same box and two text
 * lines, invisible, so both its width and its height match the plate that replaces it.
 */
export function PlanPlatePlaceholder() {
  return (
    <span aria-hidden="true" className={cn("invisible inline-flex", PLATE_SLOT_CLASS)} data-plan-plate-placeholder="">
      <span className={PLATE_BOX_CLASS}>
        <span className="flex min-w-0 flex-col">
          <span className="truncate type-body-strong">&nbsp;</span>
          <span className="truncate type-caption">&nbsp;</span>
        </span>
        <span className="size-4 shrink-0" />
      </span>
    </span>
  );
}

export function plateMeta(dataAsOf: string, round: number): string {
  return `Data as of ${formatDate(dataAsOf)} · round ${round}`;
}

export function uploadedText(uploadedAt: string): string {
  return `Uploaded ${formatDate(uploadedAt)}`;
}

export function PlanPlate({ name, menu, dataAsOf, uploadedAt, round, saved = false }: PlanPlateProps) {
  const tooltipId = useId();
  // Escape hides the tooltip until the pointer leaves or focus moves away (WCAG 1.4.13).
  const [dismissed, setDismissed] = useState(false);
  return (
    <span className={cn("group relative inline-flex", PLATE_SLOT_CLASS)} onMouseLeave={() => setDismissed(false)}>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-describedby={tooltipId}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "Escape") setDismissed(true);
            }}
            onBlur={() => setDismissed(false)}
            className={cn(PLATE_BOX_CLASS, "border-flow-track-edge bg-flow-track")}
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
            {menu.map((item, index) => (
              <Fragment key={item.href}>
                {index > 0 && item.kind !== menu[index - 1].kind && (
                  <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
                )}
                <DropdownMenu.Item asChild>
                  <Link href={item.href} className={cn(MENU_ITEM_CLASS, "max-w-80")}>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </DropdownMenu.Item>
              </Fragment>
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
