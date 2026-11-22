"""FR-2/FR-18/FR-8: a new plan can start from a saved plan's import (Story 6.3).

The new plan shares the import but none of the chosen plan's marks, moves or runs, and its
analysis is recomputed with the current settings. SQLite here, Postgres 17 in CI.
"""

import sqlite3
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, event, select

from swp.api.app import create_app
from swp.app import plans
from swp.app.imports import read_import
from swp.domain.errors import DomainError
from swp.domain.state import PlanState
from swp.store import plans as store_plans
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from tests.app.test_apply_command import _answer_key_after_run, _apply_body, _command
from tests.app.test_create_plan import NOW, SAME_ORIGIN, _counts, _multipart, _small_files
from tests.app.test_import_readers import _data_files

IMPORT_GONE = "This import no longer exists. Choose another saved plan."


def _reuse(client: TestClient, name: str, import_id: str, **extra: Any) -> Any:
    return client.post(
        "/api/plans", data={"name": name, "import_id": import_id}, headers=SAME_ORIGIN, **extra
    )


def _row(plan_id: str) -> Any:
    with get_engine().connect() as conn:
        return conn.execute(select(PlanRow).where(PlanRow.id == uuid.UUID(plan_id))).one()


def _send(client: TestClient, plan_id: str, body: dict[str, Any]) -> None:
    version = client.get(f"/api/plans/{plan_id}").json()["version"]
    full = {"command_id": str(uuid.uuid4()), "base_version": version, **body}
    response = _command(client, plan_id, full)
    assert response.status_code == 200, response.text


def _recommendations(client: TestClient, plan_id: str) -> list[tuple[str, str, str]]:
    response = client.get(f"/api/plans/{plan_id}/recommendations")
    assert response.status_code == 200, response.text
    return [
        (rec["part"], rec["from_location"], rec["to_location"])
        for rec in response.json()["recommendations"]
    ]


