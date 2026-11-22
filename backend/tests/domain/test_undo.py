"""FR-35/AD-5/AD-7: the `undo` command (domain only).

Undo drops the last step and replays the rest. Runs, best marks, keep marks and
`next_move_number` never change. Every open recommendation of the latest run and the
undone step's recommendation become `outdated(undo)`.
"""

import pytest

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import RecommendationsOutdated, StepUndone
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import UndoEffect, UndoPreview, current_round, replay
from swp.domain.recommendations import build_recommendations_view
from swp.domain.state import Outdated, PlanState, Step
from tests.domain.answer_key import (
    CTX,
    MARKS,
    after_run_1,
    apply_recommendation,
    command,
    keep_step,
    manual_step,
    play_steps,
    undo_command,
    undo_step,
)

UNDONE = Outdated(cause="undo")


def _rejected(state: PlanState, number: int, data: ImportData, analysis: Analysis) -> DomainError:
    with pytest.raises(DomainError) as raised:
        apply(state, undo_command(number), CTX, data, analysis)
    assert raised.value.code == "command_rejected"
    return raised.value


def test_fr35_undo_plain_answer_key_step_15(data: ImportData, analysis: Analysis) -> None:
    state, _ = play_steps(data, analysis, 14)
    last = state.steps[-1]

    applied = undo_step(state, data, analysis)

    assert applied.state.steps == state.steps[:-1]
    assert applied.events == [
        StepUndone(
            undone=UndoPreview(
                move_number=11,
                part="1200",
                from_location=last.from_location,
                to_location=last.to_location,
                effect=UndoEffect(kind="reverts_move", move_number=11),
            )
        ),
        RecommendationsOutdated(count=4, cause="undo"),
    ]
    assert replay(data, applied.state.steps).current_locations["1200"] == "B-01-01-02"
    assert {(r.status, r.outdated) for r in applied.state.runs[-1].recommendations} == {
        ("outdated", UNDONE)
    }


def test_fr35_undo_older_round_step(data: ImportData, analysis: Analysis) -> None:
    state, _ = play_steps(data, analysis, 15)  # last step: 0100's round 1 apply (move 10)
    assert (state.steps[-1].round, current_round(state)) == (1, 2)

    applied = undo_step(state, data, analysis)

    [rec] = [r for r in applied.state.runs[0].recommendations if r.part == "0100"]
    assert (rec.status, rec.outdated) == ("outdated", UNDONE)
    assert [e.type for e in applied.events] == ["step_undone"]  # run 1 is not counted
    assert current_round(applied.state) == 2


def test_fr35_undo_splits_combined_move(data: ImportData, analysis: Analysis) -> None:
    state, _ = play_steps(data, analysis, 18)  # 0100: move 12 A -> C, step 13 C -> B combined
    assert [m.steps for m in replay(data, state.steps).moves if m.part == "0100"] == [(12, 13)]

    applied = undo_step(state, data, analysis)

    [event] = applied.events
    assert isinstance(event, StepUndone)
    assert event.undone.effect == UndoEffect(kind="splits_combined_move", move_number=12)
    moves = [m for m in replay(data, applied.state.steps).moves if m.part == "0100"]
    assert [(m.move_number, m.from_location, m.to_location) for m in moves] == [
        (12, "A-01-01-01", "C-01-03-02")
    ]


