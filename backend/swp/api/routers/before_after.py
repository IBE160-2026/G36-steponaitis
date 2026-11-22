"""Before/after: GET /api/plans/{id}/before-after (FR-37). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import before_after as service
from swp.domain.before_after import BeforeAfterView

router = APIRouter()


@router.get("/plans/{plan_id}/before-after", responses=error_responses(404, 422))
def get_plan_before_after(plan_id: uuid.UUID) -> BeforeAfterView:
    return service.before_after(plan_id)
