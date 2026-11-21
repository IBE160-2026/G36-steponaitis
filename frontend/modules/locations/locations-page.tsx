"use client";

// Locations table (FR-14, UX-DR27, UX-DR57): every location in server order with its aisle,
// level, Walk Path, occupied or empty, best or not, and the parts stored there; the whole-warehouse
// and per-aisle occupancy lines from the server. Filters only read server flags; occupancy is
// always words and counts, never colour alone. `?aisle=&loc=` sets the aisle filter and focuses
// the row (UX-DR9, through lib/view-state). The header's search field opens a part's panel
// (`?part=`, UX-DR24) or another location.

import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SearchField } from "@/components/common/search-field";
import { type LocationRow, type LocationsView as LocationsData, type Occupancy, usePlanLocations } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type LocationParams, planStepHref } from "@/lib/view-state/urls";

export type OccupancyFilter = "all" | "occupied" | "empty";
export type BestFilter = "all" | "best" | "not-best";
export type LocationFilters = { aisle: string; occupancy: OccupancyFilter; best: BestFilter };

export const ALL_AISLES = "";
export const NO_FILTERS: LocationFilters = { aisle: ALL_AISLES, occupancy: "all", best: "all" };

const OCCUPANCY_OPTIONS: readonly { value: OccupancyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "occupied", label: "Occupied" },
  { value: "empty", label: "Empty" },
];

const BEST_OPTIONS: readonly { value: BestFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "best", label: "Best" },
  { value: "not-best", label: "Not best" },
];

/** "Aisle A · 88.9% occupied · 8 of 9 locations · 1 empty" (counts and percent from the server). */
export function occupancyLine(label: string, occupancy: Occupancy): string {
  const noun = occupancy.locations === 1 ? "location" : "locations";
  return [
    label,
    `${occupancy.occupied_percent}% occupied`,
    `${formatNumber(occupancy.occupied)} of ${formatNumber(occupancy.locations)} ${noun}`,
    `${formatNumber(occupancy.empty)} empty`,
  ].join(" · ");
}

/** "2,000 locations", or "223 of 2,000 locations" while a filter is on. */
export function countLine(shown: number, total: number, filtered: boolean): string {
  const noun = total === 1 ? "location" : "locations";
  return filtered ? `${formatNumber(shown)} of ${formatNumber(total)} ${noun}` : `${formatNumber(total)} ${noun}`;
}

export function isFiltered(filters: LocationFilters): boolean {
  return filters.aisle !== ALL_AISLES || filters.occupancy !== "all" || filters.best !== "all";
}

/** The rows that pass every filter, in the given (server) order. Reads only server flags. */
export function filterLocations<T extends Pick<LocationRow, "location" | "occupied">>(
  rows: readonly T[],
  filters: LocationFilters,
): T[] {
  return rows.filter(
    (row) =>
      (filters.aisle === ALL_AISLES || row.location.aisle === filters.aisle) &&
      (filters.occupancy === "all" || row.occupied === (filters.occupancy === "occupied")) &&
      (filters.best === "all" || row.location.is_best === (filters.best === "best")),
  );
}

/** The aisle filter a URL asks for: a server aisle, else all aisles. */
export function aisleFromParams(params: LocationParams, aisles: readonly { aisle: string }[]): string {
  return params.aisle !== undefined && aisles.some((entry) => entry.aisle === params.aisle) ? params.aisle : ALL_AISLES;
}

export const COLUMNS: readonly DataTableColumn<LocationRow>[] = [
  {
    key: "location",
    header: "Location",
    cell: (row) => <span className="type-code-table text-ink">{row.location.code}</span>,
  },
  { key: "aisle", header: "Aisle", cell: (row) => row.location.aisle },
  { key: "level", header: "Level", cell: (row) => row.location.level },
  { key: "walk_path", header: "Walk Path", align: "end", cell: (row) => formatNumber(row.walk_path) },
  {
    key: "occupancy",
    header: "Occupancy",
    cell: (row) => <span data-occupancy={row.occupied ? "occupied" : "empty"}>{row.occupied ? "Occupied" : "Empty"}</span>,
  },
  { key: "best", header: "Best", cell: (row) => (row.location.is_best ? "Best" : null) },
  {
    key: "parts",
    header: "Parts",
    cell: (row) =>
      row.contents.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {row.contents.map((content) => (
            <li key={content.part} className="flex flex-wrap items-baseline gap-x-2">
              <span className="type-code-table text-ink">{content.part}</span>
              <span className="text-ink">{content.description}</span>
              <span className="type-meta text-ink-secondary">stock {formatNumber(content.stock)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-ink-secondary">None</span>
      ),
  },
];

function ToggleGroup<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-control-sm items-center rounded-full border px-2.5 type-button",
              pressed ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function LocationsView({
  view,
  params = {},
  onAisleChange,
  search,
}: {
  view: LocationsData;
  params?: LocationParams;
  onAisleChange?: (aisle: string) => void;
  /** The header's search field. */
  search?: ReactNode;
}) {
  const fromUrl = aisleFromParams(params, view.aisles);
  const [filters, setFilters] = useState<LocationFilters>({ ...NO_FILTERS, aisle: fromUrl });
  // A new URL (e.g. another `?aisle=&loc=` link) clears the filters and sets the aisle again,
  // so a filter left on cannot hide the linked row.
  const urlKey = `${params.aisle ?? ""}\u0000${params.loc ?? ""}`;
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey);
    setFilters({ ...NO_FILTERS, aisle: fromUrl });
  }

  const rows = filterLocations(view.locations, filters);
  const aisleSelect = useId();

  function changeAisle(aisle: string) {
    setFilters((current) => ({ ...current, aisle }));
    onAisleChange?.(aisle);
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
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={aisleSelect} className="type-body text-ink">
            Aisle
          </label>
          <select
            id={aisleSelect}
            value={filters.aisle}
            onChange={(event) => changeAisle(event.target.value)}
            className="h-control-sm rounded-sm border border-border bg-surface px-2 type-body text-ink"
          >
            <option value={ALL_AISLES}>All aisles</option>
            {view.aisles.map((aisle) => (
              <option key={aisle.aisle} value={aisle.aisle}>
                {aisle.aisle}
              </option>
            ))}
          </select>
        </div>
        <ToggleGroup
          label="Filter by occupancy"
          options={OCCUPANCY_OPTIONS}
          value={filters.occupancy}
          onChange={(occupancy) => setFilters((current) => ({ ...current, occupancy }))}
        />
        <ToggleGroup
          label="Filter by best location"
          options={BEST_OPTIONS}
          value={filters.best}
          onChange={(best) => setFilters((current) => ({ ...current, best }))}
        />
      </div>
      <p className="type-body text-ink-secondary" aria-live="polite">
        {countLine(rows.length, view.locations.length, isFiltered(filters))}
      </p>
      <DataTable
        label="Locations"
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.location.code}
        focusKey={params.loc}
        className="bg-surface"
      />
    </div>
  );
}

export function LocationsPage({ planId, params = {} }: { planId: string; params?: LocationParams }) {
  const router = useRouter();
  const locations = usePlanLocations(planId);
  const panel = usePartPanel(planId, "locations", params);
  if (locations.data) {
    return (
      <WithPartPanel planId={planId} part={panel.part} onClose={panel.close}>
        <LocationsView
          view={locations.data}
          params={params}
          search={<SearchField planId={planId} onOpenPart={panel.open} />}
          onAisleChange={(aisle) =>
            router.replace(planStepHref(planId, "locations", { aisle, part: params.part }), { scroll: false })
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
