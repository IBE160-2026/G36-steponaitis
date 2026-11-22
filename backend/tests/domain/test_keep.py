"""FR-32/AD-6/AD-7: the `set_keep` / `remove_keep` commands and kept in the views (domain only).

A keep mark is not a step (FR-35 note): it never gets a move number and never touches the
steps, runs or best marks.
"""

import uuid

import pytest
from pydantic import TypeAdapter, ValidationError

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    ApplyAll,
    ApplyAllSkipped,
    Command,
    KeepRemoved,
    KeepSet,
    RemoveKeep,
    SetKeep,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import current_location, replay
from swp.domain.recommendations import (
    RecommendationsView,
    build_recommendations_view,
    revalidate,
)
from swp.domain.state import PlanState
from swp.domain.values import CODE_MAX_LENGTH
from swp.domain.views.parts import build_part_detail, build_parts_view
from swp.domain.views.summary import apply_all_count
from tests.domain.answer_key import (
    CTX,
    MARKS,
    after_run_1,
    apply_command,
    do,
    keep_step,
    manual_command,
    run_command,
)


def _set(part: str) -> SetKeep:
    return SetKeep(command_id=uuid.uuid4(), base_version=1, part=part)


def _remove(part: str) -> RemoveKeep:
    return RemoveKeep(command_id=uuid.uuid4(), base_version=1, part=part)


def _view(state: PlanState, data: ImportData, analysis: Analysis) -> RecommendationsView:
    return build_recommendations_view(data, analysis, state, 1)


def _kept_entries(view: RecommendationsView) -> list[str]:
    """Every part the Kept in place tab shows: kept rows, kept no-space rows, kept parts."""
    return [
        *(row.part for row in view.recommendations if row.status == "kept"),
        *(row.part for row in view.no_space if row.kept_in_place),
        *(row.part for row in view.kept_parts),
    ]


# --- Commands ---


def test_fr32_set_keep_adds_mark_and_emits_keep_set(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)

    applied = apply(state, _set("0500"), CTX, data, analysis)

    assert applied.state.keep_marks == ["0500"]
    assert applied.events == [KeepSet(part="0500")]
    assert state.keep_marks == []
    # Not a step (FR-35 note): steps, move numbers, runs and best marks stay untouched.
    after = applied.state
    assert (after.steps, after.next_move_number, after.runs, after.best_marks) == (
        state.steps,
        state.next_move_number,
        state.runs,
        state.best_marks,
    )


def test_fr32_set_keep_appends(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)

    applied = apply(state, _set("1200"), CTX, data, analysis)

    assert applied.state.keep_marks == ["0500", "1200"]


def test_fr32_set_keep_on_kept_part_is_noop(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)

    applied = apply(state, _set("0500"), CTX, data, analysis)

    assert applied.events == []
    assert applied.state == state


def test_fr32_remove_keep_removes_mark(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)
    state = keep_step(state, "1200", data, analysis)

    applied = apply(state, _remove("0500"), CTX, data, analysis)

    assert applied.state.keep_marks == ["1200"]
    assert applied.events == [KeepRemoved(part="0500")]


def test_fr32_remove_absent_keep_is_noop(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=MARKS)

    applied = apply(state, _remove("0500"), CTX, data, analysis)

    assert applied.events == []
    assert applied.state == state


def test_fr32_set_keep_unknown_part_rejected(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=MARKS)

    with pytest.raises(DomainError) as error:
        apply(state, _set("NOPE"), CTX, data, analysis)

    assert error.value.code == "command_rejected"
    assert error.value.message == "No part NOPE in this plan."


def test_fr32_keep_command_wire_shape() -> None:
    command_id = uuid.uuid4()
    adapter: TypeAdapter[Command] = TypeAdapter(Command)

    parsed = adapter.validate_python(
        {"type": "set_keep", "command_id": str(command_id), "base_version": 2, "part": "0500"}
    )

    assert parsed == SetKeep(command_id=command_id, base_version=2, part="0500")
    for part in ["", "x" * (CODE_MAX_LENGTH + 1)]:
        with pytest.raises(ValidationError):
            adapter.validate_python(
                {
                    "type": "remove_keep",
                    "command_id": str(command_id),
                    "base_version": 2,
                    "part": part,
                }
            )


