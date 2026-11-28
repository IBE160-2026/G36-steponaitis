"""Location labels: GET /api/plans/{plan_id}/labels (FR-48, AD-3). Read-only (FR-9).

Plan-scoped: the labels follow the plan's stock, so the response is never cached immutably.
"""

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import labels as service
from swp.app.plans import parse_plan_id
from swp.domain.labels import LabelsView

router = APIRouter()


@router.get("/plans/{plan_id}/labels", responses=error_responses(404, 422))
def get_plan_labels(plan_id: str) -> LabelsView:
    # A string, not uuid.UUID: an id that is no UUID names no plan, so it is `plan_not_found`
    # (404) like an unknown one, as the plan summary answers.
    return service.labels(parse_plan_id(plan_id))
