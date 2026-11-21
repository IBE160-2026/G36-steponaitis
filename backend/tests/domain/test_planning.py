"""FR-13/FR-14/AD-1: the shared facts in `domain/planning.py` (domain only)."""

from collections import Counter
from decimal import Decimal

import pytest

from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.planning import (
    LocationRef,
    aisle_of,
    current_location,
    is_empty,
    is_occupied,
    location_ref,
    other_locations,
    planning_copy,
    stock_at,
    total_stock,
)
from swp.domain.state import PlanState
from tests.domain.answer_key import answer_key_import, expected


@pytest.fixture(scope="module")
def copy():
    return planning_copy(answer_key_import().data, PlanState.new())


def test_fr13_current_location(copy) -> None:
    assert current_location(copy, "1200") == "B-01-01-02"
    assert current_location(copy, "4400") == "A-01-03-02"
    assert current_location(copy, "1008614-00") is None
    for part, facts in expected()["parts"].items():
        assert current_location(copy, part) == facts["current_location"], part


def test_fr13_other_locations_and_total_stock(copy) -> None:
    assert other_locations(copy, "1200") == ["A-01-02-01"]
    assert total_stock(copy, "1200") == Decimal(10)
    assert other_locations(copy, "4400") == ["B-01-01-01"]
    assert total_stock(copy, "4400") == Decimal(10)
    assert other_locations(copy, "1008614-00") == []
    assert total_stock(copy, "1008614-00") == Decimal(0)
    assert stock_at(copy, "1200", "A-01-02-01") == Decimal(2)
    assert stock_at(copy, "1200", "C-01-01-01") == Decimal(0)
    # The merged rows of 9300 at one location count once with the summed stock.
    assert stock_at(copy, "9300", "B-01-03-02") == Decimal(5)
    assert other_locations(copy, "9300") == []
    assert total_stock(copy, "9999") == Decimal(0)
    assert current_location(copy, "9999") is None


def test_fr14_zero_stock_location_is_empty(copy) -> None:
    for code in expected()["empty_with_zero_stock_row"]:
        assert is_empty(copy, code)
        assert not is_occupied(copy, code)
    occupied: Counter[str] = Counter()
    empty: Counter[str] = Counter()
    for code in copy.locations:
        (empty if is_empty(copy, code) else occupied)[aisle_of(copy, code)] += 1
    occupancy = expected()["occupancy_import"]
    for aisle, counts in occupancy.items():
        if aisle == "total":
            continue
        assert occupied[aisle] == counts["occupied"], aisle
        assert empty[aisle] == counts["empty"], aisle
    assert sum(occupied.values()) == occupancy["total"]["occupied"]
    assert sum(empty.values()) == occupancy["total"]["empty"]


def test_fr13_aisle_of_and_location_ref(copy) -> None:
    assert aisle_of(copy, "B-01-01-02") == "B"
    ref = location_ref(copy, "B-01-01-02")
    assert isinstance(ref, LocationRef)
    assert ref.code == "B-01-01-02"
    assert ref.aisle == "B"
    assert ref.is_best is False
    assert set(ref.model_dump(mode="json")) == {
        "code",
        "aisle",
        "level",
        "section",
        "position",
        "is_best",
    }


def test_fr13_planning_copy_ignores_state_in_this_epic() -> None:
    data = answer_key_import().data
    copy = planning_copy(data, PlanState.new())
    assert dict(copy.locations) == data.locations
    assert list(copy.inventory) == data.inventory


def test_fr13_other_locations_sorted_by_code() -> None:
    codes = ["C-01-01-01", "A-01-01-01", "B-01-01-01"]
    data = ImportData(
        locations={
            code: LocationData(
                walk_path=Decimal(1), aisle=code[0], level="01", section=None, position=None
            )
            for code in codes
        },
        inventory=[
            InventoryLine(part="P", location="C-01-01-01", quantity=Decimal(3)),
            InventoryLine(part="P", location="B-01-01-01", quantity=Decimal(9)),
            InventoryLine(part="P", location="A-01-01-01", quantity=Decimal(1)),
        ],
        parts={"P": "Part"},
        transactions=[],
    )
    copy = planning_copy(data, PlanState.new())
    assert current_location(copy, "P") == "B-01-01-01"
    assert other_locations(copy, "P") == ["A-01-01-01", "C-01-01-01"]
