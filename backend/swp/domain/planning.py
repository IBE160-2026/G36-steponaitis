"""Kernel: the shared facts about the plan as it is now (AD-1, AD-3, FR-13, FR-14).

This module holds the only implementations of the planning copy, stock per location,
empty/occupied, current and other locations, and the aisle of a location. Every view
imports these and never re-derives them. In Epic 2 the planning copy is the import itself;
Epic 4 makes `planning_copy` replay the plan's moves without changing `PlanningCopy`.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType

from pydantic import BaseModel

from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.state import PlanState

ZERO = Decimal(0)
_NO_STOCK: Mapping[str, Decimal] = MappingProxyType({})


@dataclass(frozen=True)
class PlanningCopy:
    """Locations and inventory of the plan as it is now, with stock indexes built once."""

    locations: Mapping[str, LocationData]
    inventory: tuple[InventoryLine, ...]
    by_part: Mapping[str, Mapping[str, Decimal]]
    by_location: Mapping[str, Mapping[str, Decimal]]

    def stock_of(self, part: str) -> Mapping[str, Decimal]:
        """Stock of `part` per location (zero rows included), or an empty mapping."""
        return self.by_part.get(part, _NO_STOCK)

    def contents_of(self, location: str) -> Mapping[str, Decimal]:
        """Stock per part at `location` (zero rows included), or an empty mapping."""
        return self.by_location.get(location, _NO_STOCK)


def _index(
    inventory: tuple[InventoryLine, ...],
) -> tuple[dict[str, dict[str, Decimal]], dict[str, dict[str, Decimal]]]:
    by_part: dict[str, dict[str, Decimal]] = {}
    by_location: dict[str, dict[str, Decimal]] = {}
    for line in inventory:
        at_part = by_part.setdefault(line.part, {})
        at_part[line.location] = at_part.get(line.location, ZERO) + line.quantity
        at_location = by_location.setdefault(line.location, {})
        at_location[line.part] = at_location.get(line.part, ZERO) + line.quantity
    return by_part, by_location


def planning_copy(data: ImportData, state: PlanState) -> PlanningCopy:
    """The plan as it is now. In this epic it is the import as-is; `state` is unused."""
    del state  # Epic 4 replays the plan's moves from the state.
    inventory = tuple(data.inventory)
    by_part, by_location = _index(inventory)
    return PlanningCopy(
        locations=MappingProxyType(dict(data.locations)),
        inventory=inventory,
        by_part=MappingProxyType(by_part),
        by_location=MappingProxyType(by_location),
    )


def stock_at(copy: PlanningCopy, part: str, location: str) -> Decimal:
    """The stock of `part` at `location` (0 when there is no row)."""
    return copy.stock_of(part).get(location, ZERO)


def is_empty(copy: PlanningCopy, location: str) -> bool:
    """A location is empty when it has no inventory rows or all its rows have stock 0."""
    return all(quantity == 0 for quantity in copy.contents_of(location).values())


def is_occupied(copy: PlanningCopy, location: str) -> bool:
    return not is_empty(copy, location)


def total_stock(copy: PlanningCopy, part: str) -> Decimal:
    """The sum of the part's quantities over all its locations."""
    return sum(copy.stock_of(part).values(), ZERO)


def current_location(copy: PlanningCopy, part: str) -> str | None:
    """The location with the most stock; on equal stock the first in location-code order;
    None when no stock is above zero."""
    held = [(location, qty) for location, qty in copy.stock_of(part).items() if qty > 0]
    return min(held, key=lambda item: (-item[1], item[0]))[0] if held else None


def other_locations(copy: PlanningCopy, part: str) -> list[str]:
    """The part's other locations with stock above zero, in location-code order."""
    current = current_location(copy, part)
    return sorted(
        location for location, qty in copy.stock_of(part).items() if qty > 0 and location != current
    )


def aisle_of(copy: PlanningCopy, location: str) -> str:
    """The aisle of a location code."""
    return copy.locations[location].aisle


class LocationRef(BaseModel):
    """A location on the wire (AD-3)."""

    code: str
    aisle: str
    level: str
    section: str | None
    position: str | None
    is_best: bool


def location_ref(copy: PlanningCopy, code: str) -> LocationRef:
    """The wire reference of a location; `is_best` is false until Epic 3."""
    location = copy.locations[code]
    return LocationRef(
        code=code,
        aisle=location.aisle,
        level=location.level,
        section=location.section,
        position=location.position,
        is_best=False,
    )
