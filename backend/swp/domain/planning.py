"""Kernel: the shared facts about the plan as it is now (AD-1, AD-3, FR-13, FR-14).

This module holds the only implementations of the planning copy, stock per location,
empty/occupied, current and other locations, the aisle of a location, and which
locations the best-location marks cover (AD-4, FR-21, FR-22). Every view
imports these and never re-derives them. `replay` is the one fold from the import and
the step log to the planning copy, the effective moves and each part's current location
(AD-5, FR-33, FR-34, FR-36); none of its results are stored.
"""

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Annotated, Literal, assert_never

from pydantic import BaseModel, ConfigDict, Field

from swp.domain.analysis import SLOW_MOVING_CLASSES, Analysis, MovementClass, PartAnalysis
from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.state import (
    BestMark,
    PlanState,
    Recommendation,
    RecommendationRule,
    Rule,
    Run,
    Step,
)

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


def import_copy(data: ImportData) -> PlanningCopy:
    """The import itself as a planning copy: its inventory indexed, no steps folded (the
    "before" side of before/after, FR-37)."""
    return _copy_of(data, tuple(data.inventory))


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


UndoKind = Literal["reverts_move", "splits_combined_move", "restores_removed_move"]
"""What undoing the last step does to the effective moves (AD-5): the step stood as its own
move (`reverts_move`), it was combined into a move (`splits_combined_move`) or it removed
a move (`restores_removed_move`)."""


@dataclass(frozen=True)
class StepOutcome:
    """How the fold took one step (FR-34): `kind` as its undo would read it, and the
    effective move it affected (its own number when it was appended as its own move)."""

    step: Step
    kind: UndoKind
    move_number: int


class UndoEffect(BaseModel):
    """What undoing the last step does (AD-5): `reverts_move` takes back move `move_number`
    (the step's own), `splits_combined_move` takes the step out of combined move
    `move_number`, `restores_removed_move` brings back removed move `move_number`."""

    kind: UndoKind
    move_number: int


class UndoPreview(BaseModel):
    """The last step of the log and what undoing it would do (AD-5); never stored."""

    move_number: int
    part: str
    from_location: str
    to_location: str
    effect: UndoEffect


def undo_preview(last: StepOutcome | None) -> UndoPreview | None:
    """The undo preview of the log's last step as the replay folded it; None without steps."""
    if last is None:
        return None
    step = last.step
    return UndoPreview(
        move_number=step.move_number,
        part=step.part,
        from_location=step.from_location,
        to_location=step.to_location,
        effect=UndoEffect(kind=last.kind, move_number=last.move_number),
    )


@dataclass(frozen=True)
class Replay:
    """The result of replaying the step log on the import. `last` is how the fold took the
    log's last step (None without steps): the data of the undo preview (AD-5)."""

    copy: PlanningCopy
    moves: tuple[EffectiveMove, ...]
    current_locations: Mapping[str, str | None]
    last: StepOutcome | None = None


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


def _fold_move(moves: list[_Open], step: Step, target_was_empty: bool, at: int) -> StepOutcome:
    """Add `step` to the effective moves (FR-34): combine it with the part's latest move in
    the same round that ends where the step starts, when that move's target held none of
    the part; drop the move when it returns to its first from-location. "Latest" is by
    the step that last set the move's target, not by the move's place in the list.
    Return which of the three it did."""
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
            return StepOutcome(step, "restores_removed_move", first.move_number)
        combined = first.model_copy(
            update={
                "to_location": step.to_location,
                "rule": "manual",
                "swap_id": None,
                "steps": (*first.steps, step.move_number),
            }
        )
        moves[latest] = _Open(combined, target_was_empty, at)
        return StepOutcome(step, "splits_combined_move", first.move_number)
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
    return StepOutcome(step, "reverts_move", step.move_number)


class _CurrentLocations(Mapping[str, str | None]):
    """Each listed part's current location in `copy`, computed when first read (a fold
    that replays after every step reads only a few)."""

    def __init__(self, copy: PlanningCopy, parts: tuple[str, ...]) -> None:
        self._copy = copy
        self._parts = parts
        self._known = frozenset(parts)
        self._cache: dict[str, str | None] = {}

    def __getitem__(self, part: str) -> str | None:
        if part not in self._known:
            raise KeyError(part)
        if part not in self._cache:
            self._cache[part] = current_location(self._copy, part)
        return self._cache[part]

    def __iter__(self) -> Iterator[str]:
        return iter(self._parts)

    def __len__(self) -> int:
        return len(self._parts)


