"""The locations table behind GET /api/plans/{id}/locations (FR-14, AD-3, AD-14, AD-15).

Pure: one planning copy per request, every row and every occupancy count built from it; it
never writes. Lists every location in the import once, in `ordering.location_order`.
"""

from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel

from swp.domain.import_data import ImportData
from swp.domain.ordering import aisle_order, location_order
from swp.domain.planning import LocationRef, is_occupied, location_ref, planning_copy
from swp.domain.state import PlanState
from swp.domain.values import Dec


class LocationContent(BaseModel):
    part: str
    description: str
    stock: Dec


class LocationRow(BaseModel):
    location: LocationRef
    walk_path: Dec
    occupied: bool
    contents: list[LocationContent]


class Occupancy(BaseModel):
    locations: int
    occupied: int
    empty: int
    occupied_percent: str


class AisleOccupancy(Occupancy):
    aisle: str


class LocationsView(BaseModel):
    version: int
    locations: list[LocationRow]
    aisles: list[AisleOccupancy]
    warehouse: Occupancy


def occupied_percent(occupied: int, total: int) -> str:
    """`occupied / total * 100` with one decimal, rounded half-up ("0.0" when total is 0)."""
    if total == 0:
        return "0.0"
    pct = (Decimal(occupied) * 100 / Decimal(total)).quantize(Decimal("0.1"), ROUND_HALF_UP)
    return f"{pct:.1f}"


def _occupancy(rows: list[LocationRow]) -> tuple[int, int, int, str]:
    total = len(rows)
    occupied = sum(1 for row in rows if row.occupied)
    return total, occupied, total - occupied, occupied_percent(occupied, total)


def build_locations_view(data: ImportData, state: PlanState, version: int) -> LocationsView:
    """Every location of the plan as it is now, with per-aisle and warehouse occupancy."""
    copy = planning_copy(data, state)
    rows = []
    for code in location_order(copy.locations):
        contents = [
            LocationContent(part=part, description=data.parts.get(part, ""), stock=stock)
            for part, stock in sorted(copy.contents_of(code).items())
            if stock > 0
        ]
        rows.append(
            LocationRow(
                location=location_ref(copy, code),
                walk_path=copy.locations[code].walk_path,
                occupied=is_occupied(copy, code),
                contents=contents,
            )
        )
    aisles = []
    for aisle in aisle_order(row.location.aisle for row in rows):
        total, occupied, empty, pct = _occupancy([r for r in rows if r.location.aisle == aisle])
        aisles.append(
            AisleOccupancy(
                aisle=aisle, locations=total, occupied=occupied, empty=empty, occupied_percent=pct
            )
        )
    total, occupied, empty, pct = _occupancy(rows)
    warehouse = Occupancy(locations=total, occupied=occupied, empty=empty, occupied_percent=pct)
    return LocationsView(version=version, locations=rows, aisles=aisles, warehouse=warehouse)
