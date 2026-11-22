"""FR-23/FR-24/FR-25/FR-26/FR-27/AD-5/AD-14: rules 1, 2 and 3 and the `run` command (domain
only)."""

import uuid
from datetime import UTC, datetime
from typing import Any

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
from swp.domain.rules import RuleMove, rule_1, rule_2, rule_3
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


def _rule_3(
    data: ImportData,
    analysis: Analysis,
    state: PlanState,
    earlier_moves: list[RuleMove] | None = None,
    earlier_no_space: list[NoSpace] | None = None,
) -> tuple[list[RuleMove], list[NoSpace]]:
    copy = replay(data, state.steps).copy
    return rule_3(data, copy, analysis, state, earlier_moves or [], earlier_no_space or [])


def _expected_outcome(
    step: dict[str, Any],
) -> tuple[list[tuple[int, str, str, str, str]], list[tuple[str, str]]]:
    """A run step of `expected.json` in `_outcome`'s shape."""
    return (
        [
            (n, f"rule_{r['rule']}", r["part"], r["from"], r["to"])
            for n, r in enumerate(step["recommendations_in_order"], start=1)
        ],
        [(n["part"], f"rule_{n['rule']}") for n in step["no_space"]],
    )


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

    applied = _run(data, analysis, PlanState(best_marks=MARKS))

    run = applied.state.runs[-1]
    assert run.round == step["round"] == 1
    assert _outcome(run) == _expected_outcome(step)
    assert _outcome(run) == (
        [
            (1, "rule_1", "1100", "C-01-01-01", "A-01-01-03"),
            (2, "rule_2", "4400", "A-01-03-02", "B-01-03-03"),
            (3, "rule_2", "9000", "A-01-01-02", "B-01-04-01"),
            (4, "rule_2", "0100", "A-01-01-01", "B-01-04-02"),
            (5, "rule_2", "0500", "A-01-03-01", "B-01-04-03"),
            (6, "rule_3", "8100", "B-01-02-01", "C-01-03-01"),
            (7, "rule_3", "8500", "B-01-02-02", "D-01-03-01"),
            (8, "rule_3", "3050", "B-01-02-03", "D-01-03-02"),
        ],
        [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1"), ("6600", "rule_3")],
    )
    assert applied.events == [RunDone(round=1, recommendations=8, no_space=4)]
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
        (f"{run_id}:{n}", n) for n in range(1, 9)
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
    # 1100 is now in A-01-01-03 (best); aisle A has no empty location left. Rule 2's and
    # rule 3's moves are not applied, so they come again; 1100 freed C-01-01-01, which is
    # now the first empty location in 8200's aisle.
    assert _outcome(new) == (
        [
            (1, "rule_2", "4400", "A-01-03-02", "B-01-03-03"),
            (2, "rule_2", "9000", "A-01-01-02", "B-01-04-01"),
            (3, "rule_2", "0100", "A-01-01-01", "B-01-04-02"),
            (4, "rule_2", "0500", "A-01-03-01", "B-01-04-03"),
            (5, "rule_3", "8100", "B-01-02-01", "C-01-01-01"),
            (6, "rule_3", "8500", "B-01-02-02", "D-01-03-01"),
            (7, "rule_3", "3050", "B-01-02-03", "D-01-03-02"),
        ],
        [("1200", "rule_1"), ("10240", "rule_1"), ("2400", "rule_1"), ("6600", "rule_3")],
    )
    assert applied.events == [RunDone(round=2, recommendations=7, no_space=4)]
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
    for index, part in [(6, "8100"), (7, "8500"), (8, "3050")]:  # steps 7-9
        state = _apply_rec(state, part, data, analysis)
        move = steps[index]["expect_move"]
        assert (state.steps[-1].part, state.steps[-1].rule, state.steps[-1].round) == (
            part,
            f"rule_{move['rule']}",
            move["round"],
        )
        assert (state.steps[-1].from_location, state.steps[-1].to_location) == (
            move["from"],
            move["to"],
        )
    for part in ["4400", "9000", "0100"]:  # steps 10-12
        state = _apply_rec(state, part, data, analysis)
    assert {step.round for step in state.steps} == {1}

    applied = _run(data, analysis, state)  # step 13

    step = steps[12]
    run = applied.state.runs[-1]
    assert run.round == step["round"] == 2
    assert _outcome(run) == _expected_outcome(step)
    assert _outcome(run) == (
        [
            (1, "rule_1", "1200", "B-01-01-02", "A-01-01-01"),
            (2, "rule_1", "10240", "B-01-01-03", "A-01-01-02"),
            (3, "rule_1", "2400", "C-01-01-02", "A-01-03-02"),
            (4, "rule_3", "8400", "C-01-02-02", "D-01-03-03"),
        ],
        [("6600", "rule_3")],
    )
    assert applied.events == [RunDone(round=2, recommendations=4, no_space=1)]


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


def _rule_3_moves(moves: list[RuleMove]) -> list[tuple[str, str, str]]:
    return [(m.part, m.from_location, m.to_location) for m in moves]


def test_fr26_answer_key_round1_rule_3(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=MARKS)
    moves_1, no_space_1 = _rule_1(data, analysis, state)
    moves_2, no_space_2 = _rule_2(data, analysis, state, moves_1, no_space_1)

    moves, no_space = _rule_3(
        data, analysis, state, [*moves_1, *moves_2], [*no_space_1, *no_space_2]
    )

    assert moves == [
        RuleMove(
            rule="rule_3",
            part="8100",
            from_location="B-01-02-01",
            to_location="C-01-03-01",
            partner="8200",
        ),
        RuleMove(
            rule="rule_3",
            part="8500",
            from_location="B-01-02-02",
            to_location="D-01-03-01",
            partner="8600",
        ),
        RuleMove(
            rule="rule_3",
            part="3050",
            from_location="B-01-02-03",
            to_location="D-01-03-02",
            partner="30400",
        ),
    ]
    assert no_space == [NoSpace(part="6600", rule="rule_3", partner="7000", aisle="A")]


def test_fr26_blocks_and_silent_skips(data: ImportData, analysis: Analysis) -> None:
    step = expected()["steps"][0]

    run = _run(data, analysis, PlanState(best_marks=MARKS)).state.runs[-1]

    outcome = {r.part for r in run.recommendations} | {n.part for n in run.no_space}
    rule_3 = {r.part for r in run.recommendations if r.rule == "rule_3"} | {
        n.part for n in run.no_space if n.rule == "rule_3"
    }
    assert rule_3 == {"8100", "8500", "3050", "6600"}
    # 0600 is in a best location, 1008614-00 has no location (so 2300's group is blocked),
    # and 8400's partner 8500 already has a recommendation.
    for part in ["0600", "1008614-00", "2300", "8400"]:
        assert part not in outcome
    # 8100-8300 (8100 handled) and 2400-5000 (2400 "no space" under rule 1) are skipped:
    # neither part gets anything from rule 3.
    for part in ["8300", "5000", "8200", "8600", "30400", "7000", "9100", "9200"]:
        assert part not in outcome
    assert outcome.isdisjoint(step["no_outcome"])


def test_fr26_tie_moves_later_part_number(data: ImportData, analysis: Analysis) -> None:
    assert analysis.parts["30400"].picks == analysis.parts["3050"].picks
    assert "30400" < "3050"

    run = _run(data, analysis, PlanState(best_marks=MARKS)).state.runs[-1]

    [rec] = [r for r in run.recommendations if r.part in {"3050", "30400"}]
    assert (rec.rule, rec.part, rec.to_location) == ("rule_3", "3050", "D-01-03-02")


def test_fr26_loop_limit_round2(data: ImportData, analysis: Analysis) -> None:
    # 8100 sits with 8200 (10 shared jobs) in aisle C; 8100-8300 (6 jobs) must not pull it
    # to aisle D and undo that.
    state = PlanState(best_marks=MARKS)
    for part, source, target in [
        ("8100", "B-01-02-01", "C-01-03-01"),
        ("8500", "B-01-02-02", "D-01-03-01"),
        ("3050", "B-01-02-03", "D-01-03-02"),
    ]:
        state = _manual(state, part, source, target, data, analysis)

    moves, no_space = _rule_3(data, analysis, state)

    # No earlier rule ran here, so 2400 (fast, fewer picks than 5000) also moves to A.
    assert _rule_3_moves(moves) == [
        ("2400", "C-01-01-02", "A-01-01-03"),
        ("8400", "C-01-02-02", "D-01-03-03"),
    ]
    assert no_space == [NoSpace(part="6600", rule="rule_3", partner="7000", aisle="A")]


def test_fr26_slow_mover_never_offered_best(data: ImportData, analysis: Analysis) -> None:
    assert analysis.parts["6600"].movement_class == "slow"
    # 2400 is handled earlier, so A-01-01-03 (best) is the only free location in partner
    # 7000's aisle A.
    earlier = [NoSpace(part="2400", rule="rule_1")]
    state = PlanState(best_marks=MARKS)

    def outcome_6600(classes: Analysis) -> tuple[list[RuleMove], list[NoSpace]]:
        moves, no_space = _rule_3(data, classes, state, [], earlier)
        return [m for m in moves if m.part == "6600"], [n for n in no_space if n.part == "6600"]

    assert outcome_6600(analysis) == (
        [],
        [NoSpace(part="6600", rule="rule_3", partner="7000", aisle="A")],
    )

    def with_class(movement_class: str) -> Analysis:
        parts = dict(analysis.parts)
        parts["6600"] = parts["6600"].model_copy(update={"movement_class": movement_class})
        return analysis.model_copy(update={"parts": parts})

    assert outcome_6600(with_class("dead")) == (
        [],
        [NoSpace(part="6600", rule="rule_3", partner="7000", aisle="A")],
    )
    # For contrast: a medium mover takes the best location.
    assert outcome_6600(with_class("medium")) == (
        [
            RuleMove(
                rule="rule_3",
                part="6600",
                from_location="C-01-02-03",
                to_location="A-01-01-03",
                partner="7000",
            )
        ],
        [],
    )


def _8300_in_aisle_b(data: ImportData, analysis: Analysis) -> PlanState:
    """8300 moved next to 8100 in aisle B."""
    return _manual(PlanState(best_marks=MARKS), "8300", "D-01-01-01", "B-01-03-03", data, analysis)


def test_fr26_loop_limit_weaker_partner_does_not_block(
    data: ImportData, analysis: Analysis
) -> None:
    # 8100 shares aisle B with 8300 (6 jobs); 8100-8200 (10 jobs) still moves it to C.
    state = _8300_in_aisle_b(data, analysis)

    moves, no_space = _rule_3(data, analysis, state)

    assert ("8100", "B-01-02-01", "C-01-03-01") in _rule_3_moves(moves)
    assert "8100" not in {n.part for n in no_space}


def test_fr26_loop_limit_tie_blocks(data: ImportData, analysis: Analysis) -> None:
    # 8100-8300 gets as many shared jobs as 8100-8200 (10); 8300 already sits in 8100's
    # aisle B, so 8100-8200 is blocked and 8100 gets nothing.
    groups = [
        g.model_copy(update={"shared_jobs": 10}) if (g.part_a, g.part_b) == ("8100", "8300") else g
        for g in analysis.pick_groups
    ]
    tied = analysis.model_copy(update={"pick_groups": groups})
    state = _8300_in_aisle_b(data, tied)

    moves, no_space = _rule_3(data, tied, state)

    assert "8100" not in {m.part for m in moves} | {n.part for n in no_space}


def test_fr26_medium_mover_may_take_best(data: ImportData, analysis: Analysis) -> None:
    assert analysis.parts["8100"].movement_class == "medium"

    moves, _ = _rule_3(data, analysis, PlanState(best_marks=[AisleMark(aisle="C")]))

    assert ("8100", "B-01-02-01", "C-01-03-01") in _rule_3_moves(moves)


def test_fr26_kept_mover_blocked(data: ImportData, analysis: Analysis) -> None:
    run = _run(data, analysis, PlanState(best_marks=MARKS, keep_marks=["8100"])).state.runs[-1]

    rule_3 = [(r.part, r.to_location) for r in run.recommendations if r.rule == "rule_3"]
    assert rule_3 == [("8500", "D-01-03-01"), ("3050", "D-01-03-02")]
    assert "8100" not in {n.part for n in run.no_space}


def test_fr27_rule_3_skips_groups_of_handled_parts(data: ImportData, analysis: Analysis) -> None:
    # 8200 (the partner) has "no space": 8100-8200 gives nothing; 8100 then moves via
    # 8100-8300 into 8300's aisle D, after 8500 took D-01-03-01.
    moves, no_space = _rule_3(
        data, analysis, PlanState(best_marks=MARKS), [], [NoSpace(part="8200", rule="rule_1")]
    )

    assert _rule_3_moves(moves) == [
        ("8500", "B-01-02-02", "D-01-03-01"),
        ("2400", "C-01-01-02", "A-01-01-03"),
        ("8100", "B-01-02-01", "D-01-03-02"),
        ("3050", "B-01-02-03", "D-01-03-03"),
    ]
    assert "8200" not in {m.part for m in moves} | {n.part for n in no_space}

    # A mover with an earlier recommendation is skipped silently, never "no space".
    earlier = RuleMove(
        rule="rule_2", part="8100", from_location="B-01-02-01", to_location="B-01-03-03"
    )
    moves, no_space = _rule_3(data, analysis, PlanState(best_marks=MARKS), [earlier])
    assert "8100" not in {m.part for m in moves} | {n.part for n in no_space}


def test_fr27_rule_3_never_virtual_and_location_once(data: ImportData, analysis: Analysis) -> None:
    virtual = data.model_copy(update={"virtual_locations": [*data.virtual_locations, "C-01-03-01"]})

    moves, _ = _rule_3(virtual, analysis, PlanState(best_marks=MARKS))

    assert ("8100", "B-01-02-01", "C-01-03-02") in _rule_3_moves(moves)
    targets = [m.to_location for m in moves]
    assert "C-01-03-01" not in targets
    assert len(set(targets)) == len(targets)

    # A location an earlier rule took is never offered again.
    earlier = RuleMove(
        rule="rule_2", part="4400", from_location="A-01-03-02", to_location="C-01-03-01"
    )
    moves, _ = _rule_3(data, analysis, PlanState(best_marks=MARKS), [earlier])
    assert ("8100", "B-01-02-01", "C-01-03-02") in _rule_3_moves(moves)
