"use client";

// The Locations table (FR-14, UX-DR27, UX-DR57), shared by the Locations step and the Best
// locations step (Story 3.4): the columns, the filter helpers, the occupancy and count lines, and a
// filter bar + table with controlled filters and optional extra columns. Filters only read server
// flags; occupancy and best are always words, never colour alone.

import { useId, useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import type { LocationRow, LocationsView, Occupancy } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LocationParams } from "@/lib/view-state/urls";

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

/** Opens a part's panel; `opener` gets the focus back when the panel closes. */
export type OpenPart = (part: string, opener: HTMLElement | null) => void;

/** The standard columns; with `onOpenPart`, each part number in the Parts cell opens its panel. */
export function locationColumns(onOpenPart?: OpenPart): readonly DataTableColumn<LocationRow>[] {
  return [
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
              {onOpenPart ? (
                <button
                  type="button"
                  data-open-part={content.part}
                  onClick={(event) => onOpenPart(content.part, event.currentTarget)}
                  className="rounded-sm type-code-table text-ink underline underline-offset-2"
                >
                  {content.part}
                </button>
              ) : (
                <span className="type-code-table text-ink">{content.part}</span>
              )}
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
}

export const LOCATION_COLUMNS = locationColumns();

export function ToggleGroup<V extends string>({
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

const NO_EXTRA_COLUMNS: readonly DataTableColumn<LocationRow>[] = [];

/** The aisle, occupancy and best filters, the count line and the Locations table. */
export function LocationsTable({
  view,
  filters,
  onFiltersChange,
  extraColumns = NO_EXTRA_COLUMNS,
  focusKey,
  onOpenPart,
}: {
  view: LocationsView;
  filters: LocationFilters;
  onFiltersChange: (filters: LocationFilters) => void;
  /** Columns added after the standard ones (e.g. the Best locations step's Mark/Unmark). */
  extraColumns?: readonly DataTableColumn<LocationRow>[];
  /** A row to focus and scroll into view (UX-DR9). */
  focusKey?: string;
  /** When set, each part number in the Parts cell is a button that opens the part panel (UX-DR24). */
  onOpenPart?: OpenPart;
}) {
  const rows = filterLocations(view.locations, filters);
  const aisleSelect = useId();
  // Stable while its inputs are, so the table's memoized rows skip unchanged locations.
  const columns = useMemo(
    () => [...(onOpenPart ? locationColumns(onOpenPart) : LOCATION_COLUMNS), ...extraColumns],
    [onOpenPart, extraColumns],
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={aisleSelect} className="type-body text-ink">
            Aisle
          </label>
          <select
            id={aisleSelect}
            value={filters.aisle}
            onChange={(event) => onFiltersChange({ ...filters, aisle: event.target.value })}
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
          onChange={(occupancy) => onFiltersChange({ ...filters, occupancy })}
        />
        <ToggleGroup
          label="Filter by best location"
          options={BEST_OPTIONS}
          value={filters.best}
          onChange={(best) => onFiltersChange({ ...filters, best })}
        />
      </div>
      <p className="type-body text-ink-secondary" aria-live="polite">
        {countLine(rows.length, view.locations.length, isFiltered(filters))}
      </p>
      <DataTable
        label="Locations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.location.code}
        focusKey={focusKey}
        className="bg-surface"
      />
    </>
  );
}
