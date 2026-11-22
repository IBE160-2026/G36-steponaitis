"""FR-23/NFR-8: the `run` command over HTTP (SQLite here, Postgres in CI)."""

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.store.plans import get_plan
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _create, _row

CREATED = datetime(2026, 11, 22, 9, 0, tzinfo=UTC)


def _run_body(base_version: int = 1, command_id: uuid.UUID | None = None) -> dict[str, Any]:
    return {
        "type": "run",
        "command_id": str(command_id or uuid.uuid4()),
        "base_version": base_version,
    }


def test_fr23_run_over_http(empty_tables: str) -> None:
    plan_id = _create("Run", CREATED)
    command_id = uuid.uuid4()

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_run_body(command_id=command_id),
            headers=SAME_ORIGIN,
        )
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["version"] == 2
    assert len(body["events"]) == 1
    event = body["events"][0]
    assert event["type"] == "run_done"
    assert event["round"] == 1
    assert summary["current_round"] == 1
    assert summary["version"] == 2
    stored = get_plan(plan_id)
    assert stored is not None
    [run] = stored.state.runs
    assert run.id == str(uuid.uuid5(command_id, "run:1"))
    assert run.round == 1
    assert run.created_by == "planner"
    assert len(run.recommendations) == event["recommendations"]
    assert len(run.no_space) == event["no_space"]


def test_fr24_answer_key_round1_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        created = client.post(
            "/api/plans",
            data={"name": "Answer key"},
            files=_multipart(_data_files("answer-key", "csv")),
            headers=SAME_ORIGIN,
        )
        assert created.status_code == 201, created.text
        plan_id = created.json()["id"]
        marked = client.post(
            f"/api/plans/{plan_id}/commands",
            json={
                "type": "set_best_mark",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "mark": {"kind": "aisle", "aisle": "A"},
            },
            headers=SAME_ORIGIN,
        )
        assert marked.status_code == 200, marked.text
        response = client.post(
            f"/api/plans/{plan_id}/commands", json=_run_body(base_version=2), headers=SAME_ORIGIN
        )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 3,
        "events": [{"type": "run_done", "round": 1, "recommendations": 1, "no_space": 3}],
    }
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    [run] = stored.state.runs
    assert [
        (r.number, r.part, r.from_location, r.to_location, r.rule) for r in run.recommendations
    ] == [(1, "1100", "C-01-01-01", "A-01-01-03", "rule_1")]
    assert [(n.part, n.rule) for n in run.no_space] == [
        ("1200", "rule_1"),
        ("10240", "rule_1"),
        ("2400", "rule_1"),
    ]


def test_fr23_repeated_run_command_returns_stored_result(empty_tables: str) -> None:
    plan_id = _create("Run twice", CREATED)
    body = _run_body()

    with TestClient(create_app()) as client:
        first = client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)
        second = client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json() == first.json()
    assert _row(plan_id)[0] == 2
    assert summary["current_round"] == 1
    stored = get_plan(plan_id)
    assert stored is not None
    assert len(stored.state.runs) == 1


def test_nfr8_run_on_sample_within_budget(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        marked = client.post(
            f"/api/plans/{plan_id}/commands",
            json={
                "type": "set_best_mark",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "mark": {"kind": "aisle", "aisle": "A"},
            },
            headers=SAME_ORIGIN,
        )
        assert marked.status_code == 200, marked.text
        start = time.perf_counter()
        response = client.post(
            f"/api/plans/{plan_id}/commands", json=_run_body(base_version=2), headers=SAME_ORIGIN
        )
        elapsed = time.perf_counter() - start

    assert response.status_code == 200, response.text
    event = response.json()["events"][0]
    assert event["type"] == "run_done"
    assert event["recommendations"] + event["no_space"] > 0
    assert response.json()["version"] == 3
    assert elapsed < 5.0, f"{elapsed:.2f} s"
