"""Wall view: GET /api/plans/{id}/wall?aisle= (FR-42, AD-3, AD-15). Read-only (FR-9)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from swp.api.errors import error_responses
from swp.app import wall as service
from swp.domain.views.wall import WallView

router = APIRouter()


@router.get("/plans/{plan_id}/wall", responses=error_responses(404, 422))
def get_plan_wall(
    plan_id: uuid.UUID, aisle: Annotated[str, Query(min_length=1, max_length=64)]
) -> WallView:
    return service.wall(plan_id, aisle)
