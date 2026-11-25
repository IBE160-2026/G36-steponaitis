"""FR-9/FR-10/FR-11/FR-21/AD-6: the command endpoint and service (SQLite here, Postgres in CI)."""

import dataclasses
import threading
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app import plans
from swp.app.commands import run_command
from swp.domain.commands import CommandResult, MarkSet, RemoveBestMark, SetBestMark
from swp.domain.errors import DomainError
from swp.domain.state import AisleMark, BestMark, LevelMark, LocationMark, PlanState
from swp.store import plans as store_plans
from swp.store.plans import plan_for_update
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_plan_summary import _create, _row

CREATED = datetime(2026, 11, 22, 9, 0, tzinfo=UTC)
NOW = datetime(2026, 11, 22, 10, 0, tzinfo=UTC)
AISLE_A = {"kind": "aisle", "aisle": "A"}


def _body(type_: str, mark: dict[str, Any], *, base_version: int = 1, **extra: Any) -> dict:
    return {
        "type": type_,
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "mark": mark,
        **extra,
    }


def _set(mark: BestMark, base_version: int = 1) -> SetBestMark:
    return SetBestMark(command_id=uuid.uuid4(), base_version=base_version, mark=mark)


def _remove(mark: BestMark, base_version: int = 1) -> RemoveBestMark:
    return RemoveBestMark(command_id=uuid.uuid4(), base_version=base_version, mark=mark)


def _version(plan_id: uuid.UUID) -> int:
    """The plan's current version: what a client that saw the last save sends (FR-41)."""
    return _row(plan_id)[0]


def test_fr21_set_mark_over_http(empty_tables: str) -> None:
    plan_id = _create("Marks", CREATED)

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_body("set_best_mark", AISLE_A),
            headers=SAME_ORIGIN,
        )
        summary = client.get(f"/api/plans/{plan_id}")

    assert response.status_code == 200, response.text
    assert response.json() == {"version": 2, "events": [{"type": "mark_set", "mark": AISLE_A}]}
    assert summary.json()["version"] == 2
    assert summary.json()["best_locations"] == 1
    assert plans.require(plan_id).state.best_marks == [AisleMark(aisle="A")]


def test_fr21_remove_mark_over_http(empty_tables: str) -> None:
    plan_id = _create("Marks", CREATED)
    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_body("remove_best_mark", AISLE_A, base_version=2),
            headers=SAME_ORIGIN,
        )
        summary = client.get(f"/api/plans/{plan_id}")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "version": 3,
        "events": [{"type": "mark_removed", "mark": AISLE_A}],
    }
    assert summary.json()["best_locations"] == 0
    assert plans.require(plan_id).state.best_marks == []


def test_fr11_last_edited_by_planner(empty_tables: str) -> None:
    plan_id = _create("Edited", CREATED)

    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    assert _row(plan_id) == (2, "planner", NOW)


def test_fr21_overlapping_marks_keep_location_best(empty_tables: str) -> None:
    plan_id = _create("Overlap", CREATED)
    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)
    run_command(plan_id, _set(LevelMark(level="1", aisle=None), _version(plan_id)), now=NOW)

    run_command(plan_id, _remove(AisleMark(aisle="A"), _version(plan_id)), now=NOW)

    with TestClient(create_app()) as client:
        summary = client.get(f"/api/plans/{plan_id}")
    assert summary.json()["best_locations"] == 1
    assert plans.require(plan_id).state.best_marks == [LevelMark(level="1")]


def test_fr10_repeated_command_id_applies_once(empty_tables: str) -> None:
    plan_id = _create("Idempotent", CREATED)
    body = _body("set_best_mark", AISLE_A)

    with TestClient(create_app()) as client:
        first = client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)
        second = client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert _row(plan_id)[0] == 2
    assert plans.require(plan_id).state.best_marks == [AisleMark(aisle="A")]


def test_fr10_repeated_command_id_after_other_commands(empty_tables: str) -> None:
    plan_id = _create("Idempotent later", CREATED)
    command = _set(AisleMark(aisle="A"))
    first = run_command(plan_id, command, now=NOW)
    run_command(plan_id, _set(LocationMark(location="A-01"), _version(plan_id)), now=NOW)

    again = run_command(plan_id, command, now=NOW + timedelta(hours=1))

    assert again == first
    assert _row(plan_id) == (3, "planner", NOW)


@pytest.mark.parametrize(
    "command",
    [
        pytest.param(lambda: _set(AisleMark(aisle="A"), 2), id="set existing"),
        pytest.param(lambda: _remove(LocationMark(location="X"), 2), id="remove missing"),
    ],
)
def test_fr21_noop_mark_does_not_bump_version(empty_tables: str, command: Any) -> None:
    plan_id = _create("No-op", CREATED)
    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)
    before = _row(plan_id)
    state_before = plans.require(plan_id).state
    noop = command()

    result = run_command(plan_id, noop, now=NOW + timedelta(hours=1))

    assert result == CommandResult(version=2, events=[])
    assert _row(plan_id) == before
    state_after = plans.require(plan_id).state
    assert state_after == state_before
    assert str(noop.command_id) not in {e["command_id"] for e in state_after.recent_commands}


