"use client";

// Locations step (FR-14, FR-42, UX-DR27, UX-DR40–43/45/48, UX-DR57). By default the open aisle is
// a bin wall (Story 10.2): aisle tabs in server order with the whole-warehouse figure, the aisle's
// header line, the wall and its Key. Every count, occupancy and best flag comes from the plan's wall
// view; the cells come from the import layout. The aisle opens from `?aisle=`, else the plan's
// stored last aisle, else the first.
//
// The wall is a keyboard grid with tooltips (Story 10.3): `?aisle=&loc=` (a LocationChip, a search
// location result) opens the wall on that aisle with the location's dialog pinned, once per `loc`.
// While a part's panel is open, its current location is drawn Selected and is the grid's tab stop;
// a part opened from the search field switches the wall to its aisle. The pinned dialog links the
// latest run's recommendations touching the location, only while their version agrees with the
// wall's (AD-12).
//
// Moves (Story 10.4): the wall draws the server's move entries of the open aisle, and the "Moves
// touching aisle" drawer under the Key lists them. `?rec=` (a recommendation) or `?move=` (a manual
// move) selects one; a marker, a cell with moves or a drawer row selects it everywhere (URL, wall,
// drawer) and scrolls the other side into view. The tabs and Open as list drop the selection.
//
// Whole warehouse (Story 10.6): the header's One aisle | Whole warehouse control (next to the search
// field in both scopes) and the whole-warehouse figure button switch scope. Whole warehouse shows
// the plan's warehouse view: four figures, nine aisle cards with mini-walls and the selected move as
// one route; a card opens its aisle. An explicit `?aisle=` or `?loc=` always opens One aisle;
// otherwise the plan's stored scope decides (`aisle-choice.ts`).
//
// One aisle lives in aisle-mode.tsx and its wall in locations-wall.tsx (split in Story 12.2, which
// adds the drag on the One aisle wall: the drag/ slice).
//
// **Open as list** (`?mode=list`) shows the milestone 1 table: every location in server order with
// its aisle, level, Walk Path, occupied or empty, best or not, and the parts stored there, with the
// whole-warehouse and per-aisle occupancy lines. Filters only read server flags; occupancy is always
// words and counts, never colour alone. `?mode=list&aisle=&loc=` sets the aisle filter and focuses
// the row (UX-DR9, through lib/view-state). The header's search field opens a part's panel
// (`?part=`, UX-DR24) or another location; so does a part number in a row's Parts cell.

import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/common/button";
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
import { useImportLayout } from "@/lib/api/imports";
import {
  type LocationsView as LocationsData,
  usePlanLocations,
  usePlanSummary,
  usePlanWarehouse,
} from "@/lib/api/plans";
import { OPEN_AS_WALL } from "@/lib/copy";
import {
  isSelectedWallMove,
  type LocationParams,
  parseLocationParams,
  planStepHref,
} from "@/lib/view-state/urls";

import { chooseAisle, chooseScope, readStoredWall, storeWall, type WallScope } from "./aisle-choice";
import { AisleMode, type ScopeSwitch } from "./aisle-mode";
import { LocationsHeader } from "./locations-wall";
import { ScopeControl, WholeWarehouse } from "./warehouse-view";

/** List mode: only `?mode=list` (a `?loc=` link without it opens the wall at that location). */
export function isListMode(params: LocationParams): boolean {
  return params.mode === "list";
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

function WallMode({ planId, params, importId }: { planId: string; params: LocationParams; importId: string }) {
  const layout = useImportLayout(importId);
  const aisles = layout.data?.aisles.map((entry) => entry.aisle) ?? [];
  // Read on each render: any aisle the wall opens on (tab, deep link, Open as wall) is stored below.
  const stored = readStoredWall(planId);
  const aisle = chooseAisle(params.aisle, stored.aisle, aisles);
  // The chosen scope lives here, seeded from storage; storage only remembers it (it may be blocked).
  const [chosen, setChosen] = useState<WallScope>(() => chooseScope(params, stored.scope));
  // A new explicit `?aisle=` / `?loc=` chooses One aisle (only when the URL changes: a switch to
  // Whole warehouse drops `aisle` from the URL one render after it sets the scope).
  const urlKey = locationUrlKey(params.aisle, params.loc);
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey);
    if (params.aisle !== undefined || params.loc !== undefined) setChosen("aisle");
  }
  const scope = chooseScope(params, chosen);
  const [focusControl, setFocusControl] = useState(false);

  const switchScope: ScopeSwitch = {
    toWarehouse: (moveQuery) => {
      storeWall(planId, "warehouse");
      setChosen("warehouse");
      setFocusControl(true);
      window.history.replaceState(null, "", planStepHref(planId, "locations", { part: params.part, ...moveQuery }));
    },
    toAisle: (next) => {
      storeWall(planId, "aisle", next);
      setChosen("aisle");
      setFocusControl(true);
      window.history.replaceState(
        null,
        "",
        planStepHref(planId, "locations", { aisle: next, part: params.part, rec: params.rec, move: params.move }),
      );
    },
    focusControl,
    onFocused: () => setFocusControl(false),
  };

  if (scope === "warehouse") {
    return <WarehouseMode planId={planId} params={params} layout={layout} aisle={aisle} switchScope={switchScope} />;
  }
  return <AisleMode planId={planId} params={params} layout={layout} aisle={aisle} switchScope={switchScope} />;
}

function WarehouseMode({
  planId,
  params,
  layout,
  aisle,
  switchScope,
}: {
  planId: string;
  params: LocationParams;
  layout: ReturnType<typeof useImportLayout>;
  /** The aisle One aisle would open on (the stored one, else the first). */
  aisle: string | undefined;
  switchScope: ScopeSwitch;
}) {
  const warehouse = usePlanWarehouse(planId, true);
  const panel = usePartPanel(planId, "locations");
  const data = usePanelPlanData(planId, warehouse, panel.part);
  // `?rec=` / `?move=` select one of the warehouse's move entries; any other id selects nothing.
  const selectedMove = data?.view.moves.find((move) => isSelectedWallMove(move, params));
  // The header stays mounted while the view loads or fails, so One aisle is always reachable.
  return (
    <WithPartPanel
      planId={planId}
      part={panel.part}
      detail={data?.detail}
      detailError={data?.detailError}
      onClose={panel.close}
    >
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        <LocationsHeader
          controls={
            <ScopeControl
              scope="warehouse"
              onChange={(next) => {
                if (next === "aisle") switchScope.toAisle(aisle);
              }}
              focusOnMount={switchScope.focusControl}
              onFocused={switchScope.onFocused}
            />
          }
          search={<SearchField planId={planId} onOpenPart={panel.open} />}
        />
        {showsLoadError(layout.error) && <PlanLoadError message={layout.error.message} />}
        {data ? (
          <WholeWarehouse
            view={data.view}
            layout={layout.data}
            selectedMove={selectedMove}
            onSelectAisle={switchScope.toAisle}
          />
        ) : showsLoadError(warehouse.error) ? (
          <PlanLoadError message={warehouse.error.message} />
        ) : (
          !showsLoadError(layout.error) && <PlanOpening planId={planId} />
        )}
      </div>
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
