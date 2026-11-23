"""FR-42/FR-14/FR-22: GET /api/plans/{id}/wall?aisle= on the sample data; it never writes."""

import uuid
from decimal import Decimal
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app import plans
from swp.domain.import_data import InventoryLine
from tests.app.test_apply_command import _answer_key_after_run, _command, _state
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_layout_api import NOW, _max_size_import
from tests.app.test_manual_move_api import _move
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def _mark(client: TestClient, plan_id: str, base_version: int, mark: dict[str, Any]) -> None:
    response = client.post(
        f"/api/plans/{plan_id}/commands",
        json={
            "type": "set_best_mark",
            "command_id": str(uuid.uuid4()),
            "base_version": base_version,
            "mark": mark,
        },
        headers=SAME_ORIGIN,
    )
    assert response.status_code == 200, response.text


def test_fr42_wall_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"})
        table = client.get(f"/api/plans/{plan_id}/locations").json()

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "version",
        "aisle",
        "round",
        "locations",
        "rail_levels",
        "moves",
        "aisles",
        "warehouse",
    }
    assert (body["version"], body["aisle"], body["rail_levels"]) == (1, "A", [])
    assert (body["round"], body["moves"]) == (0, [])
    rows = body["locations"]
    in_a = [row for row in table["locations"] if row["location"]["aisle"] == "A"]
    assert len(rows) == len(in_a) == 223
    assert [row["location"]["code"] for row in rows] == [row["location"]["code"] for row in in_a]
    assert set(rows[0]) == {
        "location",
        "walk_path",
        "occupied",
        "parts",
        "top_part",
        "covering_marks",
    }
    stocked = next(row for row in rows if row["parts"])
    assert set(stocked["parts"][0]) == {
        "part",
        "description",
        "movement_class",
        "picks",
        "stock",
        "kept_in_place",
    }
    assert stocked["top_part"] == stocked["parts"][0]
    for row in rows:
        picks = [(-part["picks"], part["part"]) for part in row["parts"]]
        assert picks == sorted(picks)
        assert row["occupied"] == bool(row["parts"])
    assert body["warehouse"] == {
        "locations": 2_000,
        "occupied": 1_584,
        "empty": 416,
        "occupied_percent": "79.2",
        "best": 0,
        "empty_best": 0,
    }
    assert [a["aisle"] for a in body["aisles"]] == [a["aisle"] for a in table["aisles"]]
    assert [a["aisle"] for a in body["aisles"]] == list("ABCDEFGHI")
    for counts, occupancy in zip(body["aisles"], table["aisles"], strict=True):
        assert {key: counts[key] for key in occupancy} == occupancy
        assert (counts["moves"], counts["best"], counts["aisle_marked"]) == (0, 0, False)
    assert _row(uuid.UUID(plan_id)) == before


def test_fr22_wall_endpoint_marks(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        b_cell = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "B"}).json()
        b_code = next(
            row["location"]["code"]
            for row in b_cell["locations"]
            if row["location"]["level"] != "1"
        )
        _mark(client, plan_id, 1, {"kind": "aisle", "aisle": "A"})
        _mark(client, plan_id, 2, {"kind": "level", "level": "1", "aisle": None})
        _mark(client, plan_id, 3, {"kind": "location", "location": b_code})
        a = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"}).json()
        b = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "B"}).json()
        summary = client.get(f"/api/plans/{plan_id}").json()

    a_levels = {row["location"]["level"] for row in a["locations"]}
    assert set(a["rail_levels"]) == a_levels
    assert a["rail_levels"] == sorted(a_levels, key=int)
    assert b["rail_levels"] == ["1"]
    cell = next(row for row in b["locations"] if row["location"]["code"] == b_code)
    assert cell["location"]["is_best"] is True
    assert cell["covering_marks"] == [{"kind": "location", "location": b_code}]
    counts = {c["aisle"]: c for c in b["aisles"]}
    assert counts["A"]["aisle_marked"] is True
    assert not any(c["aisle_marked"] for name, c in counts.items() if name != "A")
    assert counts["A"]["best"] == counts["A"]["locations"]
    assert b["version"] == 4
    best = (summary["best_locations"], summary["empty_best_locations"])
    assert (b["warehouse"]["best"], b["warehouse"]["empty_best"]) == best
    assert sum(c["best"] for c in counts.values()) == best[0]
    assert sum(c["empty_best"] for c in counts.values()) == best[1]


