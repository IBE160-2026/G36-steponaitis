"""Plan persistence: an import and its plan are saved in one transaction (AD-4, AD-9)."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from swp.domain.analysis import Analysis
from swp.domain.import_data import ImportData
from swp.domain.state import PlanState
from swp.domain.state_migrations import upcast
from swp.store.db import transaction, write_transaction
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


def _stored(session: Session, row: PlanRow) -> StoredPlan:
    """The stored plan of `row` with its import, upcast and validated."""
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


def get_plan(plan_id: uuid.UUID) -> StoredPlan | None:
    """The stored plan with its import, upcast and validated; None if there is no such plan."""
    with transaction() as session:
        row = session.get(PlanRow, plan_id)
        return None if row is None else _stored(session, row)


class PlanWriter:
    """The plan as read inside a write transaction, and its conditional save (AD-6)."""

    def __init__(self, session: Session, plan: StoredPlan) -> None:
        self._session = session
        self.plan = plan

    def save_state(
        self, state: PlanState, *, last_edited_by: str, last_edited_at: datetime
    ) -> bool:
        """Save `state` and bump the version if it is still the version read; True if saved."""
        result = self._session.execute(
            update(PlanRow)
            .where(PlanRow.id == self.plan.id, PlanRow.version == self.plan.version)
            .values(
                state=state.model_dump(mode="json"),
                version=PlanRow.version + 1,
                last_edited_by=last_edited_by,
                last_edited_at=last_edited_at,
            )
            .execution_options(synchronize_session=False)
        )
        return result.rowcount == 1


@contextmanager
def plan_for_update(plan_id: uuid.UUID) -> Iterator[PlanWriter | None]:
    """The plan locked for a read-modify-write in one transaction; None if there is no such plan.

    The transaction commits when the block ends and rolls back if it raises.
    """
    with write_transaction() as session:
        row = session.get(PlanRow, plan_id, with_for_update=True)
        yield None if row is None else PlanWriter(session, _stored(session, row))


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
