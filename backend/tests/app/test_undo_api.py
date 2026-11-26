"""FR-35/AD-5/AD-6: the `undo` command over HTTP (SQLite here, Postgres in CI)."""

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
from tests.app.test_plan_summary import _row


def _undo_body(
    move_number: int, base_version: int, command_id: uuid.UUID | None = None
) -> dict[str, Any]:
    return {
        "type": "undo",
        "command_id": str(command_id or uuid.uuid4()),
        "base_version": base_version,
        "expected_move_number": move_number,
    }


def test_fr35_undo_over_http_outdates_and_moves_preview(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        applied = _command(client, plan_id, _apply_body(rec_id, 3))  # move 1: 1100
        manual = _command(client, plan_id, _manual_body("9300", "B-01-03-02", "C-01-01-01", 4))
        before = client.get(f"/api/plans/{plan_id}").json()
        undone = _command(client, plan_id, _undo_body(2, 5))
        summary = client.get(f"/api/plans/{plan_id}").json()
        view = client.get(f"/api/plans/{plan_id}/recommendations").json()

    assert manual.status_code == 200, manual.text
    assert applied.status_code == 200, applied.text
    assert before["undo_preview"]["move_number"] == 2
    assert undone.status_code == 200, undone.text
    body = undone.json()
    assert body["version"] == 6
    assert body["events"][0] == {"type": "step_undone", "undone": before["undo_preview"]}
    [outdated] = body["events"][1:]
    assert outdated["type"] == "recommendations_outdated"
    assert outdated["cause"] == "undo"
    assert outdated["round"] == 1
    rows = {r["id"]: r for r in view["recommendations"]}
    assert rows.pop(rec_id)["status"] == "applied"
    assert outdated["count"] == len(rows)
    assert {r["status"] for r in rows.values()} == {"outdated"}
    assert {r["outdated"]["cause"] for r in rows.values()} == {"undo"}
    assert summary["version"] == 6
    assert summary["undo_preview"]["move_number"] == 1
    assert summary["undo_preview"]["part"] == "1100"
    assert summary["current_round"] == before["current_round"] == 1
    assert _state(plan_id).next_move_number == 3


def test_fr35_undo_wrong_number_or_no_steps_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        empty = _command(client, plan_id, _undo_body(1, 3))
        _command(client, plan_id, _apply_body(rec_id, 3))
        before = _row(uuid.UUID(plan_id))
        wrong = _command(client, plan_id, _undo_body(7, 4))
        after = _row(uuid.UUID(plan_id))

    assert empty.status_code == 409, empty.text
    assert empty.json()["error"]["code"] == "command_rejected"
    assert empty.json()["error"]["message"] == "There is no move to undo."
    assert wrong.status_code == 409, wrong.text
    error = wrong.json()["error"]
    assert error["code"] == "command_rejected"
    assert error["message"] == "Move 7 is no longer the last move. Undo the last move again."
    assert error["details"] == [{"last_move_number": 1}]
    assert after == before


def test_ad6_repeated_undo_command_returns_stored_result(empty_tables: str) -> None:
    command_id = uuid.uuid4()
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        _command(client, plan_id, _apply_body(rec_id, 3))
        _command(client, plan_id, _manual_body("9300", "B-01-03-02", "C-01-01-01", 4))
        first = _command(client, plan_id, _undo_body(2, 5, command_id))
        second = _command(client, plan_id, _undo_body(2, 6, command_id))

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert [step.move_number for step in _state(plan_id).steps] == [1]
