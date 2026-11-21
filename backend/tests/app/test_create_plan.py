"""FR-1/FR-11/FR-18/AD-4/AD-9: a plan and its import are stored in one transaction."""

import json
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, inspect, select
from sqlalchemy.exc import IntegrityError

from swp.api.app import create_app
from swp.app import plans
from swp.app.bootstrap import bootstrap
from swp.app.imports import UploadedFile, read_import
from swp.domain.errors import DomainError
from swp.domain.state import PlanState
from swp.store import plans as store_plans
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from tests.app.test_import_readers import DATA_DIR, INV_CSV, LOC_CSV, TX_CSV, _data_files
from tests.conftest import _clear_caches

SAME_ORIGIN = {"Origin": "http://testserver"}
NOW = datetime(2026, 11, 21, 12, 30, tzinfo=UTC)


@pytest.fixture
def empty_tables(app_database: str) -> Iterator[str]:
    """Migrated database with no plans or imports (Postgres tests share one database)."""
    bootstrap(upgrade=True, seed=False)
    with get_engine().begin() as conn:
        conn.execute(delete(PlanRow))
        conn.execute(delete(ImportRow))
    yield app_database


def _counts() -> tuple[int, int]:
    with get_engine().connect() as conn:
        imports = conn.execute(select(func.count()).select_from(ImportRow)).scalar_one()
        plan_rows = conn.execute(select(func.count()).select_from(PlanRow)).scalar_one()
    return imports, plan_rows


def _multipart(files: dict[str, UploadedFile]) -> dict[str, tuple[str, bytes]]:
    return {role: (upload.file_name, upload.data) for role, upload in files.items()}


def _small_files() -> dict[str, UploadedFile]:
    return {
        "locations": UploadedFile("Locations.csv", LOC_CSV),
        "inventory": UploadedFile("Inventory.csv", INV_CSV),
        "transactions": UploadedFile("transactions.csv", TX_CSV),
    }


def _answer_key_settings() -> dict[str, int]:
    expected = json.loads((DATA_DIR / "answer-key" / "expected.json").read_text("utf-8"))
    return expected["settings"]


def test_fr18_analysis_toml_matches_answer_key() -> None:
    assert plans.load_analysis_settings().model_dump() == _answer_key_settings()


def test_nfr12_migration_creates_exactly_imports_and_plans(empty_tables: str) -> None:
    inspector = inspect(get_engine())

    assert set(inspector.get_table_names()) == {"alembic_version", "imports", "plans"}
    assert [c["name"] for c in inspector.get_columns("imports")] == [
        "id",
        "uploaded_at",
        "data_as_of",
        "data",
    ]
    assert [c["name"] for c in inspector.get_columns("plans")] == [
        "id",
        "name",
        "import_id",
        "created_by",
        "created_at",
        "last_edited_by",
        "last_edited_at",
        "version",
        "analysis",
        "state",
    ]
    assert all(not c["nullable"] for t in ("imports", "plans") for c in inspector.get_columns(t))
    (fk,) = inspector.get_foreign_keys("plans")
    assert fk["referred_table"] == "imports"
    assert fk["constrained_columns"] == ["import_id"]
    assert (fk.get("options") or {}).get("ondelete") == "RESTRICT"


def test_fr1_sample_import_creates_plan(empty_tables: str) -> None:
    files = _multipart(_data_files("sample", "xlsx"))
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/plans", data={"name": " Demo "}, files=files, headers=SAME_ORIGIN
        )

    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {"id", "name", "import_id", "data_as_of", "uploaded_at", "version"}
    assert body["name"] == "Demo"
    assert body["data_as_of"] == "2026-09-30"
    assert body["version"] == 1
    assert body["uploaded_at"].endswith("Z")
    assert _counts() == (1, 1)

    with get_engine().connect() as conn:
        row = conn.execute(select(PlanRow)).one()
        import_row = conn.execute(select(ImportRow)).one()
    assert str(row.id) == body["id"]
    assert str(import_row.id) == body["import_id"] == str(row.import_id)
    assert import_row.data_as_of == date(2026, 9, 30)
    assert row.created_by == row.last_edited_by == "planner"
    assert row.last_edited_at == row.created_at == import_row.uploaded_at
    assert row.created_at.tzinfo is not None
    assert row.version == 1
    assert row.analysis["settings"] == _answer_key_settings()
    assert row.analysis["period_start"] == "2025-10-01"
    assert row.analysis["period_end"] == "2026-09-30"
    assert row.state == PlanState.new().model_dump(mode="json")
    assert len(import_row.data["locations"]) == 2_000


def test_fr1_plan_persists_across_restart(empty_tables: str) -> None:
    files = _multipart(_data_files("sample", "xlsx"))
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/plans", data={"name": "Demo"}, files=files, headers=SAME_ORIGIN
        )
    assert response.status_code == 201, response.text
    body = response.json()

    get_engine().dispose()
    _clear_caches()
    with TestClient(create_app()):
        stored = plans.get(uuid.UUID(body["id"]))

    assert stored is not None
    assert stored.name == "Demo"
    assert str(stored.import_id) == body["import_id"] == str(stored.imported.id)
    assert stored.imported.data_as_of == date(2026, 9, 30)
    assert len(stored.imported.data.locations) == 2_000
    assert stored.created_at == stored.imported.uploaded_at
    assert stored.created_at.tzinfo is not None
    assert stored.state == PlanState.new()
    assert plans.get(uuid.uuid4()) is None


def test_fr3_failing_file_saves_nothing(empty_tables: str) -> None:
    files = _small_files()
    files["inventory"] = UploadedFile(
        "Inventory.csv", b"Part,Part Description,Quantity,Location\nP1,Bolt,2,Z-99\n"
    )
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/plans", data={"name": "Bad"}, files=_multipart(files), headers=SAME_ORIGIN
        )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "import_invalid"
    assert [d["file_role"] for d in error["details"]] == ["locations", "inventory", "transactions"]
    assert _counts() == (0, 0)


def test_fr1_failure_mid_transaction_saves_nothing(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken_plan_row(**_kwargs: object) -> PlanRow:
        raise RuntimeError("plan insert failed")

    monkeypatch.setattr(store_plans, "PlanRow", broken_plan_row)

    with pytest.raises(RuntimeError, match="plan insert failed"):
        plans.create("Broken", read_import(_small_files()), now=NOW)

    assert _counts() == (0, 0)


def test_fr1_blank_name_rejected_by_service(empty_tables: str) -> None:
    with pytest.raises(DomainError) as caught:
        plans.create("   ", read_import(_small_files()), now=NOW)

    assert caught.value.code == "validation_failed"
    assert _counts() == (0, 0)


def test_nfr12_import_delete_restricted_by_plan(empty_tables: str) -> None:
    created = plans.create("Restrict", read_import(_small_files()), now=NOW)

    with pytest.raises(IntegrityError), get_engine().begin() as conn:
        conn.execute(delete(ImportRow).where(ImportRow.id == created.import_id))

    assert _counts() == (1, 1)
