"""FR-23/FR-24/FR-27/AD-5/AD-14: rule 1 and the `run` command (domain only)."""

import uuid
from datetime import UTC, datetime

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    Applied,
    CommandContext,
    ManualMove,
    MoveMade,
    RunDone,
    RunRecommendations,
)
from swp.domain.import_data import ImportData
from swp.domain.ordering import location_code_order
from swp.domain.planning import current_round, replay
from swp.domain.rules import RuleMove, rule_1
from swp.domain.state import (
    AisleMark,
    LevelMark,
    NoSpace,
    PlanState,
    Recommendation,
    Run,
    Step,
)
from tests.domain.answer_key import expected

CTX = CommandContext(now=datetime(2026, 11, 22, 12, 0, tzinfo=UTC), user="planner")
MARKS = [AisleMark(aisle="A")]


def _rule_1(
    data: ImportData, analysis: Analysis, state: PlanState
) -> tuple[list[RuleMove], list[NoSpace]]:
    return rule_1(data, replay(data, state.steps).copy, analysis, state)


def _run(
    data: ImportData, analysis: Analysis, state: PlanState, command_id: uuid.UUID | None = None
) -> Applied:
    command = RunRecommendations(command_id=command_id or uuid.uuid4(), base_version=1)
    return apply(state, command, CTX, data, analysis)


def _outcome(run: Run) -> tuple[list[tuple[int, str, str, str, str]], list[tuple[str, str]]]:
    recs = [(r.number, r.rule, r.part, r.from_location, r.to_location) for r in run.recommendations]
    return recs, [(n.part, n.rule) for n in run.no_space]


