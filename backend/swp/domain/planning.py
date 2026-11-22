"""Kernel: the shared facts about the plan as it is now (AD-1, AD-3, FR-13, FR-14).

This module holds the only implementations of the planning copy, stock per location,
empty/occupied, current and other locations, the aisle of a location, and which
locations the best-location marks cover (AD-4, FR-21, FR-22). Every view
imports these and never re-derives them. `replay` is the one fold from the import and
the step log to the planning copy, the effective moves and each part's current location
(AD-5, FR-33, FR-34, FR-36); none of its results are stored.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType

from pydantic import BaseModel, ConfigDict

from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.state import BestMark, PlanState, Rule, Step

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


def _copy_of(data: ImportData, inventory: tuple[InventoryLine, ...]) -> PlanningCopy:
    by_part, by_location = _index(inventory)
    return PlanningCopy(
        locations=MappingProxyType(dict(data.locations)),
        inventory=inventory,
        by_part=MappingProxyType(by_part),
        by_location=MappingProxyType(by_location),
    )


class EffectiveMove(BaseModel):
    """A move as it counts for the plan after combining (FR-34); never stored.

    A combined move keeps the first step's move number and recommendation id, has rule
    `manual` and no swap id; `steps` lists the move numbers of the steps it is made of.
    """

    model_config = ConfigDict(frozen=True)

    move_number: int
    part: str
    from_location: str
    to_location: str
    rule: Rule
    round: int
    recommendation_id: str | None
    swap_id: str | None
    steps: tuple[int, ...]


@dataclass(frozen=True)
class Replay:
    """The result of replaying the step log on the import."""

    copy: PlanningCopy
    moves: tuple[EffectiveMove, ...]
    current_locations: Mapping[str, str | None]


@dataclass
class _Open:
    """An effective move while folding: whether its target held none of the part right
    before the step that set the target, and that step's position in the log."""

    move: EffectiveMove
    target_was_empty: bool
    set_at: int


class _Stock:
    """Inventory entries keyed by (part, location) in import order, new keys appended.

    A removed key keeps its slot, so a key that comes back returns to its old place.
    """

    def __init__(self, inventory: Sequence[InventoryLine]) -> None:
        self._lines: dict[tuple[str, str], list[InventoryLine]] = {}
        for line in inventory:
            self._lines.setdefault((line.part, line.location), []).append(line)

    def quantity(self, part: str, location: str) -> Decimal:
        return sum((line.quantity for line in self._lines.get((part, location), ())), ZERO)

    def move(self, part: str, from_location: str, to_location: str) -> None:
        moved = self.quantity(part, from_location)
        if (part, from_location) in self._lines:
            self._lines[(part, from_location)] = []
        held = self.quantity(part, to_location)
        line = InventoryLine(part=part, location=to_location, quantity=held + moved)
        self._lines[(part, to_location)] = [line]

    def inventory(self) -> tuple[InventoryLine, ...]:
        return tuple(line for lines in self._lines.values() for line in lines)


def _fold_move(moves: list[_Open], step: Step, target_was_empty: bool, at: int) -> None:
    """Add `step` to the effective moves (FR-34): combine it with the part's latest move in
    the same round that ends where the step starts, when that move's target held none of
    the part; drop the move when it returns to its first from-location. "Latest" is by
    the step that last set the move's target, not by the move's place in the list."""
    latest = max(
        (
            index
            for index, item in enumerate(moves)
            if item.move.part == step.part
            and item.move.round == step.round
            and item.move.to_location == step.from_location
        ),
        key=lambda index: moves[index].set_at,
        default=None,
    )
    if latest is not None and moves[latest].target_was_empty:
        first = moves[latest].move
        if step.to_location == first.from_location:
            del moves[latest]
            return
        combined = first.model_copy(
            update={
                "to_location": step.to_location,
                "rule": "manual",
                "swap_id": None,
                "steps": (*first.steps, step.move_number),
            }
        )
        moves[latest] = _Open(combined, target_was_empty, at)
        return
    moves.append(
        _Open(
            EffectiveMove(
                move_number=step.move_number,
                part=step.part,
                from_location=step.from_location,
                to_location=step.to_location,
                rule=step.rule,
                round=step.round,
                recommendation_id=step.recommendation_id,
                swap_id=step.swap_id,
                steps=(step.move_number,),
            ),
            target_was_empty,
            at,
        )
    )


