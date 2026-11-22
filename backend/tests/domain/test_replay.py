"""AD-5/FR-33/FR-34/FR-36: the step log, `replay` and the planning copy (domain only)."""

import random
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from swp.domain import apply as apply_module
from swp.domain.analysis import AnalysisSettings, build_analysis
from swp.domain.apply import check_step_invariants
from swp.domain.classify import classify_parts
from swp.domain.commands import Applied, CommandContext, SetBestMark
from swp.domain.import_data import ImportData
from swp.domain.pick_groups import find_pick_groups
from swp.domain.planning import (
    EffectiveMove,
    append_step,
    current_location,
    current_round,
    planning_copy,
    replay,
    stock_at,
    total_stock,
)
from swp.domain.state import AisleMark, PlanState, Rule, Step
from tests.domain.answer_key import answer_key_import, expected

RULES: dict[str, Rule] = {"1": "rule_1", "2": "rule_2", "3": "rule_3", "Manual": "manual"}


@pytest.fixture(scope="module")
def data() -> ImportData:
    return answer_key_import().data


def _step(n: int, part: str, a: str, b: str, *, rnd: int = 1, rule: Rule = "manual") -> Step:
    return Step(move_number=n, part=part, from_location=a, to_location=b, rule=rule, round=rnd)


def _moves(moves: Sequence[EffectiveMove]) -> list[tuple[int, str, str, str, str, tuple[int, ...]]]:
    return [(m.move_number, m.part, m.from_location, m.to_location, m.rule, m.steps) for m in moves]


def test_ad5_no_steps_is_the_import(data: ImportData) -> None:
    result = replay(data, [])

    assert result.moves == ()
    assert result.copy == planning_copy(data, PlanState.new())
    assert result.copy.inventory == tuple(data.inventory)
    for part, facts in expected()["parts"].items():
        assert result.current_locations[part] == facts["current_location"], part
    assert set(result.current_locations) == set(data.parts) | {i.part for i in data.inventory}


def test_fr33_replay_moves_all_stock_and_adds_together(data: ImportData) -> None:
    # 1200 holds 8 at B-01-01-02 and 2 at A-01-02-01; move the 2 onto the 8.
    before = replay(data, []).copy
    assert stock_at(before, "1200", "A-01-02-01") == Decimal(2)
    held = stock_at(before, "1200", "B-01-01-02")

    copy = replay(data, [_step(1, "1200", "A-01-02-01", "B-01-01-02")]).copy

    assert stock_at(copy, "1200", "B-01-01-02") == held + 2
    assert "A-01-02-01" not in copy.stock_of("1200")
    assert total_stock(copy, "1200") == total_stock(before, "1200")
    lines = [line for line in copy.inventory if line.part == "1200"]
    assert [line.location for line in lines] == ["B-01-01-02"]


def test_fr33_single_move_into_location_left_by_another_part(data: ImportData) -> None:
    result = replay(
        data,
        [
            _step(1, "1100", "C-01-01-01", "A-01-01-03", rule="rule_1"),
            _step(2, "9300", "B-01-03-02", "C-01-01-01"),
        ],
    )

    assert result.current_locations["9300"] == "C-01-01-01"
    assert result.current_locations["1100"] == "A-01-01-03"
    assert stock_at(result.copy, "9300", "C-01-01-01") == Decimal(5)
    assert "9300" not in result.copy.contents_of("B-01-03-02")
    assert len(result.moves) == 2
    # A new (part, location) entry is appended after the import's lines.
    assert result.copy.inventory[-1].part == "9300"
    assert result.copy.inventory[-2].part == "1100"


def test_fr33_move_into_occupied_location_swaps(data: ImportData) -> None:
    result = replay(
        data,
        [
            _step(1, "9100", "D-01-02-02", "D-01-02-03"),
            _step(2, "9200", "D-01-02-03", "D-01-02-02"),
        ],
    )

    assert result.current_locations["9100"] == "D-01-02-03"
    assert result.current_locations["9200"] == "D-01-02-02"
    assert _moves(result.moves) == [
        (1, "9100", "D-01-02-02", "D-01-02-03", "manual", (1,)),
        (2, "9200", "D-01-02-03", "D-01-02-02", "manual", (2,)),
    ]


