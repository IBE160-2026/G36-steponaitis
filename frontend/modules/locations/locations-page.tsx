"use client";

// Locations step (FR-14, UX-DR27, UX-DR57): every location in server order with its aisle,
// level, Walk Path, occupied or empty, best or not, and the parts stored there; the whole-warehouse
// and per-aisle occupancy lines from the server. Filters only read server flags; occupancy is
// always words and counts, never colour alone (the table is components/common/locations-table).
// `?aisle=&loc=` sets the aisle filter and focuses the row (UX-DR9, through lib/view-state). The
// header's search field opens a part's panel (`?part=`, UX-DR24) or another location; so does a part
// number in a row's Parts cell (Story 4.3).

import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

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
import { type LocationsView as LocationsData, usePlanLocations } from "@/lib/api/plans";
import { type LocationParams, parseLocationParams, planStepHref } from "@/lib/view-state/urls";

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
}: {
  view: LocationsData;
  params?: LocationParams;
  onAisleChange?: (aisle: string) => void;
  /** The header's search field. */
  search?: ReactNode;
  /** Opens a part's panel from a part number in the Parts cell (UX-DR24). */
  onOpenPart?: OpenPart;
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
        <p className="type-body text-ink" data-occupancy-line="warehouse">
          {occupancyLine("Whole warehouse", view.warehouse)}
        </p>
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

export function LocationsPage({ planId }: { planId: string; params?: LocationParams }) {
  // The URL is the one source of the view state: `?aisle=&loc=` and the panel's `?part=` are read
  // from it here, and the aisle filter changes it without a server render, like the panel does.
  const params = parseLocationParams(useSearchParams());
  const locations = usePlanLocations(planId);
  const panel = usePartPanel(planId, "locations");
  const data = usePanelPlanData(planId, locations, panel.part);
  if (data) {
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
            window.history.replaceState(null, "", planStepHref(planId, "locations", { aisle, part: panel.part }))
          }
        />
      </WithPartPanel>
    );
  }
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