def replay(data: ImportData, steps: Sequence[Step]) -> Replay:
    """Replay `steps` on the import: the planning copy, the effective moves and each part's
    current location (AD-5, FR-33, FR-34, FR-36).

    Pure and total: steps are trusted (commands validate them). A step moves all of the
    part's stock at its from-location and adds it to the to-location. The import is never
    changed: new inventory lines are built.
    """
    stock = _Stock(data.inventory)
    moves: list[_Open] = []
    for at, step in enumerate(steps):
        target_was_empty = stock.quantity(step.part, step.to_location) == 0
        stock.move(step.part, step.from_location, step.to_location)
        _fold_move(moves, step, target_was_empty, at)
    copy = _copy_of(data, stock.inventory())
    parts = dict.fromkeys([*data.parts, *(line.part for line in data.inventory)])
    return Replay(
        copy=copy,
        moves=tuple(item.move for item in moves),
        current_locations=MappingProxyType({part: current_location(copy, part) for part in parts}),
    )


def planning_copy(data: ImportData, state: PlanState) -> PlanningCopy:
    """The plan as it is now: the import with the plan's steps replayed."""
    return replay(data, state.steps).copy


def current_round(state: PlanState) -> int:
    """The highest `round` among the plan's runs, 0 before the first run (never stored)."""
    rounds = [run.get("round") for run in state.runs]
    return max((r for r in rounds if isinstance(r, int) and not isinstance(r, bool)), default=0)


def append_step(
    state: PlanState,
    *,
    part: str,
    from_location: str,
    to_location: str,
    rule: Rule,
    recommendation_id: str | None = None,
    swap_id: str | None = None,
) -> PlanState:
    """A new state with one step appended in the current round under the next move number."""
    step = Step(
        move_number=state.next_move_number,
        part=part,
        from_location=from_location,
        to_location=to_location,
        rule=rule,
        round=current_round(state),
        recommendation_id=recommendation_id,
        swap_id=swap_id,
    )
    return state.model_copy(
        update={"steps": [*state.steps, step], "next_move_number": state.next_move_number + 1}
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


def covering_marks(copy: PlanningCopy, location: str, marks: Sequence[BestMark]) -> list[BestMark]:
    """The marks, in the given order, that cover `location` (none for an unknown code).

    An aisle mark covers its aisle, a level mark its level in one aisle (or in all aisles
    when `aisle` is None), a location mark its one code; matching is exact string equality.
    """
    loc = copy.locations.get(location)
    if loc is None:
        return []
    return [
        mark
        for mark in marks
        if (mark.kind == "aisle" and mark.aisle == loc.aisle)
        or (mark.kind == "level" and mark.level == loc.level and mark.aisle in (None, loc.aisle))
        or (mark.kind == "location" and mark.location == location)
    ]


def is_best(copy: PlanningCopy, location: str, marks: Sequence[BestMark]) -> bool:
    """A location is best when any mark covers it."""
    return bool(covering_marks(copy, location, marks))


class BestCounts(BaseModel):
    best: int
    empty: int


def best_counts(copy: PlanningCopy, marks: Sequence[BestMark]) -> BestCounts:
    """The number of best locations and of best locations that are empty."""
    best = [code for code in copy.locations if is_best(copy, code, marks)]
    return BestCounts(best=len(best), empty=sum(1 for code in best if is_empty(copy, code)))


class LocationRef(BaseModel):
    """A location on the wire (AD-3)."""

    code: str
    aisle: str
    level: str
    section: str | None
    position: str | None
    is_best: bool


def location_ref(copy: PlanningCopy, code: str, marks: Sequence[BestMark]) -> LocationRef:
    """The wire reference of a location, best when any of `marks` covers it."""
    location = copy.locations[code]
    return LocationRef(
        code=code,
        aisle=location.aisle,
        level=location.level,
        section=location.section,
        position=location.position,
        is_best=is_best(copy, code, marks),
    )
