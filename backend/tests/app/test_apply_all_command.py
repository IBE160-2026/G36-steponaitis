"""FR-30/AD-3/AD-6/NFR-8: the `apply_all` command over HTTP (SQLite here, Postgres in CI)."""

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_apply_command import _answer_key_after_run, _command, _state
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _create, _row

CREATED = datetime(2026, 11, 22, 9, 0, tzinfo=UTC)


def _apply_all_body(base_version: int, command_id: uuid.UUID | None = None) -> dict[str, Any]:
    return {
        "type": "apply_all",
        "command_id": str(command_id or uuid.uuid4()),
        "base_version": base_version,
    }


def test_fr30_apply_all_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        base = f"/api/plans/{plan_id}"
        summary_before = client.get(base).json()

        response = _command(client, plan_id, _apply_all_body(3))

        summary = client.get(base).json()
        view = client.get(f"{base}/recommendations").json()

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 4,
        "events": [{"type": "apply_all_done", "applied": [1, 2, 3, 4, 5, 6, 7, 8], "skipped": []}],
    }
    assert _row(uuid.UUID(plan_id))[0] == summary["version"] == view["version"] == 4
    assert summary_before["apply_all_count"] == 8
    assert summary["apply_all_count"] == 0
    checked = {s["key"]: s["checked"] for s in summary["steps"]}
    assert (
        {s["key"]: s["checked"] for s in summary_before["steps"]}["recommendations"],
        checked["recommendations"],
    ) == (False, True)
    rows = view["recommendations"]
    assert [r["status"] for r in rows] == ["applied"] * 8
    assert [r["applied"] for r in rows] == [
        {"move_number": n, "round": 1, "to_location": r["to_location"], "to_best": r["to_best"]}
        for n, r in enumerate(rows, start=1)
    ]
    state = _state(plan_id)
    assert [s.recommendation_id for s in state.steps] == [r["id"] for r in rows]
    assert {s.round for s in state.steps} == {1}


def test_ad6_repeated_apply_all_returns_stored_result(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        body = _apply_all_body(3)
        first = _command(client, plan_id, body)
        second = _command(client, plan_id, body)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json() == first.json()
    assert _row(uuid.UUID(plan_id))[0] == 4
    assert len(_state(plan_id).steps) == 8


def test_fr30_apply_all_without_run_is_noop_over_http(empty_tables: str) -> None:
    plan_id = _create("No run", CREATED)
    before = _row(plan_id)
    with TestClient(create_app()) as client:
        response = _command(client, str(plan_id), _apply_all_body(1))
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert response.status_code == 200, response.text
    assert response.json() == {"version": 1, "events": []}
    assert _row(plan_id) == before
    assert summary["apply_all_count"] == 0
    assert {s["key"]: s["checked"] for s in summary["steps"]}["recommendations"] is False


def test_fr30_apply_all_twice_second_is_noop_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        assert _command(client, plan_id, _apply_all_body(3)).status_code == 200
        before = _row(uuid.UUID(plan_id))
        again = _command(client, plan_id, _apply_all_body(4))

    assert again.status_code == 200, again.text
    assert again.json() == {"version": 4, "events": []}
    assert _row(uuid.UUID(plan_id)) == before


def test_nfr8_apply_all_on_sample_within_budget(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        marked = _command(
            client,
            plan_id,
            {
                "type": "set_best_mark",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "mark": {"kind": "aisle", "aisle": "A"},
            },
        )
        assert marked.status_code == 200, marked.text
        ran = _command(
            client, plan_id, {"type": "run", "command_id": str(uuid.uuid4()), "base_version": 2}
        )
        assert ran.status_code == 200, ran.text
        count = client.get(f"/api/plans/{plan_id}").json()["apply_all_count"]
        start = time.perf_counter()
        response = _command(client, plan_id, _apply_all_body(3))
        elapsed = time.perf_counter() - start
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert response.status_code == 200, response.text
    event = response.json()["events"][0]
    assert event["type"] == "apply_all_done"
    assert count > 1
    assert len(event["applied"]) == count
    assert response.json()["version"] == 4
    assert summary["apply_all_count"] == 0
    assert elapsed < 1.0, f"{elapsed:.2f} s"
