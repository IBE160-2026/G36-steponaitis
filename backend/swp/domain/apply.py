"""The single `domain.apply`: dispatch a command to its slice handler (AD-6).

Pure: returns a new state and its events and never mutates the input state.
"""

from typing import assert_never

from swp.domain import marks
from swp.domain.commands import Applied, Command, CommandContext, RemoveBestMark, SetBestMark
from swp.domain.state import PlanState


def apply(state: PlanState, command: Command, ctx: CommandContext) -> Applied:
    match command:
        case SetBestMark():
            return marks.set_best_mark(state, command, ctx)
        case RemoveBestMark():
            return marks.remove_best_mark(state, command, ctx)
        case _:
            assert_never(command)