def test_fr10_fr41_stale_base_version_is_refused_then_current_is_recorded(
    empty_tables: str,
) -> None:
    plan_id = _create("Stale", CREATED)
    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)
    run_command(plan_id, _set(AisleMark(aisle="B"), 2), now=NOW)
    before = (_row(plan_id), plans.require(plan_id).state)
    stale = _set(LocationMark(location="A-01"), base_version=1)

    with pytest.raises(DomainError) as refused:
        run_command(plan_id, stale, now=NOW + timedelta(hours=1))

    assert refused.value.code == "plan_changed"
    assert refused.value.details == [
        {"current_version": 3, "last_edited_by": "planner", "last_edited_at": NOW.isoformat()}
    ]
    assert (_row(plan_id), plans.require(plan_id).state) == before

    current = stale.model_copy(update={"base_version": 3})
    result = run_command(plan_id, current, now=NOW)

    assert result.version == 4
    entry = plans.require(plan_id).state.recent_commands[-1]
    assert entry == {
        "command_id": str(stale.command_id),
        "base_version": 3,
        "result": result.model_dump(mode="json"),
    }


def test_fr10_recent_commands_keep_last_50(empty_tables: str) -> None:
    plan_id = _create("Fifty", CREATED)
    commands = [_set(LocationMark(location=f"L-{n:02d}"), n + 1) for n in range(51)]
    for command in commands:
        run_command(plan_id, command, now=NOW)

    recent = plans.require(plan_id).state.recent_commands
    assert [entry["command_id"] for entry in recent] == [str(c.command_id) for c in commands[1:]]
    assert _row(plan_id)[0] == 52


def test_fr10_fr41_concurrent_commands_one_applies_other_is_warned(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = _create("Concurrent", CREATED)
    commands = [_set(AisleMark(aisle="A")), _set(LocationMark(location="B-01"))]
    start = threading.Barrier(len(commands))
    # Both writers inside a read-modify-write at once would meet here; the write lock
    # (BEGIN IMMEDIATE / FOR UPDATE) must keep the second out until the first commits.
    inside = threading.Barrier(len(commands))
    overlaps: list[int] = []
    original = store_plans.PlanWriter.save_state

    def save_after_overlap_check(self: store_plans.PlanWriter, *args: Any, **kwargs: Any) -> bool:
        try:
            inside.wait(timeout=0.5)
            overlaps.append(1)
        except threading.BrokenBarrierError:
            pass
        return original(self, *args, **kwargs)

    monkeypatch.setattr(store_plans.PlanWriter, "save_state", save_after_overlap_check)
    results: list[CommandResult] = []
    errors: list[BaseException] = []

    def worker(command: SetBestMark) -> None:
        try:
            start.wait()
            results.append(run_command(plan_id, command, now=NOW))
        except BaseException as exc:  # noqa: BLE001 - reported by the main thread
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(c,)) for c in commands]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    # Both were built on version 1: the write lock serialises them, the first applies and
    # the second reads version 2 under the lock and is warned (FR-41), never applied blindly.
    assert overlaps == []
    assert [result.version for result in results] == [2]
    assert len(errors) == 1
    assert isinstance(errors[0], DomainError)
    assert errors[0].code == "plan_changed"
    assert errors[0].details[0]["current_version"] == 2
    assert _row(plan_id)[0] == 2
    assert len(plans.require(plan_id).state.best_marks) == 1


