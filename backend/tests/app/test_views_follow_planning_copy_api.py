"""FR-13/FR-14/FR-20/AD-3: after a manual move over POST /commands, every plan view
returns the new version and the moved part's new location (sample plan)."""

import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_parts_api import _sample_plan


def test_fr14_views_follow_a_manual_move_command(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        base = f"/api/plans/{plan_id}"
        groups = client.get(f"{base}/pick-groups").json()["pick_groups"]
        grouped = {p["part"] for row in groups for p in (row["part_a"], row["part_b"])}
        rows = client.get(f"{base}/parts").json()["parts"]
        row = next(
            r
            for r in rows
            if r["part"] in grouped
            and r["current_location"] is not None
            and not r["other_locations"]
        )
        part, source = row["part"], row["current_location"]["code"]
        locations = client.get(f"{base}/locations").json()["locations"]
        target_row = next(
            r
            for r in locations
            if not r["occupied"] and r["location"]["aisle"] != row["current_location"]["aisle"]
        )
        target, target_aisle = target_row["location"]["code"], target_row["location"]["aisle"]

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
        parts = client.get(f"{base}/parts").json()
        detail = client.get(f"{base}/parts/{part}").json()
        located = client.get(f"{base}/locations").json()
        pick_groups = client.get(f"{base}/pick-groups").json()
        search = client.get(f"{base}/search", params={"q": target}).json()

    assert command.status_code == 200, command.text
    assert command.json()["version"] == 2
    for name, view in {
        "parts": parts,
        "part": detail,
        "locations": located,
        "pick-groups": pick_groups,
        "search": search,
    }.items():
        assert view["version"] == 2, name

    moved = next(r for r in parts["parts"] if r["part"] == part)
    assert moved["current_location"]["code"] == target
    assert detail["current_location"]["code"] == target

    by_code = {r["location"]["code"]: r for r in located["locations"]}
    assert by_code[source]["occupied"] is False
    assert by_code[source]["contents"] == []
    assert [c["part"] for c in by_code[target]["contents"]] == [part]

    sides = [
        side
        for r in pick_groups["pick_groups"]
        for side in (r["part_a"], r["part_b"])
        if side["part"] == part
    ]
    assert sides
    assert all(side["aisle"] == target_aisle for side in sides)

    assert [m["location"]["code"] for m in search["locations"]] == [target]
