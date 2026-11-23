"""FR-51/AD-6/AD-16: the drag commands and the move preview over HTTP on the sample plan."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_apply_command import _command, _state
from tests.app.test_manual_move_api import _empty_location, _preview
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def _occupied_pair(client: TestClient, plan_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Two occupied locations, each holding exactly one part with stock above zero."""
    rows = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]
    single = [
        r
        for r in rows
        if r["occupied"] and len([c for c in r["contents"] if float(c["stock"]) > 0]) == 1
    ]
    return single[0], single[1]


def _code(row: dict[str, Any]) -> str:
    return row["location"]["code"]


def _part(row: dict[str, Any]) -> str:
    return next(c["part"] for c in row["contents"] if float(c["stock"]) > 0)


def _swap_body(
    frm: str, to: str, parts: list[str], back: list[str], *, base_version: int = 1
) -> dict[str, Any]:
    return {
        "type": "swap",
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "from": frm,
        "to": to,
        "parts": parts,
        "back_parts": back,
    }


def test_fr51_swap_over_http_one_version_bump_and_retry(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        a, b = _occupied_pair(client, plan_id)
        body = _swap_body(_code(a), _code(b), [_part(a)], [_part(b)])

        response = _command(client, plan_id, body)
        version_after = _row(uuid.UUID(plan_id))[0]
        steps_after = _state(plan_id).steps
        retry = _command(client, plan_id, body)
        version_retry = _row(uuid.UUID(plan_id))[0]
        steps_retry = _state(plan_id).steps
        detail = client.get(f"/api/plans/{plan_id}/parts/{_part(a)}").json()

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["version"] == 2
    swap_id = str(uuid.uuid5(uuid.UUID(body["command_id"]), "swap:1"))
    assert result["events"][0] == {
        "type": "swap_made",
        "swap_id": swap_id,
        "from_location": _code(a),
        "to_location": _code(b),
        "move_numbers": [1, 2],
        "round": 0,
    }
    assert [(e["type"], e["part"]) for e in result["events"][1:3]] == [
        ("move_made", _part(a)),
        ("move_made", _part(b)),
    ]
    assert version_after == 2
    assert [(s.move_number, s.swap_id) for s in steps_after] == [(1, swap_id), (2, swap_id)]
    assert retry.status_code == 200, retry.text
    assert retry.json() == result
    assert version_retry == 2
    assert steps_retry == steps_after
    assert detail["current_location"]["code"] == _code(b)


def test_fr51_rejected_drag_is_409_and_changes_nothing(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        a, b = _occupied_pair(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        response = _command(
            client,
            plan_id,
            {
                "type": "move_parts",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "from": _code(a),
                "to": _code(b),
                "parts": [_part(a)],
            },
        )
        no_back = _command(client, plan_id, _swap_body(_code(a), _code(b), [_part(a)], []))

    assert response.status_code == 409, response.text
    assert response.json() == {
        "error": {
            "code": "command_rejected",
            "message": f"{_code(b)} is occupied. Choose Swap or Put together.",
            "details": [],
        }
    }
    assert no_back.status_code == 409, no_back.text
    assert no_back.json()["error"]["message"] == "Choose at least one part to move back."
    assert _row(uuid.UUID(plan_id)) == before
    assert _state(plan_id).steps == []


def test_fr51_ad6_oversized_drag_is_422(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        a, b = _occupied_pair(client, plan_id)
        body = _swap_body(_code(a), _code(b), [_part(a)] * 101, [_part(b)])

        response = _command(client, plan_id, body)

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_failed"


def test_fr51_move_preview_target_occupied_and_empty_is_read_only(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        a, b = _occupied_pair(client, plan_id)
        kept = _command(
            client,
            plan_id,
            {
                "type": "set_keep",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "part": _part(b),
            },
        )
        empty = _empty_location(client, plan_id)
        before = _row(uuid.UUID(plan_id))

        occupied = _preview(client, plan_id, _part(a), _code(a), _code(b))
        vacant = _preview(client, plan_id, _part(a), _code(a), empty)
        after = _row(uuid.UUID(plan_id))

    assert kept.status_code == 200, kept.text
    assert occupied.status_code == 200, occupied.text
    view = occupied.json()
    assert view["version"] == 2
    assert view["target"] == "occupied"
    [held] = view["target_parts"]
    assert held["part"] == _part(b)
    assert held["kept_in_place"] is True
    assert float(held["stock"]) == float(
        next(c["stock"] for c in b["contents"] if c["part"] == _part(b))
    )
    assert {"description", "movement_class", "picks"} <= held.keys()
    assert vacant.status_code == 200, vacant.text
    assert vacant.json()["target"] == "empty"
    assert vacant.json()["target_parts"] == []
    assert after == before
