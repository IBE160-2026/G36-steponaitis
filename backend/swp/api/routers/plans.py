"""Plans: create from the three exports or a saved import, list, summary and delete
(FR-1 to FR-9, FR-12, FR-18).

The GETs only read: they never change `version` or `last_edited_*` (FR-9).
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status

from swp.api.errors import INVALID_REQUEST, error_responses
from swp.api.schemas.plans import SavedPlanRow
from swp.api.session_guard import current_user
from swp.app import plans
from swp.app.imports import UploadedFile, read_import
from swp.domain.errors import DomainError
from swp.domain.import_ import FileRole
from swp.domain.views.summary import PlanSummary

router = APIRouter()


FILE_ROLES: tuple[FileRole, ...] = ("locations", "inventory", "transactions")
FIELD_REQUIRED = "Field required"
FILES_WITH_IMPORT = "Send either an import_id or the three files, not both."


def _uploaded(file: UploadFile) -> UploadedFile:
    return UploadedFile(file_name=file.filename or "", data=file.file.read())


def _validation_failed(details: list[dict[str, object]]) -> DomainError:
    """The same envelope as a FastAPI request validation error (AD-11)."""
    message = str(details[0]["message"]) if len(details) == 1 else INVALID_REQUEST
    return DomainError("validation_failed", message, details)


@router.post(
    "/plans",
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(403, 404, 409, 413, 422, 503),
)
def create_plan(
    # The router guard's dependency again: cached per request, so the user loads once (FR-11).
    user: Annotated[str, Depends(current_user)],
    # Optional so a reuse (`import_id`, FR-2) needs no files; a missing file is still
    # `validation_failed` with the same details FastAPI gave before.
    locations: Annotated[UploadFile | None, File()] = None,
    inventory: Annotated[UploadFile | None, File()] = None,
    transactions: Annotated[UploadFile | None, File()] = None,
    # An empty form value counts as missing in FastAPI; default "" so plan_name rejects it.
    name: Annotated[str, Form()] = "",
    import_id: Annotated[str | None, Form()] = None,
) -> plans.CreatedPlan:
    # The demo plan limit first, before any name, file or import check reads anything (AD-18).
    plans.ensure_plan_room()
    uploads = {"locations": locations, "inventory": inventory, "transactions": transactions}
    now = datetime.now(UTC)
    if import_id is not None:
        plan_name = plans.plan_name(name)
        if any(upload is not None for upload in uploads.values()):
            raise _validation_failed([{"field": "import_id", "message": FILES_WITH_IMPORT}])
        reused = plans.create_from_import(
            plan_name, plans.parse_import_id(import_id), now=now, user=user
        )
        return plans.created(reused)
    missing = [role for role in FILE_ROLES if uploads[role] is None]
    if missing:
        raise _validation_failed([{"field": role, "message": FIELD_REQUIRED} for role in missing])
    # After the file check: FastAPI reported missing files first, so the envelope is unchanged.
    plan_name = plans.plan_name(name)
    files: dict[FileRole, UploadedFile] = {}
    for role in FILE_ROLES:
        upload = uploads[role]
        assert upload is not None
        files[role] = _uploaded(upload)
    imported = read_import(files)
    return plans.created(plans.create(plan_name, imported, now=now, user=user))


@router.get("/plans")
def list_plans() -> list[SavedPlanRow]:
    return [
        SavedPlanRow(
            id=item.id,
            name=item.name,
            import_id=item.import_id,
            data_as_of=item.data_as_of,
            uploaded_at=item.uploaded_at,
            created_by=item.created_by,
            created_at=item.created_at,
            last_edited_by=item.last_edited_by,
            last_edited_at=item.last_edited_at,
        )
        for item in plans.list_saved()
    ]


@router.get("/plans/{plan_id}", responses=error_responses(404, 422))
def get_plan_summary(plan_id: str) -> PlanSummary:
    # A string, not uuid.UUID: an id that is no UUID names no plan, so it is `plan_not_found`
    # (404) like an unknown one, not `validation_failed` (epic-1 retro item 4).
    return plans.summary(plans.parse_plan_id(plan_id))


@router.delete(
    "/plans/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=error_responses(403, 404, 422, 503),
)
def delete_plan(plan_id: str) -> Response:
    # A string id like the GET: an id that is no UUID is `plan_not_found` (404).
    plans.delete(plans.parse_plan_id(plan_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
