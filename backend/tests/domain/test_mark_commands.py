"""FR-10/FR-21/AD-6: mark commands through the single `domain.apply`."""

import uuid
from datetime import UTC, datetime
from typing import get_args

import pytest
from pydantic import TypeAdapter, ValidationError

from swp.domain.apply import apply
from swp.domain.commands import (
    Command,
    CommandContext,
    Event,
    MarkRemoved,
    MarkSet,
    RemoveBestMark,
    SetBestMark,
)
from swp.domain.errors import DomainError
from swp.domain.state import AisleMark, BestMark, LevelMark, LocationMark, PlanState
from swp.domain.values import CODE_MAX_LENGTH
from tests.domain.answer_key import empty_analysis
from tests.domain.test_best_marks import _best, _small, _small_data

CTX = CommandContext(now=datetime(2026, 11, 22, 12, 0, tzinfo=UTC), user="planner")
DATA = _small_data()  # aisles A and B, levels 1 and 2
ANALYSIS = empty_analysis()


def _set(mark: BestMark) -> SetBestMark:
    return SetBestMark(command_id=uuid.uuid4(), base_version=1, mark=mark)


def _remove(mark: BestMark) -> RemoveBestMark:
    return RemoveBestMark(command_id=uuid.uuid4(), base_version=1, mark=mark)


def _state(*marks: BestMark) -> PlanState:
    return PlanState(best_marks=list(marks))


def test_fr21_set_mark_appends_and_emits_mark_set() -> None:
    state = _state()
    mark = AisleMark(aisle="A")

    applied = apply(state, _set(mark), CTX, DATA, ANALYSIS)

    assert applied.state.best_marks == [mark]
    assert applied.events == [MarkSet(mark=mark)]
    assert state.best_marks == []


def test_fr21_remove_mark_removes_and_emits_mark_removed() -> None:
    mark = AisleMark(aisle="A")
    other = LocationMark(location="B-1-1")
    state = _state(mark, other)

    applied = apply(state, _remove(mark), CTX, DATA, ANALYSIS)

    assert applied.state.best_marks == [other]
    assert applied.events == [MarkRemoved(mark=mark)]
    assert state.best_marks == [mark, other]


def test_fr21_set_existing_mark_is_noop() -> None:
    state = _state(AisleMark(aisle="A"))

    applied = apply(state, _set(AisleMark(aisle="A")), CTX, DATA, ANALYSIS)

    assert applied.events == []
    assert applied.state == state


@pytest.mark.parametrize(
    ("mark", "message"),
    [
        (AisleMark(aisle="ZZ"), "Aisle ZZ has no locations."),
        (LevelMark(level="9", aisle="A"), "Aisle A has no level 9."),
        (LevelMark(level="1", aisle="ZZ"), "Aisle ZZ has no level 1."),
        (LevelMark(level="9"), "No aisle has level 9."),
        (LocationMark(location="X-9-9"), "Location X-9-9 does not exist."),
    ],
)
def test_fr21_issue102_set_mark_covering_no_location_is_rejected(
    mark: BestMark, message: str
) -> None:
    state = _state(AisleMark(aisle="A"))

    with pytest.raises(DomainError) as raised:
        apply(state, _set(mark), CTX, DATA, ANALYSIS)

    assert (raised.value.code, raised.value.message) == ("validation_failed", message)
    assert state.best_marks == [AisleMark(aisle="A")]


@pytest.mark.parametrize(
    "mark",
    [
        AisleMark(aisle="B"),
        LevelMark(level="2", aisle="B"),
        LevelMark(level="2"),
        LocationMark(location="B-2-2"),
    ],
)
def test_fr21_issue102_set_mark_covering_a_location_is_accepted(mark: BestMark) -> None:
    applied = apply(_state(), _set(mark), CTX, DATA, ANALYSIS)

    assert applied.events == [MarkSet(mark=mark)]


def test_fr21_remove_missing_mark_is_noop() -> None:
    state = _state()

    applied = apply(state, _remove(LocationMark(location="X")), CTX, DATA, ANALYSIS)

    assert applied.events == []
    assert applied.state == state


def test_fr21_level_mark_with_and_without_aisle_are_different_values() -> None:
    state = _state(LevelMark(level="1", aisle=None))

    applied = apply(state, _set(LevelMark(level="1", aisle="A")), CTX, DATA, ANALYSIS)

    assert len(applied.events) == 1
    assert applied.state.best_marks == [LevelMark(level="1"), LevelMark(level="1", aisle="A")]


def test_fr21_overlapping_marks_remove_one_keeps_other() -> None:
    copy = _small()
    state = _state(AisleMark(aisle="A"), LevelMark(level="1", aisle=None))

    applied = apply(state, _remove(AisleMark(aisle="A")), CTX, DATA, ANALYSIS)

    best = _best(copy, applied.state.best_marks)
    assert "A-1-1" in best
    assert "A-2-1" not in best


def test_fr10_command_union_is_closed() -> None:
    command_types = {model.model_fields["type"].default for model in get_args(get_args(Command)[0])}
    event_types = {model.model_fields["type"].default for model in get_args(get_args(Event)[0])}

    assert command_types == {
        "set_best_mark",
        "remove_best_mark",
        "manual_move",
        "move_parts",
        "put_together",
        "swap",
        "run",
        "apply",
        "apply_all",
        "apply_other_location",
        "set_keep",
        "remove_keep",
        "undo",
        "reset",
    }
    assert event_types == {
        "mark_set",
        "mark_removed",
        "move_made",
        "moves_combined",
        "move_removed",
        "swap_made",
        "run_done",
        "recommendations_outdated",
        "apply_all_done",
        "keep_set",
        "keep_removed",
        "step_undone",
        "plan_reset",
    }
    with pytest.raises(ValidationError):
        TypeAdapter(Command).validate_python(
            {
                "type": "keep_in_place",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "mark": {"kind": "aisle", "aisle": "A"},
            }
        )


def test_fr10_command_parses_from_json_by_type() -> None:
    command_id = uuid.uuid4()
    parsed = TypeAdapter(Command).validate_python(
        {
            "type": "remove_best_mark",
            "command_id": str(command_id),
            "base_version": 3,
            "mark": {"kind": "level", "level": "1", "aisle": None},
        }
    )

    assert parsed == RemoveBestMark(
        command_id=command_id, base_version=3, mark=LevelMark(level="1", aisle=None)
    )


@pytest.mark.parametrize(
    "mark",
    [
        {"kind": "aisle", "aisle": "A" * (CODE_MAX_LENGTH + 1)},
        {"kind": "level", "level": "1" * (CODE_MAX_LENGTH + 1)},
        {"kind": "level", "level": "1", "aisle": "A" * (CODE_MAX_LENGTH + 1)},
        {"kind": "location", "location": "L" * (CODE_MAX_LENGTH + 1)},
    ],
)
def test_fr21_set_best_mark_rejects_codes_longer_than_code_max_length(mark: dict) -> None:
    body = {"type": "set_best_mark", "command_id": str(uuid.uuid4()), "base_version": 1}

    with pytest.raises(ValidationError):
        TypeAdapter(Command).validate_python({**body, "mark": mark})
    longest = {k: (v[:CODE_MAX_LENGTH] if k != "kind" else v) for k, v in mark.items()}
    assert TypeAdapter(Command).validate_python({**body, "mark": longest}).mark.kind == mark["kind"]
    remove = {**body, "type": "remove_best_mark", "mark": mark}
    assert TypeAdapter(Command).validate_python(remove).type == "remove_best_mark"
