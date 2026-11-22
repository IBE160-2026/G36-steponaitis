"""Milestone 1 gate: the answer key (`data/answer-key/expected.json`) in one place (domain only).

Classes (FR-17), pick groups (FR-19), the merged inventory (FR-6), occupancy (FR-14) and one
replay of answer-key steps 1-16 (FR-23 to FR-30, FR-32 to FR-35). Every step goes through
`domain.apply` and `revalidate`, step 6 as `set_keep 0500`, steps 15-16 as `undo`. Steps
17-20, the move list, the final current locations, the final before/after and the settled
check need Epic 7/8 work and are skipped with the story that will un-skip them.

The six rule modules never import `swp.store` or `swp.app` (checked below by scanning their
source); the import-linter layers contract also runs on the real package in
`tests/rules/test_layer_rules.py::test_nfr1_import_linter_passes_on_clean_copy`.
"""

import ast
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from swp.domain.analysis import Analysis
from swp.domain.before_after import build_before_after
from swp.domain.commands import RecommendationsOutdated, StepUndone
from swp.domain.import_data import ImportData
from swp.domain.planning import current_round, replay
from swp.domain.state import Outdated, PlanState, Rule
from swp.domain.views.locations import build_locations_view
from tests.domain.answer_key import (
    CLASS_NAMES,
    MARKS,
    apply_recommendation,
    expected,
    expected_run_outcome,
    keep_step,
    manual_step,
    play_steps,
    run_command,
    run_outcome,
)

RULES: dict[str | int, Rule] = {1: "rule_1", 2: "rule_2", 3: "rule_3", "Manual": "manual"}
RUN_3 = 'Story 7.5 "Answer-key scenario through run 3"'
MOVE_LIST = 'Story 8.1 "Move list order and header in the domain"'


@pytest.fixture(scope="module")
def key() -> dict[str, Any]:
    return expected()


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
    key: dict[str, Any], data: ImportData, analysis: Analysis
) -> None:
    state = PlanState(best_marks=MARKS)
    for step in key["steps"][:14]:
        number, action = step["step"], step["action"]
        if action == "run":
            state = run_command(data, analysis, state).state
            run = state.runs[-1]
            assert run.round == step["round"], f"step {number}"
            assert run_outcome(run) == expected_run_outcome(step), f"step {number}"
            continue
        if action == "keep_in_place":
            state = keep_step(state, step["part"], data, analysis)
            continue
        before = len(state.steps)
        if action == "apply":
            state = apply_recommendation(state, step["part"], data, analysis)
            source, target = step["expect_move"]["from"], step["expect_move"]["to"]
        else:
            assert action == "manual_move", f"step {number}: unexpected action {action}"
            state = manual_step(state, step["part"], step["from"], step["to"], data, analysis)
            source, target = step["from"], step["to"]
        assert len(state.steps) == before + 1, f"step {number}"
        move = state.steps[-1]
        want = step["expect_move"]
        assert (move.part, move.from_location, move.to_location, move.rule, move.round) == (
            step["part"],
            source,
            target,
            RULES[want["rule"]],
            want["round"],
        ), f"step {number}"

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


def test_fr32_kept_part_skipped_in_run_2(
    key: dict[str, Any], data: ImportData, analysis: Analysis
) -> None:
    state = PlanState(best_marks=MARKS)
    for step in key["steps"][:12]:
        match step["action"]:
            case "run":
                state = run_command(data, analysis, state).state
            case "keep_in_place":
                state = keep_step(state, step["part"], data, analysis)
            case "apply":
                state = apply_recommendation(state, step["part"], data, analysis)
            case action:
                assert action == "manual_move", action
                state = manual_step(state, step["part"], step["from"], step["to"], data, analysis)
    assert state.keep_marks == ["0500"]
    assert "0500" in {r.part for r in state.runs[-1].recommendations}  # run 1 had it

    run_2 = key["steps"][12]
    assert run_2["action"] == "run" and run_2["round"] == 2
    run = run_command(data, analysis, state).state.runs[-1]

    assert run_outcome(run) == expected_run_outcome(run_2)
    assert "0500" not in {r.part for r in run.recommendations}
    assert "0500" not in {n.part for n in run.no_space}