def test_fr34_combine_only_through_location_without_part(data: ImportData) -> None:
    # 0100 sits only at A-01-01-01; C-01-03-02 holds no 0100.
    steps = [
        _step(4, "0100", "A-01-01-01", "C-01-03-02", rule="rule_2"),
        _step(7, "0100", "C-01-03-02", "B-01-03-02"),
    ]
    steps[0] = steps[0].model_copy(update={"recommendation_id": "r1", "swap_id": "s1"})

    result = replay(data, steps)

    assert len(result.moves) == 1
    move = result.moves[0]
    assert (move.move_number, move.from_location, move.to_location) == (
        4,
        "A-01-01-01",
        "B-01-03-02",
    )
    assert (move.rule, move.recommendation_id, move.swap_id, move.steps) == (
        "manual",
        "r1",
        None,
        (4, 7),
    )
    assert result.current_locations["0100"] == "B-01-03-02"


def test_fr34_no_combine_when_location_held_part(data: ImportData) -> None:
    # 1200 already has stock at B-01-01-02 before the first step.
    result = replay(
        data,
        [
            _step(1, "1200", "A-01-02-01", "B-01-01-02"),
            _step(2, "1200", "B-01-01-02", "C-01-03-02"),
        ],
    )

    assert len(result.moves) == 2


def test_fr34_no_combine_through_location_refilled_by_part(data: ImportData) -> None:
    # 1200: A-01-02-01 → C-01-03-02 (empty of 1200), B-01-01-02 → C-01-03-02 (now holds
    # 1200), then C-01-03-02 → D-01-03-03: the latest move ending at C-01-03-02 went
    # into a location holding the part, so no fallback to the older one.
    result = replay(
        data,
        [
            _step(1, "1200", "A-01-02-01", "C-01-03-02"),
            _step(2, "1200", "B-01-01-02", "C-01-03-02"),
            _step(3, "1200", "C-01-03-02", "D-01-03-03"),
        ],
    )

    assert [m.steps for m in result.moves] == [(1,), (2,), (3,)]


def test_fr34_no_combine_in_other_round(data: ImportData) -> None:
    result = replay(
        data,
        [
            _step(1, "0100", "A-01-01-01", "C-01-03-02", rnd=1),
            _step(2, "0100", "C-01-03-02", "B-01-03-02", rnd=2),
        ],
    )

    assert [(m.round, m.steps) for m in result.moves] == [(1, (1,)), (2, (2,))]


def test_fr34_no_combine_from_other_location(data: ImportData) -> None:
    # 1200 leaves A-01-02-01, then its other location B-01-01-02.
    result = replay(
        data,
        [
            _step(1, "1200", "A-01-02-01", "C-01-03-02"),
            _step(2, "1200", "B-01-01-02", "D-01-03-03"),
        ],
    )

    assert len(result.moves) == 2


def test_fr34_move_back_removes_move(data: ImportData) -> None:
    before = replay(data, [])

    result = replay(
        data,
        [
            _step(1, "0100", "A-01-01-01", "C-01-03-02"),
            _step(2, "0100", "C-01-03-02", "A-01-01-01"),
        ],
    )

    assert result.moves == ()
    assert result.copy == before.copy
    assert result.current_locations == before.current_locations


def test_fr34_latest_move_is_by_time_not_position(data: ImportData) -> None:
    # 1200: B-01-01-02 → C (C empty), A-01-02-01 → D (D empty), C → D combines the first
    # into B-01-01-02 → D (D already held 1200), then D → X: the latest move ending at D
    # is the combined one, whose target was not empty, so step 4 stays separate.
    c, d, x = "C-01-03-02", "D-01-03-03", "B-01-03-02"
    result = replay(
        data,
        [
            _step(1, "1200", "B-01-01-02", c),
            _step(2, "1200", "A-01-02-01", d),
            _step(3, "1200", c, d),
            _step(4, "1200", d, x),
        ],
    )

    assert _moves(result.moves) == [
        (1, "1200", "B-01-01-02", d, "manual", (1, 3)),
        (2, "1200", "A-01-02-01", d, "manual", (2,)),
        (4, "1200", d, x, "manual", (4,)),
    ]


