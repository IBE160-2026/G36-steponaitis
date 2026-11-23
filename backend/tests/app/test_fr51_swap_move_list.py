"""FR-51/FR-38/FR-35/FR-29: a drag swap through the move list, undo and outdated
recommendations over HTTP (SQLite here, Postgres in CI)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_answer_key_api import _answer_key_marked
from tests.app.test_apply_command import _answer_key_after_run, _command
from tests.app.test_drag_api import _swap_body
from tests.app.test_reopen import _ok, _version
from tests.app.test_undo_api import _undo_body


def _drag_body(type_: str, frm: str, to: str, parts: list[str], base_version: int) -> Any:
    body = _swap_body(frm, to, parts, [], base_version=base_version)
    body.pop("back_parts")
    return {**body, "type": type_}


def _lines(client: TestClient, plan_id: str) -> list[dict[str, Any]]:
    view = _ok(client.get(f"/api/plans/{plan_id}/move-list"))
    return [line for r in view["rounds"] for line in r["lines"]]


def _recommendations(client: TestClient, plan_id: str) -> dict[str, dict[str, Any]]:
    view = _ok(client.get(f"/api/plans/{plan_id}/recommendations"))
    return {row["part"]: row for row in view["recommendations"]}


def test_fr51_fr38_fr35_answer_key_swap_marks_then_undo_leaves_plain_manual(
    empty_tables: str,
) -> None:
    """Answer-key case: D-01-02-03 holds 9200 and (after move 1) 8300; only 9200 is swapped
    with 9100 at D-01-02-02. Both swap lines are marked; one undo leaves one plain line."""
    with TestClient(create_app()) as client:
        plan_id = _answer_key_marked(client)
        together = _drag_body("put_together", "D-01-01-01", "D-01-02-03", ["8300"], 2)
        _ok(_command(client, plan_id, together))
        swapped = _ok(
            _command(
                client,
                plan_id,
                _swap_body("D-01-02-03", "D-01-02-02", ["9200"], ["9100"], base_version=3),
            )
        )
        marked = _lines(client, plan_id)
        preview = _ok(client.get(f"/api/plans/{plan_id}"))["undo_preview"]
        _ok(_command(client, plan_id, _undo_body(3, _version(client, plan_id))))
        after_undo = _lines(client, plan_id)

    assert swapped["events"][0]["move_numbers"] == [2, 3]
    by_number = {line["move_number"]: line for line in marked}
    assert sorted(by_number) == [1, 2, 3]
    assert (by_number[1]["part"], by_number[1]["rule"], by_number[1]["swap"]) == (
        "8300",
        "manual",
        None,
    )
    numbers = [line["move_number"] for line in marked]
    assert abs(numbers.index(2) - numbers.index(3)) == 1
    swap_lines = [line for line in marked if line["move_number"] in (2, 3)]
    assert sorted((line["part"], line["rule"]) for line in swap_lines) == [
        ("9100", "manual"),
        ("9200", "manual"),
    ]
    marks = [line["swap"] for line in swap_lines]
    assert [(m["index"], m["size"]) for m in marks] == [(1, 2), (2, 2)]
    assert marks[0]["locations"] == marks[1]["locations"]
    assert sorted(marks[0]["locations"]) == ["D-01-02-02", "D-01-02-03"]
    assert (preview["move_number"], preview["part"]) == (3, "9100")
    assert sorted(
        (line["move_number"], line["part"], line["rule"], line["swap"]) for line in after_undo
    ) == [(1, "8300", "manual", None), (2, "9200", "manual", None)]


def test_fr51_fr38_swap_of_three_partly_undone_loses_its_marks(empty_tables: str) -> None:
    """Epic-8 retro item 72. Round 0 puts 8300 together with 9100 at D-01-02-02 (move 1); in
    round 1 9200 swaps with both (moves 2-4, each its own move, since FR-34 folds only within
    a round). Undoing 8300's back-step leaves one move each way, printed as plain lines."""
    with TestClient(create_app()) as client:
        plan_id = _answer_key_marked(client)
        together = _drag_body("put_together", "D-01-01-01", "D-01-02-02", ["8300"], 2)
        _ok(_command(client, plan_id, together))
        ran = {"type": "run", "command_id": str(uuid.uuid4()), "base_version": 3}
        _ok(_command(client, plan_id, ran))
        swapped = _ok(
            _command(
                client,
                plan_id,
                _swap_body("D-01-02-03", "D-01-02-02", ["9200"], ["9100", "8300"], base_version=4),
            )
        )
        whole = [line for line in _lines(client, plan_id) if line["move_number"] > 1]
        _ok(_command(client, plan_id, _undo_body(4, _version(client, plan_id))))
        partly = [line for line in _lines(client, plan_id) if line["move_number"] > 1]

    assert swapped["events"][0]["move_numbers"] == [2, 3, 4]
    assert sorted(line["swap"]["index"] for line in whole) == [1, 2, 3]
    assert {line["swap"]["size"] for line in whole} == {3}
    assert sorted(
        (line["move_number"], line["part"], line["rule"], line["swap"]) for line in partly
    ) == [(2, "9200", "manual", None), (3, "9100", "manual", None)]


