"""Move list: GET /api/plans/{id}/move-list (FR-38). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import move_list as service
from swp.domain.move_list import MoveListView

router = APIRouter()


@router.get("/plans/{plan_id}/move-list", responses=error_responses(404, 422))
def get_plan_move_list(plan_id: uuid.UUID) -> MoveListView:
    return service.move_list(plan_id)
