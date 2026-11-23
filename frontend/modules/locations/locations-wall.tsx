"use client";

// The Locations wall in One aisle (Stories 10.2–10.6; FR-42): the page header, the aisle tabs with
// the whole-warehouse figure, the open aisle's header line, its wall, the Key and the moves drawer.
// Split out of locations-page.tsx in Story 12.2 (epic-10 retro item 89); `AisleMode` feeds it.

import Link from "next/link";
import { type ReactNode, useId } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import { aisleTabId, AisleTabs, AisleWall, type AisleWallProps, Key } from "@/components/common/wall";
import type { LayoutView } from "@/lib/api/imports";
import type { WallView } from "@/lib/api/plans";
import {
  aisleHeading,
  EDIT_BEST_MARKS,
  OPEN_AS_LIST,
  wallAisleLine,
  wholeWarehouseFigure,
} from "@/lib/copy";
import { planStepHref } from "@/lib/view-state/urls";

import type { WallScope } from "./aisle-choice";
import { ScopeControl } from "./warehouse-view";

/** The wall's page header: the title, then the One aisle | Whole warehouse control and the search field. */
export function LocationsHeader({ controls, search }: { controls?: ReactNode; search?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="type-page-title">Locations</h1>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
        {controls}
        {/* The search field is `w-full max-w-[360px]`: a fixed box keeps it beside the control. */}
        {search && <div className="w-[360px] max-w-full">{search}</div>}
      </div>
    </div>
  );
}

export function LocationsWall({
  planId,
  view,
  layout,
  selected,
  onSelect,
  onOpenList,
  part,
  search,
  grid = {},
  drawer,
  onScopeChange,
  focusScope = false,
  onScopeFocused,
}: {
  planId: string;
  view: WallView;
  /** The import's layout; the wall is drawn once it is here. */
  layout: LayoutView | undefined;
  /** The chosen aisle (its tab is selected; `view` may still be the previous aisle while it loads). */
  selected: string;
  onSelect: (aisle: string) => void;
  onOpenList: () => void;
  part?: string;
  search?: ReactNode;
  /** The wall grid's selection, `?loc=` pin, recommendations and actions. */
  grid?: Omit<AisleWallProps, "layout" | "wall">;
  /** The "Moves touching aisle" drawer under the Key. */
  drawer?: ReactNode;
  /** The One aisle | Whole warehouse control and the whole-warehouse figure button (Story 10.6). */
  onScopeChange?: (scope: WallScope) => void;
  /** Focus the control's checked radio once mounted (after a scope switch), then `onScopeFocused`. */
  focusScope?: boolean;
  onScopeFocused?: () => void;
}) {
  const idPrefix = useId();
  const panelId = `${idPrefix}-panel`;
  const counts = view.aisles.find((entry) => entry.aisle === view.aisle);
  const aisleLayout = layout?.aisles.find((entry) => entry.aisle === view.aisle);
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <LocationsHeader
        controls={
          <ScopeControl
            scope="aisle"
            onChange={(scope) => onScopeChange?.(scope)}
            focusOnMount={focusScope}
            onFocused={onScopeFocused}
          />
        }
        search={search}
      />
      <div className="flex flex-col items-start gap-2">
        <AisleTabs aisles={view.aisles} selected={selected} onSelect={onSelect} idPrefix={idPrefix} panelId={panelId} />
        <button
          type="button"
          onClick={() => onScopeChange?.("warehouse")}
          className="rounded-sm text-left type-body text-ink underline decoration-border underline-offset-4 hover:decoration-ink"
          data-whole-warehouse=""
        >
          {wholeWarehouseFigure(view.warehouse)}
        </button>
      </div>
      <section
        role="tabpanel"
        id={panelId}
        aria-labelledby={aisleTabId(idPrefix, selected)}
        aria-busy={view.aisle !== selected ? true : undefined}
        className="flex flex-col gap-3"
        data-wall-aisle={view.aisle}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="type-section-title">{aisleHeading(view.aisle)}</h2>
            {counts && aisleLayout && (
              <p className="type-body text-ink-secondary" data-aisle-line="">
                {wallAisleLine(counts, aisleLayout.walk_path_first, aisleLayout.walk_path_last)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="tertiary" size="md" onClick={onOpenList}>
              {OPEN_AS_LIST}
            </Button>
            <Link
              href={planStepHref(planId, "best-locations", { aisle: view.aisle, part })}
              className={buttonClassName("link", "md")}
            >
              {EDIT_BEST_MARKS}
            </Link>
          </div>
        </div>
        {aisleLayout && <AisleWall key={view.aisle} layout={aisleLayout} wall={view} {...grid} />}
        <Key />
        {drawer}
      </section>
    </div>
  );
}
