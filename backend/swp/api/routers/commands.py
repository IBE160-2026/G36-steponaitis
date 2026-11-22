"""The command endpoint: every plan change goes through here (AD-6, FR-10).

JSON body only; cross-site POSTs are rejected by the origin guard (AD-19).
"""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app.commands import run_command
from swp.domain.commands import Command, CommandResult

router = APIRouter()


@router.post("/plans/{plan_id}/commands", responses=error_responses(403, 404, 422, 500))
def post_command(plan_id: uuid.UUID, command: Command) -> CommandResult:
    return run_command(plan_id, command)
