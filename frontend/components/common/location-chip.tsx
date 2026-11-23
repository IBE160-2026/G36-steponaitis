// LocationChip (UX-DR25): a location code in Barlow, 24px high, in an ink outline. A link to the
// Locations wall on the location's aisle with that location's dialog pinned (Story 10.3; in M1 it
// opened the table, which `?mode=list` still does). Being a link, it opens with the keyboard (Enter).

import Link from "next/link";

import type { LocationRef } from "@/lib/api/plans";
import { cn } from "@/lib/utils";
import { planStepHref } from "@/lib/view-state/urls";

/** Where a chip (and a search location result) leads: `/plans/<id>/locations?aisle=<aisle>&loc=<code>`. */
export function locationChipHref(planId: string, location: Pick<LocationRef, "code" | "aisle">): string {
  return planStepHref(planId, "locations", { aisle: location.aisle, loc: location.code });
}

export function LocationChip({
  planId,
  location,
  className,
}: {
  planId: string;
  location: Pick<LocationRef, "code" | "aisle">;
  className?: string;
}) {
  return (
    <Link
      href={locationChipHref(planId, location)}
      data-location-chip={location.code}
      className={cn(
        "inline-flex h-control-sm items-center rounded-sm border border-ink bg-surface px-1.5 type-code-table text-ink",
        className,
      )}
    >
      {location.code}
    </Link>
  );
}
