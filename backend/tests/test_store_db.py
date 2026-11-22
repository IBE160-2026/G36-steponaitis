"""NFR-7: several backend processes share the SQLite file; WAL lets a save commit beside readers."""

import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from swp.app.bootstrap import bootstrap
from swp.domain.analysis import AnalysisSettings, build_analysis
from swp.domain.state import PlanState
from swp.store.db import get_engine
from swp.store.plans import StoredImport, StoredPlan, get_plan, insert_plan_with_import
from tests.domain.answer_key import answer_key_import, expected

NOW = datetime(2026, 11, 22, 9, 0, tzinfo=UTC)


def _plan() -> StoredPlan:
    imported = answer_key_import()
    settings = AnalysisSettings.model_validate(expected()["settings"])
    stored_import = StoredImport(
        id=uuid.uuid4(), uploaded_at=NOW, data_as_of=imported.data_as_of, data=imported.data
    )
    return StoredPlan(
        id=uuid.uuid4(),
        name="WAL plan",
        import_id=stored_import.id,
        created_by="demo",
        created_at=NOW,
        last_edited_by="demo",
        last_edited_at=NOW,
        version=1,
        analysis=build_analysis(imported.data_as_of, settings),
        state=PlanState.new(),
        imported=stored_import,
    )


def test_nfr7_sqlite_uses_wal(database_path: Path) -> None:
    bootstrap(upgrade=True, seed=False)
    get_engine().dispose()
    # A raw connection, not the app engine (whose connect hook sets WAL itself): the mode must
    # already be stored in the file after the upgrade.
    conn = sqlite3.connect(database_path)
    try:
        assert conn.execute("PRAGMA journal_mode").fetchone() == ("wal",)
    finally:
        conn.close()


def test_nfr7_plan_saves_while_a_reader_holds_a_read_transaction(database_path: Path) -> None:
    bootstrap(upgrade=True, seed=False)
    plan = _plan()
    reader = sqlite3.connect(database_path, isolation_level=None, timeout=0)
    try:
        reader.execute("BEGIN")
        assert reader.execute("SELECT count(*) FROM plans").fetchone() == (0,)

        # The save must not wait on the reader's lock (without WAL it raises `database is locked`).
        insert_plan_with_import(plan)

        # The reader keeps its snapshot; the save is visible to everyone else.
        assert reader.execute("SELECT count(*) FROM plans").fetchone() == (0,)
        reader.execute("COMMIT")
    finally:
        reader.close()

    stored = get_plan(plan.id)
    assert stored is not None
    assert stored.name == "WAL plan"
