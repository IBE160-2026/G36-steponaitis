"""Parts roster: GET /api/plans/{id}/parts (FR-13). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import parts as service
from swp.domain.views.parts import PartsView

router = APIRouter()


@router.get("/plans/{plan_id}/parts", responses=error_responses(404, 422))
def get_plan_parts(plan_id: uuid.UUID) -> PartsView:
    return service.parts(plan_id)