def test_fr2_reuse_import_creates_empty_plan_on_same_import(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_a, rec_id = _answer_key_after_run(client)
        applied = _command(client, plan_a, _apply_body(rec_id, 3))
        assert applied.status_code == 200, applied.text
        before = _row(plan_a)
        summary_a = client.get(f"/api/plans/{plan_a}").json()
        counts = _counts()

        response = _reuse(client, " B ", summary_a["import_id"])

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["name"] == "B"
        assert body["version"] == 1
        assert body["import_id"] == summary_a["import_id"]
        assert body["data_as_of"] == summary_a["data_as_of"]
        assert body["uploaded_at"] == summary_a["uploaded_at"]
        assert _counts() == (counts[0], counts[1] + 1)

        row_b = _row(body["id"])
        assert row_b.state == PlanState.new().model_dump(mode="json")
        assert row_b.version == 1
        assert client.get(f"/api/plans/{body['id']}").json()["current_round"] == 0

        after = _row(plan_a)
        assert after.state == before.state
        assert after.version == before.version
        assert after.last_edited_at == before.last_edited_at
        assert after.last_edited_by == before.last_edited_by


def test_fr2_reuse_import_same_results(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_a, _rec = _answer_key_after_run(client)
        import_id = client.get(f"/api/plans/{plan_a}").json()["import_id"]
        created = _reuse(client, "B", import_id)
        assert created.status_code == 201, created.text
        plan_b = created.json()["id"]
        _send(client, plan_b, {"type": "set_best_mark", "mark": {"kind": "aisle", "aisle": "A"}})
        _send(client, plan_b, {"type": "run"})

        stored_a = plans.get(uuid.UUID(plan_a))
        stored_b = plans.get(uuid.UUID(plan_b))
        assert stored_a is not None and stored_b is not None
        assert stored_b.analysis.parts == stored_a.analysis.parts
        assert stored_b.analysis.pick_groups == stored_a.analysis.pick_groups
        recs_a = _recommendations(client, plan_a)
        assert recs_a
        assert _recommendations(client, plan_b) == recs_a


def test_fr18_reuse_import_uses_current_settings(
    empty_tables: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = plans.create("Before", read_import(_data_files("answer-key", "csv")), now=NOW)
    before = plans.summary(first.id).class_counts

    changed = tmp_path / "analysis.toml"
    changed.write_text(
        "period_months = 12\nfast_min_picks = 10\nmedium_min_picks = 3\n"
        "slow_min_picks = 2\npick_group_min_shared_jobs = 5\n",
        encoding="utf-8",
    )
    load = plans.load_analysis_settings
    monkeypatch.setattr(plans, "load_analysis_settings", lambda: load(changed))
    second = plans.create_from_import("After", first.import_id, now=NOW)

    assert second.import_id == first.import_id
    assert second.analysis.settings.fast_min_picks == 10
    assert plans.summary(first.id).class_counts == before
    assert plans.get(first.id).analysis.settings == first.analysis.settings
    assert plans.summary(second.id).class_counts.model_dump() == {
        "fast": 17,
        "medium": 6,
        "slow": 0,
        "dead": 4,
    }


def test_fr2_reuse_deleted_import_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        unknown = _reuse(client, "B", str(uuid.uuid4()))
        assert unknown.status_code == 404
        assert unknown.json()["error"]["code"] == "not_found"
        assert unknown.json()["error"]["message"] == IMPORT_GONE

        first = plans.create("A", read_import(_small_files()), now=NOW)
        with get_engine().begin() as conn:
            conn.execute(delete(PlanRow))
            conn.execute(delete(ImportRow))
        deleted = _reuse(client, "B", str(first.import_id))

    assert deleted.status_code == 404
    assert deleted.json()["error"] == {"code": "not_found", "message": IMPORT_GONE, "details": []}
    assert _counts() == (0, 0)


def test_fr2_insert_on_missing_import_inserts_nothing(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    stored_import = store_plans.get_import(first.import_id)
    assert stored_import is not None

    def import_deleted_meanwhile(import_id: uuid.UUID) -> store_plans.StoredImport | None:
        with get_engine().begin() as conn:
            conn.execute(delete(PlanRow))
            conn.execute(delete(ImportRow))
        return stored_import

    monkeypatch.setattr(store_plans, "get_import", import_deleted_meanwhile)
    with pytest.raises(DomainError) as raised:
        plans.create_from_import("B", first.import_id, now=NOW)

    assert raised.value.code == "not_found"
    assert raised.value.message == IMPORT_GONE
    assert _counts() == (0, 0)
    orphan = plans._new_plan("C", stored_import, first.analysis, now=NOW, user="planner")
    assert store_plans.insert_plan_on_import(orphan) is False
    assert _counts() == (0, 0)


def test_fr2_reuse_import_busy_unavailable(empty_tables: str) -> None:
    engine = get_engine()
    if engine.dialect.name != "sqlite":
        pytest.skip("SQLite write lock only")
    database = engine.url.database
    assert database is not None
    first = plans.create("A", read_import(_small_files()), now=NOW)

    with TestClient(create_app()) as client:
        engine.dispose()

        def short_busy_timeout(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA busy_timeout=50")
            cursor.close()

        event.listen(engine, "connect", short_busy_timeout)
        holder = sqlite3.connect(database, isolation_level=None)
        try:
            holder.execute("BEGIN IMMEDIATE")
            response = _reuse(client, "B", str(first.import_id))
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)

    assert response.status_code == 503, response.text
    assert response.json() == {
        "error": {
            "code": "unavailable",
            "message": "The plan is busy. Try again.",
            "details": [],
        }
    }
    assert _counts() == (1, 1)


def test_fr2_reuse_bad_import_id_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = _reuse(client, "B", "abc")

    assert response.status_code == 404
    assert response.json()["error"] == {"code": "not_found", "message": IMPORT_GONE, "details": []}
    assert _counts() == (0, 0)


def test_fr2_files_and_import_id_rejected(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    with TestClient(create_app()) as client:
        response = _reuse(
            client,
            "B",
            str(first.import_id),
            files=_multipart({"locations": _small_files()["locations"]}),
        )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert [d["field"] for d in error["details"]] == ["import_id"]
    assert _counts() == (1, 1)


def test_fr1_missing_files_validation_failed(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        none = client.post("/api/plans", data={"name": "A"}, headers=SAME_ORIGIN)
        blank = client.post("/api/plans", data={"name": " "}, headers=SAME_ORIGIN)
        files = _small_files()
        one = client.post(
            "/api/plans",
            data={"name": "A"},
            files=_multipart({k: v for k, v in files.items() if k != "inventory"}),
            headers=SAME_ORIGIN,
        )

    assert none.status_code == 422
    assert none.json()["error"] == {
        "code": "validation_failed",
        "message": "The request is not valid.",
        "details": [
            {"field": "locations", "message": "Field required"},
            {"field": "inventory", "message": "Field required"},
            {"field": "transactions", "message": "Field required"},
        ],
    }
    assert blank.status_code == 422
    assert blank.json() == none.json()
    assert one.status_code == 422
    assert one.json()["error"] == {
        "code": "validation_failed",
        "message": "Field required",
        "details": [{"field": "inventory", "message": "Field required"}],
    }
    assert _counts() == (0, 0)


def test_fr2_reuse_blank_name_rejected(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    with TestClient(create_app()) as client:
        response = _reuse(client, " ", str(first.import_id))

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert [d["field"] for d in error["details"]] == ["name"]
    assert _counts() == (1, 1)


def test_fr8_list_rows_carry_import_id(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    second = plans.create_from_import("B", first.import_id, now=NOW)
    with TestClient(create_app()) as client:
        rows = client.get("/api/plans").json()

    by_id = {row["id"]: row for row in rows}
    assert by_id[str(first.id)]["import_id"] == str(first.import_id)
    assert by_id[str(second.id)]["import_id"] == str(first.import_id)
    assert {"data", "analysis", "state"}.isdisjoint(rows[0])
