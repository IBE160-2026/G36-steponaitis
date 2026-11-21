// LocationChip (UX-DR25): a location code in Barlow, 24px high, in an ink outline. In M1 it is a
// link to the Locations table filtered to the location's aisle with its row focused (UX-DR9);
// Epic 10 points it at the wall. Being a link, it opens with the keyboard (Enter).

import Link from "next/link";

import type { LocationRef } from "@/lib/api/plans";
import { cn } from "@/lib/utils";
import { planStepHref } from "@/lib/view-state/urls";

/** Where a chip leads: `/plans/<id>/locations?aisle=<aisle>&loc=<code>`. */
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
