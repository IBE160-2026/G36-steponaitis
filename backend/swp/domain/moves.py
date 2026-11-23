"""Slice: the manual move command (FR-33, FR-34, AD-6).

The refusals and the effect come from `planning.check_manual_move`, the same check the
move preview uses, so the command and the preview always agree (AD-3).
"""

from swp.domain.commands import Applied, CommandContext, ManualMove
from swp.domain.import_data import ImportData
from swp.domain.manual_steps import append_manual_step
from swp.domain.state import PlanState


def manual_move(
    state: PlanState, command: ManualMove, _ctx: CommandContext, data: ImportData
) -> Applied:
    """Append a manual step, or raise `command_rejected` with the check's sentence."""
    new_state, event = append_manual_step(
        data, state, command.part, command.from_location, command.to_location
    )
    return Applied(state=new_state, events=[event])