class StepFold:
    """`replay` as an incremental fold: `add` one step at a time, `replay()` the result.

    The one implementation behind `replay`; a multi-step command (apply all) adds each new
    step instead of replaying the whole log again. Mutable and private to its caller.
    """

    def __init__(self, data: ImportData, steps: Sequence[Step] = ()) -> None:
        self._data = data
        self._stock = _Stock(data.inventory)
        self._moves: list[_Open] = []
        self._count = 0
        self._last: StepOutcome | None = None
        for step in steps:
            self.add(step)

    def add(self, step: Step) -> None:
        """Fold the next step of the log."""
        target_was_empty = self._stock.quantity(step.part, step.to_location) == 0
        self._stock.move(step.part, step.from_location, step.to_location)
        self._last = _fold_move(self._moves, step, target_was_empty, self._count)
        self._count += 1

    def replay(self) -> Replay:
        """The replay of the steps added so far."""
        data = self._data
        copy = _copy_of(data, self._stock.inventory())
        parts = dict.fromkeys([*data.parts, *(line.part for line in data.inventory)])
        return Replay(
            copy=copy,
            moves=tuple(item.move for item in self._moves),
            current_locations=_CurrentLocations(copy, tuple(parts)),
            last=self._last,
        )


def replay(data: ImportData, steps: Sequence[Step]) -> Replay:
    """Replay `steps` on the import: the planning copy, the effective moves and each part's
    current location (AD-5, FR-33, FR-34, FR-36).

    Pure and total: steps are trusted (commands validate them). A step moves all of the
    part's stock at its from-location and adds it to the to-location. The import is never
    changed: new inventory lines are built.
    """
    return StepFold(data, steps).replay()


def run_baseline(data: ImportData, steps: Sequence[Step], k: int) -> Replay:
    """The run baseline of run `k` (AD-5): the replay of the steps with round < `k`, i.e.
    the planning copy as it was when run `k` was made."""
    return replay(data, [step for step in steps if step.round < k])


def planning_copy(data: ImportData, state: PlanState) -> PlanningCopy:
    """The plan as it is now: the import with the plan's steps replayed."""
    return replay(data, state.steps).copy


def current_round(state: PlanState) -> int:
    """The highest `round` among the plan's runs, 0 before the first run (never stored)."""
    return max((run.round for run in state.runs), default=0)


def latest_run(state: PlanState) -> Run | None:
    """The run with the highest round, or None before the first run."""
    return max(state.runs, key=lambda run: run.round, default=None)


def applied_step(state: PlanState, recommendation_id: str) -> Step | None:
    """The step that applied `recommendation_id`, or None (the one place "applied" is
    derived, AD-7)."""
    return next((s for s in state.steps if s.recommendation_id == recommendation_id), None)


def open_recommendations(state: PlanState) -> list[Recommendation]:
    """The latest run's recommendations with stored status `open` and no applied step, in
    stored order; empty before the first run. Kept parts are included (FR-30, AD-3)."""
    latest = latest_run(state)
    if latest is None:
        return []
    return [
        rec
        for rec in latest.recommendations
        if rec.status == "open" and applied_step(state, rec.id) is None
    ]


