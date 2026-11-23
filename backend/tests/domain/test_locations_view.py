"""FR-14/AD-14: the locations view, occupancy and the location order (domain only)."""

from decimal import Decimal

from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.ordering import location_order
from swp.domain.state import AisleMark, LevelMark, LocationMark, PlanState
from swp.domain.views.common import occupied_percent
from swp.domain.views.locations import LocationsView, build_locations_view
from tests.domain.answer_key import answer_key_import, expected


def _view(version: int = 3) -> LocationsView:
    return build_locations_view(answer_key_import().data, PlanState.new(), version)


def _location(aisle: str, level: str, walk_path: str) -> LocationData:
    return LocationData(
        walk_path=Decimal(walk_path), aisle=aisle, level=level, section=None, position=None
    )


def test_fr14_locations_view_lists_every_location() -> None:
    data = answer_key_import().data
    view = _view()
    codes = [row.location.code for row in view.locations]
    assert view.version == 3
    assert len(codes) == len(set(codes)) == len(data.locations) == 39
    assert set(codes) == set(data.locations)
    assert codes == location_order(data.locations)
    for row in view.locations:
        source = data.locations[row.location.code]
        assert row.location.aisle == source.aisle
        assert row.location.level == source.level
        assert row.location.section == source.section
        assert row.location.position == source.position
        assert row.location.is_best is False
        assert row.walk_path == source.walk_path
    rows = {row.location.code: row for row in view.locations}
    assert [(c.part, c.description, c.stock) for c in rows["A-01-01-01"].contents] == [
        ("0100", "Wiper blade - Volvo V70", Decimal(4))
    ]
    assert rows["A-01-01-01"].occupied is True


def test_fr14_zero_stock_location_shows_empty() -> None:
    rows = {row.location.code: row for row in _view().locations}
    for code in expected()["empty_with_zero_stock_row"]:
        assert rows[code].occupied is False
        assert rows[code].contents == []


def test_fr14_occupancy_per_aisle() -> None:
    view = _view()
    facts = expected()["occupancy_import"]
    assert [aisle.aisle for aisle in view.aisles] == ["A", "B", "C", "D"]
    for aisle in view.aisles:
        assert (aisle.locations, aisle.occupied, aisle.empty) == (
            facts[aisle.aisle]["locations"],
            facts[aisle.aisle]["occupied"],
            facts[aisle.aisle]["empty"],
        )
    assert [aisle.occupied_percent for aisle in view.aisles] == ["88.9", "66.7", "66.7", "66.7"]
    total = facts["total"]
    warehouse = view.warehouse
    assert (warehouse.locations, warehouse.occupied, warehouse.empty) == (
        total["locations"],
        total["occupied"],
        total["empty"],
    )
    assert warehouse.occupied_percent == "71.8"


def test_fr14_location_order_numeric_levels() -> None:
    locations = {
        "A-10-a": _location("A", "10", "0"),
        "A-2-b": _location("A", "2", "20"),
        "A-2-a": _location("A", "2", "5"),
        "A-2-c": _location("A", "2", "5"),
        "B-1": _location("B", "1", "0"),
    }
    assert location_order(locations) == ["A-2-a", "A-2-c", "A-2-b", "A-10-a", "B-1"]


def test_fr14_location_order_text_levels() -> None:
    locations = {
        "A-B": _location("A", "B", "0"),
        "A-2": _location("A", "2", "0"),
        "A-10": _location("A", "10", "0"),
    }
    assert location_order(locations) == ["A-10", "A-2", "A-B"]


def test_fr14_location_order_unicode_digit_levels_sort_as_text() -> None:
    # "²".isdigit() is true but int("²") raises: such a level makes the import sort as text.
    locations = {
        "A-sup": _location("A", "\u00b2", "0"),
        "A-1": _location("A", "1", "0"),
    }
    assert location_order(locations) == ["A-1", "A-sup"]


def test_fr14_location_contents_order_and_missing_description() -> None:
    data = ImportData(
        locations={"A-1": _location("A", "1", "0")},
        inventory=[
            InventoryLine(part="0500", location="A-1", quantity=Decimal(2)),
            InventoryLine(part="0100", location="A-1", quantity=Decimal(4)),
            InventoryLine(part="0900", location="A-1", quantity=Decimal(1)),
        ],
        parts={"0500": "Fog light - Ford Focus", "0100": "Wiper blade - Volvo V70"},
        transactions=[],
    )
    (row,) = build_locations_view(data, PlanState.new(), 1).locations
    assert [(c.part, c.description) for c in row.contents] == [
        ("0100", "Wiper blade - Volvo V70"),
        ("0500", "Fog light - Ford Focus"),
        ("0900", ""),
    ]


def test_fr14_occupied_percent_rounding() -> None:
    assert occupied_percent(2, 3) == "66.7"
    assert occupied_percent(1, 8) == "12.5"
    assert occupied_percent(1, 16) == "6.3"
    assert occupied_percent(0, 5) == "0.0"
    assert occupied_percent(5, 5) == "100.0"
    assert occupied_percent(8, 9) == "88.9"


def test_fr21_locations_view_lists_marks_in_order() -> None:
    marks = [
        LocationMark(location="ZZ-99"),
        LocationMark(location="B-01-02-01"),
        LevelMark(level="2", aisle="B"),
        AisleMark(aisle="C"),
        LevelMark(level="10", aisle=None),
        LocationMark(location="A-01-01-02"),
        LevelMark(level="2", aisle=None),
        AisleMark(aisle="A"),
        LevelMark(level="1", aisle="A"),
    ]
    state = PlanState.new().model_copy(update={"best_marks": marks})
    view = build_locations_view(answer_key_import().data, state, 2)
    assert view.marks == [
        AisleMark(aisle="A"),
        AisleMark(aisle="C"),
        LevelMark(level="1", aisle="A"),
        LevelMark(level="2", aisle=None),
        LevelMark(level="2", aisle="B"),
        LevelMark(level="10", aisle=None),
        LocationMark(location="A-01-01-02"),
        LocationMark(location="B-01-02-01"),
        LocationMark(location="ZZ-99"),
    ]
    assert _view().marks == []


def test_fr21_locations_view_lists_levels() -> None:
    data = answer_key_import().data
    levels = {location.level for location in data.locations.values()}
    view = _view()
    assert sorted(view.levels) == sorted(levels)
    assert len(view.levels) == len(levels)
    assert view.levels == sorted(levels, key=int)
    data = ImportData(
        locations={
            "A-10": _location("A", "10", "0"),
            "A-2": _location("A", "2", "0"),
            "B-2": _location("B", "2", "0"),
        },
        inventory=[],
        parts={},
        transactions=[],
    )
    assert build_locations_view(data, PlanState.new(), 1).levels == ["2", "10"]


def test_fr21_text_level_mark_over_numeric_import_sorts_last() -> None:
    state = PlanState.new().model_copy(
        update={"best_marks": [LevelMark(level="X"), LevelMark(level="2")]}
    )
    view = build_locations_view(answer_key_import().data, state, 2)
    assert view.marks == [LevelMark(level="2"), LevelMark(level="X")]


def test_fr21_text_levels_list_in_str_order() -> None:
    data = ImportData(
        locations={
            "A-B": _location("A", "B", "0"),
            "A-A": _location("A", "A", "0"),
            "A-10": _location("A", "10", "0"),
        },
        inventory=[],
        parts={},
        transactions=[],
    )
    assert build_locations_view(data, PlanState.new(), 1).levels == ["10", "A", "B"]