def test_fr34_chain_combines_into_one_move(data: ImportData) -> None:
    result = replay(
        data,
        [
            _step(1, "0100", "A-01-01-01", "C-01-03-02"),
            _step(2, "0100", "C-01-03-02", "D-01-03-03"),
            _step(3, "0100", "D-01-03-03", "B-01-03-02"),
        ],
    )

    assert _moves(result.moves) == [(1, "0100", "A-01-01-01", "B-01-03-02", "manual", (1, 2, 3))]


def _scenario_steps() -> list[Step]:
    """The 15 steps left after the answer-key scenario's two undos (README "The scenario").

    Move numbers follow the scenario's order; the undone moves 10 (0100, round 1) and
    11 (1200, round 2) are gone and their numbers are never reused.
    """
    applied = {
        step["part"]: step["expect_move"]
        for step in expected()["steps"]
        if step["action"] in ("apply", "manual_move") and "from" in step.get("expect_move", {})
    }
    run_3 = next(s for s in expected()["steps"] if s["action"] == "run" and s["round"] == 3)
    round_1 = ["1100", "9300", "9100", "9200", "8100", "8500", "3050", "4400", "9000"]
    manual = {step["part"]: step for step in expected()["steps"] if step["action"] == "manual_move"}
    steps: list[Step] = []
    for number, part in enumerate(round_1, start=1):
        if part in applied:
            move = applied[part]
            steps.append(
                _step(number, part, move["from"], move["to"], rnd=1, rule=RULES[str(move["rule"])])
            )
        else:
            move = manual[part]
            steps.append(_step(number, part, move["from"], move["to"], rnd=1))
    steps.append(_step(12, "0100", "A-01-01-01", "C-01-03-02", rnd=2))
    steps.append(_step(13, "0100", "C-01-03-02", "B-01-03-02", rnd=2))
    for number, rec in enumerate(run_3["recommendations_in_order"], start=14):
        steps.append(
            _step(number, rec["part"], rec["from"], rec["to"], rnd=3, rule=RULES[str(rec["rule"])])
        )
    return steps


def test_fr34_answer_key_scenario_effective_moves(data: ImportData) -> None:
    steps = _scenario_steps()
    assert len(steps) == 15

    result = replay(data, steps)

    lines = expected()["move_list"]["lines_in_order"]
    assert {(m.round, m.part, m.from_location, m.to_location, m.rule) for m in result.moves} == {
        (line["round"], line["part"], line["from"], line["to"], RULES[line["rule"]])
        for line in lines
    }
    assert len(result.moves) == len(lines) == 14
    combined = next(m for m in result.moves if m.part == "0100")
    assert (combined.move_number, combined.steps) == (12, (12, 13))
    for part, location in expected()["final_current_locations"].items():
        assert result.current_locations[part] == location, part


def _random_steps(data: ImportData, seed: int) -> list[Step]:
    """A random valid step sequence: a part with stock at the from-location, another
    location in the Locations file, non-decreasing rounds."""
    rng = random.Random(seed)
    codes = list(data.locations)
    steps: list[Step] = []
    rnd = 0
    for number in range(1, rng.randint(1, 40) + 1):
        copy = replay(data, steps).copy
        held = sorted({(p, loc) for p, at in copy.by_part.items() for loc, q in at.items() if q})
        part, source = rng.choice(held)
        target = rng.choice([code for code in codes if code != source])
        rnd += rng.random() < 0.2
        rule: Rule = rng.choice(["rule_1", "rule_2", "rule_3", "manual"])
        steps.append(_step(number, part, source, target, rnd=rnd, rule=rule))
    return steps


