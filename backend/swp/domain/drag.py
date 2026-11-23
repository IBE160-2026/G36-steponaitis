"""Slice: the drag commands `move_parts`, `put_together` and `swap` (FR-51, AD-16).

A drop on the wall is one command. It is checked whole against the plan as it is, then
expanded into ordinary manual steps through `manual_steps.append_manual_step`, the same
check and FR-34 fold the manual move uses, so a swap is never saved as half its moves.
"""

import uuid
from collections.abc import Sequence

from swp.domain.commands import (
    Applied,
    CommandContext,
    Event,
    MoveMade,
    MoveParts,
    PutTogether,
    Swap,
    SwapMade,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.manual_steps import append_manual_step
from swp.domain.planning import (
    IS_FROM_LOCATION,
    PlanningCopy,
    current_round,
    is_empty,
    planning_copy,
    stock_at,
)
from swp.domain.state import PlanState

NO_PART = "Choose at least one part to move."
NO_BACK_PART = "Choose at least one part to move back."


def _code_refusal(data: ImportData, code: str) -> str | None:
    """A from- or to-location that is not a shelf, in the order of the manual move check."""
    if code in data.virtual_locations:
        return f"{code} is a virtual location, not a shelf."
    if code not in data.locations:
        return f"{code} is not in the Locations file."
    return None


def _twice(parts: Sequence[str]) -> str | None:
    seen: set[str] = set()
    for part in parts:
        if part in seen:
            return part
        seen.add(part)
    return None


def _refusal(
    data: ImportData,
    copy: PlanningCopy,
    from_location: str,
    to_location: str,
    parts: Sequence[str],
    back_parts: Sequence[str] | None,
) -> str | None:
    """The first rule the drag breaks, as a final English sentence; None if allowed.
    `back_parts` is None for a command that moves nothing back."""
    if not parts:
        return NO_PART
    if back_parts is not None and not back_parts:
        return NO_BACK_PART
    if from_location == to_location:
        return IS_FROM_LOCATION
    for code in (from_location, to_location):
        refusal = _code_refusal(data, code)
        if refusal is not None:
            return refusal
    back = back_parts or ()
    for listed in (parts, back):
        twice = _twice(listed)
        if twice is not None:
            return f"{twice} is chosen twice."
    back_set = set(back)
    both = next((part for part in parts if part in back_set), None)
    if both is not None:
        return f"{both} cannot move both ways."
    for listed, location in ((parts, from_location), (back, to_location)):
        for part in listed:
            if stock_at(copy, part, location) <= 0:
                return f"{part} has no stock at {location}."
    return None


def _check(
    data: ImportData,
    state: PlanState,
    from_location: str,
    to_location: str,
    parts: Sequence[str],
    back_parts: Sequence[str] | None = None,
) -> PlanningCopy:
    """Raise `command_rejected` when the drag breaks a rule; return the planning copy."""
    copy = planning_copy(data, state)
    refusal = _refusal(data, copy, from_location, to_location, parts, back_parts)
    if refusal is not None:
        raise DomainError("command_rejected", refusal)
    return copy


def _expand(
    data: ImportData,
    state: PlanState,
    moves: Sequence[tuple[str, str, str]],
    swap_id: str | None = None,
) -> tuple[PlanState, list[Event]]:
    """Append one manual step per (part, from, to) in order, folding on the new state. With
    a `swap_id` every step also carries the swap's size, `len(moves)`."""
    swap_size = len(moves) if swap_id is not None else None
    events: list[Event] = []
    for part, from_location, to_location in moves:
        state, event = append_manual_step(
            data, state, part, from_location, to_location, swap_id=swap_id, swap_size=swap_size
        )
        events.append(event)
    return state, events


def move_parts(
    state: PlanState, command: MoveParts, _ctx: CommandContext, data: ImportData
) -> Applied:
    """Move each chosen part to an empty location as one manual step, in listed order."""
    frm, to = command.from_location, command.to_location
    copy = _check(data, state, frm, to, command.parts)
    if not is_empty(copy, to):
        raise DomainError("command_rejected", f"{to} is occupied. Choose Swap or Put together.")
    new_state, events = _expand(data, state, [(part, frm, to) for part in command.parts])
    return Applied(state=new_state, events=events)


def put_together(
    state: PlanState, command: PutTogether, _ctx: CommandContext, data: ImportData
) -> Applied:
    """Move each chosen part into an occupied location as one manual step, in listed order."""
    frm, to = command.from_location, command.to_location
    copy = _check(data, state, frm, to, command.parts)
    if is_empty(copy, to):
        raise DomainError("command_rejected", f"{to} is empty. Move the parts there instead.")
    new_state, events = _expand(data, state, [(part, frm, to) for part in command.parts])
    return Applied(state=new_state, events=events)


def swap(state: PlanState, command: Swap, _ctx: CommandContext, data: ImportData) -> Applied:
    """Move the chosen parts from → to, then the back-parts to → from, as manual steps
    sharing one swap id; `swap_made` comes before the per-step events and lists only the
    steps that stand as their own move (`move_made`), not those FR-34 folded."""
    frm, to = command.from_location, command.to_location
    _check(data, state, frm, to, command.parts, command.back_parts)
    swap_id = str(uuid.uuid5(command.command_id, "swap:1"))
    steps = [
        *((part, frm, to) for part in command.parts),
        *((part, to, frm) for part in command.back_parts),
    ]
    new_state, events = _expand(data, state, steps, swap_id)
    made = SwapMade(
        swap_id=swap_id,
        from_location=frm,
        to_location=to,
        move_numbers=[e.move_number for e in events if isinstance(e, MoveMade)],
        round=current_round(state),
    )
    return Applied(state=new_state, events=[made, *events])
