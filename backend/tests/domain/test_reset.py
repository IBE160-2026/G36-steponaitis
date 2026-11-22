"""FR-35/FR-36/AD-5: the `reset` command (domain only).

Reset deletes every step and run and restarts move numbering at 1. Best marks, keep marks
and the import stay; `plan_reset.moves_removed` counts effective moves, not raw steps.
"""

import uuid

import pytest

from swp.domain.analysis import Analysis
from swp.domain.apply import apply, check_step_invariants
from swp.domain.commands import PlanReset, Reset
from swp.domain.import_data import ImportData
from swp.domain.planning import current_round, replay
from swp.domain.state import PlanState
from tests.domain.answer_key import (
    CTX,
    MARKS,
    answer_key_analysis,
    answer_key_import,
    apply_recommendation,
    keep_step,
    manual_step,
    reset_step,
    run_command,
    undo_step,
)


@pytest.fixture(scope="module")
def planned(data: ImportData, analysis: Analysis) -> PlanState:
    """Aisle A marked, 0500 kept, run 1, 1100 applied, 4400 applied and moved back (a
    removed move), 0100 moved twice (one combined move), run 2: 2 effective moves."""
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)
    state = run_command(data, analysis, state).state
    state = apply_recommendation(state, "1100", data, analysis)
    state = apply_recommendation(state, "4400", data, analysis)
    state = manual_step(state, "4400", "B-01-03-03", "A-01-03-02", data, analysis)
    state = manual_step(state, "0100", "A-01-01-01", "C-01-03-02", data, analysis)
    state = manual_step(state, "0100", "C-01-03-02", "C-01-01-01", data, analysis)
    state = run_command(data, analysis, state).state
    assert len(state.steps) == 5
    assert len(replay(data, state.steps).moves) == 2
    assert current_round(state) == 2
    return state


def test_fr35_reset_keeps_marks(planned: PlanState, data: ImportData, analysis: Analysis) -> None:
    applied = reset_step(planned, data, analysis)

    assert applied.state.best_marks == planned.best_marks == MARKS
    assert applied.state.keep_marks == planned.keep_marks
    assert "0500" in applied.state.keep_marks


def test_fr35_reset_full_plan(planned: PlanState, data: ImportData, analysis: Analysis) -> None:
    applied = reset_step(planned, data, analysis)

    assert applied.state.steps == []
    assert applied.state.runs == []
    assert applied.state.next_move_number == 1
    assert current_round(applied.state) == 0
    assert applied.state.recent_commands == planned.recent_commands
    assert applied.state.schema_version == planned.schema_version
    assert applied.events == [PlanReset(moves_removed=2)]


def test_fr35_reset_runs_only(data: ImportData, analysis: Analysis) -> None:
    state = run_command(data, analysis, PlanState(best_marks=MARKS)).state
    assert state.runs and not state.steps

    applied = reset_step(state, data, analysis)

    assert applied.state.runs == []
    assert applied.events == [PlanReset(moves_removed=0)]


def test_fr35_reset_after_undo_all(data: ImportData, analysis: Analysis) -> None:
    state = run_command(data, analysis, PlanState(best_marks=MARKS)).state
    state = apply_recommendation(state, "1100", data, analysis)
    state = apply_recommendation(state, "4400", data, analysis)
    state = manual_step(state, "9300", "B-01-03-02", "C-01-01-01", data, analysis)
    for _ in range(3):
        state = undo_step(state, data, analysis).state
    state = state.model_copy(update={"runs": []})
    assert (state.steps, state.next_move_number) == ([], 4)

    applied = reset_step(state, data, analysis)

    assert applied.state.next_move_number == 1
    assert applied.events == [PlanReset(moves_removed=0)]


def test_fr35_reset_nothing_to_reset_is_noop(data: ImportData, analysis: Analysis) -> None:
    state = keep_step(PlanState(best_marks=MARKS), "0500", data, analysis)

    applied = reset_step(state, data, analysis)

    assert applied.state == state
    assert applied.events == []


def test_fr35_reset_next_run_round_1_and_move_1(
    planned: PlanState, data: ImportData, analysis: Analysis
) -> None:
    state = reset_step(planned, data, analysis).state

    state = run_command(data, analysis, state).state
    assert [run.round for run in state.runs] == [1]
    state = apply_recommendation(state, "1100", data, analysis)

    assert [(s.move_number, s.round) for s in state.steps] == [(1, 1)]
    assert state.next_move_number == 2


def test_fr36_reset_never_changes_import_or_analysis(
    planned: PlanState, data: ImportData, analysis: Analysis
) -> None:
    data_before = answer_key_import().data
    analysis_before = answer_key_analysis()

    state = undo_step(planned, data, analysis).state
    state = reset_step(state, data, analysis).state
    state = run_command(data, analysis, state).state
    state = apply_recommendation(state, "1100", data, analysis)
    reset_step(state, data, analysis)

    assert data == data_before
    assert analysis == analysis_before


def test_ad5_item36_reset_passes_step_invariants(
    planned: PlanState, data: ImportData, analysis: Analysis
) -> None:
    applied = apply(planned, Reset(command_id=uuid.uuid4(), base_version=1), CTX, data, analysis)

    check_step_invariants(planned, applied.state)


def test_ad5_item36_non_reset_decrease_still_raises(planned: PlanState) -> None:
    lowered = planned.model_copy(update={"next_move_number": planned.next_move_number - 1})

    with pytest.raises(AssertionError, match="next_move_number decreased"):
        check_step_invariants(planned, lowered)
    with pytest.raises(AssertionError, match="next_move_number decreased"):
        check_step_invariants(planned, lowered.model_copy(update={"steps": [], "runs": []}))
