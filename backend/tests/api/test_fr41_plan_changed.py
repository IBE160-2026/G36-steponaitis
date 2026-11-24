"""FR-41 (Story 15.1): a command built on an older plan version is refused with `plan_changed`.

Two logged-in planners share one plan over HTTP. The idempotency lookup comes before the
version check, so a retried command that was applied is never warned; a resend of the same
command with the new `base_version` is applied on top of the other planner's change.
"""

import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app.plans import require
from swp.domain.state import AisleMark, PlanState
from tests.app.test_apply_command import (
    _answer_key_after_run,
    _apply_body,
    _command,
    _manual_body,
)
from tests.app.test_reuse_import import _row
from tests.conftest import _clear_caches

SAME_ORIGIN = {"Origin": "http://testserver"}
PLAN_CHANGED = "Someone saved this plan after you opened it."
MARK_B = {"kind": "aisle", "aisle": "B"}


def _planner(username: str) -> TestClient:
    client = TestClient(create_app())
    client.__enter__()
    signup = {"username": username, "password": "secret", "password_repeat": "secret"}
    assert client.post("/api/auth/signup", json=signup, headers=SAME_ORIGIN).status_code == 201
    login = {"username": username, "password": "secret"}
    assert client.post("/api/auth/login", json=login, headers=SAME_ORIGIN).status_code == 200
    return client


@pytest.fixture
def planners(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[tuple[TestClient, TestClient]]:
    """Kari7 (A) and Ola8 (B), each logged in with an own session."""
    monkeypatch.setenv("FEATURE_AUTH", "true")
    _clear_caches()
    a = _planner("Kari7")
    b = _planner("Ola8")
    try:
        yield a, b
    finally:
        b.__exit__(None, None, None)
        a.__exit__(None, None, None)


def _mark_b(base_version: int) -> dict[str, Any]:
    return {
        "type": "set_best_mark",
        "command_id": str(uuid.uuid4()),
        "base_version": base_version,
        "mark": MARK_B,
    }


def _state(plan_id: str) -> PlanState:
    return require(uuid.UUID(plan_id)).state


def test_fr41_stale_base_version_is_refused_and_nothing_saved(
    planners: tuple[TestClient, TestClient],
) -> None:
    a, b = planners
    plan_id, rec_id = _answer_key_after_run(a)  # version 3
    assert _command(b, plan_id, _mark_b(3)).status_code == 200  # B saves: version 4
    before = _row(plan_id)
    state_before = _state(plan_id)

    response = _command(a, plan_id, _apply_body(rec_id, 3))

    assert response.status_code == 409, response.text
    assert response.json() == {
        "error": {
            "code": "plan_changed",
            "message": PLAN_CHANGED,
            "details": [
                {
                    "current_version": 4,
                    "last_edited_by": "Ola8",
                    "last_edited_at": before.last_edited_at.isoformat(),
                }
            ],
        }
    }
    assert _row(plan_id) == before
    assert _state(plan_id) == state_before


def test_fr41_current_base_version_applies(planners: tuple[TestClient, TestClient]) -> None:
    a, b = planners
    plan_id, rec_id = _answer_key_after_run(a)
    assert _command(b, plan_id, _mark_b(3)).status_code == 200

    response = _command(a, plan_id, _apply_body(rec_id, 4))

    assert response.status_code == 200, response.text
    assert response.json()["version"] == 5
    assert _row(plan_id).last_edited_by == "Kari7"


def test_fr41_repeated_command_id_with_stale_base_returns_stored_result(
    planners: tuple[TestClient, TestClient],
) -> None:
    a, b = planners
    plan_id, rec_id = _answer_key_after_run(a)
    body = _apply_body(rec_id, 3)
    first = _command(a, plan_id, body)
    assert first.status_code == 200, first.text
    assert _command(b, plan_id, _mark_b(4)).status_code == 200  # version 5
    before = _row(plan_id)

    again = _command(a, plan_id, body)

    assert again.status_code == 200, again.text
    assert again.json() == first.json()
    assert _row(plan_id) == before


def test_fr41_keep_going_resend_applies_on_top_of_other_change(
    planners: tuple[TestClient, TestClient],
) -> None:
    a, b = planners
    plan_id, rec_id = _answer_key_after_run(a)
    assert _command(b, plan_id, _mark_b(3)).status_code == 200
    command_id = uuid.uuid4()
    warned = _command(a, plan_id, _apply_body(rec_id, 3, command_id))
    assert warned.status_code == 409, warned.text
    current = warned.json()["error"]["details"][0]["current_version"]

    resent = _command(a, plan_id, _apply_body(rec_id, current, command_id))

    assert resent.status_code == 200, resent.text
    assert resent.json()["version"] == 5
    state = _state(plan_id)
    assert AisleMark(aisle="B") in state.best_marks
    assert len(state.steps) == 1
    assert _row(plan_id).last_edited_by == "Kari7"


def test_fr41_keep_going_resend_of_outdated_recommendation_is_rejected(
    planners: tuple[TestClient, TestClient],
) -> None:
    a, b = planners
    plan_id, rec_id = _answer_key_after_run(a)
    # B moves recommendation #1's part by hand: the recommendation goes outdated.
    moved = _command(b, plan_id, _manual_body("1100", "C-01-01-01", "B-01-04-01", 3))
    assert moved.status_code == 200, moved.text
    command_id = uuid.uuid4()
    warned = _command(a, plan_id, _apply_body(rec_id, 3, command_id))
    assert warned.json()["error"]["code"] == "plan_changed"
    before = _row(plan_id)

    resent = _command(a, plan_id, _apply_body(rec_id, 4, command_id))

    assert resent.status_code == 409, resent.text
    assert resent.json() == {
        "error": {
            "code": "command_rejected",
            "message": "Recommendation #1 is outdated.",
            "details": [{"cause": "moved"}],
        }
    }
    assert _row(plan_id) == before
