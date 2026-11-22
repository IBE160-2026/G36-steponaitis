"""FR-37: before/after counts per aisle and in total (domain only, answer key)."""

from typing import Any

import pytest

from swp.domain.analysis import Analysis
from swp.domain.before_after import BeforeAfter, Count, build_before_after
from swp.domain.import_data import ImportData
from swp.domain.planning import (
    PlanningCopy,
    current_location,
    import_copy,
    listed_parts,
    replay,
)
from swp.domain.state import AisleMark, BestMark, Rule, Step
from tests.domain.answer_key import answer_key_import, expected
from tests.domain.test_pick_groups_view import _analysis

RULES: dict[str, Rule] = {"1": "rule_1", "2": "rule_2", "3": "rule_3", "Manual": "manual"}
MARKS: list[BestMark] = [AisleMark(aisle="A")]


@pytest.fixture(scope="module")
def data() -> ImportData:
    return answer_key_import().data


@pytest.fixture(scope="module")
def analysis() -> Analysis:
    return _analysis()


def _steps(lines: list[dict[str, Any]]) -> list[Step]:
    return [
        Step(
            move_number=number,
            part=line["part"],
            from_location=line["from"],
            to_location=line["to"],
            rule=RULES[line["rule"]],
            round=line["round"],
        )
        for number, line in enumerate(lines, start=1)
    ]


def _manual(moves: list[tuple[str, str, str]]) -> list[Step]:
    return _steps(
        [{"part": p, "from": a, "to": b, "rule": "Manual", "round": 0} for p, a, b in moves]
    )


def _after(data: ImportData, steps: list[Step]) -> PlanningCopy:
    return replay(data, steps).copy


def _row(result: BeforeAfter, aisle: str) -> Any:
    return next(row for row in result.aisles if row.aisle == aisle)


def test_fr37_answer_key_before_after(data: ImportData, analysis: Analysis) -> None:
    key = expected()
    replayed = replay(data, _steps(key["move_list"]["lines_in_order"]))
    for part, location in key["final_current_locations"].items():
        assert replayed.current_locations[part] == location
    marks: list[BestMark] = [AisleMark.model_validate(m) for m in key["best_location_marks"]]

    result = build_before_after(data, replayed.copy, analysis, marks)

    want = key["before_after"]
    assert [row.aisle for row in result.aisles] == sorted(want["moved_in"])
    for row in result.aisles:
        a = row.aisle
        assert row.fast_in_best == Count(
            before=want["fast_in_best"]["before"][a], after=want["fast_in_best"]["after"][a]
        )
        assert row.pick_groups_together == Count(
            before=want["pick_groups_together"]["before"][a],
            after=want["pick_groups_together"]["after"][a],
        )
        assert row.moved_in == want["moved_in"][a]
        assert row.moved_out == want["moved_out"][a]
        assert row.occupied.after == want["occupancy_after"][a]["occupied"]
        assert row.empty.after == want["occupancy_after"][a]["empty"]
        assert row.occupied.before == key["occupancy_import"][a]["occupied"]
        assert row.empty.before == key["occupancy_import"][a]["empty"]
    total = result.total
    assert total.fast_in_best == Count(before=1, after=5)
    assert total.pick_groups_together == Count(before=1, after=6)
    assert total.fast_in_best.after == want["fast_in_best"]["after"]["total"]
    assert total.pick_groups_together.after == want["pick_groups_together"]["after"]["total"]
    assert total.occupied.after == want["occupancy_after"]["total"]["occupied"]
    assert total.empty.after == want["occupancy_after"]["total"]["empty"]
    assert total.occupied.before == key["occupancy_import"]["total"]["occupied"]
    assert total.empty.before == key["occupancy_import"]["total"]["empty"]


def test_fr37_no_moves_before_equals_after(data: ImportData, analysis: Analysis) -> None:
    result = build_before_after(data, import_copy(data), analysis, MARKS)

    for row in result.aisles:
        assert row.moved_in == [] and row.moved_out == []
        for count in (row.fast_in_best, row.pick_groups_together, row.occupied, row.empty):
            assert count.before == count.after
    t = result.total
    for count in (t.fast_in_best, t.pick_groups_together, t.occupied, t.empty):
        assert count.before == count.after


