"""FR-30/AD-5/AD-6/AD-7: the `apply_all` command (domain only)."""

import uuid

from swp.domain.analysis import Analysis
from swp.domain.apply import apply, check_step_invariants
from swp.domain.commands import (
    Applied,
    ApplyAll,
    ApplyAllDone,
    ApplyAllSkipped,
    RecommendationsOutdated,
)
from swp.domain.import_data import ImportData
from swp.domain.planning import applied_step, latest_run, open_recommendations
from swp.domain.recommendations import revalidate
from swp.domain.state import Outdated, PlanState, Step
from tests.domain.answer_key import (
    CTX,
    MARKS,
    after_run_1,
    apply_command,
    apply_recommendation,
    do,
    expected,
    manual_command,
    manual_step,
    run_command,
)


def _apply_all(state: PlanState, data: ImportData, analysis: Analysis) -> Applied:
    return apply(state, ApplyAll(command_id=uuid.uuid4(), base_version=1), CTX, data, analysis)


def _answer_key_after_run_2(data: ImportData, analysis: Analysis) -> PlanState:
    """Answer-key steps 1-13 (as `test_fr25_answer_key_rounds`), 0500 kept in the state."""
    state = run_command(data, analysis, PlanState(best_marks=MARKS)).state  # step 1
    state = apply_recommendation(state, "1100", data, analysis)  # step 2
    for part, source, target in [
        ("9300", "B-01-03-02", "C-01-01-01"),  # step 3
        ("9100", "D-01-02-02", "D-01-02-03"),  # step 4
        ("9200", "D-01-02-03", "D-01-02-02"),  # step 5
    ]:
        state = manual_step(state, part, source, target, data, analysis)
    state = state.model_copy(update={"keep_marks": ["0500"]})  # step 6 (keep is Epic 7)
    for part in ["8100", "8500", "3050", "4400", "9000", "0100"]:  # steps 7-12
        state = apply_recommendation(state, part, data, analysis)
    return run_command(data, analysis, state).state  # step 13


def _numbers(state: PlanState) -> dict[int, str]:
    run = latest_run(state)
    assert run is not None
    return {rec.number: rec.id for rec in run.recommendations}


def test_fr30_apply_all(data: ImportData, analysis: Analysis) -> None:
    run_2 = expected()["steps"][12]
    state = _answer_key_after_run_2(data, analysis)
    first = state.next_move_number

    applied = _apply_all(state, data, analysis)

    added = applied.state.steps[len(state.steps) :]
    recs = latest_run(state).recommendations  # type: ignore[union-attr]
    assert added == [
        Step(
            move_number=first + index,
            part=rec["part"],
            from_location=rec["from"],
            to_location=rec["to"],
            rule=f"rule_{rec['rule']}",
            round=2,
            recommendation_id=recs[index].id,
        )
        for index, rec in enumerate(run_2["recommendations_in_order"])
    ]
    assert [(s.part, s.to_location, s.rule) for s in added] == [
        ("1200", "A-01-01-01", "rule_1"),
        ("10240", "A-01-01-02", "rule_1"),
        ("2400", "A-01-03-02", "rule_1"),
        ("8400", "D-01-03-03", "rule_3"),
    ]
    assert applied.state.next_move_number == first + 4
    assert applied.events == [ApplyAllDone(applied=[1, 2, 3, 4], skipped=[])]
    assert open_recommendations(applied.state) == []
    assert "6600" not in {s.part for s in added}  # "no space" is never touched


def test_fr30_apply_all_after_run_1(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)

    applied = _apply_all(state, data, analysis)

    assert applied.events == [ApplyAllDone(applied=list(range(1, 9)), skipped=[])]
    assert [s.move_number for s in applied.state.steps] == list(range(1, 9))
    assert {s.round for s in applied.state.steps} == {1}
    ids = _numbers(state)
    assert all(applied_step(applied.state, ids[n]) is not None for n in ids)


