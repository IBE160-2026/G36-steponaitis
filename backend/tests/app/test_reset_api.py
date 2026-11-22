"""FR-35/FR-36/AD-5/AD-6: the `reset` command over HTTP (SQLite here, Postgres in CI)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_apply_command import (
    _answer_key_after_run,
    _apply_body,
    _command,
    _manual_body,
    _state,
)
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.app.test_plan_summary import _row


def _reset_body(base_version: int, command_id: uuid.UUID | None = None) -> dict[str, Any]:
    return {
        "type": "reset",
        "command_id": str(command_id or uuid.uuid4()),
        "base_version": base_version,
    }


def _planned(client: TestClient) -> str:
    """Answer-key plan, aisle A marked, run 1, 1100 applied, 0100 moved twice (combined) and
    0500 kept (version 7): 2 effective moves from 3 steps."""
    plan_id, rec_id = _answer_key_after_run(client)
    for body in [
        _apply_body(rec_id, 3),
        _manual_body("0100", "A-01-01-01", "C-01-03-02", 4),
        _manual_body("0100", "C-01-03-02", "C-01-01-01", 5),
        {"type": "set_keep", "command_id": str(uuid.uuid4()), "base_version": 6, "part": "0500"},
    ]:
        response = _command(client, plan_id, body)
        assert response.status_code == 200, response.text
    return plan_id


def test_fr35_reset_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _planned(client)
        before = client.get(f"/api/plans/{plan_id}").json()
        reset = _command(client, plan_id, _reset_body(7))
        summary = client.get(f"/api/plans/{plan_id}").json()
        view = client.get(f"/api/plans/{plan_id}/recommendations").json()

    assert before["move_count"] == 2
    assert len(_state(plan_id).steps) == 0
    assert reset.status_code == 200, reset.text
    assert reset.json() == {"version": 8, "events": [{"type": "plan_reset", "moves_removed": 2}]}
    assert summary["version"] == 8
    assert summary["current_round"] == 0
    assert summary["move_count"] == 0
    assert summary["undo_preview"] is None
    assert summary["best_locations"] == before["best_locations"] > 0
    assert summary["kept_in_place"] == before["kept_in_place"] == 1
    assert view["run"] is None
    assert view["recommendations"] == []
    assert view["no_space"] == []
    assert _state(plan_id).next_move_number == 1


def test_fr35_after_reset_next_run_is_round_1_and_move_1(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _planned(client)
        _command(client, plan_id, _reset_body(7))
        ran = _command(
            client, plan_id, {"type": "run", "command_id": str(uuid.uuid4()), "base_version": 8}
        )
        rec_id = _state(plan_id).runs[-1].recommendations[0].id
        applied = _command(client, plan_id, _apply_body(rec_id, 9))

    assert ran.status_code == 200, ran.text
    assert ran.json()["events"][0]["round"] == 1
    assert applied.status_code == 200, applied.text
    [move] = [e for e in applied.json()["events"] if e["type"] == "move_made"]
    assert (move["move_number"], move["round"]) == (1, 1)


def test_ad6_repeated_reset_command_returns_stored_result(empty_tables: str) -> None:
    command_id = uuid.uuid4()
    with TestClient(create_app()) as client:
        plan_id = _planned(client)
        first = _command(client, plan_id, _reset_body(7, command_id))
        second = _command(client, plan_id, _reset_body(8, command_id))
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert summary["version"] == 8


def test_ad6_reset_of_fresh_plan_is_noop(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        created = client.post(
            "/api/plans",
            data={"name": "Fresh"},
            files=_multipart(_data_files("answer-key", "csv")),
            headers=SAME_ORIGIN,
        )
        plan_id = created.json()["id"]
        before = _row(uuid.UUID(plan_id))
        reset = _command(client, plan_id, _reset_body(1))
        after = _row(uuid.UUID(plan_id))

    assert reset.status_code == 200, reset.text
    assert reset.json() == {"version": 1, "events": []}
    assert after == before
