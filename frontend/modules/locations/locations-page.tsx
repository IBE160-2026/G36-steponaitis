"use client";

// Locations step (FR-14, FR-42, UX-DR27, UX-DR40/41/45/48, UX-DR57). By default the open aisle is
// a bin wall (Story 10.2): aisle tabs in server order with the whole-warehouse figure, the aisle's
// header line, the wall and its Key. Every count, occupancy and best flag comes from the plan's wall
// view; the cells come from the import layout. The aisle opens from `?aisle=`, else the plan's
// stored last aisle, else the first.
//
// **Open as list** (`?mode=list`, or any `?loc=` link) shows the milestone 1 table: every location
// in server order with its aisle, level, Walk Path, occupied or empty, best or not, and the parts
// stored there, with the whole-warehouse and per-aisle occupancy lines. Filters only read server
// flags; occupancy is always words and counts, never colour alone. `?aisle=&loc=` sets the aisle
// filter and focuses the row (UX-DR9, through lib/view-state). The header's search field opens a
// part's panel (`?part=`, UX-DR24) or another location; so does a part number in a row's Parts cell.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useId, useState } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import {
  aisleFromParams,
  type LocationFilters,
  LocationsTable,
  NO_FILTERS,
  occupancyLine,
  type OpenPart,
} from "@/components/common/locations-table";
import { usePanelPlanData, usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SearchField } from "@/components/common/search-field";
import { Key } from "@/components/common/wall";
import { type LayoutView, useImportLayout } from "@/lib/api/imports";
import {
  type LocationsView as LocationsData,
  usePlanLocations,
  usePlanSummary,
  usePlanWall,
  type WallView,
} from "@/lib/api/plans";
import {
  aisleHeading,
  EDIT_BEST_MARKS,
  OPEN_AS_LIST,
  OPEN_AS_WALL,
  wallAisleLine,
  wholeWarehouseFigure,
} from "@/lib/copy";
import { type LocationParams, parseLocationParams, planStepHref } from "@/lib/view-state/urls";

import { chooseAisle, readStoredAisle, storeAisle } from "./aisle-choice";
import { aisleTabId, AisleTabs } from "./aisle-tabs";
import { AisleWall } from "./aisle-wall";

/** List mode: `?mode=list`, or a `?loc=` link (a location link focuses its table row). */
export function isListMode(params: LocationParams): boolean {
  return params.mode === "list" || params.loc !== undefined;
}

/** The part of the URL that resets the filters: `?aisle=` and `?loc=` (empty values dropped). */
function locationUrlKey(aisle: string | undefined, loc: string | undefined): string {
  return `${aisle ?? ""}\u0000${loc ?? ""}`;
}

export function LocationsView({
  view,
  params = {},
  onAisleChange,
  search,
  onOpenPart,
  actions,
}: {
  view: LocationsData;
  params?: LocationParams;
  onAisleChange?: (aisle: string) => void;
  /** The header's search field. */
  search?: ReactNode;
  /** Opens a part's panel from a part number in the Parts cell (UX-DR24). */
  onOpenPart?: OpenPart;
  /** Beside the occupancy lines: **Open as wall**. */
  actions?: ReactNode;
}) {
  const fromUrl = aisleFromParams(params, view.aisles);
  const [filters, setFilters] = useState<LocationFilters>({ ...NO_FILTERS, aisle: fromUrl });
  // A new URL (e.g. another `?aisle=&loc=` link) clears the filters and sets the aisle again,
  // so a filter left on cannot hide the linked row. The URL this view writes itself when the
  // table's aisle changes (`?aisle=` without `loc`) keeps the Occupancy and Best filters.
  const urlKey = locationUrlKey(params.aisle, params.loc);
  const [seenUrl, setSeenUrl] = useState(urlKey);
  const [ownUrl, setOwnUrl] = useState<string | null>(null);
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey);
    setOwnUrl(null);
    if (urlKey !== ownUrl) setFilters({ ...NO_FILTERS, aisle: fromUrl });
  }

  function changeFilters(next: LocationFilters) {
    setFilters(next);
    if (next.aisle !== filters.aisle && onAisleChange) {
      setOwnUrl(locationUrlKey(next.aisle, undefined));
      onAisleChange(next.aisle);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="type-page-title">Locations</h1>
          {search}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="type-body text-ink" data-occupancy-line="warehouse">
            {occupancyLine("Whole warehouse", view.warehouse)}
          </p>
          {actions}
        </div>
        <ul className="flex flex-col gap-0.5" aria-label="Occupancy per aisle">
          {view.aisles.map((aisle) => (
            <li key={aisle.aisle} className="type-body text-ink-secondary" data-occupancy-line={aisle.aisle}>
              {occupancyLine(`Aisle ${aisle.aisle}`, aisle)}
            </li>
          ))}
        </ul>
      </div>
      <LocationsTable
        view={view}
        filters={filters}
        onFiltersChange={changeFilters}
        focusKey={params.loc}
        onOpenPart={onOpenPart}
      />
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
}) {
  const idPrefix = useId();
  const panelId = `${idPrefix}-panel`;
  const counts = view.aisles.find((entry) => entry.aisle === view.aisle);
  const aisleLayout = layout?.aisles.find((entry) => entry.aisle === view.aisle);
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="type-page-title">Locations</h1>
        {search}
      </div>
      <div className="flex flex-col gap-2">
        <AisleTabs aisles={view.aisles} selected={selected} onSelect={onSelect} idPrefix={idPrefix} panelId={panelId} />
        <p className="type-body text-ink" data-whole-warehouse="">
          {wholeWarehouseFigure(view.warehouse)}
        </p>
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
        {aisleLayout && <AisleWall layout={aisleLayout} wall={view} />}
        <Key />
      </section>
    </div>
  );
}

