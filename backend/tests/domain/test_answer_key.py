"""Milestone 1 and 2 gate: the answer key (`data/answer-key/expected.json`) in one place
(domain only).

Classes (FR-17), pick groups (FR-19), the merged inventory (FR-6), occupancy (FR-14) and the
whole scenario of answer-key steps 1-20 (SM-1, FR-23 to FR-37): every step is played by
`tests.domain.answer_key.scenario` through `domain.apply` and `revalidate` with a fixed
command id (step 6 as `set_keep 0500`, steps 15-16 as `undo`, step 20 as `apply_all`).
After it: the 14 effective moves, the final current locations, the final before/after, the
unchanged import, the settled check (one more run) and the printed move list in order
(FR-38). `tests/app/test_answer_key_api.py` posts the same commands over HTTP.

The six rule modules never import `swp.store` or `swp.app` (checked below by scanning their
source); the import-linter layers contract also runs on the real package in
`tests/rules/test_layer_rules.py::test_nfr1_import_linter_passes_on_clean_copy`.
"""

import ast
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from swp.domain.analysis import Analysis
from swp.domain.before_after import build_before_after
from swp.domain.commands import (
    ApplyAllDone,
    Event,
    KeepSet,
    MoveMade,
    MovesCombined,
    RecommendationsOutdated,
    RunDone,
    StepUndone,
)
from swp.domain.import_data import ImportData
from swp.domain.move_list import build_move_list_rounds
from swp.domain.planning import UndoEffect, UndoPreview, current_round, replay
from swp.domain.state import Outdated, PlanState, Rule
from swp.domain.views.locations import build_locations_view
from tests.domain.answer_key import (
    CLASS_NAMES,
    MARKS,
    ScenarioStep,
    answer_key_analysis,
    answer_key_import,
    expected,
    expected_run_outcome,
    run_command,
    run_outcome,
    scenario,
)

RULES: dict[str | int, Rule] = {1: "rule_1", 2: "rule_2", 3: "rule_3", "Manual": "manual"}


@pytest.fixture(scope="module")
def key() -> dict[str, Any]:
    return expected()


@pytest.fixture(scope="module")
def played(data: ImportData, analysis: Analysis) -> list[ScenarioStep]:
    """All 20 answer-key steps, played once per module."""
    return scenario(data, analysis)


@pytest.fixture(scope="module")
def final(played: list[ScenarioStep]) -> PlanState:
    return played[-1].applied.state


DOMAIN_DIR = Path(__file__).resolve().parents[2] / "swp" / "domain"
RULE_MODULES = ["classify", "pick_groups", "rules", "recommendations", "planning", "before_after"]


def _imports(source: str) -> list[str]:
    names: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names.append(node.module)
    return names


@pytest.mark.parametrize("name", RULE_MODULES)
def test_nfr1_rule_modules_import_no_store_or_app(name: str) -> None:
    source = (DOMAIN_DIR / f"{name}.py").read_text(encoding="utf-8")
    imports = _imports(source)

    assert imports, name
    assert [i for i in imports if i.split(".")[:2] in (["swp", "store"], ["swp", "app"])] == []


def test_fr17_answer_key_classes_and_not_classified(
    key: dict[str, Any], analysis: Analysis
) -> None:
    assert analysis.settings.model_dump() == key["settings"]
    assert {part: (e.picks, e.movement_class) for part, e in analysis.parts.items()} == {
        part: (e["picks"], CLASS_NAMES[e["class"]]) for part, e in key["parts"].items()
    }
    for part in key["not_classified"]:
        assert part not in analysis.parts


def test_fr19_answer_key_pick_groups_in_order(key: dict[str, Any], analysis: Analysis) -> None:
    assert [(g.part_a, g.part_b, g.shared_jobs) for g in analysis.pick_groups] == [
        (e["parts"][0], e["parts"][1], e["shared_jobs"]) for e in key["pick_groups_in_order"]
    ]


