"""Plan persistence: an import and its plan are saved in one transaction (AD-4, AD-9)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import select

from swp.domain.analysis import Analysis
from swp.domain.import_data import ImportData
from swp.domain.state import PlanState
from swp.domain.state_migrations import upcast
from swp.store.db import transaction
from swp.store.models import ImportRow, PlanRow


@dataclass(frozen=True)
class StoredImport:
    id: uuid.UUID
    uploaded_at: datetime
    data_as_of: date
    data: ImportData


@dataclass(frozen=True)
class StoredPlan:
    id: uuid.UUID
    name: str
    import_id: uuid.UUID
    created_by: str
    created_at: datetime
    last_edited_by: str
    last_edited_at: datetime
    version: int
    analysis: Analysis
    state: PlanState
    imported: StoredImport


@dataclass(frozen=True)
class PlanListItem:
    """One saved plan as listed: plan and import columns only, no JSON documents."""

    id: uuid.UUID
    name: str
    data_as_of: date
    uploaded_at: datetime
    created_by: str
    created_at: datetime
    last_edited_by: str
    last_edited_at: datetime


def insert_plan_with_import(plan: StoredPlan) -> None:
    """Insert `plan.imported` and the plan in one transaction; nothing is saved if either fails."""
    imported = plan.imported
    with transaction() as session:
        session.add(
            ImportRow(
                id=imported.id,
                uploaded_at=imported.uploaded_at,
                data_as_of=imported.data_as_of,
                data=imported.data.model_dump(mode="json"),
            )
        )
        session.flush()
        session.add(
            PlanRow(
                id=plan.id,
                name=plan.name,
                import_id=imported.id,
                created_by=plan.created_by,
                created_at=plan.created_at,
                last_edited_by=plan.last_edited_by,
                last_edited_at=plan.last_edited_at,
                version=plan.version,
                analysis=plan.analysis.model_dump(mode="json"),
                state=plan.state.model_dump(mode="json"),
            )
        )


def get_plan(plan_id: uuid.UUID) -> StoredPlan | None:
    """The stored plan with its import, upcast and validated; None if there is no such plan."""
    with transaction() as session:
        row = session.get(PlanRow, plan_id)
        if row is None:
            return None
        import_row = session.get(ImportRow, row.import_id)
        assert import_row is not None  # FK ON DELETE RESTRICT
        imported = StoredImport(
            id=import_row.id,
            uploaded_at=import_row.uploaded_at,
            data_as_of=import_row.data_as_of,
            data=ImportData.model_validate(upcast("data", import_row.data)),
        )
        return StoredPlan(
            id=row.id,
            name=row.name,
            import_id=row.import_id,
            created_by=row.created_by,
            created_at=row.created_at,
            last_edited_by=row.last_edited_by,
            last_edited_at=row.last_edited_at,
            version=row.version,
            analysis=Analysis.model_validate(upcast("analysis", row.analysis)),
            state=PlanState.model_validate(upcast("state", row.state)),
            imported=imported,
        )


def list_plans() -> list[PlanListItem]:
    """Every saved plan, most recently edited first (then newest created, then id)."""
    query = (
        select(
            PlanRow.id,
            PlanRow.name,
            ImportRow.data_as_of,
            ImportRow.uploaded_at,
            PlanRow.created_by,
            PlanRow.created_at,
            PlanRow.last_edited_by,
            PlanRow.last_edited_at,
        )
        .join(ImportRow, ImportRow.id == PlanRow.import_id)
        .order_by(PlanRow.last_edited_at.desc(), PlanRow.created_at.desc(), PlanRow.id)
    )
    with transaction() as session:
        return [PlanListItem(**row._asdict()) for row in session.execute(query)]
