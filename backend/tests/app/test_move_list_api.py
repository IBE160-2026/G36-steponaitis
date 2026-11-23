"""FR-38: GET /api/plans/{id}/move-list on the sample data; it never writes the plan."""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.domain.state import PlanState
from swp.domain.state_migrations import upcast
from tests.app.test_apply_command import _command
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row
from tests.app.test_reopen import _ok, _raw_state, _single_location_parts, _version, _write_state
from tests.app.test_undo_api import _undo_body


def _instant(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def test_fr38_move_list_endpoint_empty_plan(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        summary = client.get(f"/api/plans/{plan_id}").json()
        start = datetime.now(UTC)
        response = client.get(f"/api/plans/{plan_id}/move-list")
        again = client.get(f"/api/plans/{plan_id}/move-list")
        end = datetime.now(UTC)

    assert response.status_code == 200, response.text
    assert again.status_code == 200, again.text
    body = response.json()
    assert set(body) == {"version", "header", "rounds"}
    assert body["version"] == summary["version"] == 1
    header = body["header"]
    assert set(header) == {"name", "data_as_of", "uploaded_at", "rounds", "generated_at"}
    assert header["name"] == summary["name"]
    assert header["data_as_of"] == summary["data_as_of"]
    assert _instant(header["uploaded_at"]) == _instant(summary["uploaded_at"])
    assert header["rounds"] == 0
    assert body["rounds"] == []
    generated = _instant(header["generated_at"])
    assert generated.tzinfo is not None
    assert start <= generated <= end
    assert _row(uuid.UUID(plan_id)) == before


def test_fr38_move_list_after_a_manual_move(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        base = f"/api/plans/{plan_id}"
        locations = client.get(f"{base}/locations").json()["locations"]
        roster = {r["part"]: r for r in client.get(f"{base}/parts").json()["parts"]}
        source_row = next(
            r
            for r in locations
            if r["contents"]
            and (roster[r["contents"][0]["part"]]["current_location"] or {}).get("code")
            == r["location"]["code"]
        )
        part = source_row["contents"][0]["part"]
        source = source_row["location"]["code"]
        target = next(r for r in locations if not r["occupied"])["location"]["code"]

        command = client.post(
            f"{base}/commands",
            json={
                "type": "manual_move",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "part": part,
                "from": source,
                "to": target,
            },
            headers=SAME_ORIGIN,
        )
        response = client.get(f"{base}/move-list")

    assert command.status_code == 200, command.text
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["version"] == 2
    assert body["header"]["rounds"] == 1
    assert body["rounds"] == [
        {
            "round": 0,
            "label": "before the first run",
            "lines": [
                {
                    "move_number": 1,
                    "round": 0,
                    "part": part,
                    "description": roster[part]["description"],
                    "from_location": source,
                    "to_location": target,
                    "rule": "manual",
                    "swap": None,
                }
            ],
        }
    ]
    assert roster[part]["description"]


def test_fr38_move_list_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/move-list")
        malformed = client.get("/api/plans/abc/move-list")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_failed"


def test_fr38_move_list_marks_an_intact_swap_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        base = f"/api/plans/{plan_id}"
        candidates = _single_location_parts(client, plan_id, set())
        p, p_at = candidates[0]
        q, q_at = next((part, at) for part, at in candidates if at != p_at)
        state = PlanState.model_validate(upcast("state", _raw_state(plan_id)))
        number = state.next_move_number
        swap = [(p, p_at, q_at), (q, q_at, p_at)]
        steps = [
            {
                "move_number": number + offset,
                "part": part,
                "from_location": source,
                "to_location": target,
                "rule": "manual",
                "round": 0,
                "recommendation_id": None,
                "swap_id": "swap-1",
            }
            for offset, (part, source, target) in enumerate(swap)
        ]
        doc = state.model_dump(mode="json")
        _write_state(plan_id, {**doc, "steps": steps, "next_move_number": number + 2})

        marked = _ok(client.get(f"{base}/move-list"))
        _ok(_command(client, plan_id, _undo_body(number + 1, _version(client, plan_id))))
        after_undo = _ok(client.get(f"{base}/move-list"))

    lines = [line for r in marked["rounds"] for line in r["lines"]]
    assert sorted(line["move_number"] for line in lines) == [number, number + 1]
    first = lines[0]
    pair = [first["from_location"], first["to_location"]]
    assert sorted(pair) == sorted([p_at, q_at])
    assert [line["swap"] for line in lines] == [
        {"index": 1, "size": 2, "locations": pair},
        {"index": 2, "size": 2, "locations": pair},
    ]
    assert all(line["rule"] == "manual" for line in lines)
    remaining = [line for r in after_undo["rounds"] for line in r["lines"]]
    assert [(line["part"], line["move_number"], line["swap"]) for line in remaining] == [
        (p, number, None)
    ]
