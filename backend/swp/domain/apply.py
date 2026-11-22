"""The single `domain.apply`: dispatch a command to its slice handler (AD-6).

Pure: returns a new state and its events and never mutates the input state.
"""

from typing import assert_never

from swp.domain import marks, moves, rules
from swp.domain.analysis import Analysis
from swp.domain.commands import (
    Applied,
    Command,
    CommandContext,
    ManualMove,
    RemoveBestMark,
    RunRecommendations,
    SetBestMark,
)
from swp.domain.import_data import ImportData
from swp.domain.planning import current_round
from swp.domain.state import PlanState


def _is_reset(after: PlanState) -> bool:
    """The reset shape (AD-5): no steps and move numbering restarted at 1."""
    return not after.steps and after.next_move_number == 1


def check_step_invariants(before: PlanState, after: PlanState) -> None:
    """Raise AssertionError if a command broke the AD-5 invariants.

    `next_move_number` never decreases, except to the reset shape (no steps, 1). Steps in
    `after` whose move number is not in `before` are new: they must be in the current round
    of `after`, have increasing move numbers from `before.next_move_number` on, and lie below
    `after.next_move_number`. This holds even when `before.steps` is not a prefix of
    `after.steps` (a rewritten log). Move numbers in `after` are unique (never reused). A
    programming error, never a DomainError.
    """
    if _is_reset(after):
        return
    if after.next_move_number < before.next_move_number:
        raise AssertionError(
            f"next_move_number decreased from {before.next_move_number} "
            f"to {after.next_move_number}."
        )
    seen: set[int] = set()
    for step in after.steps:
        if step.move_number in seen:
            raise AssertionError(f"Move number {step.move_number} is used by more than one step.")
        seen.add(step.move_number)
    known = {step.move_number for step in before.steps}
    added = [step for step in after.steps if step.move_number not in known]
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


def apply(
    state: PlanState, command: Command, ctx: CommandContext, data: ImportData, analysis: Analysis
) -> Applied:
    """Apply `command` to `state`; `data` and `analysis` are the plan's import and analysis
    (read-only)."""
    applied = _dispatch(state, command, ctx, data, analysis)
    check_step_invariants(state, applied.state)
    return applied


def _dispatch(
    state: PlanState, command: Command, ctx: CommandContext, data: ImportData, analysis: Analysis
) -> Applied:
    match command:
        case SetBestMark():
            return marks.set_best_mark(state, command, ctx)
        case RemoveBestMark():
            return marks.remove_best_mark(state, command, ctx)
        case ManualMove():
            return moves.manual_move(state, command, ctx, data)
        case RunRecommendations():
            return rules.run(state, command, ctx, data, analysis)
        case _:
            assert_never(command)
