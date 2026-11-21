"""POST /api/plans: create a plan from the three exports (FR-1, FR-3 to FR-7, FR-18)."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from swp.api.errors import error_responses
from swp.app import plans
from swp.app.imports import UploadedFile, read_import
from swp.domain.import_ import FileRole

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
