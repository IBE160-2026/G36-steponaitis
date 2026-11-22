"""FR-29/FR-30/FR-32/AD-5/AD-7: the `apply` command (domain only)."""

import uuid

import pytest

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    MoveMade,
    RemoveBestMark,
    SetBestMark,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import replay
from swp.domain.recommendations import applied_step, outdated_cause
from swp.domain.state import AisleMark, BestMark, PlanState, Recommendation, Run, Step
from tests.domain.answer_key import (
    CTX,
    MARKS,
    after_run_1,
    apply_command,
    do,
    expected,
    manual_command,
    run_command,
)


def _rejected(state: PlanState, rec_id: str, data: ImportData, analysis: Analysis) -> DomainError:
    with pytest.raises(DomainError) as raised:
        apply(state, apply_command(rec_id), CTX, data, analysis)
    assert raised.value.code == "command_rejected"
    return raised.value


def test_fr30_apply_answer_key_step2(data: ImportData, analysis: Analysis) -> None:
    step = expected()["steps"][1]
    assert step["action"] == "apply"
    move = step["expect_move"]
    state, rec_id = after_run_1(data, analysis)

    applied = apply(state, apply_command(rec_id), CTX, data, analysis)

    assert applied.state.steps == [
        Step(
            move_number=1,
            part=step["part"],
            from_location=move["from"],
            to_location=move["to"],
            rule=f"rule_{move['rule']}",
            round=move["round"],
            recommendation_id=rec_id,
        )
    ]
    assert applied.events == [
        MoveMade(
            move_number=1,
            part="1100",
            from_location="C-01-01-01",
            to_location="A-01-01-03",
            rule="rule_1",
            round=1,
        )
    ]
    assert applied.state.next_move_number == 2
    assert applied.state.runs[-1].recommendations[0].status == "open"
    copy = replay(data, applied.state.steps).copy
    assert "1100" in copy.contents_of("A-01-01-03")


def test_ad5_manual_move_after_apply_gets_run_round(data: ImportData, analysis: Analysis) -> None:
    step = expected()["steps"][2]
    assert step["action"] == "manual_move"
    state, rec_id = after_run_1(data, analysis)
    state = do(state, apply_command(rec_id), data, analysis)

    applied = apply(
        state, manual_command(step["part"], step["from"], step["to"]), CTX, data, analysis
    )

    [event] = applied.events
    assert isinstance(event, MoveMade)
    assert (event.rule, event.round) == ("manual", step["expect_move"]["round"]) == ("manual", 1)
    assert (event.part, event.from_location, event.to_location) == (
        "9300",
        "B-01-03-02",
        "C-01-01-01",
    )


def test_ad7_apply_unknown_rejected(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)

    error = _rejected(state, "nope", data, analysis)

    assert error.message == "This recommendation is not in the latest run."


def test_ad7_apply_without_run_rejected(data: ImportData, analysis: Analysis) -> None:
    error = _rejected(PlanState(best_marks=MARKS), "nope", data, analysis)

    assert error.message == "This recommendation is not in the latest run."


def test_ad7_apply_earlier_run_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = run_command(data, analysis, state).state
    assert state.runs[-1].round == 2

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "This recommendation is not in the latest run."


def test_ad7_apply_twice_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = do(state, apply_command(rec_id), data, analysis)

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "Recommendation #1 is already applied."


def test_fr29_apply_moved_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = do(state, manual_command("1100", "C-01-01-01", "B-01-04-01"), data, analysis)

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "Recommendation #1 is outdated."
    assert error.details == [{"cause": "moved"}]


def test_fr29_apply_filled_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = do(state, manual_command("1200", "B-01-01-02", "A-01-01-03"), data, analysis)

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "Recommendation #1 is outdated."
    assert error.details == [{"cause": "filled"}]


def test_fr29_apply_marks_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    remove = RemoveBestMark(command_id=uuid.uuid4(), base_version=1, mark=MARKS[0])
    state = do(state, remove, data, analysis)
    assert state.best_marks == []

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "Recommendation #1 is outdated."
    assert error.details == [{"cause": "marks"}]


def test_fr32_apply_kept_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = state.model_copy(update={"keep_marks": ["1100"]})

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "1100 is kept in place."


