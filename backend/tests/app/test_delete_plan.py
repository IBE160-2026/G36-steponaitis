"""FR-12/FR-2/NFR-6: a plan is deleted permanently, and its import with its last plan (Story 6.4).

SQLite here, Postgres 17 in CI; the Postgres lock tests skip on SQLite.
"""

import sqlite3
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from swp.api.app import create_app
from swp.app import plans
from swp.app.imports import read_import
from swp.store import db
from swp.store import plans as store_plans
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from tests.app.test_apply_command import _answer_key_after_run, _apply_body, _command
from tests.app.test_create_plan import NOW, SAME_ORIGIN, _counts, _small_files
from tests.app.test_reuse_import import IMPORT_GONE, _reuse, _row

PLAN_GONE = "This plan does not exist."
BUSY = {"error": {"code": "unavailable", "message": "The plan is busy. Try again.", "details": []}}


def _delete(client: TestClient, plan_id: str) -> Any:
    return client.delete(f"/api/plans/{plan_id}", headers=SAME_ORIGIN)


def _postgres_only() -> None:
    if get_engine().dialect.name != "postgresql":
        pytest.skip("Postgres row locks only")


def test_fr12_delete_keeps_other_plans(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_a, rec_id = _answer_key_after_run(client)
        applied = _command(client, plan_a, _apply_body(rec_id, 3))
        assert applied.status_code == 200, applied.text
        import_id = client.get(f"/api/plans/{plan_a}").json()["import_id"]
        created = _reuse(client, "B", import_id)
        assert created.status_code == 201, created.text
        plan_b = created.json()["id"]
        before_b = _row(plan_b)
        summary_b = client.get(f"/api/plans/{plan_b}").json()

        response = _delete(client, plan_a)

        assert response.status_code == 204, response.text
        assert response.content == b""
        assert client.get(f"/api/plans/{plan_a}").status_code == 404
        assert client.get(f"/api/plans/{plan_b}").json() == summary_b
        assert [row["id"] for row in client.get("/api/plans").json()] == [plan_b]

    after_b = _row(plan_b)
    assert after_b.state == before_b.state
    assert after_b.version == before_b.version
    assert after_b.last_edited_at == before_b.last_edited_at
    assert after_b.last_edited_by == before_b.last_edited_by
    assert after_b.analysis == before_b.analysis
    assert _counts() == (1, 1)
    assert store_plans.get_import(uuid.UUID(import_id)) is not None


def test_fr12_delete_last_plan_deletes_import(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    second = plans.create_from_import("B", first.import_id, now=NOW)
    with TestClient(create_app()) as client:
        assert _delete(client, str(first.id)).status_code == 204
        assert _counts() == (1, 1)
        response = _delete(client, str(second.id))

    assert response.status_code == 204, response.text
    assert _counts() == (0, 0)


def test_fr12_delete_unknown_plan_not_found(empty_tables: str) -> None:
    plans.create("A", read_import(_small_files()), now=NOW)
    with TestClient(create_app()) as client:
        response = _delete(client, str(uuid.uuid4()))

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "plan_not_found",
        "message": PLAN_GONE,
        "details": [],
    }
    assert _counts() == (1, 1)


def test_fr12_delete_bad_id_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = _delete(client, "abc")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "plan_not_found"


@pytest.mark.parametrize(
    "headers",
    [{}, {"Origin": "https://evil.example"}],
    ids=["no-origin", "cross-site"],
)
def test_nfr6_delete_cross_site_forbidden(empty_tables: str, headers: dict[str, str]) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    with TestClient(create_app()) as client:
        response = client.delete(f"/api/plans/{first.id}", headers=headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden_origin"
    assert _counts() == (1, 1)


def test_fr12_delete_busy_unavailable(empty_tables: str) -> None:
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
            response = _delete(client, str(first.id))
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)

    assert response.status_code == 503, response.text
    assert response.json() == BUSY
    assert _counts() == (1, 1)


def test_fr12_delete_waits_for_import_lock_postgres(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _postgres_only()
    monkeypatch.setattr(db, "PG_LOCK_TIMEOUT", "200ms")
    first = plans.create("A", read_import(_small_files()), now=NOW)
    lock = select(ImportRow.id).where(ImportRow.id == first.import_id).with_for_update()

    with TestClient(create_app()) as client, get_engine().connect() as holder:
        with holder.begin():
            holder.execute(lock).one()
            response = _delete(client, str(first.id))

    assert response.status_code == 503, response.text
    assert response.json() == BUSY
    assert _counts() == (1, 1)


def test_fr12_command_lock_fails_fast_postgres(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _postgres_only()
    monkeypatch.setattr(db, "PG_LOCK_TIMEOUT", "200ms")
    first = plans.create("A", read_import(_small_files()), now=NOW)
    lock = select(PlanRow.id).where(PlanRow.id == first.id).with_for_update()
    body = {
        "type": "set_best_mark",
        "command_id": str(uuid.uuid4()),
        "base_version": 1,
        "mark": {"kind": "aisle", "aisle": "A"},
    }

    with TestClient(create_app()) as client, get_engine().connect() as holder:
        with holder.begin():
            holder.execute(lock).one()
            response = _command(client, str(first.id), body)

    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "unavailable"
    assert _row(str(first.id)).version == 1


def test_fr2_reuse_after_last_plan_deleted_not_found(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)
    with TestClient(create_app()) as client:
        assert _delete(client, str(first.id)).status_code == 204
        response = _reuse(client, "B", str(first.import_id))

    assert response.status_code == 404
    assert response.json()["error"] == {"code": "not_found", "message": IMPORT_GONE, "details": []}
    assert _counts() == (0, 0)


def test_fr12_store_delete_twice_false(empty_tables: str) -> None:
    first = plans.create("A", read_import(_small_files()), now=NOW)

    assert store_plans.delete_plan(first.id) is True
    assert store_plans.delete_plan(first.id) is False
    assert _counts() == (0, 0)
