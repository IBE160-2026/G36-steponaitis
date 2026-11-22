"""FR-30/FR-33/AD-6/AD-7: the `apply` command over HTTP (SQLite here, Postgres in CI)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.domain.state import PlanState
from swp.store.plans import get_plan
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.app.test_plan_summary import _row


def _command(client: TestClient, plan_id: str, body: dict[str, Any]) -> Any:
    return client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)


def _apply_body(
    rec_id: str, base_version: int, command_id: uuid.UUID | None = None
) -> dict[str, Any]:
    return {
        "type": "apply",
        "command_id": str(command_id or uuid.uuid4()),
        "base_version": base_version,
        "recommendation_id": rec_id,
    }


def _manual_body(part: str, a: str, b: str, base_version: int) -> dict[str, Any]:
    return {
        "type": "manual_move",
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "part": part,
        "from": a,
        "to": b,
    }


def _answer_key_after_run(client: TestClient) -> tuple[str, str]:
    """Answer-key plan over HTTP, aisle A marked, run 1 done (version 3); returns the plan id
    and recommendation #1's id."""
    created = client.post(
        "/api/plans",
        data={"name": "Answer key"},
        files=_multipart(_data_files("answer-key", "csv")),
        headers=SAME_ORIGIN,
    )
    assert created.status_code == 201, created.text
    plan_id = created.json()["id"]
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
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    return plan_id, stored.state.runs[-1].recommendations[0].id


def _state(plan_id: str) -> PlanState:
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    return stored.state


def _empty_best_rows(client: TestClient, plan_id: str) -> int:
    rows = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]
    return sum(1 for r in rows if r["location"]["is_best"] and not r["occupied"])


def test_fr30_apply_over_http_views_follow(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        base = f"/api/plans/{plan_id}"
        summary_before = client.get(base).json()
        fast_before = client.get(f"{base}/before-after").json()["total"]["fast_in_best"]

        response = _command(client, plan_id, _apply_body(rec_id, 3))

        summary = client.get(base).json()
        parts = {r["part"]: r for r in client.get(f"{base}/parts").json()["parts"]}
        detail = client.get(f"{base}/parts/1100").json()
        locations = {
            r["location"]["code"]: r for r in client.get(f"{base}/locations").json()["locations"]
        }
        fast_after = client.get(f"{base}/before-after").json()["total"]["fast_in_best"]
        empty_best_rows = _empty_best_rows(client, plan_id)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 4,
        "events": [
            {
                "type": "move_made",
                "move_number": 1,
                "part": "1100",
                "from_location": "C-01-01-01",
                "to_location": "A-01-01-03",
                "rule": "rule_1",
                "round": 1,
            }
        ],
    }
    assert _row(uuid.UUID(plan_id))[0] == summary["version"] == 4
    assert parts["1100"]["current_location"]["code"] == "A-01-01-03"
    assert detail["current_location"]["code"] == "A-01-01-03"
    assert [c["part"] for c in locations["A-01-01-03"]["contents"]] == ["1100"]
    assert locations["C-01-01-01"]["occupied"] is False
    assert locations["C-01-01-01"]["contents"] == []
    assert fast_after["after"] == fast_before["after"] + 1
    # Retro item 28 (epic 4): the summary count follows the apply and agrees with /locations.
    assert summary["empty_best_locations"] == summary_before["empty_best_locations"] - 1
    assert summary["empty_best_locations"] == empty_best_rows
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    assert stored.state.steps[0].recommendation_id == rec_id
    assert stored.state.runs[-1].recommendations[0].status == "open"


def test_ad7_apply_rejected_over_http_leaves_plan_unchanged(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        # Already applied.
        plan_id, rec_id = _answer_key_after_run(client)
        assert _command(client, plan_id, _apply_body(rec_id, 3)).status_code == 200
        before = _row(uuid.UUID(plan_id))
        state_before = _state(plan_id)
        twice = _command(client, plan_id, _apply_body(rec_id, 4))
        after_twice = _row(uuid.UUID(plan_id))
        state_twice = _state(plan_id)

        # Outdated by a manual move of the same part in the run's round.
        other_id, other_rec = _answer_key_after_run(client)
        moved = _command(client, other_id, _manual_body("1100", "C-01-01-01", "B-01-04-01", 3))
        assert moved.status_code == 200, moved.text
        before_outdated = _row(uuid.UUID(other_id))
        state_before_outdated = _state(other_id)
        outdated = _command(client, other_id, _apply_body(other_rec, 4))
        after_outdated = _row(uuid.UUID(other_id))
        state_after_outdated = _state(other_id)

    assert twice.status_code == 409, twice.text
    assert twice.json() == {
        "error": {
            "code": "command_rejected",
            "message": "Recommendation #1 is already applied.",
            "details": [],
        }
    }
    assert after_twice == before
    assert state_twice == state_before
    assert len(state_twice.steps) == 1
    assert outdated.status_code == 409, outdated.text
    assert outdated.json() == {
        "error": {
            "code": "command_rejected",
            "message": "Recommendation #1 is outdated.",
            "details": [{"cause": "moved"}],
        }
    }
    assert after_outdated == before_outdated
    assert after_outdated[0] == 4
    assert state_after_outdated == state_before_outdated


def test_ad7_apply_unknown_or_invalid_id_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        before = _row(uuid.UUID(plan_id))
        state_before = _state(plan_id)
        unknown = _command(client, plan_id, _apply_body("nope", 3))
        empty = _command(client, plan_id, _apply_body("", 3))
        too_long = _command(client, plan_id, _apply_body("x" * 201, 3))

    assert unknown.status_code == 409, unknown.text
    assert unknown.json() == {
        "error": {
            "code": "command_rejected",
            "message": "This recommendation is not in the latest run.",
            "details": [],
        }
    }
    assert empty.status_code == 422, empty.text
    assert too_long.status_code == 422, too_long.text
    assert _row(uuid.UUID(plan_id)) == before
    assert _state(plan_id) == state_before


def test_ad6_repeated_apply_command_returns_stored_result(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        body = _apply_body(rec_id, 3)
        first = _command(client, plan_id, body)
        second = _command(client, plan_id, body)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json() == first.json()
    assert _row(uuid.UUID(plan_id))[0] == 4
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    assert len(stored.state.steps) == 1


def test_fr33_manual_move_after_apply_gets_run_round_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        assert _command(client, plan_id, _apply_body(rec_id, 3)).status_code == 200
        # Answer-key step 3: a manual move after the apply carries the run's round.
        response = _command(client, plan_id, _manual_body("9300", "B-01-03-02", "C-01-01-01", 4))

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 5,
        "events": [
            {
                "type": "move_made",
                "move_number": 2,
                "part": "9300",
                "from_location": "B-01-03-02",
                "to_location": "C-01-01-01",
                "rule": "manual",
                "round": 1,
            }
        ],
    }