def test_fr51_fr29_drag_outdates_moved_and_filled_recommendations(empty_tables: str) -> None:
    """Run 1 recommends 1100 C-01-01-01 → A-01-01-03 and 4400 A-01-03-02 → B-01-03-03."""
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        moved = _ok(
            _command(
                client, plan_id, _drag_body("move_parts", "C-01-01-01", "C-01-03-02", ["1100"], 3)
            )
        )
        filled = _ok(
            _command(
                client, plan_id, _drag_body("move_parts", "D-01-02-03", "B-01-03-03", ["9200"], 4)
            )
        )
        rows = _recommendations(client, plan_id)

    assert moved["events"][-1] == {"type": "recommendations_outdated", "count": 1, "cause": "moved"}
    assert filled["events"][-1] == {
        "type": "recommendations_outdated",
        "count": 1,
        "cause": "filled",
    }
    assert (rows["1100"]["status"], rows["1100"]["outdated"]["cause"]) == ("outdated", "moved")
    assert rows["4400"]["status"] == "outdated"
    assert rows["4400"]["outdated"]["cause"] == "filled"
    assert rows["4400"]["outdated"]["location"] == "B-01-03-03"
    assert rows["4400"]["outdated"]["move_number"] == 2


def test_fr51_fr35_fr29_each_undo_of_a_round_1_swap_outdates_every_open_recommendation(
    empty_tables: str,
) -> None:
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        swapped = _ok(
            _command(
                client,
                plan_id,
                _swap_body("D-01-02-02", "D-01-02-03", ["9100"], ["9200"], base_version=3),
            )
        )
        previews: list[dict[str, Any]] = []
        views: list[dict[str, dict[str, Any]]] = []
        for _ in range(2):
            preview = _ok(client.get(f"/api/plans/{plan_id}"))["undo_preview"]
            previews.append(preview)
            body = _undo_body(preview["move_number"], _version(client, plan_id))
            assert _ok(_command(client, plan_id, body))["events"][0]["type"] == "step_undone"
            views.append(_recommendations(client, plan_id))
        lines = _lines(client, plan_id)

    assert swapped["events"][0]["round"] == 1
    assert swapped["events"][0]["move_numbers"] == [1, 2]
    assert [(p["move_number"], p["part"]) for p in previews] == [(2, "9200"), (1, "9100")]
    for rows in views:
        assert len(rows) == 8
        assert {row["status"] for row in rows.values()} == {"outdated"}
        assert {row["outdated"]["cause"] for row in rows.values()} == {"undo"}
    assert lines == []
