"""Plan service: the only path that creates a plan (FR-1, FR-11, FR-18, AD-4)."""

import tomllib
import uuid
from datetime import date, datetime
from pathlib import Path

from pydantic import AwareDatetime, BaseModel

from swp.config import BACKEND_DIR
from swp.domain.analysis import AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.errors import DomainError
from swp.domain.import_data import NormalizedImport
from swp.domain.state import PlanState
from swp.domain.views.summary import PlanSummary, build_summary
from swp.store import plans as store
from swp.store.plans import PlanListItem, StoredImport, StoredPlan

ANALYSIS_SETTINGS_PATH = BACKEND_DIR / "settings" / "analysis.toml"
NAME_REQUIRED = "Give the plan a name."
PLAN_NOT_FOUND = "This plan does not exist."
DEFAULT_USER = "planner"  # M1 runs with auth off (FR-11); Epic 9 uses the logged-in user.


class CreatedPlan(BaseModel):
    """The response of POST /api/plans."""

    id: uuid.UUID
    name: str
    import_id: uuid.UUID
    data_as_of: date
    uploaded_at: AwareDatetime
    version: int


def load_analysis_settings(path: Path = ANALYSIS_SETTINGS_PATH) -> AnalysisSettings:
    """The analysis settings from `backend/settings/analysis.toml` (FR-18)."""
    with path.open("rb") as file:
        return AnalysisSettings.model_validate(tomllib.load(file))


def plan_name(name: str) -> str:
    """The trimmed plan name; raise `validation_failed` if it is blank."""
    trimmed = name.strip()
    if not trimmed:
        raise DomainError(
            "validation_failed", NAME_REQUIRED, [{"field": "name", "message": NAME_REQUIRED}]
        )
    return trimmed


def create(
    name: str,
    imported: NormalizedImport,
    *,
    now: datetime,
    user: str = DEFAULT_USER,
    settings: AnalysisSettings | None = None,
) -> StoredPlan:
    """Create and store a plan with its import in one transaction.

    The picks and class of every part are computed once here and stored (AD-4).
    """
    name = plan_name(name)
    settings = settings if settings is not None else load_analysis_settings()
    analysis = build_analysis(imported.data_as_of, settings)
    analysis = analysis.model_copy(update={"parts": classify_parts(imported.data, analysis)})
    stored_import = StoredImport(
        id=uuid.uuid4(), uploaded_at=now, data_as_of=imported.data_as_of, data=imported.data
    )
    plan = StoredPlan(
        id=uuid.uuid4(),
        name=name,
        import_id=stored_import.id,
        created_by=user,
        created_at=now,
        last_edited_by=user,
        last_edited_at=now,
        version=1,
        analysis=analysis,
        state=PlanState.new(),
        imported=stored_import,
    )
    store.insert_plan_with_import(plan)
    return plan


def created(plan: StoredPlan) -> CreatedPlan:
    return CreatedPlan(
        id=plan.id,
        name=plan.name,
        import_id=plan.import_id,
        data_as_of=plan.imported.data_as_of,
        uploaded_at=plan.imported.uploaded_at,
        version=plan.version,
    )


def get(plan_id: uuid.UUID) -> StoredPlan | None:
    """The stored plan with its import, or None."""
    return store.get_plan(plan_id)


def summary(plan_id: uuid.UUID) -> PlanSummary:
    """The plan summary (read-only, FR-9); raise `plan_not_found` for an unknown id."""
    plan = store.get_plan(plan_id)
    if plan is None:
        raise DomainError("plan_not_found", PLAN_NOT_FOUND)
    return build_summary(
        id=plan.id,
        name=plan.name,
        import_id=plan.import_id,
        data_as_of=plan.imported.data_as_of,
        uploaded_at=plan.imported.uploaded_at,
        created_by=plan.created_by,
        created_at=plan.created_at,
        last_edited_by=plan.last_edited_by,
        last_edited_at=plan.last_edited_at,
        version=plan.version,
        analysis=plan.analysis,
        state=plan.state,
        location_count=len(plan.imported.data.locations),
        part_count=len(plan.imported.data.parts),
    )


def list_saved() -> list[PlanListItem]:
    """The saved plans, most recently edited first (FR-8); reads columns only."""
    return store.list_plans()
