"""FR-32/AD-6: `set_keep` / `remove_keep` over HTTP and the kept fields of the views (SQLite
here, Postgres in CI)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_apply_command import _answer_key_after_run, _apply_body, _command, _state
from tests.app.test_plan_summary import _row


def _keep_body(type_: str, part: str, base_version: int) -> dict[str, Any]:
    return {
        "type": type_,
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "part": part,
    }


def _rec_5(client: TestClient, plan_id: str) -> dict[str, Any]:
    view = client.get(f"/api/plans/{plan_id}/recommendations").json()
    return next(r for r in view["recommendations"] if r["part"] == "0500")


def test_fr32_set_and_remove_keep_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        summary_before = client.get(f"/api/plans/{plan_id}").json()
        kept = _command(client, plan_id, _keep_body("set_keep", "0500", 3))
        row_after_set = _row(uuid.UUID(plan_id))
        repeat = _command(client, plan_id, _keep_body("set_keep", "0500", 4))
        row_after_repeat = _row(uuid.UUID(plan_id))
        rec = _rec_5(client, plan_id)
        rejected = _command(client, plan_id, _apply_body(rec["id"], 4))
        summary = client.get(f"/api/plans/{plan_id}").json()
        parts = client.get(f"/api/plans/{plan_id}/parts").json()["parts"]
        detail = client.get(f"/api/plans/{plan_id}/parts/0500").json()
        removed = _command(client, plan_id, _keep_body("remove_keep", "0500", 4))
        row_after_remove = _row(uuid.UUID(plan_id))
        absent = _command(client, plan_id, _keep_body("remove_keep", "0500", 5))
        row_after_absent = _row(uuid.UUID(plan_id))
        rec_after = _rec_5(client, plan_id)

    assert kept.status_code == 200, kept.text
    assert kept.json() == {"version": 4, "events": [{"type": "keep_set", "part": "0500"}]}
    assert repeat.status_code == 200, repeat.text
    assert repeat.json() == {"version": 4, "events": []}
    assert row_after_repeat == row_after_set
    assert rec["status"] == "kept"
    assert rejected.status_code == 409, rejected.text
    assert rejected.json()["error"]["code"] == "command_rejected"
    assert rejected.json()["error"]["message"] == "0500 is kept in place."
    assert summary["kept_in_place"] == 1
    assert summary["apply_all_count"] == summary_before["apply_all_count"] - 1
    assert [p["part"] for p in parts if p["kept_in_place"]] == ["0500"]
    assert detail["kept_in_place"] is True
    assert removed.json() == {"version": 5, "events": [{"type": "keep_removed", "part": "0500"}]}
    assert absent.status_code == 200, absent.text
    assert absent.json() == {"version": 5, "events": []}
    assert row_after_absent == row_after_remove
    assert rec_after["status"] == "open"
    assert _state(plan_id).keep_marks == []


def test_fr32_set_keep_unknown_part_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        before = _row(uuid.UUID(plan_id))
        response = _command(client, plan_id, _keep_body("set_keep", "NOPE", 3))

    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "command_rejected"
    assert _row(uuid.UUID(plan_id)) == before
    assert _state(plan_id).keep_marks == []


def test_fr32_kept_parts_and_no_space_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        _command(client, plan_id, _keep_body("set_keep", "1200", 3))
        _command(client, plan_id, _keep_body("set_keep", "9100", 4))
        view = client.get(f"/api/plans/{plan_id}/recommendations").json()

    assert {n["part"]: n["kept_in_place"] for n in view["no_space"]}["1200"] is True
    assert [k["part"] for k in view["kept_parts"]] == ["9100"]
    assert set(view["kept_parts"][0]) == {
        "part",
        "description",
        "movement_class",
        "picks",
        "from_location",
        "from_best",
    }