def test_fr24_answer_key_round1(data: ImportData, analysis: Analysis) -> None:
    step = expected()["steps"][0]
    rule_1_recs = [r for r in step["recommendations_in_order"] if r["rule"] == 1]
    rule_1_no_space = [n["part"] for n in step["no_space"] if n["rule"] == 1]

    applied = _run(data, analysis, PlanState(best_marks=MARKS))

    run = applied.state.runs[-1]
    assert run.round == step["round"] == 1
    assert _outcome(run) == (
        [(n, "rule_1", r["part"], r["from"], r["to"]) for n, r in enumerate(rule_1_recs, start=1)],
        [(part, "rule_1") for part in rule_1_no_space],
    )
    assert _outcome(run) == (
        [(1, "rule_1", "1100", "C-01-01-01", "A-01-01-03")],
        [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1")],
    )
    assert applied.events == [RunDone(round=1, recommendations=1, no_space=3)]
    assert applied.state.steps == []
    assert applied.state.next_move_number == 1


def test_fr23_run_is_deterministic(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=MARKS)

    first = _run(data, analysis, state, uuid.UUID(int=1)).state.runs[-1]
    second = _run(data, analysis, state, uuid.UUID(int=2)).state.runs[-1]

    assert first.id != second.id
    assert _outcome(first) == _outcome(second)
    assert _rule_1(data, analysis, state) == _rule_1(data, analysis, state)


def test_fr27_kept_part_skipped(data: ImportData, analysis: Analysis) -> None:
    moves, no_space = _rule_1(data, analysis, PlanState(best_marks=MARKS, keep_marks=["1100"]))

    assert moves == [
        RuleMove(rule="rule_1", part="1200", from_location="B-01-01-02", to_location="A-01-01-03")
    ]
    assert no_space == [NoSpace(part="10240", rule="rule_1"), NoSpace(part="2400", rule="rule_1")]


def test_fr27_no_current_location_skipped(data: ImportData, analysis: Analysis) -> None:
    # 1008614-00 is fast but has stock 0: no current location.
    assert analysis.parts["1008614-00"].movement_class == "fast"
    for marks in ([], MARKS, [LevelMark(level="3")]):
        moves, no_space = _rule_1(data, analysis, PlanState(best_marks=marks))

        assert "1008614-00" not in {move.part for move in moves}
        assert "1008614-00" not in {entry.part for entry in no_space}


def test_fr24_no_best_marks_gives_no_space(data: ImportData, analysis: Analysis) -> None:
    moves, no_space = _rule_1(data, analysis, PlanState())

    assert moves == []
    # Fast parts with a current location, most picks first (5000 is in a best location
    # only when aisle A is marked).
    assert no_space == [
        NoSpace(part=part, rule="rule_1") for part in ["5000", "1100", "1200", "10240", "2400"]
    ]


def test_fr27_each_location_once_and_never_virtual(data: ImportData, analysis: Analysis) -> None:
    # Pretend B-01-03-03 (empty, level 3) is virtual: it must never be suggested.
    virtual = data.model_copy(update={"virtual_locations": [*data.virtual_locations, "B-01-03-03"]})
    state = PlanState(best_marks=[LevelMark(level="3")])

    moves, no_space = _rule_1(virtual, analysis, state)

    targets = [move.to_location for move in moves]
    assert targets == ["C-01-03-01", "C-01-03-02", "C-01-03-03", "D-01-03-01", "D-01-03-02"]
    assert targets == location_code_order(targets)
    assert len(set(targets)) == len(targets)
    assert "B-01-03-03" not in targets
    assert [move.part for move in moves] == ["5000", "1100", "1200", "10240", "2400"]
    assert no_space == []
    assert len({move.part for move in moves}) == len(moves)


def test_fr27_location_code_order_is_plain_str_order() -> None:
    assert location_code_order(["B-10", "B-2", "A-1", "B-2"]) == ["A-1", "B-10", "B-2"]


def test_fr23_run_identity_and_metadata(data: ImportData, analysis: Analysis) -> None:
    command_id = uuid.UUID(int=42)

    applied = _run(data, analysis, PlanState(best_marks=MARKS), command_id)

    run = applied.state.runs[-1]
    run_id = str(uuid.uuid5(command_id, "run:1"))
    assert run.id == run_id
    assert run.round == 1
    assert run.created_at == CTX.now
    assert run.created_by == "planner"
    assert run.recommendations == [
        Recommendation(
            id=f"{run_id}:1",
            number=1,
            rule="rule_1",
            part="1100",
            from_location="C-01-01-01",
            to_location="A-01-01-03",
        )
    ]
    assert run.recommendations[0].status == "open"
    assert current_round(applied.state) == 1


def test_fr23_new_run_prunes_unreferenced_and_bumps_round(
    data: ImportData, analysis: Analysis
) -> None:
    run_1 = _run(data, analysis, PlanState(best_marks=MARKS), uuid.UUID(int=1)).state.runs[0]
    extra = Recommendation(
        id=f"{run_1.id}:2",
        number=2,
        rule="rule_1",
        part="5000",
        from_location="A-01-02-03",
        to_location="A-01-01-03",
    )
    run_1 = run_1.model_copy(update={"recommendations": [*run_1.recommendations, extra]})
    step = Step(
        move_number=1,
        part="1100",
        from_location="C-01-01-01",
        to_location="A-01-01-03",
        rule="rule_1",
        round=1,
        recommendation_id=f"{run_1.id}:1",
    )
    state = PlanState(best_marks=MARKS, runs=[run_1], steps=[step], next_move_number=2)

    applied = _run(data, analysis, state, uuid.UUID(int=2))

    old, new = applied.state.runs
    assert (old.id, old.round, old.created_at, old.created_by) == (
        run_1.id,
        1,
        run_1.created_at,
        run_1.created_by,
    )
    assert old.recommendations == [run_1.recommendations[0]]
    assert old.no_space == []
    assert new.round == 2
    assert new.id == str(uuid.uuid5(uuid.UUID(int=2), "run:2"))
    # 1100 is now in A-01-01-03 (best); aisle A has no empty location left.
    assert _outcome(new) == ([], [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1")])
    assert applied.events == [RunDone(round=2, recommendations=0, no_space=3)]
    assert applied.state.steps == [step]
    assert current_round(applied.state) == 2


def test_ad5_step_after_run_gets_its_round(data: ImportData, analysis: Analysis) -> None:
    after_run = _run(data, analysis, PlanState(best_marks=MARKS)).state
    after_run = _run(data, analysis, after_run).state
    move = ManualMove(
        command_id=uuid.uuid4(),
        base_version=1,
        part="9300",
        from_location="B-01-03-02",
        to_location="C-01-03-01",
    )

    applied = apply(after_run, move, CTX, data, analysis)

    assert applied.state.steps[-1].round == 2
    assert applied.events == [
        MoveMade(
            move_number=1,
            part="9300",
            from_location="B-01-03-02",
            to_location="C-01-03-01",
            rule="manual",
            round=2,
        )
    ]
