"""FR-42/FR-14/FR-22: the wall view of one aisle (domain only)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from swp.domain.analysis import Analysis
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData, InventoryLine
from swp.domain.ordering import location_order
from swp.domain.planning import (
    append_step,
    best_counts,
    planning_copy,
    recommendation_status,
    replay,
)
from swp.domain.state import (
    AisleMark,
    LevelMark,
    LocationMark,
    Outdated,
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


def _step(number: int, part: str, a: str, b: str, *, rec: int | None = None) -> Step:
    return Step(
        move_number=number,
        part=part,
        from_location=a,
        to_location=b,
        rule="rule_1" if rec is not None else "manual",
        round=1,
        recommendation_id=f"{RUN_ID}:{rec}" if rec is not None else None,
    )


def _with_steps(state: PlanState, *steps: Step) -> PlanState:
    return state.model_copy(update={"steps": list(steps), "next_move_number": len(steps) + 1})


def _assert_counts_match(data: ImportData, analysis: Analysis, state: PlanState) -> None:
    """Every aisle's tab count equals the number of entries its wall lists."""
    first = build_wall_view(data, analysis, state, 1, "A")
    for counts in first.aisles:
        view = build_wall_view(data, analysis, state, 1, counts.aisle)
        assert counts.moves == len(view.moves), counts.aisle


def test_fr42_wall_moves_count_the_latest_run(data: ImportData, analysis: Analysis) -> None:
    recs = [
        _rec(1, "0100", "A-01-01-01", "B-01-03-03"),  # A and B
        _rec(2, "0600", "A-01-02-02", "A-01-01-03"),  # A only (counted once)
        _rec(3, "6600", "C-01-02-03", "C-01-03-01"),  # applied elsewhere: to D
    ]
    state = _with_steps(
        PlanState(runs=[_run(*recs)]), _step(1, "6600", "C-01-02-03", "D-01-03-01", rec=3)
    )
    view = build_wall_view(data, analysis, state, 2, "A")
    moves = {c.aisle: c.moves for c in view.aisles}
    assert moves == {"A": 2, "B": 1, "C": 1, "D": 1}
    assert view.round == 1
    assert [(m.number, m.status) for m in view.moves] == [(1, "open"), (2, "open")]
    _assert_counts_match(data, analysis, state)


def test_fr42_wall_moves_no_run(data: ImportData, analysis: Analysis) -> None:
    view = build_wall_view(data, analysis, PlanState.new(), 1, "A")
    assert (view.round, view.moves) == (0, [])
    assert all(c.moves == 0 for c in view.aisles)


def test_fr42_wall_moves_cross_aisle_rec(data: ImportData, analysis: Analysis) -> None:
    state = PlanState(runs=[_run(_rec(1, "0100", "A-01-01-01", "B-01-03-03"))])
    view = build_wall_view(data, analysis, state, 1, "B")
    [move] = view.moves
    assert (move.kind, move.recommendation_id, move.number, move.move_number) == (
        "recommendation",
        f"{RUN_ID}:1",
        1,
        None,
    )
    assert (move.rule, move.part, move.status) == ("rule_1", "0100", "open")
    assert move.description == data.parts["0100"]
    assert (move.movement_class, move.picks) == (analysis.parts["0100"].movement_class, 1)
    assert (move.from_location.code, move.from_location.aisle) == ("A-01-01-01", "A")
    assert (move.to_location.code, move.to_location.aisle) == ("B-01-03-03", "B")
    assert build_wall_view(data, analysis, state, 1, "A").moves == [move]
    _assert_counts_match(data, analysis, state)


def test_fr42_wall_moves_applied_to_other_location(data: ImportData, analysis: Analysis) -> None:
    state = _with_steps(
        PlanState(runs=[_run(_rec(3, "6600", "C-01-02-03", "C-01-03-01"))]),
        _step(1, "6600", "C-01-02-03", "D-01-03-01", rec=3),
    )
    [move] = build_wall_view(data, analysis, state, 2, "D").moves
    assert (move.status, move.move_number, move.rule) == ("applied", 1, "rule_1")
    assert move.to_location.code == "D-01-03-01"
    _assert_counts_match(data, analysis, state)


def test_fr42_wall_moves_moved_back_is_outdated(data: ImportData, analysis: Analysis) -> None:
    state = _with_steps(
        PlanState(runs=[_run(_rec(3, "6600", "C-01-02-03", "C-01-03-01"))]),
        _step(1, "6600", "C-01-02-03", "D-01-03-01", rec=3),
        _step(2, "6600", "D-01-03-01", "C-01-02-03"),
    )
    view = build_wall_view(data, analysis, state, 3, "C")
    [move] = view.moves
    assert (move.status, move.move_number) == ("outdated", None)
    assert (move.from_location.code, move.to_location.code) == ("C-01-02-03", "D-01-03-01")
    _assert_counts_match(data, analysis, state)


