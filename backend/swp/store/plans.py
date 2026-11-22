"""Plan persistence: an import and its plan are saved in one transaction (AD-4, AD-9)."""

import uuid
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import select, update
from sqlalchemy.exc import OperationalError
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
    import_id: uuid.UUID
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
        session.add(_plan_row(plan))


def _plan_row(plan: StoredPlan) -> PlanRow:
    return PlanRow(
        id=plan.id,
        name=plan.name,
        import_id=plan.import_id,
        created_by=plan.created_by,
        created_at=plan.created_at,
        last_edited_by=plan.last_edited_by,
        last_edited_at=plan.last_edited_at,
        version=plan.version,
        analysis=plan.analysis.model_dump(mode="json"),
        state=plan.state.model_dump(mode="json"),
    )


def _stored_import(import_row: ImportRow) -> StoredImport:
    """The import of `import_row`, its data upcast and validated."""
    return StoredImport(
        id=import_row.id,
        uploaded_at=import_row.uploaded_at,
        data_as_of=import_row.data_as_of,
        data=ImportData.model_validate(upcast("data", import_row.data)),
    )


def get_import(import_id: uuid.UUID) -> StoredImport | None:
    """The stored import, upcast and validated; None if there is no such import."""
    with transaction() as session:
        row = session.get(ImportRow, import_id)
        return None if row is None else _stored_import(row)


def insert_plan_on_import(plan: StoredPlan) -> bool:
    """Insert `plan` on its existing import while holding the import row lock (AD-4).

    False, and nothing inserted, if the import no longer exists. Raise PlanBusy when the
    lock cannot be taken. Story 6.4's import delete must take this same lock, so that a delete
    cannot race a reuse.
    """
    query = select(ImportRow.id).where(ImportRow.id == plan.import_id).with_for_update()
    with ExitStack() as stack:
        try:
            session = stack.enter_context(write_transaction())
            found = session.execute(query).one_or_none()
        except OperationalError as error:
            if _is_busy(error):
                raise PlanBusy from error
            raise
        if found is None:
            return False
        session.add(_plan_row(plan))
    return True


def _stored(session: Session, row: PlanRow) -> StoredPlan:
    """The stored plan of `row` with its import, upcast and validated."""
    import_row = session.get(ImportRow, row.import_id)
    assert import_row is not None  # FK ON DELETE RESTRICT
    imported = _stored_import(import_row)
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


@dataclass(frozen=True)
class LockedPlan:
    """The plan columns read under the write lock: only what a command changes (AD-6)."""

    id: uuid.UUID
    version: int
    state: PlanState


class PlanBusy(Exception):
    """The database is busy: another writer holds the lock (SQLite busy/locked, pg 55P03)."""


@dataclass(frozen=True)
class PlanInputs:
    """The plan's import and analysis, upcast and validated: what a command reads besides
    the state."""

    data: ImportData
    analysis: Analysis


def get_plan_inputs(plan_id: uuid.UUID) -> PlanInputs | None:
    """The import and analysis of the plan; None if there is no such plan.

    An import never changes, a plan never changes its `import_id` and its analysis is
    written once at creation, so these may be read before the plan is locked.
    """
    query = (
        select(ImportRow.data, PlanRow.analysis)
        .join(PlanRow, PlanRow.import_id == ImportRow.id)
        .where(PlanRow.id == plan_id)
    )
    with transaction() as session:
        row = session.execute(query).one_or_none()
    if row is None:
        return None
    return PlanInputs(
        data=ImportData.model_validate(upcast("data", row.data)),
        analysis=Analysis.model_validate(upcast("analysis", row.analysis)),
    )


class PlanWriter:
    """The plan as read inside a write transaction, and its conditional save (AD-6)."""

    def __init__(self, session: Session, plan: LockedPlan) -> None:
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


_SQLITE_BUSY_CODES = (5, 6)  # SQLITE_BUSY, SQLITE_LOCKED (primary result codes)
_SQLITE_BUSY_TEXT = ("database is locked", "database is busy")
_PG_LOCK_NOT_AVAILABLE = "55P03"


def _is_busy(error: OperationalError) -> bool:
    """True when `error` means another writer holds the lock."""
    orig = error.orig
    code = getattr(orig, "sqlite_errorcode", None)
    if isinstance(code, int) and code & 0xFF in _SQLITE_BUSY_CODES:
        return True
    if getattr(orig, "sqlstate", None) == _PG_LOCK_NOT_AVAILABLE:
        return True
    text = str(orig).lower()
    return any(fragment in text for fragment in _SQLITE_BUSY_TEXT)


@contextmanager
def plan_for_update(plan_id: uuid.UUID) -> Iterator[PlanWriter | None]:
    """The plan's id, version and state locked for a read-modify-write in one transaction;
    None if there is no such plan. Raise PlanBusy when the lock cannot be taken.

    The transaction commits when the block ends and rolls back if it raises.
    """
    query = (
        select(PlanRow.id, PlanRow.version, PlanRow.state)
        .where(PlanRow.id == plan_id)
        .with_for_update()
    )
    with ExitStack() as stack:
        try:
            session = stack.enter_context(write_transaction())
            row = session.execute(query).one_or_none()
        except OperationalError as error:
            if _is_busy(error):
                raise PlanBusy from error
            raise
        if row is None:
            yield None
            return
        plan = LockedPlan(
            id=row.id,
            version=row.version,
            state=PlanState.model_validate(upcast("state", row.state)),
        )
        yield PlanWriter(session, plan)


def list_plans() -> list[PlanListItem]:
    """Every saved plan, most recently edited first (then newest created, then id)."""
    query = (
        select(
            PlanRow.id,
            PlanRow.name,
            PlanRow.import_id,
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
