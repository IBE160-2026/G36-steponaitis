"""FR-28/FR-29/AD-6: GET /api/plans/{id}/recommendations and `recommendations_outdated`
over HTTP (SQLite here, Postgres in CI)."""

import uuid

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


def test_fr29_mark_removal_outdates_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        before = client.get(f"/api/plans/{plan_id}/recommendations")
        assert before.status_code == 200, before.text
        assert before.json()["version"] == 3
        assert {r["status"] for r in before.json()["recommendations"]} == {"open"}

        removed = _command(
            client,
            plan_id,
            {
                "type": "remove_best_mark",
                "command_id": str(uuid.uuid4()),
                "base_version": 3,
                "mark": {"kind": "aisle", "aisle": "A"},
            },
        )
        after = client.get(f"/api/plans/{plan_id}/recommendations")
        rejected = _command(client, plan_id, _apply_body(rec_id, 4))

    assert removed.status_code == 200, removed.text
    assert removed.json() == {
        "version": 4,
        "events": [
            {"type": "mark_removed", "mark": {"kind": "aisle", "aisle": "A"}},
            {"type": "recommendations_outdated", "count": 5, "cause": "marks"},
        ],
    }
    body = after.json()
    assert body["version"] == 4
    assert body["run"]["round"] == 1
    outdated = [r for r in body["recommendations"] if r["status"] == "outdated"]
    assert [r["number"] for r in outdated] == [1, 2, 3, 4, 5]
    assert {r["outdated"]["cause"] for r in outdated} == {"marks"}
    assert rejected.status_code == 409, rejected.text
    assert rejected.json()["error"]["code"] == "command_rejected"
    assert _state(plan_id).runs[-1].recommendations[0].outdated is not None


def test_fr29_filling_manual_move_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        moved = _command(client, plan_id, _manual_body("1200", "B-01-01-02", "A-01-01-03", 3))
        row = client.get(f"/api/plans/{plan_id}/recommendations").json()["recommendations"][0]

    assert moved.status_code == 200, moved.text
    assert moved.json()["events"][-1] == {
        "type": "recommendations_outdated",
        "count": 1,
        "cause": "filled",
    }
    assert row["status"] == "outdated"
    assert row["outdated"] == {
        "cause": "filled",
        "location": "A-01-01-03",
        "move_number": 1,
        "partner": None,
        "aisle": None,
    }


def test_fr28_reasons_over_http_and_read_only(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        before = _row(uuid.UUID(plan_id))
        first = client.get(f"/api/plans/{plan_id}/recommendations")
        second = client.get(f"/api/plans/{plan_id}/recommendations")

    assert first.status_code == 200, first.text
    assert first.json() == second.json()
    assert _row(uuid.UUID(plan_id)) == before
    body = first.json()
    assert set(body) == {
        "version",
        "run",
        "recommendations",
        "no_space",
        "kept_parts",
        "recent_moves",
    }
    assert body["recommendations"][0]["reason"]["kind"] == "class"
    assert body["recommendations"][5]["reason"]["kind"] == "pick_group"
    assert [n["part"] for n in body["no_space"]] == ["1200", "10240", "2400", "6600"]
    assert body["no_space"][-1]["cause"] == {"rule": "rule_3", "aisle": "A", "outside_best": True}


def test_fr28_recommendations_unknown_plan(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{uuid.uuid4()}/recommendations")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "plan_not_found"


def test_fr28_view_rows_carry_display_facts(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        body = client.get(f"/api/plans/{plan_id}/recommendations").json()

    one = body["recommendations"][0]
    assert {k: one[k] for k in ("part", "description", "movement_class", "to_best")} == {
        "part": "1100",
        "description": "Brake pad set, front - VW Golf",
        "movement_class": "fast",
        "to_best": True,
    }
    assert one["from_best"] is False and isinstance(one["picks"], int)
    spark = body["no_space"][0]
    assert spark["part"] == "1200" and spark["description"] == "Spark plug - Ford Focus"
    assert (spark["from_location"], spark["from_best"]) == ("B-01-01-02", False)
    assert spark["movement_class"] == "fast" and isinstance(spark["picks"], int)


def test_fr42_recommendations_recent_moves_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
        before = client.get(f"/api/plans/{plan_id}/recommendations").json()
        applied = _command(client, plan_id, _apply_body(rec_id, 3))
        after = client.get(f"/api/plans/{plan_id}/recommendations").json()

    assert before["recent_moves"] == []
    assert applied.status_code == 200, applied.text
    row = next(r for r in after["recommendations"] if r["id"] == rec_id)
    assert after["recent_moves"] == [
        {
            "move_number": row["applied"]["move_number"],
            "part": row["part"],
            "rule": row["rule"],
            "round": 1,
            "from_location": row["from_location"],
            "to_location": row["to_location"],
        }
    ]
