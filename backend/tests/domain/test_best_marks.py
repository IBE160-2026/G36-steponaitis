"""FR-21/FR-22/AD-1/AD-4: best-location marks, `covering_marks`, `is_best` and the counts."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from swp.domain.analysis import Analysis, AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.pick_groups import find_pick_groups
from swp.domain.planning import (
    LocationRef,
    PlanningCopy,
    best_counts,
    covering_marks,
    is_best,
    location_ref,
    planning_copy,
)
from swp.domain.state import AisleMark, BestMark, LevelMark, LocationMark, PlanState
from swp.domain.views.locations import build_locations_view
from swp.domain.views.parts import build_part_detail, build_parts_view
from swp.domain.views.search import build_search_view
from swp.domain.views.summary import build_summary
from tests.domain.answer_key import answer_key_import, expected

NOW = datetime(2026, 11, 22, 12, 0, tzinfo=UTC)

# Aisles A and B, levels 1 and 2, two positions each; A-1-2 holds only a zero-stock row.
CODES = [f"{a}-{lvl}-{p}" for a in "AB" for lvl in "12" for p in "12"]


def _small() -> PlanningCopy:
    data = ImportData(
        locations={
            code: LocationData(
                walk_path=Decimal(i),
                aisle=code[0],
                level=code[2],
                section=None,
                position=code[4],
            )
            for i, code in enumerate(CODES)
        },
        inventory=[
            InventoryLine(part="P", location="A-1-1", quantity=Decimal(3)),
            InventoryLine(part="P", location="A-1-2", quantity=Decimal(0)),
            InventoryLine(part="Q", location="B-1-1", quantity=Decimal(2)),
        ],
        parts={"P": "Part P", "Q": "Part Q"},
        transactions=[],
    )
    return planning_copy(data, PlanState.new())


def _best(copy: PlanningCopy, marks: list[BestMark]) -> set[str]:
    return {code for code in copy.locations if is_best(copy, code, marks)}


def test_fr21_aisle_mark() -> None:
    copy = _small()
    mark = AisleMark(aisle="A")

    assert covering_marks(copy, "A-1-1", [mark]) == [mark]
    assert covering_marks(copy, "B-1-1", [mark]) == []
    assert _best(copy, [mark]) == {"A-1-1", "A-1-2", "A-2-1", "A-2-2"}


def test_fr21_level_mark_in_all_aisles() -> None:
    copy = _small()
    marks: list[BestMark] = [LevelMark(level="1", aisle=None)]

    assert _best(copy, marks) == {"A-1-1", "A-1-2", "B-1-1", "B-1-2"}
    assert not is_best(copy, "A-2-1", marks)


def test_fr21_level_mark_in_one_aisle() -> None:
    copy = _small()
    marks: list[BestMark] = [LevelMark(level="1", aisle="B")]

    assert _best(copy, marks) == {"B-1-1", "B-1-2"}
    assert not is_best(copy, "A-1-1", marks)


def test_fr21_single_location_mark() -> None:
    copy = _small()

    assert _best(copy, [LocationMark(location="B-2-2")]) == {"B-2-2"}


def test_fr21_overlapping_marks() -> None:
    copy = _small()
    aisle = AisleMark(aisle="A")
    level = LevelMark(level="1", aisle=None)

    assert covering_marks(copy, "A-1-1", [aisle, level]) == [aisle, level]
    assert covering_marks(copy, "A-1-1", [level, aisle]) == [level, aisle]
    assert is_best(copy, "A-2-1", [aisle, level])
    # Removing the aisle mark leaves A level 1 best through the level mark.
    assert is_best(copy, "A-1-1", [level])
    assert not is_best(copy, "A-2-1", [level])


def test_fr21_unknown_target_marks_nothing() -> None:
    copy = _small()
    marks: list[BestMark] = [
        AisleMark(aisle="Z"),
        LocationMark(location="X-99"),
        LevelMark(level="1", aisle="Z"),
        LevelMark(level="9"),
    ]

    assert _best(copy, marks) == set()
    assert best_counts(copy, marks).model_dump() == {"best": 0, "empty": 0}
    assert covering_marks(copy, "X-99", marks) == []
    assert not is_best(copy, "X-99", marks)
    for mark in marks:
        assert _best(copy, [mark]) == set(), mark


def test_fr21_level_matches_by_exact_string() -> None:
    data = answer_key_import().data
    copy = planning_copy(data, PlanState.new())
    assert data.locations["A-01-01-01"].level == "1"
    assert _best(copy, [LevelMark(level="01")]) == set()
    small = _small()
    padded = planning_copy(
        ImportData(
            locations={
                "A-01": LocationData(
                    walk_path=Decimal(0), aisle="A", level="01", section=None, position=None
                )
            },
            inventory=[],
            parts={},
            transactions=[],
        ),
        PlanState.new(),
    )
    assert not is_best(padded, "A-01", [LevelMark(level="1")])
    assert is_best(padded, "A-01", [LevelMark(level="01")])
    assert not is_best(small, "A-1-1", [LevelMark(level="01")])


def test_fr21_no_marks_nothing_best() -> None:
    copy = _small()

    assert _best(copy, []) == set()
    assert best_counts(copy, []).model_dump() == {"best": 0, "empty": 0}


def test_fr21_duplicate_marks_collapse_to_one() -> None:
    state = PlanState.model_validate(
        {
            "best_marks": [
                {"kind": "aisle", "aisle": "A"},
                {"kind": "level", "level": "1", "aisle": None},
                {"kind": "aisle", "aisle": "A"},
                {"kind": "level", "level": "1"},
                {"kind": "level", "level": "1", "aisle": "A"},
            ]
        }
    )

    assert state.best_marks == [
        AisleMark(aisle="A"),
        LevelMark(level="1", aisle=None),
        LevelMark(level="1", aisle="A"),
    ]
    assert PlanState(best_marks=[AisleMark(aisle="A"), AisleMark(aisle="A")]).best_marks == [
        AisleMark(aisle="A")
    ]


def test_fr21_marks_serialize_as_values() -> None:
    state = PlanState(
        best_marks=[AisleMark(aisle="A"), LevelMark(level="2"), LocationMark(location="A-1-1")]
    )

    assert state.model_dump(mode="json")["best_marks"] == [
        {"kind": "aisle", "aisle": "A"},
        {"kind": "level", "level": "2", "aisle": None},
        {"kind": "location", "location": "A-1-1"},
    ]
    assert PlanState.model_validate_json(state.model_dump_json()) == state


def test_fr22_empty_best_counts_zero_stock_rows() -> None:
    copy = _small()

    assert best_counts(copy, [AisleMark(aisle="A")]).model_dump() == {"best": 4, "empty": 3}
    assert best_counts(copy, [LevelMark(level="1")]).model_dump() == {"best": 4, "empty": 2}


def _analysis() -> Analysis:
    imported = answer_key_import()
    settings = AnalysisSettings.model_validate(expected()["settings"])
    analysis = build_analysis(imported.data_as_of, settings)
    return analysis.model_copy(
        update={
            "parts": classify_parts(imported.data, analysis),
            "pick_groups": find_pick_groups(imported.data, analysis),
        }
    )


def _answer_key_state() -> PlanState:
    return PlanState.model_validate(
        {"best_marks": [{"kind": "aisle", **mark} for mark in expected()["best_location_marks"]]}
    )


def test_fr22_answer_key_best_counts() -> None:
    data = answer_key_import().data
    state = _answer_key_state()
    copy = planning_copy(data, state)

    best = {code for code in copy.locations if is_best(copy, code, state.best_marks)}
    assert best == {code for code, loc in data.locations.items() if loc.aisle == "A"}
    counts = best_counts(copy, state.best_marks)
    assert (counts.best, counts.empty) == (9, 1)
    assert {code for code in best if code in expected()["empty_with_zero_stock_row"]} == {
        "A-01-01-03"
    }


def test_fr22_locations_view_rows_carry_best_and_covering_marks() -> None:
    state = _answer_key_state()
    view = build_locations_view(answer_key_import().data, state, 1)

    for row in view.locations:
        if row.location.aisle == "A":
            assert row.location.is_best is True, row.location.code
            assert row.covering_marks == [AisleMark(aisle="A")]
        else:
            assert row.location.is_best is False, row.location.code
            assert row.covering_marks == []
    row = view.locations[0].model_dump(mode="json")
    assert row["covering_marks"] == [{"kind": "aisle", "aisle": "A"}]


def test_fr22_parts_and_search_refs_agree_with_is_best() -> None:
    data = answer_key_import().data
    analysis = _analysis()
    state = _answer_key_state()
    copy = planning_copy(data, state)

    def check(ref: LocationRef) -> None:
        assert ref.is_best == is_best(copy, ref.code, state.best_marks), ref.code

    rows = {row.part: row for row in build_parts_view(data, analysis, state, 1).parts}
    # 1200: current B-01-01-02 (not best), other A-01-02-01 (best under aisle A).
    assert rows["1200"].current_location is not None
    assert rows["1200"].current_location.is_best is False
    assert [ref.is_best for ref in rows["1200"].other_locations] == [True]
    for row in rows.values():
        for ref in [row.current_location, *row.other_locations]:
            if ref is not None:
                check(ref)

    detail = build_part_detail(data, analysis, state, 1, "4400")
    assert detail.current_location is not None
    assert detail.current_location.code == "A-01-03-02"
    assert detail.current_location.is_best is True
    for stocked in detail.other_locations:
        check(stocked.location)

    search = build_search_view(data, analysis, state, 1, "-01-01-")
    assert search.locations
    assert any(match.location.is_best for match in search.locations)
    for match in search.locations:
        check(match.location)

    assert location_ref(copy, "A-01-01-01", state.best_marks).is_best is True
    assert location_ref(copy, "B-01-01-01", state.best_marks).is_best is False


@pytest.mark.parametrize("marks", [[], [{"kind": "aisle", "aisle": "A"}]])
def test_fr21_marks_never_change_the_import(marks: list[dict[str, str]]) -> None:
    data = answer_key_import().data
    before = data.model_copy(deep=True)
    state = PlanState.model_validate({"best_marks": marks})
    analysis = _analysis()

    copy = planning_copy(data, state)
    best_counts(copy, state.best_marks)
    build_locations_view(data, state, 1)
    build_parts_view(data, analysis, state, 1)
    build_part_detail(data, analysis, state, 1, "1200")
    build_search_view(data, analysis, state, 1, "A-01")
    imported = answer_key_import()
    build_summary(
        id=uuid.UUID(int=1),
        name="Marks",
        import_id=uuid.UUID(int=2),
        data_as_of=imported.data_as_of,
        uploaded_at=NOW,
        created_by="planner",
        created_at=NOW,
        last_edited_by="planner",
        last_edited_at=NOW,
        version=1,
        analysis=analysis,
        state=state,
        copy=copy,
        last_step=None,
        move_count=0,
        location_count=len(data.locations),
        part_count=len(data.parts),
    )

    assert data == before
    assert dict(copy.locations) == data.locations
    assert list(copy.inventory) == data.inventory