def test_fr30_apply_all_kept_part_skipped(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = state.model_copy(update={"keep_marks": ["0500"]})  # rec #5

    applied = _apply_all(state, data, analysis)

    assert applied.events == [
        ApplyAllDone(
            applied=[1, 2, 3, 4, 6, 7, 8], skipped=[ApplyAllSkipped(number=5, cause="kept")]
        )
    ]
    assert applied_step(applied.state, _numbers(state)[5]) is None
    assert "0500" not in {s.part for s in applied.state.steps}


def test_fr30_apply_all_already_outdated_skipped(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    state = do(state, manual_command("9100", "D-01-02-02", "A-01-01-03"), data, analysis)
    state = revalidate(data, analysis, state).state  # as the service does after the move
    assert latest_run(state).recommendations[0].status == "outdated"  # type: ignore[union-attr]

    applied = _apply_all(state, data, analysis)

    assert applied.events == [
        ApplyAllDone(
            applied=[2, 3, 4, 5, 6, 7, 8], skipped=[ApplyAllSkipped(number=1, cause="filled")]
        )
    ]
    assert "1100" not in {s.part for s in applied.state.steps}


def test_fr30_apply_all_revalidates_first(data: ImportData, analysis: Analysis) -> None:
    """A recommendation outdated by a move not yet revalidated is stored and counted."""
    state, _ = after_run_1(data, analysis)
    state = do(state, manual_command("9100", "D-01-02-02", "A-01-01-03"), data, analysis)

    applied = _apply_all(state, data, analysis)

    assert applied.events == [
        ApplyAllDone(
            applied=[2, 3, 4, 5, 6, 7, 8], skipped=[ApplyAllSkipped(number=1, cause="filled")]
        ),
        RecommendationsOutdated(count=1, cause="filled"),
    ]


def test_fr30_apply_all_outdated_during_fold(data: ImportData, analysis: Analysis) -> None:
    """Rec #3 targets rec #2's location (state fixture): applying #2 fills it mid-fold."""
    state, _ = after_run_1(data, analysis)
    run = latest_run(state)
    assert run is not None
    shared = run.recommendations[1].to_location
    recs = [
        rec.model_copy(update={"to_location": shared}) if rec.number == 3 else rec
        for rec in run.recommendations
    ]
    state = state.model_copy(update={"runs": [run.model_copy(update={"recommendations": recs})]})
    assert revalidate(data, analysis, state).events == []  # #3 holds before the fold

    applied = _apply_all(state, data, analysis)

    assert applied.events == [
        ApplyAllDone(
            applied=[1, 2, 4, 5, 6, 7, 8], skipped=[ApplyAllSkipped(number=3, cause="filled")]
        ),
        RecommendationsOutdated(count=1, cause="filled"),
    ]
    move_of_2 = applied_step(applied.state, recs[1].id)
    assert move_of_2 is not None
    stored = latest_run(applied.state).recommendations[2]  # type: ignore[union-attr]
    assert stored.status == "outdated"
    assert stored.outdated == Outdated(
        cause="filled", location=shared, move_number=move_of_2.move_number
    )


def test_fr30_apply_all_already_applied_not_listed(data: ImportData, analysis: Analysis) -> None:
    state, rec_1 = after_run_1(data, analysis)
    state = do(state, apply_command(rec_1), data, analysis)

    applied = _apply_all(state, data, analysis)

    assert applied.events == [ApplyAllDone(applied=list(range(2, 9)), skipped=[])]
    assert [s.recommendation_id for s in applied.state.steps].count(rec_1) == 1
    assert [s.move_number for s in applied.state.steps] == list(range(1, 9))


def test_fr30_apply_all_without_run_is_noop(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=MARKS)

    applied = _apply_all(state, data, analysis)

    assert applied.state == state
    assert applied.events == []


def test_fr30_apply_all_nothing_left_is_noop(data: ImportData, analysis: Analysis) -> None:
    state, _ = after_run_1(data, analysis)
    done = _apply_all(state, data, analysis).state

    again = _apply_all(done, data, analysis)

    assert again.state is done
    assert again.events == []


def test_fr30_apply_all_only_kept_or_outdated_is_noop(data: ImportData, analysis: Analysis) -> None:
    """Every open rec kept and the rest outdated: nothing applied, the input state returned
    (even the fold's own revalidate is dropped)."""
    state, _ = after_run_1(data, analysis)
    parts = [rec.part for rec in latest_run(state).recommendations]  # type: ignore[union-attr]
    state = state.model_copy(update={"keep_marks": parts[1:]})
    state = do(state, manual_command("9100", "D-01-02-02", "A-01-01-03"), data, analysis)

    applied = _apply_all(state, data, analysis)

    assert applied.state is state
    assert applied.events == []


def test_fr30_apply_all_is_deterministic(data: ImportData, analysis: Analysis) -> None:
    state = _answer_key_after_run_2(data, analysis)

    first = _apply_all(state, data, analysis)
    second = _apply_all(state, data, analysis)

    assert first == second


def test_ad5_apply_all_step_invariants(data: ImportData, analysis: Analysis) -> None:
    """Retro item 36: over the fold `next_move_number` never decreases and the new steps
    number from it, in the current round."""
    state = _answer_key_after_run_2(data, analysis)

    after = _apply_all(state, data, analysis).state

    check_step_invariants(state, after)
    added = after.steps[len(state.steps) :]
    assert [s.move_number for s in added] == list(
        range(state.next_move_number, after.next_move_number)
    )
    assert {s.round for s in added} == {2}