def test_fr42_wall_moves_manual_combined_into_applied_rec(
    data: ImportData, analysis: Analysis
) -> None:
    state = _with_steps(
        PlanState(runs=[_run(_rec(3, "6600", "C-01-02-03", "C-01-03-01"))]),
        _step(1, "6600", "C-01-02-03", "C-01-03-01", rec=3),
        _step(2, "6600", "C-01-03-01", "D-01-03-01"),
    )
    view = build_wall_view(data, analysis, state, 3, "C")
    [move] = view.moves
    assert (move.kind, move.status, move.rule, move.move_number) == (
        "recommendation",
        "applied",
        "rule_1",
        1,
    )
    assert move.to_location.code == "D-01-03-01"
    assert {c.aisle: c.moves for c in view.aisles if c.moves} == {"C": 1, "D": 1}
    _assert_counts_match(data, analysis, state)


def test_fr42_wall_moves_manual_round_0(data: ImportData, analysis: Analysis) -> None:
    state = append_step(
        PlanState.new(),
        part="1200",
        from_location="B-01-01-02",
        to_location="B-01-03-03",
        rule="manual",
    )
    view = build_wall_view(data, analysis, state, 2, "B")
    assert view.round == 0
    [move] = view.moves
    assert (move.kind, move.recommendation_id, move.number, move.move_number) == (
        "manual",
        None,
        None,
        1,
    )
    assert (move.rule, move.status, move.part) == ("manual", "manual", "1200")
    assert {c.aisle: c.moves for c in view.aisles if c.moves} == {"B": 1}


def test_fr42_recommendation_status_precedence(data: ImportData, analysis: Analysis) -> None:
    rec = _rec(3, "6600", "C-01-02-03", "C-01-03-01")
    stored = rec.model_copy(update={"status": "outdated", "outdated": Outdated(cause="marks")})
    applied = [_step(1, "6600", "C-01-02-03", "D-01-03-01", rec=3)]
    moved_back = [*applied, _step(2, "6600", "D-01-03-01", "C-01-02-03")]

    def status(r: Recommendation, steps: list[Step], keep: list[str]) -> str:
        state = _with_steps(PlanState(runs=[_run(r)], keep_marks=keep), *steps)
        return recommendation_status(state, replay(data, state.steps).moves, r).status

    # Applied wins over stored outdated and kept; moved back is outdated even when kept.
    assert status(stored, applied, ["6600"]) == "applied"
    assert status(rec, moved_back, ["6600"]) == "outdated"
    # Stored outdated wins over kept; kept wins over open.
    assert status(stored, [], ["6600"]) == "outdated"
    assert status(rec, [], ["6600"]) == "kept"
    assert status(rec, [], []) == "open"


def test_fr42_wall_moves_manual_from_earlier_round_is_not_listed(
    data: ImportData, analysis: Analysis
) -> None:
    state = append_step(
        PlanState.new(),
        part="1200",
        from_location="B-01-01-02",
        to_location="B-01-03-03",
        rule="manual",
    )
    state = state.model_copy(update={"runs": [_run(_rec(1, "0100", "A-01-01-01", "A-01-01-03"))]})
    view = build_wall_view(data, analysis, state, 3, "B")
    assert view.round == 1
    assert view.moves == []
    assert {c.aisle: c.moves for c in view.aisles if c.moves} == {"A": 1}


def test_fr42_wall_moves_other_aisle_manual_not_listed(
    data: ImportData, analysis: Analysis
) -> None:
    state = append_step(
        PlanState.new(),
        part="1200",
        from_location="B-01-01-02",
        to_location="B-01-03-03",
        rule="manual",
    )
    view = build_wall_view(data, analysis, state, 2, "A")
    assert view.moves == []
    assert {c.aisle: c.moves for c in view.aisles}["A"] == 0


def test_fr42_wall_moves_order_and_statuses(data: ImportData, analysis: Analysis) -> None:
    outdated = _rec(2, "0600", "A-01-02-02", "A-01-01-03").model_copy(
        update={"status": "outdated", "outdated": Outdated(cause="marks")}
    )
    recs = [
        _rec(1, "0100", "A-01-01-01", "B-01-03-03"),
        outdated,
        _rec(3, "6600", "C-01-02-03", "A-01-01-03"),
        _rec(4, "1200", "B-01-01-02", "A-01-01-03"),
    ]
    state = _with_steps(
        PlanState(runs=[_run(*recs)], keep_marks=["0100"]),
        _step(1, "1200", "B-01-01-02", "A-01-01-03", rec=4),
        _step(2, "6600", "C-01-02-03", "C-01-03-01"),
    )
    view = build_wall_view(data, analysis, state, 3, "A")
    assert [(m.kind, m.number, m.move_number, m.status) for m in view.moves] == [
        ("recommendation", 1, None, "kept"),
        ("recommendation", 2, None, "outdated"),
        ("recommendation", 3, None, "open"),
        ("recommendation", 4, 1, "applied"),
    ]
    c = build_wall_view(data, analysis, state, 3, "C")
    assert [(m.kind, m.number, m.move_number, m.status) for m in c.moves] == [
        ("recommendation", 3, None, "open"),
        ("manual", None, 2, "manual"),
    ]
    _assert_counts_match(data, analysis, state)


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
