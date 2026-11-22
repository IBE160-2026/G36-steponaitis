"""The single `domain.apply`: dispatch a command to its slice handler (AD-6).

Pure: returns a new state and its events and never mutates the input state.
"""

from typing import assert_never

from swp.domain import marks
from swp.domain.commands import Applied, Command, CommandContext, RemoveBestMark, SetBestMark
from swp.domain.planning import current_round
from swp.domain.state import PlanState


def check_step_invariants(before: PlanState, after: PlanState) -> None:
    """Raise AssertionError if a command added a step outside the AD-5 invariants.

    Steps appended to `before.steps` must be in the current round of `after`, have
    increasing move numbers from `before.next_move_number` on, and `after.next_move_number`
    must be above the last of them. A programming error, never a DomainError. When
    `before.steps` is not a prefix of `after.steps` (undo, reset) nothing was appended.
    """
    count = len(before.steps)
    if after.steps[:count] != before.steps:
        return
    added = after.steps[count:]
    if not added:
        return
    round_now = current_round(after)
    floor = before.next_move_number
    for step in added:
        if step.round != round_now:
            raise AssertionError(
                f"Step {step.move_number} is in round {step.round}, not the current {round_now}."
            )
        if step.move_number < floor:
            raise AssertionError(f"Step move number {step.move_number} is below {floor}.")
        floor = step.move_number + 1
    if after.next_move_number < floor:
        raise AssertionError(
            f"next_move_number {after.next_move_number} is not above move {floor - 1}."
        )


def apply(state: PlanState, command: Command, ctx: CommandContext) -> Applied:
    applied = _dispatch(state, command, ctx)
    check_step_invariants(state, applied.state)
    return applied


def _dispatch(state: PlanState, command: Command, ctx: CommandContext) -> Applied:
    match command:
        case SetBestMark():
            return marks.set_best_mark(state, command, ctx)
        case RemoveBestMark():
            return marks.remove_best_mark(state, command, ctx)
        case _:
            assert_never(command)