def test_fr6_answer_key_merged_inventory(key: dict[str, Any], data: ImportData) -> None:
    for merged in key["merged_inventory"]:
        lines = [
            line
            for line in data.inventory
            if (line.part, line.location) == (merged["part"], merged["location"])
        ]
        assert [line.quantity for line in lines] == [Decimal(merged["quantity"])], merged


def test_fr14_answer_key_occupancy_and_zero_stock(key: dict[str, Any], data: ImportData) -> None:
    view = build_locations_view(data, PlanState.new(), 1)

    facts = key["occupancy_import"]
    assert {a.aisle: (a.locations, a.occupied, a.empty) for a in view.aisles} == {
        aisle: (f["locations"], f["occupied"], f["empty"])
        for aisle, f in facts.items()
        if aisle != "total"
    }
    warehouse = view.warehouse
    assert (warehouse.locations, warehouse.occupied, warehouse.empty) == (
        facts["total"]["locations"],
        facts["total"]["occupied"],
        facts["total"]["empty"],
    )
    rows = {row.location.code: row for row in view.locations}
    for code in key["empty_with_zero_stock_row"]:
        assert (rows[code].occupied, rows[code].contents) == (False, []), code


def test_fr23_fr30_answer_key_steps_1_to_14(
    key: dict[str, Any], data: ImportData, analysis: Analysis, played: list[ScenarioStep]
) -> None:
    for played_step in played[:14]:
        step, before, state = played_step.step, played_step.before, played_step.applied.state
        number, action = step["step"], step["action"]
        if action == "run":
            run = state.runs[-1]
            assert run.round == step["round"], f"step {number}"
            assert run_outcome(run) == expected_run_outcome(step), f"step {number}"
            continue
        if action == "keep_in_place":
            continue
        if action == "apply":
            source, target = step["expect_move"]["from"], step["expect_move"]["to"]
        else:
            assert action == "manual_move", f"step {number}: unexpected action {action}"
            source, target = step["from"], step["to"]
        assert len(state.steps) == len(before.steps) + 1, f"step {number}"
        move = state.steps[-1]
        want = step["expect_move"]
        assert (move.part, move.from_location, move.to_location, move.rule, move.round) == (
            step["part"],
            source,
            target,
            RULES[want["rule"]],
            want["round"],
        ), f"step {number}"

    state = played[13].applied.state
    assert state.keep_marks == ["0500"]
    assert [(s.part, s.round) for s in state.steps][-1] == ("1200", 2)
    before_after = build_before_after(data, replay(data, state.steps).copy, analysis, MARKS)
    want = key["before_after"]
    aisles = set(want["fast_in_best"]["before"]) - {"total"}
    assert {row.aisle for row in before_after.aisles} == aisles
    for row in before_after.aisles:
        assert row.fast_in_best.before == want["fast_in_best"]["before"][row.aisle]
        assert row.pick_groups_together.before == want["pick_groups_together"]["before"][row.aisle]
    assert before_after.total.fast_in_best.before == want["fast_in_best"]["before"]["total"]


def test_fr32_kept_part_skipped_in_run_2(key: dict[str, Any], played: list[ScenarioStep]) -> None:
    state = played[11].applied.state
    assert state.keep_marks == ["0500"]
    assert "0500" in {r.part for r in state.runs[-1].recommendations}  # run 1 had it

    run_2 = key["steps"][12]
    assert run_2["action"] == "run" and run_2["round"] == 2
    run = played[12].applied.state.runs[-1]

    assert run_outcome(run) == expected_run_outcome(run_2)
    assert "0500" not in {r.part for r in run.recommendations}
    assert "0500" not in {n.part for n in run.no_space}


UNDONE = Outdated(cause="undo")
MOVE_NUMBERS = {2: 1, 3: 2, 4: 3, 5: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 14: 11, 17: 12}
"""The move number each apply or manual step takes (step 6 is a mark, step 18 is combined)."""