def test_ad7_applied_is_derived_not_stored(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    assert applied_step(state, rec_id) is None

    after = do(state, apply_command(rec_id), data, analysis)

    assert applied_step(after, rec_id) == after.steps[0]
    assert after.runs == state.runs
    assert all(r.status == "open" for r in after.runs[-1].recommendations)


def test_fr29_apply_marks_from_best_rejected(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    mark_c = SetBestMark(command_id=uuid.uuid4(), base_version=1, mark=AisleMark(aisle="C"))
    state = do(state, mark_c, data, analysis)

    error = _rejected(state, rec_id, data, analysis)

    assert error.details == [{"cause": "marks"}]


def test_fr29_apply_after_earlier_round_move_allowed(data: ImportData, analysis: Analysis) -> None:
    # Round 0: 1100 moves C-01-01-01 -> C-01-03-01 (not best) before run 1.
    state = do(
        PlanState(best_marks=MARKS),
        manual_command("1100", "C-01-01-01", "C-01-03-01"),
        data,
        analysis,
    )
    assert state.steps[0].round == 0
    state = run_command(data, analysis, state).state
    rec = state.runs[-1].recommendations[0]
    assert (rec.part, rec.from_location) == ("1100", "C-01-03-01")

    after = do(state, apply_command(rec.id), data, analysis)

    assert after.steps[-1].recommendation_id == rec.id
    assert after.steps[-1].round == 1


def test_fr29_apply_cause_order_moved_before_filled(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = do(state, manual_command("1100", "C-01-01-01", "A-01-01-03"), data, analysis)

    error = _rejected(state, rec_id, data, analysis)

    assert error.details == [{"cause": "moved"}]


def test_fr29_apply_outdated_wins_over_kept(data: ImportData, analysis: Analysis) -> None:
    state, rec_id = after_run_1(data, analysis)
    state = do(state, manual_command("1200", "B-01-01-02", "A-01-01-03"), data, analysis)
    state = state.model_copy(update={"keep_marks": ["1100"]})

    error = _rejected(state, rec_id, data, analysis)

    assert error.message == "Recommendation #1 is outdated."
    assert error.details == [{"cause": "filled"}]


def _cause(
    data: ImportData, analysis: Analysis, rec: Recommendation, marks: list[BestMark]
) -> str | None:
    run = Run(id="run", round=1, created_at=CTX.now, created_by="planner", recommendations=[rec])
    state = PlanState(best_marks=marks, runs=[run])
    return outdated_cause(data, analysis, state, run, rec)


def test_fr29_outdated_cause_marks_rule_2(data: ImportData, analysis: Analysis) -> None:
    # 0100 (slow) in best A-01-01-01 -> non-best B-01-04-01.
    rec = Recommendation(
        id="run:1",
        number=1,
        rule="rule_2",
        part="0100",
        from_location="A-01-01-01",
        to_location="B-01-04-01",
    )
    aisle_a, aisle_b = AisleMark(aisle="A"), AisleMark(aisle="B")

    assert _cause(data, analysis, rec, [aisle_a]) is None
    assert _cause(data, analysis, rec, []) == "marks"  # from is no longer best
    assert _cause(data, analysis, rec, [aisle_a, aisle_b]) == "marks"  # to became best


def test_fr29_outdated_cause_marks_rule_3(data: ImportData, analysis: Analysis) -> None:
    # 8100 (medium) B-01-02-01 -> C-01-03-01; 6600 (slow) C-01-02-03 -> D-01-03-01.
    medium = Recommendation(
        id="run:1",
        number=1,
        rule="rule_3",
        part="8100",
        from_location="B-01-02-01",
        to_location="C-01-03-01",
    )
    slow = Recommendation(
        id="run:2",
        number=2,
        rule="rule_3",
        part="6600",
        from_location="C-01-02-03",
        to_location="D-01-03-01",
    )
    assert analysis.parts["8100"].movement_class == "medium"
    assert analysis.parts["6600"].movement_class == "slow"

    assert _cause(data, analysis, medium, []) is None
    assert _cause(data, analysis, medium, [AisleMark(aisle="B")]) == "marks"  # from is best
    assert _cause(data, analysis, medium, [AisleMark(aisle="C")]) is None  # medium may go to best
    assert _cause(data, analysis, slow, []) is None
    assert _cause(data, analysis, slow, [AisleMark(aisle="D")]) == "marks"  # slow to best
