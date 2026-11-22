"""FR-9/NFR-12/AD-4/AD-5: a saved plan reopens exactly as it was left, after a restart.

A "restart" disposes the engine, clears the settings and engine caches and builds a new app,
so nothing read before it can survive in memory. SQLite here, Postgres 17 in CI.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from swp.api.app import create_app
from swp.app import plans
from swp.app.imports import read_import
from swp.domain.planning import replay
from swp.domain.state import PlanState
from swp.domain.state_migrations import upcast
from swp.store.db import get_engine
from swp.store.models import PlanRow
from tests.app.test_apply_command import _answer_key_after_run, _apply_body, _command
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.app.test_plan_summary import NOW, _row
from tests.conftest import _clear_caches

FIXTURES = Path(__file__).resolve().parents[1] / "domain" / "fixtures"


def _restart() -> TestClient:
    """A new app on a fresh engine and settings: what a backend restart leaves (FR-9)."""
    get_engine().dispose()
    _clear_caches()
    return TestClient(create_app())


def _raw_state(plan_id: str) -> dict[str, Any]:
    with get_engine().connect() as conn:
        state = conn.execute(select(PlanRow.state).where(PlanRow.id == uuid.UUID(plan_id))).one()[0]
    assert isinstance(state, dict)
    return state


def _write_state(plan_id: str, state: dict[str, Any]) -> None:
    """Write `state` into the row as stored, without a command (no version bump)."""
    with get_engine().begin() as conn:
        conn.execute(update(PlanRow).where(PlanRow.id == uuid.UUID(plan_id)).values(state=state))


def _ok(response: Any) -> Any:
    assert response.status_code == 200, response.text
    return response.json()


def _version(client: TestClient, plan_id: str) -> int:
    return int(_ok(client.get(f"/api/plans/{plan_id}"))["version"])


def _send(client: TestClient, plan_id: str, body: dict[str, Any]) -> dict[str, Any]:
    body = {"command_id": str(uuid.uuid4()), "base_version": _version(client, plan_id), **body}
    return _ok(_command(client, plan_id, body))


def _move(client: TestClient, plan_id: str, part: str, a: str, b: str) -> dict[str, Any]:
    return _send(client, plan_id, {"type": "manual_move", "part": part, "from": a, "to": b})


def _empty_locations(client: TestClient, plan_id: str) -> list[str]:
    rows = _ok(client.get(f"/api/plans/{plan_id}/locations"))["locations"]
    return [row["location"]["code"] for row in rows if not row["occupied"]]


def _single_location_parts(
    client: TestClient, plan_id: str, avoid: set[str]
) -> list[tuple[str, str]]:
    """Parts with stock at exactly one location (not in `avoid`), with that location."""
    rows = _ok(client.get(f"/api/plans/{plan_id}/parts"))["parts"]
    return [
        (row["part"], row["current_location"]["code"])
        for row in rows
        if row["current_location"] is not None
        and not row["other_locations"]
        and row["part"] not in avoid
    ]


def _views(client: TestClient, plan_id: str, parts: list[str]) -> dict[str, Any]:
    """Every GET view of the plan (and the saved-plans list), keyed by path."""
    paths = [
        f"/api/plans/{plan_id}",
        f"/api/plans/{plan_id}/locations",
        f"/api/plans/{plan_id}/parts",
        f"/api/plans/{plan_id}/pick-groups",
        f"/api/plans/{plan_id}/before-after",
        f"/api/plans/{plan_id}/recommendations",
        *(f"/api/plans/{plan_id}/parts/{part}" for part in parts),
        *(f"/api/plans/{plan_id}/search?q={part}" for part in parts),
        "/api/plans",
    ]
    return {path: _ok(client.get(path)) for path in paths}


def _outdate(client: TestClient, plan_id: str, rec: dict[str, Any]) -> str:
    """Move `rec`'s part away from its from-location (not to its target), so the open
    recommendation turns outdated with cause `moved` (AD-7); return where it went."""
    away = next(code for code in _empty_locations(client, plan_id) if code != rec["to_location"])
    _move(client, plan_id, rec["part"], rec["from_location"], away)
    rows = _ok(client.get(f"/api/plans/{plan_id}/recommendations"))["recommendations"]
    row = next(row for row in rows if row["id"] == rec["id"])
    assert row["status"] == "outdated" and row["outdated"]["cause"] == "moved", row
    return away


def _build_rich_plan(client: TestClient) -> tuple[str, list[str]]:
    """The sample plan with marks, two runs, an applied and an outdated recommendation, a
    combined move, a keep mark and a swap pair; returns its id and the parts it moved."""
    created = client.post(
        "/api/plans",
        data={"name": "Reopen"},
        files=_multipart(_data_files("sample", "xlsx")),
        headers=SAME_ORIGIN,
    )
    assert created.status_code == 201, created.text
    plan_id = created.json()["id"]
    locations = _ok(client.get(f"/api/plans/{plan_id}/locations"))["locations"]
    aisles = sorted({row["location"]["aisle"] for row in locations})
    level_row = next(row for row in locations if row["location"]["aisle"] == aisles[1])
    level = {"kind": "level", "level": level_row["location"]["level"], "aisle": aisles[1]}

    _send(client, plan_id, {"type": "set_best_mark", "mark": {"kind": "aisle", "aisle": aisles[0]}})
    _send(client, plan_id, {"type": "set_best_mark", "mark": level})
    _send(client, plan_id, {"type": "run"})
    recs = _ok(client.get(f"/api/plans/{plan_id}/recommendations"))["recommendations"]
    assert len(recs) >= 3, recs
    applied, moved = recs[0], recs[1]
    _ok(_command(client, plan_id, _apply_body(applied["id"], _version(client, plan_id))))
    away = _outdate(client, plan_id, moved)
    _send(client, plan_id, {"type": "run"})
    # The second run keeps only the recommendations a step references: outdate one of its own.
    second_run = _ok(client.get(f"/api/plans/{plan_id}/recommendations"))
    rerun = [rec for rec in second_run["recommendations"] if rec["status"] == "open"]
    assert len(rerun) >= 2, second_run
    away_2 = _outdate(client, plan_id, rerun[0])

    # Keep marks and swap steps have no command yet (Epics 7 and 12): write them as stored.
    touched = {applied["part"], moved["part"]} | {
        rec["part"] for rec in second_run["recommendations"]
    }
    (p, p_at), (q, q_at), (c, c_from) = _single_location_parts(client, plan_id, touched)[:3]
    state = PlanState.model_validate(upcast("state", _raw_state(plan_id)))
    open_part = rerun[1]["part"]
    swap = [
        {"part": p, "from_location": p_at, "to_location": q_at},
        {"part": q, "from_location": q_at, "to_location": p_at},
    ]
    number = state.next_move_number
    steps = [
        *(step.model_dump(mode="json") for step in state.steps),
        *(
            {
                **move,
                "move_number": number + offset,
                "rule": "manual",
                "round": 2,
                "recommendation_id": None,
                "swap_id": "swap-1",
            }
            for offset, move in enumerate(swap)
        ),
    ]
    doc = state.model_dump(mode="json")
    _write_state(
        plan_id,
        {**doc, "keep_marks": [open_part], "steps": steps, "next_move_number": number + 2},
    )

    # A combined move last: undo would split it (AD-5).
    first, second = [
        code for code in _empty_locations(client, plan_id) if code not in (away, away_2)
    ][:2]
    _move(client, plan_id, c, c_from, first)
    _move(client, plan_id, c, first, second)
    return plan_id, [applied["part"], moved["part"], rerun[0]["part"], open_part, p, q, c]


def test_fr9_reopen_identical_state(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, parts = _build_rich_plan(client)
        state_before = _raw_state(plan_id)
        row_before = _row(uuid.UUID(plan_id))
        views_before = _views(client, plan_id, parts)
        assert _row(uuid.UUID(plan_id)) == row_before

    with _restart() as client:
        views_after = _views(client, plan_id, parts)
        state_after = _raw_state(plan_id)

    assert _row(uuid.UUID(plan_id)) == row_before
    assert state_after == state_before
    stored = PlanState.model_validate(state_after)
    assert stored.keep_marks and len(stored.best_marks) == 2
    assert {run.round for run in stored.runs} == {1, 2}
    assert all(run.id and run.created_by == "planner" for run in stored.runs)
    latest = stored.runs[-1]
    assert any(rec.status == "outdated" and rec.outdated for rec in latest.recommendations)
    assert any(rec.status == "open" for rec in latest.recommendations)
    assert latest.no_space
    assert [step.swap_id for step in stored.steps].count("swap-1") == 2
    assert stored.next_move_number == max(step.move_number for step in stored.steps) + 1
    for path, body in views_before.items():
        assert views_after[path] == body, path
    summary = views_after[f"/api/plans/{plan_id}"]
    assert summary["current_round"] == 2
    last = stored.steps[-1]
    assert summary["undo_preview"] == {
        "move_number": last.move_number,
        "part": last.part,
        "from_location": last.from_location,
        "to_location": last.to_location,
        "effect": {"kind": "splits_combined_move", "move_number": stored.steps[-2].move_number},
    }
    moves = views_after[f"/api/plans/{plan_id}/before-after"]
    assert moves == views_before[f"/api/plans/{plan_id}/before-after"]
    copy = replay(plans.require(uuid.UUID(plan_id)).imported.data, stored.steps)
    assert any(len(move.steps) == 2 for move in copy.moves)


def test_nfr12_old_state_upcast_on_read_saved_current_on_command(empty_tables: str) -> None:
    plan = plans.create("Old", read_import(_data_files("answer-key", "csv")), now=NOW)
    plan_id = str(plan.id)
    v1 = json.loads((FIXTURES / "state_v1_with_run.json").read_text(encoding="utf-8"))
    _write_state(plan_id, v1)
    row_before = _row(plan.id)

    with _restart() as client:
        summary = _ok(client.get(f"/api/plans/{plan_id}"))
        recs = _ok(client.get(f"/api/plans/{plan_id}/recommendations"))
        _ok(client.get(f"/api/plans/{plan_id}/locations"))
        assert _raw_state(plan_id) == v1
        assert _row(plan.id) == row_before

        changed = _command(
            client,
            plan_id,
            {
                "type": "set_best_mark",
                "command_id": str(uuid.uuid4()),
                "base_version": row_before[0],
                "mark": {"kind": "aisle", "aisle": "B"},
            },
        )

    assert summary["current_round"] == 1
    assert summary["undo_preview"] is None
    assert [rec["number"] for rec in recs["recommendations"]] == [1, 2]
    assert changed.status_code == 200, changed.text
    stored = _raw_state(plan_id)
    assert stored["schema_version"] == 2
    [run] = PlanState.model_validate(stored).runs
    assert run.id == v1["runs"][0]["id"]
    assert [rec.id for rec in run.recommendations] == [
        r["id"] for r in v1["runs"][0]["recommendations"]
    ]
    assert _row(plan.id)[0] == row_before[0] + 1


def test_fr9_reopened_plan_stays_editable(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id, rec_id = _answer_key_after_run(client)
    before = _row(uuid.UUID(plan_id))

    with _restart() as client:
        assert _version(client, plan_id) == before[0]
        applied = _command(client, plan_id, _apply_body(rec_id, before[0]))
        summary = _ok(client.get(f"/api/plans/{plan_id}"))

    assert applied.status_code == 200, applied.text
    version, edited_by, edited_at = _row(uuid.UUID(plan_id))
    assert version == before[0] + 1 == summary["version"]
    assert edited_by == "planner"
    assert isinstance(edited_at, datetime) and edited_at >= before[2]
    assert summary["undo_preview"]["effect"]["kind"] == "reverts_move"