def test_fr42_wall_moves_after_a_run(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _rec_id = _answer_key_after_run(client)
        wall = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"}).json()

    recs = _state(plan_id).runs[-1].recommendations
    assert recs
    moves = {c["aisle"]: c["moves"] for c in wall["aisles"]}
    expected: dict[str, int] = dict.fromkeys(moves, 0)
    for rec in recs:
        # Answer-key codes start with their aisle: "A-01-01-01".
        for name in {rec.from_location[0], rec.to_location[0]}:
            expected[name] += 1
    assert moves == expected
    assert wall["round"] == 1
    assert len(wall["moves"]) == moves["A"]
    in_a = [r for r in recs if "A" in {r.from_location[0], r.to_location[0]}]
    assert [m["number"] for m in wall["moves"]] == [r.number for r in in_a]
    first = wall["moves"][0]
    assert set(first) == {
        "kind",
        "recommendation_id",
        "number",
        "move_number",
        "rule",
        "part",
        "description",
        "movement_class",
        "picks",
        "from_location",
        "to_location",
        "status",
    }
    assert (first["kind"], first["status"], first["move_number"]) == (
        "recommendation",
        "open",
        None,
    )


def test_fr42_wall_follows_a_manual_move(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"}).json()
        source = next(row for row in before["locations"] if len(row["parts"]) == 1)
        target = next(row for row in before["locations"] if not row["occupied"])
        part = source["parts"][0]["part"]
        moved = _command(
            client, plan_id, _move(part, source["location"]["code"], target["location"]["code"])
        )
        assert moved.status_code == 200, moved.text
        after = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"}).json()

    rows = {row["location"]["code"]: row for row in after["locations"]}
    assert after["version"] > before["version"]
    [manual] = after["moves"]
    assert (manual["kind"], manual["status"], manual["part"]) == ("manual", "manual", part)
    assert manual["to_location"]["code"] == target["location"]["code"]
    assert {c["aisle"]: c["moves"] for c in after["aisles"]}["A"] == 1
    assert rows[target["location"]["code"]]["occupied"] is True
    assert rows[target["location"]["code"]]["top_part"]["part"] == part
    assert rows[source["location"]["code"]]["parts"] == [
        p for p in source["parts"] if p["part"] != part
    ]


def test_fr42_wall_unknown_aisle_and_plan(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        unknown = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "Z"})
        missing_aisle = client.get(f"/api/plans/{plan_id}/wall")
        empty_aisle = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": ""})
        too_long = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A" * 65})
        missing_plan = client.get(f"/api/plans/{uuid.uuid4()}/wall", params={"aisle": "A"})

    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "not_found"
    assert unknown.json()["error"]["message"] == "This aisle is not in the plan."
    assert missing_aisle.status_code == 422
    assert missing_aisle.json()["error"]["code"] == "validation_failed"
    assert too_long.status_code == 422
    assert empty_aisle.status_code == 422
    assert empty_aisle.json()["error"]["code"] == "validation_failed"
    assert missing_plan.status_code == 404
    assert missing_plan.json()["error"]["code"] == "plan_not_found"


def test_fr42_warehouse_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/warehouse")
        wall = client.get(f"/api/plans/{plan_id}/wall", params={"aisle": "A"}).json()

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "round", "run", "locations", "moves", "aisles", "warehouse"}
    assert (body["version"], body["round"], body["run"], body["moves"]) == (1, 0, None, [])
    assert len(body["locations"]) == 2_000
    assert set(body["locations"][0]) == {"code", "occupied", "movement_class"}
    assert body["aisles"] == wall["aisles"]
    assert body["warehouse"] == wall["warehouse"]
    rows = {row["code"]: row for row in body["locations"]}
    for cell in wall["locations"]:
        row = rows[cell["location"]["code"]]
        top = cell["top_part"]["movement_class"] if cell["top_part"] else None
        assert (row["occupied"], row["movement_class"]) == (cell["occupied"], top)
    assert _row(uuid.UUID(plan_id)) == before


def test_fr42_warehouse_endpoint_after_a_run(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, _rec_id = _answer_key_after_run(client)
        body = client.get(f"/api/plans/{plan_id}/warehouse").json()

    recs = _state(plan_id).runs[-1].recommendations
    assert body["run"] == {"round": 1, "recommendations": len(recs)}
    assert [m["number"] for m in body["moves"]] == [r.number for r in recs]
    assert body["version"] == 3


def test_fr42_warehouse_endpoint_unknown_plan(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/warehouse")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"


def test_fr42_warehouse_endpoint_max_size_under_4_mb(empty_tables: str) -> None:
    imported = _max_size_import()
    # Worst case for size: every location stocked, so every row carries a class.
    stocked = [
        InventoryLine(part=f"P{n % 100:03}", location=code, quantity=Decimal(1))
        for n, code in enumerate(imported.data.locations)
    ]
    parts = {f"P{n:03}": f"Part {n}" for n in range(100)}
    data = imported.data.model_copy(update={"inventory": stocked, "parts": parts})
    created = plans.create("Max", imported.model_copy(update={"data": data}), now=NOW)

    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{created.id}/warehouse")

    assert response.status_code == 200, response.text
    rows = response.json()["locations"]
    assert len(rows) == 25_000
    assert all(row["occupied"] and row["movement_class"] for row in rows)
    assert len(response.content) < 4_000_000, len(response.content)