def test_fr35_undo_restores_removed_move(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = apply_recommendation(state, "1100", data, analysis)  # move 1: C-01-01-01 -> A-01-01-03
    state = manual_step(state, "1100", "A-01-01-03", "C-01-01-01", data, analysis)  # move back
    assert replay(data, state.steps).moves == ()

    applied = undo_step(state, data, analysis)

    [event, *_] = applied.events
    assert isinstance(event, StepUndone)
    assert event.undone.effect == UndoEffect(kind="restores_removed_move", move_number=1)
    assert [m.move_number for m in replay(data, applied.state.steps).moves] == [1]
    view = build_recommendations_view(data, analysis, applied.state, 1)
    [row] = [row for row in view.recommendations if row.id == rec_id]
    assert row.status == "applied"
    assert row.applied is not None and row.applied.move_number == 1


def test_fr35_undo_swap_pair_one_step_at_a_time(data: ImportData, analysis: Analysis) -> None:
    swap = [
        Step(
            move_number=7,
            part="9100",
            from_location="D-01-02-02",
            to_location="D-01-02-03",
            rule="manual",
            round=0,
            swap_id="swap-1",
        ),
        Step(
            move_number=8,
            part="9200",
            from_location="D-01-02-03",
            to_location="D-01-02-02",
            rule="manual",
            round=0,
            swap_id="swap-1",
        ),
    ]
    state = PlanState(best_marks=MARKS, steps=swap, next_move_number=9)

    assert _rejected(state, 7, data, analysis).details == [{"last_move_number": 8}]
    once = apply(state, undo_command(8), CTX, data, analysis).state
    assert once.steps == swap[:1]
    twice = apply(once, undo_command(7), CTX, data, analysis).state
    assert twice.steps == []
    assert twice.next_move_number == 9


def test_fr35_undo_without_run(data: ImportData, analysis: Analysis) -> None:
    state = manual_step(PlanState(), "9100", "D-01-02-02", "D-01-02-03", data, analysis)

    applied = undo_step(state, data, analysis)

    assert applied.state.steps == []
    assert [e.type for e in applied.events] == ["step_undone"]


def test_fr35_undo_outdates_kept_part_recommendation(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = keep_step(state, "0500", data, analysis)
    state = apply_recommendation(state, "1100", data, analysis)

    applied = undo_step(state, data, analysis)

    [rec] = [r for r in applied.state.runs[-1].recommendations if r.part == "0500"]
    assert (rec.status, rec.outdated) == ("outdated", UNDONE)
    view = build_recommendations_view(data, analysis, applied.state, 1)
    [row] = [row for row in view.recommendations if row.part == "0500"]
    assert row.status == "outdated" and row.outdated is not None
    assert row.outdated.cause == "undo"


def test_fr35_undo_keeps_marks_runs_and_next_move_number(
    data: ImportData, analysis: Analysis
) -> None:
    state, _ = play_steps(data, analysis, 14)

    after = undo_step(state, data, analysis).state

    assert after.best_marks == state.best_marks
    assert after.keep_marks == state.keep_marks == ["0500"]
    assert [run.id for run in after.runs] == [run.id for run in state.runs]
    assert [run.no_space for run in after.runs] == [run.no_space for run in state.runs]
    assert after.next_move_number == state.next_move_number == 12  # never decreases (AD-5)


def test_fr35_undo_never_reuses_move_numbers(data: ImportData, analysis: Analysis) -> None:
    state = manual_step(PlanState(), "9100", "D-01-02-02", "D-01-02-03", data, analysis)
    state = undo_step(state, data, analysis).state

    state = manual_step(state, "9100", "D-01-02-02", "D-01-02-03", data, analysis)

    assert [s.move_number for s in state.steps] == [2]


def test_fr35_undo_wrong_number_rejected(data: ImportData, analysis: Analysis) -> None:
    state, _ = play_steps(data, analysis, 14)

    error = _rejected(state, 10, data, analysis)

    assert error.message == "Move 10 is no longer the last move. Undo the last move again."
    assert error.details == [{"last_move_number": 11}]
    assert state.steps[-1].move_number == 11  # pure: the input is untouched


def test_fr35_undo_nothing_to_undo_rejected(data: ImportData, analysis: Analysis) -> None:
    error = _rejected(PlanState(best_marks=MARKS), 1, data, analysis)

    assert error.message == "There is no move to undo."


def test_fr35_undo_outdated_is_sticky_through_revalidate(
    data: ImportData, analysis: Analysis
) -> None:
    state, _ = play_steps(data, analysis, 15)

    after = command(state, undo_command(10), data, analysis)

    assert {(r.status, r.outdated) for r in after.state.runs[-1].recommendations} == {
        ("outdated", UNDONE)
    }
    assert [e.type for e in after.events] == ["step_undone"]