def _next_step(
    state: PlanState,
    *,
    part: str,
    from_location: str,
    to_location: str,
    rule: Rule,
    recommendation_id: str | None = None,
    swap_id: str | None = None,
) -> Step:
    """The step `append_step` would append: the current round, the next move number."""
    return Step(
        move_number=state.next_move_number,
        part=part,
        from_location=from_location,
        to_location=to_location,
        rule=rule,
        round=current_round(state),
        recommendation_id=recommendation_id,
        swap_id=swap_id,
    )


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
    step = _next_step(
        state,
        part=part,
        from_location=from_location,
        to_location=to_location,
        rule=rule,
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


def current_aisle(copy: PlanningCopy, part: str) -> str | None:
    """The aisle of the part's current location; None when no stock is above zero."""
    current = current_location(copy, part)
    return aisle_of(copy, current) if current is not None else None


def listed_parts(data: ImportData, analysis: Analysis) -> dict[str, PartAnalysis]:
    """The parts the views list: Inventory parts (in `data.parts` order) that have an
    analysis entry, with that entry."""
    return {part: analysis.parts[part] for part in data.parts if part in analysis.parts}


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


def fits_rule_target(
    rule: RecommendationRule, movement_class: MovementClass | None, to_best: bool
) -> bool:
    """Whether a to-location with best mark `to_best` fits the to-location side of `rule`
    for a part of `movement_class` (FR-24, FR-25, FR-26, FR-31): rule 1 needs a best
    location, rule 2 one that is not best, rule 3 one that is not best for a slow-moving or
    dead part (any for the others; the aisle side is checked by the caller)."""
    match rule:
        case "rule_1":
            return to_best
        case "rule_2":
            return not to_best
        case "rule_3":
            return not (to_best and movement_class in SLOW_MOVING_CLASSES)
        case _:
            assert_never(rule)


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


class NewMove(BaseModel):
    """The move is a new effective move to a location that holds none of the part."""

    kind: Literal["new"] = "new"


class AddsToStock(BaseModel):
    """The move is a new effective move; the target already holds the part (stock adds up)."""

    kind: Literal["adds_to_stock"] = "adds_to_stock"


class CombinesWith(BaseModel):
    """The move lands in effective move `move_number`, which keeps its number (FR-34)."""

    kind: Literal["combines_with"] = "combines_with"
    move_number: int


class RemovesMove(BaseModel):
    """The move returns the part to where move `move_number` took it from: that move is
    removed (FR-34)."""

    kind: Literal["removes_move"] = "removes_move"
    move_number: int


MoveEffect = Annotated[
    NewMove | AddsToStock | CombinesWith | RemovesMove, Field(discriminator="kind")
]
"""What a manual move does to the effective moves (AD-3)."""

ENTER_TO_LOCATION = "Enter a to-location."
IS_FROM_LOCATION = "This is the from-location. Choose another."


@dataclass(frozen=True)
class ManualMoveCheck:
    """Whether a manual move is allowed and what it does (FR-33, FR-34, AD-3).

    `copy` is the planning copy before the move. When allowed, `step` is the step to append,
    `move` the effective move holding it afterwards (None when the move removes one) and
    `removed` the effective move it removes (None otherwise).
    """

    copy: PlanningCopy
    refusal_message: str | None
    effect: MoveEffect | None
    step: Step | None = None
    move: EffectiveMove | None = None
    removed: EffectiveMove | None = None

    @property
    def allowed(self) -> bool:
        return self.refusal_message is None


def _refusal(
    data: ImportData, copy: PlanningCopy, part: str, from_location: str, to_location: str
) -> str | None:
    """The first rule a manual move breaks, as a final English sentence; None if allowed."""
    if not to_location.strip():
        return ENTER_TO_LOCATION
    if to_location == from_location:
        return IS_FROM_LOCATION
    if to_location in data.virtual_locations:
        return f"{to_location} is a virtual location, not a shelf."
    if to_location not in data.locations:
        return f"{to_location} is not in the Locations file."
    if stock_at(copy, part, from_location) <= 0:
        return f"{part} has no stock at {from_location}."
    return None


def check_manual_move(
    data: ImportData, state: PlanState, part: str, from_location: str, to_location: str
) -> ManualMoveCheck:
    """Check a manual move of all of `part`'s stock at `from_location` to `to_location`
    (FR-33, FR-34). The only implementation of the refusals and the effect: the command and
    the preview both call it. The effect comes from replaying the step log with and
    without the new step, so `replay` stays the only FR-34 fold (AD-5)."""
    before = replay(data, state.steps)
    refusal = _refusal(data, before.copy, part, from_location, to_location)
    if refusal is not None:
        return ManualMoveCheck(copy=before.copy, refusal_message=refusal, effect=None)
    step = _next_step(
        state, part=part, from_location=from_location, to_location=to_location, rule="manual"
    )
    after = replay(data, [*state.steps, step])
    after_numbers = {move.move_number for move in after.moves}
    removed = next((m for m in before.moves if m.move_number not in after_numbers), None)
    if removed is not None:
        return ManualMoveCheck(
            copy=before.copy,
            refusal_message=None,
            effect=RemovesMove(move_number=removed.move_number),
            step=step,
            removed=removed,
        )
    holding = next(m for m in after.moves if step.move_number in m.steps)
    effect: MoveEffect
    if holding.move_number != step.move_number:
        effect = CombinesWith(move_number=holding.move_number)
    elif stock_at(before.copy, part, to_location) > 0:
        effect = AddsToStock()
    else:
        effect = NewMove()
    return ManualMoveCheck(
        copy=before.copy, refusal_message=None, effect=effect, step=step, move=holding
    )
