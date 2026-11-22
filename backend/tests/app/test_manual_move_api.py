"""FR-33/AD-3/AD-6/AD-11: the manual move command and preview over HTTP on the sample plan."""

import sqlite3
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from swp.api.app import create_app
from swp.store.db import get_engine
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import NOW, _create, _row


def _single_location_part(client: TestClient, plan_id: str) -> tuple[str, str]:
    """A part with exactly one location holding stock, and that location."""
    rows = client.get(f"/api/plans/{plan_id}/parts").json()["parts"]
    row = next(r for r in rows if r["current_location"] is not None and not r["other_locations"])
    return row["part"], row["current_location"]["code"]


def _empty_location(client: TestClient, plan_id: str) -> str:
    rows = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]
    return next(r["location"]["code"] for r in rows if not r["occupied"])


def _move(part: str, a: str, b: str, *, base_version: int = 1) -> dict[str, Any]:
    return {
        "type": "manual_move",
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "part": part,
        "from": a,
        "to": b,
    }


def _preview(client: TestClient, plan_id: str, part: str, a: str, b: str) -> Any:
    return client.get(
        f"/api/plans/{plan_id}/moves/preview", params={"part": part, "from": a, "to": b}
    )


def test_fr33_manual_move_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        target = _empty_location(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_move(part, source, target),
            headers=SAME_ORIGIN,
        )
        summary = client.get(f"/api/plans/{plan_id}").json()
        detail = client.get(f"/api/plans/{plan_id}/parts/{part}").json()

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 2,
        "events": [
            {
                "type": "move_made",
                "move_number": 1,
                "part": part,
                "from_location": source,
                "to_location": target,
                "rule": "manual",
                "round": 0,
            }
        ],
    }
    after = _row(uuid.UUID(plan_id))
    assert after[0] == 2
    assert summary["version"] == 2
    assert summary["last_edited_by"] == "planner"
    assert after[2] > before[2]
    assert detail["version"] == 2
    assert detail["current_location"]["code"] == target


def test_fr33_refused_move_is_409_with_preview_sentence(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        preview = _preview(client, plan_id, part, source, "ZZ-99")
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_move(part, source, "ZZ-99"),
            headers=SAME_ORIGIN,
        )

    message = "ZZ-99 is not in the Locations file."
    assert response.status_code == 409, response.text
    assert response.json() == {
        "error": {"code": "command_rejected", "message": message, "details": []}
    }
    assert preview.status_code == 200, preview.text
    assert preview.json()["allowed"] is False
    assert preview.json()["refusal_message"] == message
    assert preview.json()["effect"] is None
    assert preview.json()["target"] == "none"
    assert _row(uuid.UUID(plan_id)) == before


def test_ad3_preview_allowed_and_read_only(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        target = _empty_location(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        responses = [_preview(client, plan_id, part, source, target) for _ in range(3)]
        refused = _preview(client, plan_id, part, source, "")

    for response in responses:
        assert response.status_code == 200, response.text
        assert response.json() == {
            "version": 1,
            "allowed": True,
            "refusal_message": None,
            "effect": {"kind": "new"},
            "target": "empty",
            "target_parts": [],
        }
    assert refused.status_code == 200, refused.text
    assert refused.json()["refusal_message"] == "Enter a to-location."
    assert _row(uuid.UUID(plan_id)) == before


def test_ad3_preview_missing_param_422_and_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        missing = client.get(
            f"/api/plans/{plan_id}/moves/preview", params={"part": "X", "from": "A"}
        )
        unknown = _preview(client, str(uuid.uuid4()), "X", "A", "B")

    assert missing.status_code == 422, missing.text
    assert missing.json()["error"]["code"] == "validation_failed"
    assert unknown.status_code == 404, unknown.text
    assert unknown.json()["error"]["code"] == "plan_not_found"


def test_fr33_codes_over_200_chars_are_422(empty_tables: str) -> None:
    plan_id = str(_create("Long codes", NOW))
    long = "X" * 201
    with TestClient(create_app()) as client:
        commands = [
            client.post(f"/api/plans/{plan_id}/commands", json=_move(*args), headers=SAME_ORIGIN)
            for args in ((long, "A", "B"), ("X", long, "B"), ("X", "A", long))
        ]
        previews = [
            _preview(client, plan_id, *args)
            for args in ((long, "A", "B"), ("X", long, "B"), ("X", "A", long))
        ]
        at_limit = _preview(client, plan_id, "X" * 200, "A", "B")

    for response in [*commands, *previews]:
        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "validation_failed"
    assert at_limit.status_code == 200, at_limit.text
    assert _row(uuid.UUID(plan_id))[0] == 1


def test_ad6_manual_move_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{uuid.uuid4()}/commands",
            json=_move("X", "A", "B"),
            headers=SAME_ORIGIN,
        )

    assert response.status_code == 404, response.text
    assert response.json()["error"]["code"] == "plan_not_found"


def test_ad6_busy_database_is_503(empty_tables: str) -> None:
    engine = get_engine()
    if engine.dialect.name != "sqlite":
        pytest.skip("SQLite write lock only")
    database = engine.url.database
    assert database is not None

    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        target = _empty_location(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        engine.dispose()

        def short_busy_timeout(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA busy_timeout=50")
            cursor.close()

        event.listen(engine, "connect", short_busy_timeout)
        holder = sqlite3.connect(database, isolation_level=None)
        try:
            holder.execute("BEGIN IMMEDIATE")
            response = client.post(
                f"/api/plans/{plan_id}/commands",
                json=_move(part, source, target),
                headers=SAME_ORIGIN,
            )
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
    assert _row(uuid.UUID(plan_id)) == before