def _undone(move_number: int, part: str, source: str, target: str) -> StepUndone:
    return StepUndone(
        undone=UndoPreview(
            move_number=move_number,
            part=part,
            from_location=source,
            to_location=target,
            effect=UndoEffect(kind="reverts_move", move_number=move_number),
        )
    )


def _expected_events(step: dict[str, Any]) -> list[Event]:
    """The exact events of an answer-key step (retro epic-5 #43)."""
    number = step["step"]
    match step["action"]:
        case "run":
            return [
                RunDone(
                    round=step["round"],
                    recommendations=len(step["recommendations_in_order"]),
                    no_space=len(step["no_space"]),
                )
            ]
        case "keep_in_place":
            return [KeepSet(part=step["part"])]
        case "apply_all":
            return [ApplyAllDone(applied=[1, 2, 3, 4], skipped=[])]
        case "undo" if number == 15:
            return [
                _undone(11, "1200", "B-01-01-02", "A-01-01-01"),
                RecommendationsOutdated(count=4, cause="undo", round=2),
            ]
        case "undo":
            assert number == 16
            return [_undone(10, "0100", "A-01-01-01", "B-01-04-02")]
        case "manual_move" if number == 18:
            return [
                MovesCombined(
                    move_number=12,
                    part="0100",
                    from_location="A-01-01-01",
                    to_location="B-01-03-02",
                    round=2,
                    step_move_number=13,
                )
            ]
    want = step["expect_move"]
    return [
        MoveMade(
            move_number=MOVE_NUMBERS[number],
            part=step["part"],
            from_location=want.get("from", step.get("from")),
            to_location=want.get("to", step.get("to")),
            rule=RULES[want["rule"]],
            round=want["round"],
        )
    ]


def test_sm1_answer_key_scenario(played: list[ScenarioStep]) -> None:
    assert [p.step["step"] for p in played] == list(range(1, 21))
    last_next = 1
    runs = 0
    for played_step in played:
        step, applied = played_step.step, played_step.applied
        number, state = step["step"], applied.state
        assert applied.events == _expected_events(step), f"step {number}"

        if step["action"] == "run":
            runs += 1
            run = state.runs[-1]
            assert run.round == step["round"], f"step {number}"
            assert run_outcome(run) == expected_run_outcome(step), f"step {number}"
        assert current_round(state) == runs, f"step {number}"

        latest = state.runs[-1].recommendations
        if 15 <= number <= 18:
            assert all((r.status, r.outdated) == ("outdated", UNDONE) for r in latest), number
        else:
            assert all((r.status, r.outdated) == ("open", None) for r in latest), number
        if number == 16:
            [rec] = [r for r in state.runs[0].recommendations if r.part == "0100"]
            assert (rec.status, rec.outdated) == ("outdated", UNDONE)

        assert state.next_move_number >= last_next, f"step {number}"  # retro epic-4 #36
        last_next = state.next_move_number

    assert runs == 3
    final = played[-1].applied.state
    run_3 = final.runs[-1]
    assert [
        (s.move_number, s.part, s.from_location, s.to_location, s.rule, s.round)
        for s in final.steps[-4:]
    ] == [
        (n, r.part, r.from_location, r.to_location, r.rule, 3)
        for n, r in zip([14, 15, 16, 17], run_3.recommendations, strict=True)
    ]
    assert final.next_move_number == 18


def _step_15(played: list[ScenarioStep], data: ImportData) -> None:
    before, (state, events) = played[14].before, _after(played, 15)
    assert played[14].step["action"] == "undo"
    assert before.steps[-1].move_number == 11  # 1200's apply; step 6 is a mark

    assert replay(data, state.steps).current_locations["1200"] == "B-01-01-02"
    run_2 = state.runs[-1]
    assert run_2.round == 2
    assert [(r.part, r.status, r.outdated) for r in run_2.recommendations] == [
        (part, "outdated", UNDONE) for part in ["1200", "10240", "2400", "8400"]
    ]
    assert isinstance(events[0], StepUndone)
    assert events[0].undone.move_number == 11
    assert events[1:] == [RecommendationsOutdated(count=4, cause="undo", round=2)]


