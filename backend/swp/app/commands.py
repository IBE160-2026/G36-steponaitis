"""Command service: the one write path for plan changes (AD-6, FR-10, FR-11).

Reads the plan in a write transaction, applies the command in the domain and saves it with
a conditional update on the version read. A repeated `command_id` returns its stored result,
a no-op writes nothing, and a lost race is re-read and re-applied up to 3 times. The import
and the analysis are read once before the lock (neither ever changes); a busy database
answers `unavailable` at once and the client retries (AD-12).
"""

import uuid
from datetime import UTC, datetime

from swp.app.plans import DEFAULT_USER, PLAN_NOT_FOUND
from swp.domain.apply import apply
from swp.domain.commands import Command, CommandContext, CommandResult
from swp.domain.errors import DomainError
from swp.domain.recommendations import revalidate
from swp.domain.state import PlanState
from swp.store.plans import PlanBusy, PlanInputs, get_plan_inputs, plan_for_update

MAX_ATTEMPTS = 4  # the first attempt and 3 retries
RECENT_COMMANDS = 50
NOT_SAVED = "The change was not saved. Try again."
PLAN_BUSY = "The plan is busy. Try again."


def _stored_result(state: PlanState, command_id: uuid.UUID) -> CommandResult | None:
    key = str(command_id)
    for entry in state.recent_commands:
        if entry.get("command_id") == key:
            return CommandResult.model_validate(entry["result"])
    return None


def run_command(
    plan_id: uuid.UUID, command: Command, *, now: datetime | None = None, user: str = DEFAULT_USER
) -> CommandResult:
    """Apply `command` to the plan once and return `{version, events}`."""
    ctx = CommandContext(now=now if now is not None else datetime.now(UTC), user=user)
    inputs = get_plan_inputs(plan_id)
    if inputs is None:
        raise DomainError("plan_not_found", PLAN_NOT_FOUND)
    try:
        return _run(plan_id, command, ctx, inputs)
    except PlanBusy as error:
        raise DomainError("unavailable", PLAN_BUSY) from error


def _run(
    plan_id: uuid.UUID, command: Command, ctx: CommandContext, inputs: PlanInputs
) -> CommandResult:
    for _attempt in range(MAX_ATTEMPTS):
        with plan_for_update(plan_id) as writer:
            if writer is None:
                raise DomainError("plan_not_found", PLAN_NOT_FOUND)
            plan = writer.plan
            stored = _stored_result(plan.state, command.command_id)
            if stored is not None:
                return stored
            applied = apply(plan.state, command, ctx, inputs.data, inputs.analysis)
            if not applied.events:
                return CommandResult(version=plan.version, events=[])
            revalidated = revalidate(inputs.data, inputs.analysis, applied.state)
            events = [*applied.events, *revalidated.events]
            result = CommandResult(version=plan.version + 1, events=events)
            entry: dict[str, object] = {
                "command_id": str(command.command_id),
                "base_version": command.base_version,
                "result": result.model_dump(mode="json"),
            }
            recent = [*revalidated.state.recent_commands, entry][-RECENT_COMMANDS:]
            state = revalidated.state.model_copy(update={"recent_commands": recent})
            if writer.save_state(state, last_edited_by=ctx.user, last_edited_at=ctx.now):
                return result
    raise DomainError("internal", NOT_SAVED)
