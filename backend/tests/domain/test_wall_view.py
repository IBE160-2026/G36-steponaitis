"""FR-42/FR-14/FR-22: the wall view of one aisle (domain only)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from swp.domain.analysis import Analysis
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData, InventoryLine
from swp.domain.ordering import location_order
from swp.domain.planning import append_step, best_counts, planning_copy
from swp.domain.state import (
    AisleMark,
    LevelMark,
    LocationMark,
    PlanState,
    Recommendation,
    Run,
    Step,
)
from swp.domain.views.locations import build_locations_view
from swp.domain.views.wall import AISLE_NOT_FOUND, build_wall_view

RUN_ID = "run-1"


def _rec(number: int, part: str, from_location: str, to_location: str) -> Recommendation:
    return Recommendation(
        id=f"{RUN_ID}:{number}",
        number=number,
        rule="rule_1",
        part=part,
        from_location=from_location,
        to_location=to_location,
    )


def _run(*recs: Recommendation) -> Run:
    return Run(
        id=RUN_ID,
        round=1,
        created_at=datetime(2026, 11, 23, 12, 0, tzinfo=UTC),
        created_by="planner",
        recommendations=list(recs),
    )


def test_fr42_wall_lists_the_aisle_in_location_order(data: ImportData, analysis: Analysis) -> None:
    view = build_wall_view(data, analysis, PlanState.new(), 4, "B")
    codes = [row.location.code for row in view.locations]
    assert view.version == 4
    assert view.aisle == "B"
    in_b = {code: loc for code, loc in data.locations.items() if loc.aisle == "B"}
    assert codes == location_order(in_b)
    assert view.rail_levels == []
    rows = {row.location.code: row for row in view.locations}
    full = rows["B-01-01-02"]
    assert full.occupied is True
    assert full.walk_path == Decimal(100)
    assert [(p.part, p.movement_class, p.picks, p.stock) for p in full.parts] == [
        ("1200", analysis.parts["1200"].movement_class, 25, Decimal(8))
    ]
    assert full.top_part == full.parts[0]
    assert full.parts[0].kept_in_place is False
    empty = rows["B-01-03-03"]
    assert (empty.occupied, empty.parts, empty.top_part) == (False, [], None)


def test_fr42_wall_counts_match_locations_view(data: ImportData, analysis: Analysis) -> None:
    wall = build_wall_view(data, analysis, PlanState.new(), 1, "A")
    table = build_locations_view(data, PlanState.new(), 1)
    assert [a.aisle for a in wall.aisles] == [a.aisle for a in table.aisles]
    for counts, occupancy in zip(wall.aisles, table.aisles, strict=True):
        assert (counts.locations, counts.occupied, counts.empty, counts.occupied_percent) == (
            occupancy.locations,
            occupancy.occupied,
            occupancy.empty,
            occupancy.occupied_percent,
        )
        assert (counts.best, counts.empty_best, counts.moves, counts.aisle_marked) == (
            0,
            0,
            0,
            False,
        )
    warehouse = table.warehouse
    assert (wall.warehouse.locations, wall.warehouse.occupied, wall.warehouse.empty) == (
        warehouse.locations,
        warehouse.occupied,
        warehouse.empty,
    )
    assert wall.warehouse.occupied_percent == warehouse.occupied_percent


def test_fr42_wall_parts_in_pick_order_without_zero_stock(
    data: ImportData, analysis: Analysis
) -> None:
    # A-01-01-01 holds 0100 (1 pick); add 1200 (25 picks) and a zero-stock row of 5000.
    extra = [
        InventoryLine(part="1200", location="A-01-01-01", quantity=Decimal(3)),
        InventoryLine(part="5000", location="A-01-01-01", quantity=Decimal(0)),
    ]
    two_parts = data.model_copy(update={"inventory": [*data.inventory, *extra]})
    state = PlanState(keep_marks=["0100"])
    view = build_wall_view(two_parts, analysis, state, 1, "A")
    row = next(r for r in view.locations if r.location.code == "A-01-01-01")
    assert [(p.part, p.picks, p.kept_in_place) for p in row.parts] == [
        ("1200", 25, False),
        ("0100", 1, True),
    ]
    assert row.top_part is not None
    assert row.top_part.part == "1200"
    assert row.parts[0].description == data.parts["1200"]
    assert row.occupied is True


def test_fr42_wall_zero_stock_location_is_empty(data: ImportData, analysis: Analysis) -> None:
    view = build_wall_view(data, analysis, PlanState.new(), 1, "A")
    row = next(r for r in view.locations if r.location.code == "A-01-01-03")
    assert (row.occupied, row.parts, row.top_part) == (False, [], None)


def test_fr22_wall_marks_rails_and_best(data: ImportData, analysis: Analysis) -> None:
    marks = [
        AisleMark(aisle="A"),
        LevelMark(level="1"),
        LocationMark(location="B-01-03-03"),
    ]
    state = PlanState(best_marks=marks)
    copy = planning_copy(data, state)
    a = build_wall_view(data, analysis, state, 1, "A")
    b = build_wall_view(data, analysis, state, 1, "B")
    assert a.rail_levels == ["1", "2", "3"]
    assert b.rail_levels == ["1"]
    cell = next(r for r in b.locations if r.location.code == "B-01-03-03")
    assert cell.location.is_best is True
    assert cell.covering_marks == [LocationMark(location="B-01-03-03")]
    counts = {c.aisle: c for c in b.aisles}
    assert counts["A"].aisle_marked is True
    assert counts["B"].aisle_marked is False
    assert (counts["A"].best, counts["A"].empty_best) == (9, 1)
    assert (counts["B"].best, counts["B"].empty_best) == (4, 1)
    expected = best_counts(copy, marks)
    assert (b.warehouse.best, b.warehouse.empty_best) == (expected.best, expected.empty)
    assert sum(c.best for c in b.aisles) == expected.best
    assert sum(c.empty_best for c in b.aisles) == expected.empty


def test_fr22_wall_level_mark_in_one_aisle(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(best_marks=[LevelMark(level="2", aisle="C")])
    assert build_wall_view(data, analysis, state, 1, "C").rail_levels == ["2"]
    assert build_wall_view(data, analysis, state, 1, "D").rail_levels == []


def test_fr42_wall_moves_count_the_latest_run(data: ImportData, analysis: Analysis) -> None:
    recs = [
        _rec(1, "0100", "A-01-01-01", "B-01-03-03"),  # A and B
        _rec(2, "0600", "A-01-02-02", "A-01-01-03"),  # A only (counted once)
        _rec(3, "6600", "C-01-02-03", "C-01-03-01"),  # applied elsewhere: to D
    ]
    state = PlanState(runs=[_run(*recs)])
    state = state.model_copy(
        update={
            "steps": [
                Step(
                    move_number=1,
                    part="6600",
                    from_location="C-01-02-03",
                    to_location="D-01-03-01",
                    rule="rule_1",
                    round=1,
                    recommendation_id=f"{RUN_ID}:3",
                )
            ],
            "next_move_number": 2,
        }
    )
    view = build_wall_view(data, analysis, state, 2, "A")
    moves = {c.aisle: c.moves for c in view.aisles}
    assert moves == {"A": 2, "B": 1, "C": 1, "D": 1}


def test_fr42_wall_follows_a_manual_move(data: ImportData, analysis: Analysis) -> None:
    before = build_wall_view(data, analysis, PlanState.new(), 1, "B")
    state = append_step(
        PlanState.new(),
        part="1200",
        from_location="B-01-01-02",
        to_location="B-01-03-03",
        rule="manual",
    )
    after = build_wall_view(data, analysis, state, 2, "B")
    rows_before = {r.location.code: r for r in before.locations}
    rows_after = {r.location.code: r for r in after.locations}
    assert rows_before["B-01-01-02"].occupied and not rows_before["B-01-03-03"].occupied
    assert not rows_after["B-01-01-02"].occupied and rows_after["B-01-03-03"].occupied
    assert after.version == 2
    counts = {c.aisle: c for c in after.aisles}
    assert counts["B"].occupied == {c.aisle: c for c in before.aisles}["B"].occupied


def test_fr42_wall_unknown_aisle_not_found(data: ImportData, analysis: Analysis) -> None:
    with pytest.raises(DomainError) as raised:
        build_wall_view(data, analysis, PlanState.new(), 1, "Z")
    assert raised.value.code == "not_found"
    assert raised.value.message == AISLE_NOT_FOUND
