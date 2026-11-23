"""Kernel: append one checked manual step and its event (FR-33, FR-34, AD-6).

The manual move command and the drag commands both turn a manual step into a new state and
one event here, through `planning.check_manual_move`, so they refuse and combine alike.
"""

from swp.domain.commands import Event, MoveMade, MoveRemoved, MovesCombined
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import CombinesWith, RemovesMove, append_step, check_manual_move
from swp.domain.state import PlanState


def append_manual_step(
    data: ImportData,
    state: PlanState,
    part: str,
    from_location: str,
    to_location: str,
    *,
    swap_id: str | None = None,
) -> tuple[PlanState, Event]:
    """Append a manual step moving all of `part`'s stock at `from_location` to `to_location`
    and return the new state and its event (`move_made`, `moves_combined` or
    `move_removed`), or raise `command_rejected` with the check's sentence."""
    check = check_manual_move(data, state, part, from_location, to_location)
    if check.refusal_message is not None:
        raise DomainError("command_rejected", check.refusal_message)
    step = check.step
    assert step is not None
    new_state = append_step(
        state,
        part=step.part,
        from_location=step.from_location,
        to_location=step.to_location,
        rule="manual",
        swap_id=swap_id,
    )
    event: Event
    match check.effect:
        case RemovesMove():
            assert check.removed is not None
            event = MoveRemoved(
                move_number=check.removed.move_number,
                part=step.part,
                location=step.to_location,
                round=step.round,
                step_move_number=step.move_number,
            )
        case CombinesWith():
            assert check.move is not None
            event = MovesCombined(
                move_number=check.move.move_number,
                part=step.part,
                from_location=check.move.from_location,
                to_location=check.move.to_location,
                round=step.round,
                step_move_number=step.move_number,
            )
        case _:
            event = MoveMade(
                move_number=step.move_number,
                part=step.part,
                from_location=step.from_location,
                to_location=step.to_location,
                rule=step.rule,
                round=step.round,
            )
    return new_state, event
