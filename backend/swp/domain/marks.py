"""Slice: best-location mark commands (FR-21, AD-4). Marks are named by value."""

from typing import assert_never

from swp.domain.commands import (
    Applied,
    CommandContext,
    MarkRemoved,
    MarkSet,
    RemoveBestMark,
    SetBestMark,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import mark_covers
from swp.domain.state import BestMark, PlanState


def _covers_nothing(mark: BestMark) -> str:
    """The `validation_failed` message for a mark that covers no location of the import."""
    match mark.kind:
        case "aisle":
            return f"Aisle {mark.aisle} has no locations."
        case "level" if mark.aisle is None:
            return f"No aisle has level {mark.level}."
        case "level":
            return f"Aisle {mark.aisle} has no level {mark.level}."
        case "location":
            return f"Location {mark.location} does not exist."
        case _:
            assert_never(mark)


def set_best_mark(
    state: PlanState, command: SetBestMark, _ctx: CommandContext, data: ImportData
) -> Applied:
    """Add the mark; a mark that already exists is a no-op. A mark that covers no location
    of the import is rejected with `validation_failed` (FR-21)."""
    if command.mark in state.best_marks:
        return Applied(state=state)
    if not any(mark_covers(command.mark, code, loc) for code, loc in data.locations.items()):
        raise DomainError("validation_failed", _covers_nothing(command.mark))
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
