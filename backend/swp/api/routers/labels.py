"""Location labels: GET /api/imports/{import_id}/labels (FR-48, AD-3). Read-only.

An import never changes, so the response is cached immutably by the browser.
"""

from fastapi import APIRouter, Response

from swp.api.errors import error_responses
from swp.api.routers.layout import IMMUTABLE
from swp.app import labels as service
from swp.app.plans import parse_import_id
from swp.domain.labels import LabelsView

router = APIRouter()


@router.get("/imports/{import_id}/labels", responses=error_responses(404, 422))
def get_import_labels(import_id: str, response: Response) -> LabelsView:
    # A string, not uuid.UUID: an id that is no UUID names no import, so it is `not_found`.
    view = service.labels(parse_import_id(import_id))
    response.headers["Cache-Control"] = IMMUTABLE
    return view