def test_fr37_part_without_stock_counts_nowhere(data: ImportData, analysis: Analysis) -> None:
    assert analysis.parts["1008614-00"].movement_class == "fast"
    copy = import_copy(data)
    assert current_location(copy, "1008614-00") is None
    marks: list[BestMark] = [AisleMark(aisle=a) for a in "ABCD"]
    only = analysis.model_copy(
        update={
            "parts": {"1008614-00": analysis.parts["1008614-00"]},
            "pick_groups": [
                g for g in analysis.pick_groups if "1008614-00" in (g.part_a, g.part_b)
            ],
        }
    )
    assert [(g.part_a, g.part_b) for g in only.pick_groups] == [("1008614-00", "2300")]
    assert listed_parts(data, only)["1008614-00"].movement_class == "fast"

    result = build_before_after(data, copy, only, marks)

    for row in result.aisles:
        assert row.fast_in_best == Count(before=0, after=0)
        assert row.pick_groups_together == Count(before=0, after=0)


def test_fr37_part_keeping_a_location_in_the_aisle_is_not_moved_in(
    data: ImportData, analysis: Analysis
) -> None:
    copy = _after(data, _manual([("1200", "B-01-01-02", "A-01-01-01")]))

    result = build_before_after(data, copy, analysis, MARKS)

    assert "1200" not in _row(result, "A").moved_in
    assert "1200" in _row(result, "B").moved_out
    assert current_location(copy, "1200") == "A-01-01-01"
    assert analysis.parts["1200"].movement_class == "fast"
    a = _row(result, "A")
    assert a.fast_in_best.after == a.fast_in_best.before + 1


def test_fr37_both_sides_use_current_marks(data: ImportData, analysis: Analysis) -> None:
    copy = _after(data, _steps(expected()["move_list"]["lines_in_order"]))
    marks: list[BestMark] = [AisleMark(aisle="A"), AisleMark(aisle="B")]

    moved = build_before_after(data, copy, analysis, marks)

    assert {row.aisle: row.fast_in_best for row in moved.aisles} == {
        "A": Count(before=1, after=5),
        "B": Count(before=2, after=0),
        "C": Count(before=0, after=0),
        "D": Count(before=0, after=0),
    }
    assert moved.total.fast_in_best == Count(before=3, after=5)

    result = build_before_after(data, import_copy(data), analysis, [])

    for row in result.aisles:
        assert row.fast_in_best == Count(before=0, after=0)
    assert result.total.fast_in_best == Count(before=0, after=0)


def test_fr37_swap_inside_an_aisle_moves_nothing_in_or_out(
    data: ImportData, analysis: Analysis
) -> None:
    copy = _after(
        data,
        _manual([("9100", "D-01-02-02", "D-01-02-03"), ("9200", "D-01-02-03", "D-01-02-02")]),
    )

    result = build_before_after(data, copy, analysis, MARKS)

    for row in result.aisles:
        assert row.moved_in == [] and row.moved_out == []


def test_fr37_aisles_in_text_order_and_totals_are_sums(
    data: ImportData, analysis: Analysis
) -> None:
    key = expected()
    copy = _after(data, _steps(key["move_list"]["lines_in_order"]))

    result = build_before_after(data, copy, analysis, MARKS)

    aisles = sorted({location.aisle for location in data.locations.values()})
    assert [row.aisle for row in result.aisles] == aisles
    for field in ("fast_in_best", "pick_groups_together", "occupied", "empty"):
        counts = [getattr(row, field) for row in result.aisles]
        assert getattr(result.total, field) == Count(
            before=sum(c.before for c in counts), after=sum(c.after for c in counts)
        )
    for row in result.aisles:
        size = sum(1 for loc in data.locations.values() if loc.aisle == row.aisle)
        assert row.occupied.before + row.empty.before == size
        assert row.occupied.after + row.empty.after == size