def test_fr10_lost_race_is_retried(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> None:
    plan_id = _create("Retry", CREATED)
    original = store_plans.PlanWriter.save_state
    calls: list[int] = []

    def lose_once(self: store_plans.PlanWriter, *args: Any, **kwargs: Any) -> bool:
        calls.append(1)
        if len(calls) == 1:
            return False
        return original(self, *args, **kwargs)

    monkeypatch.setattr(store_plans.PlanWriter, "save_state", lose_once)

    result = run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    assert len(calls) == 2
    assert result == CommandResult(version=2, events=[MarkSet(mark=AisleMark(aisle="A"))])
    assert _row(plan_id)[0] == 2
    assert plans.require(plan_id).state.best_marks == [AisleMark(aisle="A")]
    assert len(plans.require(plan_id).state.recent_commands) == 1


def test_fr41_lost_race_to_another_save_warns(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = _create("Lost race", CREATED)
    original = store_plans.PlanWriter.save_state
    calls: list[int] = []

    def other_saves_first(self: store_plans.PlanWriter, *args: Any, **kwargs: Any) -> bool:
        calls.append(1)
        if len(calls) == 1:
            # Another planner's save lands between this read and this save.
            state = self.plan.state.model_copy(update={"best_marks": [AisleMark(aisle="B")]})
            assert original(self, state, last_edited_by="Ola", last_edited_at=NOW)
            return False
        return original(self, *args, **kwargs)

    monkeypatch.setattr(store_plans.PlanWriter, "save_state", other_saves_first)

    with pytest.raises(DomainError) as refused:
        run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    assert len(calls) == 1
    assert refused.value.code == "plan_changed"
    assert refused.value.details == [
        {"current_version": 2, "last_edited_by": "Ola", "last_edited_at": NOW.isoformat()}
    ]
    assert plans.require(plan_id).state.best_marks == [AisleMark(aisle="B")]


def test_fr10_fr41_lost_race_to_the_same_command_returns_its_stored_result(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = _create("Duplicate race", CREATED)
    original = store_plans.PlanWriter.save_state
    calls: list[int] = []

    def duplicate_saves_first(self: store_plans.PlanWriter, *args: Any, **kwargs: Any) -> bool:
        calls.append(1)
        if len(calls) == 1:
            # A concurrent retry of this same command saves it between this read and this save.
            assert original(self, *args, **kwargs)
            return False
        return original(self, *args, **kwargs)

    monkeypatch.setattr(store_plans.PlanWriter, "save_state", duplicate_saves_first)

    result = run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    assert len(calls) == 1
    assert result == CommandResult(version=2, events=[MarkSet(mark=AisleMark(aisle="A"))])
    assert _row(plan_id)[0] == 2
    assert plans.require(plan_id).state.best_marks == [AisleMark(aisle="A")]
    assert len(plans.require(plan_id).state.recent_commands) == 1


def test_fr10_conditional_update_on_changed_version_writes_nothing(empty_tables: str) -> None:
    plan_id = _create("Changed version", CREATED)
    before = _row(plan_id)

    with plan_for_update(plan_id) as writer:
        assert writer is not None
        writer.plan = dataclasses.replace(writer.plan, version=writer.plan.version - 1)
        state = PlanState(best_marks=[AisleMark(aisle="A")])
        saved = writer.save_state(state, last_edited_by="someone", last_edited_at=NOW)

    assert saved is False
    assert _row(plan_id) == before
    assert plans.require(plan_id).state.best_marks == []


def test_fr10_lost_race_four_times_is_internal(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = _create("Always lost", CREATED)
    before = _row(plan_id)
    calls: list[int] = []

    def always_lose(self: store_plans.PlanWriter, *args: Any, **kwargs: Any) -> bool:
        calls.append(1)
        return False

    monkeypatch.setattr(store_plans.PlanWriter, "save_state", always_lose)

    with pytest.raises(DomainError) as raised:
        run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)

    assert raised.value.code == "internal"
    assert len(calls) == 4
    assert _row(plan_id) == before
    assert plans.require(plan_id).state.best_marks == []

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_body("set_best_mark", AISLE_A),
            headers=SAME_ORIGIN,
        )
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal"
    assert _row(plan_id) == before


def test_fr10_unknown_plan_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{uuid.uuid4()}/commands",
            json=_body("set_best_mark", AISLE_A),
            headers=SAME_ORIGIN,
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "plan_not_found"


@pytest.mark.parametrize(
    "body",
    [
        pytest.param(_body("keep_in_place", AISLE_A), id="unknown type"),
        pytest.param(
            {"type": "set_best_mark", "command_id": str(uuid.uuid4()), "base_version": 1},
            id="missing mark",
        ),
        pytest.param(_body("set_best_mark", {"kind": "row", "row": "A"}), id="bad kind"),
        pytest.param({**_body("set_best_mark", AISLE_A), "command_id": "abc"}, id="bad id"),
        pytest.param(
            {**_body("set_best_mark", AISLE_A), "base_version": "latest"}, id="bad version"
        ),
        pytest.param(
            _body("set_best_mark", {"kind": "aisle", "aisle": "A" * 201}), id="long aisle"
        ),
        pytest.param(
            _body("set_best_mark", {"kind": "level", "level": "1", "aisle": "A" * 201}),
            id="long level aisle",
        ),
        pytest.param(
            _body("set_best_mark", {"kind": "level", "level": "1" * 201}), id="long level"
        ),
        pytest.param(
            _body("set_best_mark", {"kind": "location", "location": "L" * 201}), id="long location"
        ),
    ],
)
def test_fr10_invalid_command_validation_failed(empty_tables: str, body: dict) -> None:
    plan_id = _create("Invalid", CREATED)
    before = _row(plan_id)

    with TestClient(create_app()) as client:
        response = client.post(f"/api/plans/{plan_id}/commands", json=body, headers=SAME_ORIGIN)

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_failed"
    assert _row(plan_id) == before


@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({}, id="no origin"),
        pytest.param({"Origin": "https://evil.example"}, id="foreign"),
    ],
)
def test_ad19_cross_site_command_forbidden(empty_tables: str, headers: dict[str, str]) -> None:
    plan_id = _create("Guarded", CREATED)
    before = _row(plan_id)

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_body("set_best_mark", AISLE_A),
            headers=headers,
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden_origin"
    assert _row(plan_id) == before


def test_fr9_get_after_command_never_writes(empty_tables: str) -> None:
    plan_id = _create("Read after write", CREATED)
    run_command(plan_id, _set(AisleMark(aisle="A")), now=NOW)
    before = _row(plan_id)

    with TestClient(create_app()) as client:
        for path in ("", "/locations"):
            assert client.get(f"/api/plans/{plan_id}{path}").status_code == 200

    assert _row(plan_id) == before == (2, "planner", NOW)
