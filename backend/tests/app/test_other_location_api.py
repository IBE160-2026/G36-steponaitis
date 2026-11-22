"""FR-31/AD-3/AD-7: the other-locations endpoint and `apply_other_location` over HTTP
(SQLite here, Postgres in CI). Answer key, aisle A marked, run 1 done: recommendation #2
moves 4400 A-01-03-02 -> B-01-03-03 (rule 2)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_apply_command import _answer_key_after_run, _apply_body, _command, _state
from tests.app.test_plan_summary import _row

REC_2_SET = [
    "B-01-04-01",
    "B-01-04-02",
    "B-01-04-03",
    "C-01-03-01",
    "C-01-03-02",
    "C-01-03-03",
    "D-01-03-01",
    "D-01-03-02",
    "D-01-03-03",
]


def _other_body(rec_id: str, to_location: str, base_version: int) -> dict[str, Any]:
    return {
        "type": "apply_other_location",
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "recommendation_id": rec_id,
        "to_location": to_location,
    }


def _rec(client: TestClient, plan_id: str, number: int) -> dict[str, Any]:
    view = client.get(f"/api/plans/{plan_id}/recommendations").json()
    return next(r for r in view["recommendations"] if r["number"] == number)


def _others_url(plan_id: str, rec_id: str) -> str:
    return f"/api/plans/{plan_id}/recommendations/{rec_id}/other-locations"


def test_fr31_other_locations_endpoint(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_1 = _answer_key_after_run(client)
        before = _row(uuid.UUID(plan_id))
        rec_2 = _rec(client, plan_id, 2)["id"]
        response = client.get(_others_url(plan_id, rec_2))
        rule_1 = client.get(_others_url(plan_id, rec_1)).json()
        unknown = client.get(_others_url(plan_id, "nope"))
        missing = client.get(_others_url(str(uuid.uuid4()), rec_2))

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "recommendation_id", "locations"}
    assert (body["version"], body["recommendation_id"]) == (3, rec_2)
    assert [ref["code"] for ref in body["locations"]] == REC_2_SET
    assert body["locations"][0] == {
        "code": "B-01-04-01",
        "aisle": "B",
        "level": "4",
        "section": "1",
        "position": "1",
        "is_best": False,
    }
    assert all(ref["is_best"] is False for ref in body["locations"])
    assert rule_1["locations"] == []  # aisle A has no other empty location
    assert unknown.status_code == 200, unknown.text
    assert unknown.json()["locations"] == []
    assert missing.status_code == 404, missing.text
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert _row(uuid.UUID(plan_id)) == before


def test_fr31_apply_other_location_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        base = f"/api/plans/{plan_id}"
        rec_2 = _rec(client, plan_id, 2)["id"]
        before_after = client.get(f"{base}/before-after").json()
        response = _command(client, plan_id, _other_body(rec_2, "C-01-03-02", 3))
        row = _rec(client, plan_id, 2)
        after = client.get(f"{base}/before-after").json()
        others_after = client.get(_others_url(plan_id, rec_2)).json()
        again = _command(client, plan_id, _apply_body(rec_2, 4))

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 4,
        "events": [
            {
                "type": "move_made",
                "move_number": 1,
                "part": "4400",
                "from_location": "A-01-03-02",
                "to_location": "C-01-03-02",
                "rule": "rule_2",
                "round": 1,
            }
        ],
    }
    assert row["status"] == "applied"
    assert row["to_location"] == "B-01-03-03"
    assert row["applied"] == {
        "move_number": 1,
        "round": 1,
        "to_location": "C-01-03-02",
        "to_best": False,
    }
    state = _state(plan_id)
    [step] = state.steps
    assert (step.to_location, step.rule, step.round, step.recommendation_id) == (
        "C-01-03-02",
        "rule_2",
        1,
        rec_2,
    )
    assert state.runs[-1].recommendations[1].to_location == "B-01-03-03"
    aisles_before = {a["aisle"]: a for a in before_after["aisles"]}
    aisles = {a["aisle"]: a for a in after["aisles"]}
    assert after["has_moves"] is True
    assert aisles["C"]["moved_in"] == ["4400"]
    assert aisles["B"]["moved_in"] == []
    assert aisles["C"]["occupied"]["after"] == aisles_before["C"]["occupied"]["after"] + 1
    assert aisles["B"]["occupied"]["after"] == aisles_before["B"]["occupied"]["after"]
    assert others_after["locations"] == []
    assert again.status_code == 409, again.text
    assert again.json()["error"]["message"] == "Recommendation #2 is already applied."


def test_fr31_apply_into_other_target_outdates_it(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        rec_2 = _rec(client, plan_id, 2)["id"]
        response = _command(client, plan_id, _other_body(rec_2, "B-01-04-01", 3))
        rec_3 = _rec(client, plan_id, 3)

    assert response.status_code == 200, response.text
    assert [e["type"] for e in response.json()["events"]] == [
        "move_made",
        "recommendations_outdated",
    ]
    assert rec_3["status"] == "outdated"
    assert rec_3["outdated"]["cause"] == "filled"


def test_fr31_apply_other_location_rejected_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        rec_2 = _rec(client, plan_id, 2)["id"]
        before = _row(uuid.UUID(plan_id))
        outside = _command(client, plan_id, _other_body(rec_2, "A-01-01-03", 3))
        suggested = _command(client, plan_id, _other_body(rec_2, "B-01-03-03", 3))
        unknown = _command(client, plan_id, _other_body("nope", "B-01-04-01", 3))
        after = _row(uuid.UUID(plan_id))

    assert outside.status_code == 409, outside.text
    assert outside.json()["error"]["code"] == "command_rejected"
    assert outside.json()["error"]["message"] == (
        "A-01-01-03 is not an allowed location for recommendation #2."
    )
    assert suggested.status_code == 409, suggested.text
    assert suggested.json()["error"]["message"] == (
        "B-01-03-03 is not an allowed location for recommendation #2."
    )
    assert unknown.status_code == 409, unknown.text
    assert unknown.json()["error"]["message"] == "This recommendation is not in the latest run."
    assert after == before
    assert _state(plan_id).steps == []
