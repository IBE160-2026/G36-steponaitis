"""Slice: keep-in-place mark commands (FR-32, AD-6).

A keep mark is a part number in `PlanState.keep_marks`. It is not a step: it never gets a
move number and never touches steps, runs or best marks. Whether a recommendation is kept
is worked out from the marks when a view is built (AD-7).
"""

from swp.domain.analysis import Analysis
from swp.domain.commands import (
    Applied,
    CommandContext,
    KeepRemoved,
    KeepSet,
    RemoveKeep,
    SetKeep,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import listed_parts
from swp.domain.state import PlanState


def set_keep(
    state: PlanState,
    command: SetKeep,
    _ctx: CommandContext,
    data: ImportData,
    analysis: Analysis,
) -> Applied:
    """Keep the part in place; a part that is already kept is a no-op. A part the plan does
    not list is rejected."""
    if command.part not in listed_parts(data, analysis):
        raise DomainError("command_rejected", f"No part {command.part} in this plan.")
    if command.part in state.keep_marks:
        return Applied(state=state)
    return Applied(
        state=state.model_copy(update={"keep_marks": [*state.keep_marks, command.part]}),
        events=[KeepSet(part=command.part)],
    )


def remove_keep(
    state: PlanState,
    command: RemoveKeep,
    _ctx: CommandContext,
    _data: ImportData,
    _analysis: Analysis,
) -> Applied:
    """Remove the part's keep mark; a part that is not kept is a no-op."""
    if command.part not in state.keep_marks:
        return Applied(state=state)
    marks = [part for part in state.keep_marks if part != command.part]
    return Applied(
        state=state.model_copy(update={"keep_marks": marks}),
        events=[KeepRemoved(part=command.part)],
    )
