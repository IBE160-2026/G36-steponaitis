"""FR-23/FR-24/FR-25/FR-27/AD-5/AD-14: rules 1 and 2 and the `run` command (domain only)."""

import uuid
from datetime import UTC, datetime

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    Applied,
    ApplyRecommendation,
    CommandContext,
    ManualMove,
    MoveMade,
    RunDone,
    RunRecommendations,
)
from swp.domain.import_data import ImportData
from swp.domain.ordering import fewest_picks_order, location_code_order
from swp.domain.planning import current_round, import_copy, replay, run_baseline
from swp.domain.rules import RuleMove, rule_1, rule_2
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


def _rule_2(
    data: ImportData,
    analysis: Analysis,
    state: PlanState,
    earlier_moves: list[RuleMove] | None = None,
    earlier_no_space: list[NoSpace] | None = None,
) -> tuple[list[RuleMove], list[NoSpace]]:
    copy = replay(data, state.steps).copy
    return rule_2(data, copy, analysis, state, earlier_moves or [], earlier_no_space or [])


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
    # Rules 1 and 2 only: rule 3 is Story 5.4.
    recs = [r for r in step["recommendations_in_order"] if r["rule"] in (1, 2)]
    no_space = [n for n in step["no_space"] if n["rule"] in (1, 2)]

    applied = _run(data, analysis, PlanState(best_marks=MARKS))

    run = applied.state.runs[-1]
    assert run.round == step["round"] == 1
    assert _outcome(run) == (
        [
            (n, f"rule_{r['rule']}", r["part"], r["from"], r["to"])
            for n, r in enumerate(recs, start=1)
        ],
        [(n["part"], f"rule_{n['rule']}") for n in no_space],
    )
    assert _outcome(run) == (
        [
            (1, "rule_1", "1100", "C-01-01-01", "A-01-01-03"),
            (2, "rule_2", "4400", "A-01-03-02", "B-01-03-03"),
            (3, "rule_2", "9000", "A-01-01-02", "B-01-04-01"),
            (4, "rule_2", "0100", "A-01-01-01", "B-01-04-02"),
            (5, "rule_2", "0500", "A-01-03-01", "B-01-04-03"),
        ],
        [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1")],
    )
    assert applied.events == [RunDone(round=1, recommendations=5, no_space=3)]
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
    assert run.recommendations[0] == Recommendation(
        id=f"{run_id}:1",
        number=1,
        rule="rule_1",
        part="1100",
        from_location="C-01-01-01",
        to_location="A-01-01-03",
    )
    assert [(r.id, r.number) for r in run.recommendations] == [
        (f"{run_id}:{n}", n) for n in range(1, 6)
    ]
    assert all(r.status == "open" for r in run.recommendations)
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
    # 1100 is now in A-01-01-03 (best); aisle A has no empty location left. Rule 2's
    # moves are not applied, so it recommends them again.
    assert _outcome(new) == (
        [
            (1, "rule_2", "4400", "A-01-03-02", "B-01-03-03"),
            (2, "rule_2", "9000", "A-01-01-02", "B-01-04-01"),
            (3, "rule_2", "0100", "A-01-01-01", "B-01-04-02"),
            (4, "rule_2", "0500", "A-01-03-01", "B-01-04-03"),
        ],
        [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1")],
    )
    assert applied.events == [RunDone(round=2, recommendations=4, no_space=3)]
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


def test_fr25_answer_key_round1_rule_2(data: ImportData, analysis: Analysis) -> None:
    moves, no_space = _rule_2(data, analysis, PlanState(best_marks=MARKS))

    assert moves == [
        RuleMove(rule="rule_2", part="4400", from_location="A-01-03-02", to_location="B-01-03-03"),
        RuleMove(rule="rule_2", part="9000", from_location="A-01-01-02", to_location="B-01-04-01"),
        RuleMove(rule="rule_2", part="0100", from_location="A-01-01-01", to_location="B-01-04-02"),
        RuleMove(rule="rule_2", part="0500", from_location="A-01-03-01", to_location="B-01-04-03"),
    ]
    assert no_space == []
    assert all(analysis.parts[m.part].movement_class in {"slow", "dead"} for m in moves)


def test_fr25_freed_best_not_offered_in_same_run(data: ImportData, analysis: Analysis) -> None:
    run = _run(data, analysis, PlanState(best_marks=MARKS)).state.runs[-1]

    freed = {r.from_location for r in run.recommendations if r.rule == "rule_2"}
    assert freed == {"A-01-03-02", "A-01-01-02", "A-01-01-01", "A-01-03-01"}
    # 1200 is "no space" although rule 2 would free four A locations.
    assert NoSpace(part="1200", rule="rule_1") in run.no_space
    assert not freed & {r.to_location for r in run.recommendations}


def _apply_rec(state: PlanState, part: str, data: ImportData, analysis: Analysis) -> PlanState:
    [rec] = [r for r in state.runs[-1].recommendations if r.part == part]
    command = ApplyRecommendation(command_id=uuid.uuid4(), base_version=1, recommendation_id=rec.id)
    return apply(state, command, CTX, data, analysis).state


def _manual(
    state: PlanState, part: str, source: str, target: str, data: ImportData, analysis: Analysis
) -> PlanState:
    command = ManualMove(
        command_id=uuid.uuid4(),
        base_version=1,
        part=part,
        from_location=source,
        to_location=target,
    )
    return apply(state, command, CTX, data, analysis).state


def test_fr25_answer_key_rounds(data: ImportData, analysis: Analysis) -> None:
    steps = expected()["steps"]
    state = _run(data, analysis, PlanState(best_marks=MARKS)).state  # step 1
    state = _apply_rec(state, "1100", data, analysis)  # step 2
    for part, source, target in [
        ("9300", "B-01-03-02", "C-01-01-01"),  # step 3
        ("9100", "D-01-02-02", "D-01-02-03"),  # step 4
        ("9200", "D-01-02-03", "D-01-02-02"),  # step 5
    ]:
        state = _manual(state, part, source, target, data, analysis)
    # Step 6: the keep command is Epic 7, so the mark is set in the state.
    state = state.model_copy(update={"keep_marks": ["0500"]})
    # Steps 7-9: rule 3 is Story 5.4, so its moves are made as manual moves in round 1.
    for part, source, target in [
        ("8100", "B-01-02-01", "C-01-03-01"),
        ("8500", "B-01-02-02", "D-01-03-01"),
        ("3050", "B-01-02-03", "D-01-03-02"),
    ]:
        state = _manual(state, part, source, target, data, analysis)
    for part in ["4400", "9000", "0100"]:  # steps 10-12
        state = _apply_rec(state, part, data, analysis)
    assert {step.round for step in state.steps} == {1}

    applied = _run(data, analysis, state)  # step 13

    step = steps[12]
    recs = [r for r in step["recommendations_in_order"] if r["rule"] in (1, 2)]
    run = applied.state.runs[-1]
    assert run.round == step["round"] == 2
    assert _outcome(run) == (
        [
            (n, f"rule_{r['rule']}", r["part"], r["from"], r["to"])
            for n, r in enumerate(recs, start=1)
        ],
        [(n["part"], f"rule_{n['rule']}") for n in step["no_space"] if n["rule"] in (1, 2)],
    )
    assert _outcome(run) == (
        [
            (1, "rule_1", "1200", "B-01-01-02", "A-01-01-01"),
            (2, "rule_1", "10240", "B-01-01-03", "A-01-01-02"),
            (3, "rule_1", "2400", "C-01-01-02", "A-01-03-02"),
        ],
        [],
    )
    assert applied.events == [RunDone(round=2, recommendations=3, no_space=0)]


def test_fr25_no_space_under_rule_2(data: ImportData, analysis: Analysis) -> None:
    marks = [AisleMark(aisle=aisle) for aisle in "ABCD"]

    run = _run(data, analysis, PlanState(best_marks=marks)).state.runs[-1]

    assert _outcome(run) == (
        [],
        [(part, "rule_2") for part in ["4400", "9000", "9300", "0100", "0500", "6600"]],
    )


def test_fr27_rule_2_kept_part_skipped(data: ImportData, analysis: Analysis) -> None:
    moves, no_space = _rule_2(data, analysis, PlanState(best_marks=MARKS, keep_marks=["4400"]))

    assert [(m.part, m.to_location) for m in moves] == [
        ("9000", "B-01-03-03"),
        ("0100", "B-01-04-01"),
        ("0500", "B-01-04-02"),
    ]
    assert no_space == []


def test_fr27_rule_2_skips_parts_earlier_rules_handled(
    data: ImportData, analysis: Analysis
) -> None:
    earlier = RuleMove(
        rule="rule_1", part="9000", from_location="A-01-01-02", to_location="B-01-03-03"
    )

    moves, no_space = _rule_2(data, analysis, PlanState(best_marks=MARKS), [earlier])

    assert [(m.part, m.to_location) for m in moves] == [
        ("4400", "B-01-04-01"),
        ("0100", "B-01-04-02"),
        ("0500", "B-01-04-03"),
    ]
    assert no_space == []

    # A part with an earlier "no space" entry is skipped silently too.
    moves, no_space = _rule_2(
        data, analysis, PlanState(best_marks=MARKS), [], [NoSpace(part="4400", rule="rule_1")]
    )
    assert "4400" not in {m.part for m in moves} | {n.part for n in no_space}


def test_fr27_rule_2_never_virtual(data: ImportData, analysis: Analysis) -> None:
    virtual = data.model_copy(update={"virtual_locations": [*data.virtual_locations, "B-01-03-03"]})

    moves, no_space = _rule_2(virtual, analysis, PlanState(best_marks=MARKS))

    assert [(m.part, m.to_location) for m in moves] == [
        ("4400", "B-01-04-01"),
        ("9000", "B-01-04-02"),
        ("0100", "B-01-04-03"),
        ("0500", "C-01-03-01"),
    ]
    assert no_space == []


def test_ad5_run_baseline_is_replay_of_earlier_rounds(data: ImportData) -> None:
    round_1 = Step(
        move_number=1,
        part="1100",
        from_location="C-01-01-01",
        to_location="A-01-01-03",
        rule="rule_1",
        round=1,
    )
    round_2 = Step(
        move_number=2,
        part="9300",
        from_location="B-01-03-02",
        to_location="C-01-01-01",
        rule="manual",
        round=2,
    )
    steps = [round_1, round_2]

    assert run_baseline(data, steps, 2) == replay(data, [round_1])
    assert run_baseline(data, steps, 3) == replay(data, steps)
    assert run_baseline(data, steps, 1) == replay(data, [])
    assert run_baseline(data, steps, 1).copy == import_copy(data)


def test_ad14_fewest_picks_order(analysis: Analysis) -> None:
    parts = {part: analysis.parts[part] for part in ["0100", "0500", "4400", "9000", "9300"]}

    order = fewest_picks_order(parts)

    assert order[:4] == ["4400", "9000", "9300", "0100"]
    # Ties go in part-number `str` order ("30400" < "3050"), fewest picks first.
    tied = analysis.parts["4400"]
    more = tied.model_copy(update={"picks": tied.picks + 1})
    assert fewest_picks_order({"3050": tied, "9": more, "30400": tied}) == ["30400", "3050", "9"]
