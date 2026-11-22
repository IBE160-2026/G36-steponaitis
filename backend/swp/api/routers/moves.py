"""Manual move preview: GET /api/plans/{id}/moves/preview (FR-33, AD-3). Read-only (FR-9);
the move itself is the `manual_move` command."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from swp.api.errors import error_responses
from swp.app import moves as service
from swp.domain.views.move_preview import MovePreview

router = APIRouter()


@router.get("/plans/{plan_id}/moves/preview", responses=error_responses(404, 422))
def get_move_preview(
    plan_id: uuid.UUID,
    part: str,
    from_location: Annotated[str, Query(alias="from")],
    to_location: Annotated[str, Query(alias="to")],
) -> MovePreview:
    return service.preview(plan_id, part, from_location, to_location)