function WallMode({ planId, params, importId }: { planId: string; params: LocationParams; importId: string }) {
  const layout = useImportLayout(importId);
  const aisles = layout.data?.aisles.map((entry) => entry.aisle) ?? [];
  // Read on each render: any aisle the wall opens on (tab, deep link, Open as wall) is stored below.
  const aisle = chooseAisle(params.aisle, readStoredAisle(planId), aisles);
  const wall = usePlanWall(planId, aisle ?? "", aisle !== undefined);
  const panel = usePartPanel(planId, "locations");
  const data = usePanelPlanData(planId, wall, panel.part);

  useEffect(() => {
    if (aisle !== undefined) storeAisle(planId, aisle);
  }, [planId, aisle]);

  function select(next: string) {
    window.history.replaceState(null, "", planStepHref(planId, "locations", { aisle: next, part: panel.part }));
  }

  function openList() {
    // The chosen aisle, not the previous aisle's wall still shown while the next one loads.
    const current = aisle ?? data?.view.aisle;
    window.history.replaceState(
      null,
      "",
      planStepHref(planId, "locations", { aisle: current, mode: "list", part: panel.part }),
    );
  }

  if (!data || aisle === undefined) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        {showsLoadError(layout.error) ? (
          <PlanLoadError message={layout.error.message} />
        ) : showsLoadError(wall.error) ? (
          <PlanLoadError message={wall.error.message} />
        ) : (
          <PlanOpening planId={planId} />
        )}
      </div>
    );
  }
  return (
    <WithPartPanel
      planId={planId}
      part={panel.part}
      detail={data.detail}
      detailError={data.detailError}
      onClose={panel.close}
    >
      <LocationsWall
        planId={planId}
        view={data.view}
        layout={layout.data}
        selected={aisle}
        onSelect={select}
        onOpenList={openList}
        part={panel.part}
        search={<SearchField planId={planId} onOpenPart={panel.open} />}
      />
    </WithPartPanel>
  );
}

function ListMode({ planId, params }: { planId: string; params: LocationParams }) {
  const locations = usePlanLocations(planId);
  const panel = usePartPanel(planId, "locations");
  const data = usePanelPlanData(planId, locations, panel.part);
  if (!data) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        {showsLoadError(locations.error) ? (
          <PlanLoadError message={locations.error.message} />
        ) : (
          <PlanOpening planId={planId} />
        )}
      </div>
    );
  }
  return (
    <WithPartPanel
      planId={planId}
      part={panel.part}
      detail={data.detail}
      detailError={data.detailError}
      onClose={panel.close}
    >
      <LocationsView
        view={data.view}
        params={params}
        search={<SearchField planId={planId} onOpenPart={panel.open} />}
        onOpenPart={panel.open}
        onAisleChange={(aisle) =>
          window.history.replaceState(
            null,
            "",
            planStepHref(planId, "locations", { aisle, mode: "list", part: panel.part }),
          )
        }
        actions={
          <Button
            variant="tertiary"
            size="md"
            onClick={() =>
              window.history.replaceState(
                null,
                "",
                planStepHref(planId, "locations", { aisle: params.aisle, part: panel.part }),
              )
            }
          >
            {OPEN_AS_WALL}
          </Button>
        }
      />
    </WithPartPanel>
  );
}

export function LocationsPage({ planId }: { planId: string; params?: LocationParams }) {
  // The URL is the one source of the view state: `?aisle=&loc=&mode=` and the panel's `?part=` are
  // read from it here; the tabs, Open as list/wall and the aisle filter change it without a server
  // render, like the panel does.
  const params = parseLocationParams(useSearchParams());
  const summary = usePlanSummary(planId);
  if (isListMode(params)) return <ListMode planId={planId} params={params} />;
  if (!summary.data) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        {showsLoadError(summary.error) ? (
          <PlanLoadError message={summary.error.message} />
        ) : (
          <PlanOpening planId={planId} />
        )}
      </div>
    );
  }
  return <WallMode planId={planId} params={params} importId={summary.data.import_id} />;
}