def test_fr36_import_never_changes() -> None:
    imported = answer_key_import()
    data = imported.data
    analysis = build_analysis(
        imported.data_as_of, AnalysisSettings.model_validate(expected()["settings"])
    )
    stored_parts = classify_parts(data, analysis)
    stored_groups = find_pick_groups(data, analysis)
    dumped = data.model_dump_json()
    totals = {part: total_stock(replay(data, []).copy, part) for part in data.parts}

    for seed in range(25):
        steps = _random_steps(data, seed)
        result = replay(data, steps)

        assert data.model_dump_json() == dumped, seed
        assert classify_parts(data, analysis) == stored_parts, seed
        assert find_pick_groups(data, analysis) == stored_groups, seed
        for part, total in totals.items():
            assert total_stock(result.copy, part) == total, (seed, part)
            assert result.current_locations[part] == current_location(result.copy, part)


def test_ad5_round_invariant_append_step_round_0_before_any_run() -> None:
    state = append_step(
        PlanState.new(), part="P", from_location="A", to_location="B", rule="manual"
    )

    assert state.steps == [_step(1, "P", "A", "B", rnd=0)]
    assert state.next_move_number == 2
    assert PlanState.new().steps == []
    check_step_invariants(PlanState.new(), state)


def test_ad5_round_invariant_append_step_uses_current_round() -> None:
    state = PlanState(runs=[{"round": 1}, {"round": 2}], next_move_number=7)

    after = append_step(state, part="P", from_location="A", to_location="B", rule="rule_1")
    after = append_step(after, part="P", from_location="B", to_location="C", rule="manual")

    assert current_round(state) == 2
    assert [(s.move_number, s.round) for s in after.steps] == [(7, 2), (8, 2)]
    assert after.next_move_number == 9
    check_step_invariants(state, after)


def test_ad5_round_invariant_number_never_reused() -> None:
    # Undo removed step 1 but next_move_number stays 2: the next step is 2, not 1.
    state = PlanState(next_move_number=2)

    after = append_step(state, part="P", from_location="A", to_location="B", rule="manual")

    assert after.steps[0].move_number == 2
    check_step_invariants(state, after)


@pytest.mark.parametrize(
    ("before", "after"),
    [
        (PlanState.new(), PlanState(steps=[_step(1, "P", "A", "B", rnd=1)], next_move_number=2)),
        (PlanState.new(), PlanState(steps=[_step(1, "P", "A", "B", rnd=0)], next_move_number=1)),
        (
            PlanState(next_move_number=2),
            PlanState(steps=[_step(1, "P", "A", "B", rnd=0)], next_move_number=5),
        ),
        (
            PlanState.new(),
            PlanState(
                steps=[_step(1, "P", "A", "B", rnd=0), _step(1, "P", "B", "C", rnd=0)],
                next_move_number=3,
            ),
        ),
    ],
    ids=["wrong-round", "next-not-above", "below-floor", "number-reused-in-one-command"],
)
def test_ad5_round_invariant_violations_raise(before: PlanState, after: PlanState) -> None:
    with pytest.raises(AssertionError):
        check_step_invariants(before, after)


def test_ad5_apply_checks_step_invariants(monkeypatch: pytest.MonkeyPatch) -> None:
    def bad_handler(state: PlanState, _command: SetBestMark, _ctx: CommandContext) -> Applied:
        # Round 1 while the plan has no runs (current round 0).
        return Applied(
            state=state.model_copy(
                update={"steps": [_step(1, "P", "A", "B", rnd=1)], "next_move_number": 2}
            )
        )

    monkeypatch.setattr(apply_module.marks, "set_best_mark", bad_handler)
    ctx = CommandContext(user="planner", now=datetime(2026, 11, 22, tzinfo=UTC))

    with pytest.raises(AssertionError):
        apply_module.apply(
            PlanState.new(),
            SetBestMark(command_id=uuid.UUID(int=1), base_version=1, mark=AisleMark(aisle="A")),
            ctx,
            ImportData(locations={}, inventory=[], parts={}, transactions=[]),
        )


def test_ad5_round_invariant_ignores_removed_steps() -> None:
    before = PlanState(steps=[_step(1, "P", "A", "B", rnd=0)], next_move_number=2)

    check_step_invariants(before, PlanState(next_move_number=2))