def _step_16(played: list[ScenarioStep], data: ImportData) -> None:
    before, (state, events) = played[15].before, _after(played, 16)
    assert played[15].step["action"] == "undo"
    assert (before.steps[-1].move_number, before.steps[-1].part) == (10, "0100")

    assert replay(data, state.steps).current_locations["0100"] == "A-01-01-01"
    [rec] = [r for r in state.runs[0].recommendations if r.part == "0100"]
    assert (rec.status, rec.outdated) == ("outdated", UNDONE)
    assert [e.type for e in events] == ["step_undone"]
    assert current_round(state) == 2
    assert state.next_move_number == 12


def _step_17(played: list[ScenarioStep], data: ImportData) -> None:
    state, events = _after(played, 17)
    move = state.steps[-1]
    assert (move.move_number, move.part, move.from_location, move.to_location) == (
        12,
        "0100",
        "A-01-01-01",
        "C-01-03-02",
    )
    assert (move.rule, move.round) == ("manual", 2)
    assert [e.type for e in events] == ["move_made"]
    assert replay(data, state.steps).current_locations["0100"] == "C-01-03-02"


def _step_18(played: list[ScenarioStep], data: ImportData) -> None:
    state, events = _after(played, 18)
    assert (state.steps[-1].move_number, state.steps[-1].part) == (13, "0100")
    moves = [m for m in replay(data, state.steps).moves if m.part == "0100"]
    assert [(m.move_number, m.from_location, m.to_location, m.rule, m.round) for m in moves] == [
        (12, "A-01-01-01", "B-01-03-02", "manual", 2)
    ]
    assert [e.type for e in events] == ["moves_combined"]


def _step_19(played: list[ScenarioStep], data: ImportData) -> None:
    state, _ = _after(played, 19)
    run = state.runs[-1]
    assert run.round == 3 and current_round(state) == 3
    assert run_outcome(run) == expected_run_outcome(played[18].step)


def _step_20(played: list[ScenarioStep], data: ImportData) -> None:
    state, events = _after(played, 20)
    recs = state.runs[-1].recommendations
    assert [(s.move_number, s.recommendation_id, s.round) for s in state.steps[-4:]] == [
        (14 + i, r.id, 3) for i, r in enumerate(recs)
    ]
    moves = replay(data, state.steps).moves
    assert [(m.part, m.from_location, m.to_location, m.rule, m.round) for m in moves[-4:]] == [
        (r.part, r.from_location, r.to_location, r.rule, 3) for r in recs
    ]
    assert events == [ApplyAllDone(applied=[1, 2, 3, 4], skipped=[])]


def _after(played: list[ScenarioStep], number: int) -> tuple[PlanState, list[Event]]:
    applied = played[number - 1].applied
    return applied.state, applied.events


@pytest.mark.parametrize("number", [15, 16, 17, 18, 19, 20])
def test_fr23_fr30_answer_key_steps_15_to_20(
    number: int, played: list[ScenarioStep], data: ImportData
) -> None:
    steps = {15: _step_15, 16: _step_16, 17: _step_17, 18: _step_18, 19: _step_19, 20: _step_20}
    steps[number](played, data)


def test_fr35_undo_after_later_run(played: list[ScenarioStep], data: ImportData) -> None:
    state = played[17].applied.state

    moves = [m for m in replay(data, state.steps).moves if m.part == "0100"]
    assert [(m.from_location, m.to_location, m.rule, m.round) for m in moves] == [
        ("A-01-01-01", "B-01-03-02", "manual", 2)
    ]
    assert current_round(state) == 2
    assert all(
        (r.status, r.outdated) == ("outdated", UNDONE) for r in state.runs[-1].recommendations
    )


def _rule(rule: str) -> Rule:
    return RULES["Manual" if rule == "Manual" else int(rule)]


