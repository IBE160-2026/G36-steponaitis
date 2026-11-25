"""Wall layout: GET /api/imports/{import_id}/layout (FR-42, AD-3, AD-15). Read-only.

An import never changes, so the response is cached immutably by the browser.
"""

from fastapi import APIRouter, Response

from swp.api.caching import IMMUTABLE
from swp.api.errors import error_responses
from swp.app import layout as service
from swp.app.plans import parse_import_id
from swp.domain.layout import LayoutView

router = APIRouter()


@router.get("/imports/{import_id}/layout", responses=error_responses(404, 422))
def get_import_layout(import_id: str, response: Response) -> LayoutView:
    # A string, not uuid.UUID: an id that is no UUID names no import, so it is `not_found`
    # (404) like an unknown one (epic-1 retro item 4).
    view = service.layout(parse_import_id(import_id))
    response.headers["Cache-Control"] = IMMUTABLE
    return view