def test_fr32_manual_move_of_kept_part_keeps_mark(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "9100", data, analysis)

    state = do(state, manual_command("9100", "D-01-02-02", "D-01-02-03"), data, analysis)

    assert [(s.part, s.to_location) for s in state.steps] == [("9100", "D-01-02-03")]
    assert state.keep_marks == ["9100"]


# --- Views ---


def test_fr32_kept_open_recommendation(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    before = apply_all_count(state)
    state = keep_step(state, "0500", data, analysis)

    view = _view(state, data, analysis)

    rec = next(row for row in view.recommendations if row.part == "0500")
    assert (rec.number, rec.status, rec.applied, rec.outdated) == (5, "kept", None, None)
    assert [row.status for row in view.recommendations].count("kept") == 1
    assert view.kept_parts == []
    assert _kept_entries(view) == ["0500"]
    assert apply_all_count(state) == before - 1
    with pytest.raises(DomainError) as error:
        apply(state, apply_command(rec.id), CTX, data, analysis)
    assert error.value.message == "0500 is kept in place."
    applied = apply(state, ApplyAll(command_id=uuid.uuid4(), base_version=1), CTX, data, analysis)
    assert ApplyAllSkipped(number=5, cause="kept") in applied.events[0].skipped  # type: ignore[union-attr]


def test_fr32_unkeep_returns_open(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = keep_step(state, "0500", data, analysis)

    state = do(state, _remove("0500"), data, analysis)

    rec = next(row for row in _view(state, data, analysis).recommendations if row.part == "0500")
    assert rec.status == "open"


def test_fr32_applied_and_outdated_win_over_kept(data: ImportData, analysis: Analysis) -> None:
    state, first = after_run_1(data, analysis)
    state = do(state, apply_command(first), data, analysis)  # 1100 applied
    state = keep_step(state, "1100", data, analysis)

    view = _view(state, data, analysis)

    rec = next(row for row in view.recommendations if row.part == "1100")
    assert rec.status == "applied"
    assert [row.part for row in view.kept_parts] == ["1100"]
    assert _kept_entries(view) == ["1100"]


def test_fr32_outdated_wins_over_kept(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = keep_step(state, "1100", data, analysis)  # rec #1: C-01-01-01 -> A-01-01-03
    state = do(state, manual_command("1200", "B-01-01-02", "A-01-01-03"), data, analysis)
    state = revalidate(data, analysis, state).state  # as the command service does (AD-6)

    view = _view(state, data, analysis)

    rec = next(row for row in view.recommendations if row.part == "1100")
    assert rec.status == "outdated"
    assert rec.outdated is not None
    assert [row.part for row in view.kept_parts].count("1100") == 1
    assert _kept_entries(view) == ["1100"]


def test_fr32_kept_no_space_row(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = keep_step(state, "1200", data, analysis)

    view = _view(state, data, analysis)

    kept = {row.part: row.kept_in_place for row in view.no_space}
    assert kept == {"1200": True, "10240": False, "2400": False, "6600": False}
    assert view.kept_parts == []
    assert _kept_entries(view) == ["1200"]


def test_fr32_kept_parts_without_run_in_part_number_order(
    data: ImportData, analysis: Analysis
) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "9100", data, analysis)
    state = keep_step(state, "0500", data, analysis)

    view = _view(state, data, analysis)

    assert view.run is None
    assert [row.part for row in view.kept_parts] == ["0500", "9100"]
    row = view.kept_parts[0]
    copy = replay(data, state.steps).copy
    assert (row.from_location, row.from_best) == (current_location(copy, "0500"), True)
    assert row.movement_class == analysis.parts["0500"].movement_class


def test_fr32_kept_part_after_next_run_listed_once(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = keep_step(state, "0500", data, analysis)
    state = keep_step(state, "1200", data, analysis)

    state = run_command(data, analysis, state).state
    view = _view(state, data, analysis)

    assert "0500" not in {row.part for row in view.recommendations}
    assert "0500" not in {row.part for row in view.no_space}
    assert sorted(_kept_entries(view)) == ["0500", "1200"]
    assert len(_kept_entries(view)) == len(state.keep_marks)


def test_fr32_parts_views_show_kept(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)

    rows = {row.part: row.kept_in_place for row in build_parts_view(data, analysis, state, 1).parts}

    assert [part for part, kept in rows.items() if kept] == ["0500"]
    assert build_part_detail(data, analysis, state, 1, "0500").kept_in_place is True
    assert build_part_detail(data, analysis, state, 1, "1200").kept_in_place is False