def test_fr34_answer_key_final_effective_moves(
    key: dict[str, Any], data: ImportData, final: PlanState
) -> None:
    moves = replay(data, final.steps).moves
    lines = key["move_list"]["lines_in_order"]

    assert len(moves) == len(lines) == 14
    assert Counter(
        (m.part, m.from_location, m.to_location, m.rule, m.round) for m in moves
    ) == Counter((e["part"], e["from"], e["to"], _rule(e["rule"]), e["round"]) for e in lines)
    assert [
        (m.round, m.from_location, m.to_location, m.rule) for m in moves if m.part == "0100"
    ] == [(2, "A-01-01-01", "B-01-03-02", "manual")]


def test_fr33_answer_key_final_current_locations(
    key: dict[str, Any], data: ImportData, final: PlanState
) -> None:
    current = replay(data, final.steps).current_locations
    assert {part: current[part] for part in key["final_current_locations"]} == key[
        "final_current_locations"
    ]


def test_fr37_answer_key_final_before_after(
    key: dict[str, Any], data: ImportData, analysis: Analysis, final: PlanState
) -> None:
    counts = build_before_after(data, replay(data, final.steps).copy, analysis, final.best_marks)
    want = key["before_after"]
    occupancy = want["occupancy_after"]

    assert {row.aisle for row in counts.aisles} == set(occupancy) - {"total"}
    for row in counts.aisles:
        aisle = row.aisle
        for field in ("fast_in_best", "pick_groups_together"):
            count = getattr(row, field)
            assert (count.before, count.after) == (
                want[field]["before"][aisle],
                want[field]["after"][aisle],
            ), (aisle, field)
        assert row.moved_in == want["moved_in"][aisle], aisle
        assert row.moved_out == want["moved_out"][aisle], aisle
        assert (row.occupied.after, row.empty.after) == (
            occupancy[aisle]["occupied"],
            occupancy[aisle]["empty"],
        ), aisle
    total = counts.total
    for field in ("fast_in_best", "pick_groups_together"):
        count = getattr(total, field)
        assert (count.before, count.after) == (
            want[field]["before"]["total"],
            want[field]["after"]["total"],
        ), field
    assert (total.occupied.after, total.empty.after) == (
        occupancy["total"]["occupied"],
        occupancy["total"]["empty"],
    )


def test_fr36_answer_key_import_unchanged(
    data: ImportData, analysis: Analysis, played: list[ScenarioStep]
) -> None:
    assert len(played) == 20  # the module's scenario has run on these fixtures
    assert data == answer_key_import().data
    assert analysis == answer_key_analysis()


def test_fr23_answer_key_settled_check(
    key: dict[str, Any], data: ImportData, analysis: Analysis, final: PlanState
) -> None:
    run = run_command(data, analysis, final).state.runs[-1]
    want = key["settled_check"]

    assert run.round == 4
    assert run_outcome(run) == expected_run_outcome(
        {"recommendations_in_order": want["recommendations"], "no_space": want["no_space"]}
    )


def test_fr38_answer_key_move_list(key: dict[str, Any], data: ImportData, final: PlanState) -> None:
    rounds = build_move_list_rounds(data, replay(data, final.steps).moves, steps=final.steps)
    want = key["move_list"]

    assert len(rounds) == want["rounds"] == 3
    assert [
        (line.round, line.part, line.from_location, line.to_location, line.rule)
        for r in rounds
        for line in r.lines
    ] == [
        (e["round"], e["part"], e["from"], e["to"], _rule(e["rule"]))
        for e in want["lines_in_order"]
    ]
    assert all(line.round == r.round for r in rounds for line in r.lines)
    moves = {(m.round, m.part): m for m in replay(data, final.steps).moves}
    assert len(moves) == 14
    for line in (line for r in rounds for line in r.lines):
        assert line.move_number == moves[(line.round, line.part)].move_number, line
        assert line.description == data.parts[line.part], line
        assert line.swap is None, line  # 9100 <-> 9200 is a cycle of manual moves, not a swap
