"""Plan service: the only path that creates a plan (FR-1, FR-11, FR-18, AD-4)."""

import tomllib
import uuid
from datetime import date, datetime
from pathlib import Path

from pydantic import AwareDatetime, BaseModel

from swp.config import BACKEND_DIR
from swp.domain.analysis import Analysis, AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData, NormalizedImport
from swp.domain.pick_groups import find_pick_groups
from swp.domain.planning import replay
from swp.domain.state import PlanState
from swp.domain.views.summary import PlanSummary, build_summary
from swp.store import plans as store
from swp.store.plans import PlanBusy, PlanListItem, StoredImport, StoredPlan

ANALYSIS_SETTINGS_PATH = BACKEND_DIR / "settings" / "analysis.toml"
NAME_REQUIRED = "Give the plan a name."
PLAN_NOT_FOUND = "This plan does not exist."
IMPORT_NOT_FOUND = "This import no longer exists. Choose another saved plan."
IMPORT_BUSY = "The plan is busy. Try again."
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

    The picks and class of every part and every pick group are computed once here and
    stored (AD-4).
    """
    name = plan_name(name)
    analysis = _analysis(imported.data, imported.data_as_of, settings)
    stored_import = StoredImport(
        id=uuid.uuid4(), uploaded_at=now, data_as_of=imported.data_as_of, data=imported.data
    )
    plan = _new_plan(name, stored_import, analysis, now=now, user=user)
    store.insert_plan_with_import(plan)
    return plan


def create_from_import(
    name: str,
    import_id: uuid.UUID,
    *,
    now: datetime,
    user: str = DEFAULT_USER,
    settings: AnalysisSettings | None = None,
) -> StoredPlan:
    """Create and store a new plan on an existing import (FR-2).

    The analysis is recomputed with the current settings; no other plan's analysis or state
    is read. The import never changes (AD-4), so the analysis is computed from a plain read;
    only the insert runs under the import row lock, which re-checks that the import exists.
    """
    name = plan_name(name)
    stored_import = store.get_import(import_id)
    if stored_import is None:
        raise DomainError("not_found", IMPORT_NOT_FOUND)
    analysis = _analysis(stored_import.data, stored_import.data_as_of, settings)
    plan = _new_plan(name, stored_import, analysis, now=now, user=user)
    try:
        inserted = store.insert_plan_on_import(plan)
    except PlanBusy as error:
        raise DomainError("unavailable", IMPORT_BUSY) from error
    if not inserted:
        raise DomainError("not_found", IMPORT_NOT_FOUND)
    return plan


def parse_import_id(raw: str) -> uuid.UUID:
    """The `import_id` form value; raise `not_found` when it is not a UUID (no import has it)."""
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise DomainError("not_found", IMPORT_NOT_FOUND) from None


def _analysis(data: ImportData, data_as_of: date, settings: AnalysisSettings | None) -> Analysis:
    """The picks and class of every part and every pick group, computed once (AD-4, FR-18)."""
    settings = settings if settings is not None else load_analysis_settings()
    analysis = build_analysis(data_as_of, settings)
    return analysis.model_copy(
        update={
            "parts": classify_parts(data, analysis),
            "pick_groups": find_pick_groups(data, analysis),
        }
    )


def _new_plan(
    name: str, imported: StoredImport, analysis: Analysis, *, now: datetime, user: str
) -> StoredPlan:
    """A fresh plan on `imported`: empty state, round 0, version 1."""
    return StoredPlan(
        id=uuid.uuid4(),
        name=name,
        import_id=imported.id,
        created_by=user,
        created_at=now,
        last_edited_by=user,
        last_edited_at=now,
        version=1,
        analysis=analysis,
        state=PlanState.new(),
        imported=imported,
    )


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


def parse_plan_id(raw: str) -> uuid.UUID:
    """The plan id in a URL; raise `plan_not_found` when it is not a UUID (no plan has it)."""
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise DomainError("plan_not_found", PLAN_NOT_FOUND) from None


def require(plan_id: uuid.UUID) -> StoredPlan:
    """The stored plan with its import; raise `plan_not_found` for an unknown id."""
    plan = store.get_plan(plan_id)
    if plan is None:
        raise DomainError("plan_not_found", PLAN_NOT_FOUND)
    return plan


def summary(plan_id: uuid.UUID) -> PlanSummary:
    """The plan summary (read-only, FR-9); raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    replayed = replay(plan.imported.data, plan.state.steps)
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
        copy=replayed.copy,
        last_step=replayed.last,
        location_count=len(plan.imported.data.locations),
        part_count=len(plan.imported.data.parts),
    )


def delete(plan_id: uuid.UUID) -> None:
    """Delete the plan permanently, and its import with its last plan (FR-12).

    Raise `plan_not_found` for an unknown id and `unavailable` while the import is locked.
    """
    try:
        deleted = store.delete_plan(plan_id)
    except PlanBusy as error:
        raise DomainError("unavailable", IMPORT_BUSY) from error
    if not deleted:
        raise DomainError("plan_not_found", PLAN_NOT_FOUND)


def list_saved() -> list[PlanListItem]:
    """The saved plans, most recently edited first (FR-8); reads columns only."""
    return store.list_plans()
