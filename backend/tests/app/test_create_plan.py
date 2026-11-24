"""FR-1/FR-11/FR-18/AD-4/AD-9: a plan and its import are stored in one transaction."""

import json
import time
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, inspect, select
from sqlalchemy.exc import IntegrityError

from swp.api.app import create_app
from swp.app import plans
from swp.app.imports import UploadedFile, read_import
from swp.domain.errors import DomainError
from swp.domain.state import PlanState
from swp.store import plans as store_plans
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from tests.app.test_import_readers import DATA_DIR, INV_CSV, LOC_CSV, TX_CSV, _data_files
from tests.conftest import _clear_caches
from tests.domain.answer_key import CLASS_NAMES, expected

SAME_ORIGIN = {"Origin": "http://testserver"}
NOW = datetime(2026, 11, 21, 12, 30, tzinfo=UTC)


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


def test_nfr12_migration_creates_exactly_imports_plans_users_login_attempts_and_categories(
    empty_tables: str,
) -> None:
    inspector = inspect(get_engine())

    # FR-39: migration 0002 only adds `users` (checked in tests/app/test_signup.py); FR-40:
    # migration 0003 only adds `login_attempts` (checked in tests/app/test_fr40_login_throttle.py);
    # FR-43: migration 0004 only adds `keyword_rules` (checked in
    # tests/app/test_fr43_keyword_rules_api.py); FR-45: migration 0005 only adds
    # `aisle_categories` (checked in tests/app/test_fr45_aisle_categories_api.py).
    assert set(inspector.get_table_names()) == {
        "alembic_version",
        "imports",
        "plans",
        "users",
        "login_attempts",
        "keyword_rules",
        "aisle_categories",
    }
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


def _expected_parts() -> dict[str, dict[str, object]]:
    return {
        part: {"picks": e["picks"], "movement_class": CLASS_NAMES[e["class"]]}
        for part, e in expected()["parts"].items()
    }


def test_fr18_create_stores_classes(empty_tables: str) -> None:
    created = plans.create("Key", read_import(_data_files("answer-key", "csv")), now=NOW)

    with get_engine().connect() as conn:
        row = conn.execute(select(PlanRow).where(PlanRow.id == created.id)).one()
    assert row.analysis["parts"] == _expected_parts()
    assert list(row.analysis["parts"]) == sorted(row.analysis["parts"])
    stored = plans.get(created.id)
    assert stored is not None
    assert stored.analysis.parts == created.analysis.parts


def test_fr19_create_stores_pick_groups(empty_tables: str) -> None:
    created = plans.create("Key", read_import(_data_files("answer-key", "csv")), now=NOW)

    with get_engine().connect() as conn:
        row = conn.execute(select(PlanRow).where(PlanRow.id == created.id)).one()
    assert row.analysis["pick_groups"] == [
        {"part_a": e["parts"][0], "part_b": e["parts"][1], "shared_jobs": e["shared_jobs"]}
        for e in expected()["pick_groups_in_order"]
    ]
    stored = plans.get(created.id)
    assert stored is not None
    assert [g.model_dump() for g in stored.analysis.pick_groups] == row.analysis["pick_groups"]


def test_nfr8_sample_plan_within_import_budget(empty_tables: str) -> None:
    files = _data_files("sample", "xlsx")

    started = time.perf_counter()
    created = plans.create("Sample", read_import(files), now=NOW)
    elapsed = time.perf_counter() - started

    assert elapsed < 10, f"import plus analysis took {elapsed:.2f} s"
    assert created.analysis.pick_groups


def test_fr18_reopen_keeps_classes_after_settings_change(
    empty_tables: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    files = _data_files("answer-key", "csv")
    first = plans.create("Before", read_import(files), now=NOW)
    before = plans.summary(first.id).class_counts

    changed = tmp_path / "analysis.toml"
    changed.write_text(
        "period_months = 12\nfast_min_picks = 10\nmedium_min_picks = 3\n"
        "slow_min_picks = 2\npick_group_min_shared_jobs = 5\n",
        encoding="utf-8",
    )
    load = plans.load_analysis_settings
    monkeypatch.setattr(plans, "load_analysis_settings", lambda: load(changed))
    second = plans.create("After", read_import(files), now=NOW)

    assert plans.summary(first.id).class_counts == before
    assert before.model_dump() == {"fast": 6, "medium": 15, "slow": 3, "dead": 3}
    # expected.json picks under limits 10/3/2: >=10 is 17 parts, 3-9 is 6, 2 is none, <2 is 4.
    assert plans.summary(second.id).class_counts.model_dump() == {
        "fast": 17,
        "medium": 6,
        "slow": 0,
        "dead": 4,
    }
