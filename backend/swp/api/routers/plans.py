"""Plans: create from the three exports, list and summary (FR-1, FR-3 to FR-9, FR-18).

The GETs only read: they never change `version` or `last_edited_*` (FR-9).
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from swp.api.errors import error_responses
from swp.api.schemas.plans import SavedPlanRow
from swp.app import plans
from swp.app.imports import UploadedFile, read_import
from swp.domain.import_ import FileRole
from swp.domain.views.summary import PlanSummary

router = APIRouter()


def _uploaded(file: UploadFile) -> UploadedFile:
    return UploadedFile(file_name=file.filename or "", data=file.file.read())


@router.post(
    "/plans",
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(403, 413, 422),
)
def create_plan(
    locations: Annotated[UploadFile, File()],
    inventory: Annotated[UploadFile, File()],
    transactions: Annotated[UploadFile, File()],
    # An empty form value counts as missing in FastAPI; default "" so plan_name rejects it.
    name: Annotated[str, Form()] = "",
) -> plans.CreatedPlan:
    plan_name = plans.plan_name(name)
    files: dict[FileRole, UploadedFile] = {
        "locations": _uploaded(locations),
        "inventory": _uploaded(inventory),
        "transactions": _uploaded(transactions),
    }
    imported = read_import(files)
    return plans.created(plans.create(plan_name, imported, now=datetime.now(UTC)))


@router.get("/plans")
def list_plans() -> list[SavedPlanRow]:
    return [
        SavedPlanRow(
            id=item.id,
            name=item.name,
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
def get_plan_summary(plan_id: uuid.UUID) -> PlanSummary:
    return plans.summary(plan_id)
