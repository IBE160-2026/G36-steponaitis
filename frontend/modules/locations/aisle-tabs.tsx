"use client";

// Aisle tabs (UX-DR48): one tab per aisle in server order, each with its letter plate, occupied %
// and the number of wall move entries touching it (latest-run recommendations plus current-round
// manual moves), and a BEST tag when an aisle mark names it. One tab
// stop; arrow keys, Home and End move between tabs and open the aisle.

import { type KeyboardEvent, useRef } from "react";

import { nextRadioIndex } from "@/components/common/segmented-control";
import type { AisleCounts } from "@/lib/api/plans";
import { AISLE_TABS_LABEL, aisleTabMoves, BEST_TAG, percentText } from "@/lib/copy";
import { cn } from "@/lib/utils";

/** The id of an aisle's tab, from the page's id prefix (the aisle encoded: ids hold no whitespace). */
export function aisleTabId(prefix: string, aisle: string): string {
  return `${prefix}-tab-${encodeURIComponent(aisle)}`;
}

export function AisleTabs({
  aisles,
  selected,
  onSelect,
  idPrefix,
  panelId,
}: {
  aisles: readonly AisleCounts[];
  selected: string;
  onSelect: (aisle: string) => void;
  idPrefix: string;
  panelId: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    aisles.findIndex((entry) => entry.aisle === selected),
  );

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const next = nextRadioIndex(event.key, index, aisles.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(aisles[next].aisle);
    tabs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={AISLE_TABS_LABEL} className="flex flex-wrap gap-2">
      {aisles.map((entry, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={entry.aisle}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={aisleTabId(idPrefix, entry.aisle)}
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(entry.aisle)}
            onKeyDown={(event) => onKeyDown(event, index)}
            data-aisle-tab={entry.aisle}
            className={cn(
              "flex h-[58px] min-w-[116px] items-center gap-2.5 rounded-xl px-2.5 text-left text-ink",
              isSelected ? "border-[1.5px] border-ink bg-surface" : "border border-border bg-transparent",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border-[1.4px] border-ink bg-surface type-plate-code">
              {entry.aisle}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 type-body-strong">
                {percentText(entry.occupied_percent)}
                {entry.aisle_marked && (
                  <span className="rounded-sm bg-best-on-light px-1 type-tag text-surface" data-best-tag="">
                    {BEST_TAG}
                  </span>
                )}
              </span>
              <span className="type-caption text-ink-secondary">{aisleTabMoves(entry.moves)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
