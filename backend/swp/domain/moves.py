"""Slice: the manual move command (FR-33, FR-34, AD-6).

The refusals and the effect come from `planning.check_manual_move`, the same check the
move preview uses, so the command and the preview always agree (AD-3).
"""

from swp.domain.commands import (
    Applied,
    CommandContext,
    Event,
    ManualMove,
    MoveMade,
    MoveRemoved,
    MovesCombined,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import CombinesWith, RemovesMove, append_step, check_manual_move
from swp.domain.state import PlanState


def manual_move(
    state: PlanState, command: ManualMove, _ctx: CommandContext, data: ImportData
) -> Applied:
    """Append a manual step, or raise `command_rejected` with the check's sentence."""
    check = check_manual_move(data, state, command.part, command.from_location, command.to_location)
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
    return Applied(state=new_state, events=[event])