UNDONE = Outdated(cause="undo")


def _step_15(key: dict[str, Any], data: ImportData, analysis: Analysis) -> None:
    before, _ = play_steps(data, analysis, 14)
    assert key["steps"][14]["action"] == "undo"
    assert before.steps[-1].move_number == 11  # 1200's apply; step 6 is a mark

    state, events = play_steps(data, analysis, 15)

    assert replay(data, state.steps).current_locations["1200"] == "B-01-01-02"
    run_2 = state.runs[-1]
    assert run_2.round == 2
    assert [(r.part, r.status, r.outdated) for r in run_2.recommendations] == [
        (part, "outdated", UNDONE) for part in ["1200", "10240", "2400", "8400"]
    ]
    assert isinstance(events[0], StepUndone)
    assert events[0].undone.move_number == 11
    assert events[1:] == [RecommendationsOutdated(count=4, cause="undo")]


def _step_16(key: dict[str, Any], data: ImportData, analysis: Analysis) -> None:
    before, _ = play_steps(data, analysis, 15)
    assert key["steps"][15]["action"] == "undo"
    assert (before.steps[-1].move_number, before.steps[-1].part) == (10, "0100")

    state, events = play_steps(data, analysis, 16)

    assert replay(data, state.steps).current_locations["0100"] == "A-01-01-01"
    [rec] = [r for r in state.runs[0].recommendations if r.part == "0100"]
    assert (rec.status, rec.outdated) == ("outdated", UNDONE)
    assert [e.type for e in events] == ["step_undone"]
    assert current_round(state) == 2
    assert state.next_move_number == 12


@pytest.mark.parametrize(
    "number",
    [
        15,
        16,
        pytest.param(17, marks=pytest.mark.skip(reason=f"after undo: {RUN_3}")),
        pytest.param(18, marks=pytest.mark.skip(reason=f"after undo: {RUN_3}")),
        pytest.param(19, marks=pytest.mark.skip(reason=f"run 3: {RUN_3}")),
        pytest.param(20, marks=pytest.mark.skip(reason=f"apply all in run 3: {RUN_3}")),
    ],
)
def test_fr23_fr30_answer_key_steps_15_to_20(
    number: int, key: dict[str, Any], data: ImportData, analysis: Analysis
) -> None:
    {15: _step_15, 16: _step_16}[number](key, data, analysis)


def test_fr35_undo_after_later_run(
    key: dict[str, Any], data: ImportData, analysis: Analysis
) -> None:
    state, _ = play_steps(data, analysis, 18)

    moves = [m for m in replay(data, state.steps).moves if m.part == "0100"]
    assert [(m.from_location, m.to_location, m.rule, m.round) for m in moves] == [
        ("A-01-01-01", "B-01-03-02", "manual", 2)
    ]
    assert current_round(state) == 2
    assert all(
        (r.status, r.outdated) == ("outdated", UNDONE) for r in state.runs[-1].recommendations
    )


@pytest.mark.skip(reason=f"move list: {MOVE_LIST}")
def test_fr38_answer_key_move_list() -> None:
    raise AssertionError("deferred")


@pytest.mark.skip(reason=f"final before/after after run 3: {RUN_3}")
def test_fr37_answer_key_final_before_after() -> None:
    raise AssertionError("deferred")


@pytest.mark.skip(reason=f"final current locations after run 3: {RUN_3}")
def test_fr33_answer_key_final_current_locations() -> None:
    raise AssertionError("deferred")


@pytest.mark.skip(reason=f"settled check (one more run on the final state): {RUN_3}")
def test_fr23_answer_key_settled_check() -> None:
    raise AssertionError("deferred")
