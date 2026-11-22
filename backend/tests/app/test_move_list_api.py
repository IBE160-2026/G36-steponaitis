"""FR-38: GET /api/plans/{id}/move-list on the sample data; it never writes the plan."""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


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
