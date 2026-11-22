"""Slice: best-location mark commands (FR-21, AD-4). Marks are named by value."""

from swp.domain.commands import (
    Applied,
    CommandContext,
    MarkRemoved,
    MarkSet,
    RemoveBestMark,
    SetBestMark,
)
from swp.domain.state import PlanState


def set_best_mark(state: PlanState, command: SetBestMark, _ctx: CommandContext) -> Applied:
    """Add the mark; a mark that already exists is a no-op."""
    if command.mark in state.best_marks:
        return Applied(state=state)
    marks = [*state.best_marks, command.mark]
    return Applied(
        state=state.model_copy(update={"best_marks": marks}),
        events=[MarkSet(mark=command.mark)],
    )


def remove_best_mark(state: PlanState, command: RemoveBestMark, _ctx: CommandContext) -> Applied:
    """Remove the mark; a mark that does not exist is a no-op."""
    if command.mark not in state.best_marks:
        return Applied(state=state)
    marks = [mark for mark in state.best_marks if mark != command.mark]
    return Applied(
        state=state.model_copy(update={"best_marks": marks}),
        events=[MarkRemoved(mark=command.mark)],
    )
