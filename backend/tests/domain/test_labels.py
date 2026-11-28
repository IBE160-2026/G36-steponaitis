"""FR-48: the location labels of a plan, one per stocked (location, part), per aisle in
Walk Path order (SM-7)."""

from decimal import Decimal

from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.labels import LabelsView, build_labels
from swp.domain.planning import append_step
from swp.domain.state import AisleMark, PlanState


def _location(walk_path: int, aisle: str, level: str = "1") -> LocationData:
    return LocationData(
        walk_path=Decimal(walk_path), aisle=aisle, level=level, section=None, position=None
    )


def _stock(part: str, location: str, quantity: int = 1) -> InventoryLine:
    return InventoryLine(part=part, location=location, quantity=Decimal(quantity))


def _import(
    locations: dict[str, LocationData],
    inventory: list[InventoryLine],
    virtual: list[str] | None = None,
) -> ImportData:
    return ImportData(
        locations=locations,
        inventory=inventory,
        parts={},
        transactions=[],
        virtual_locations=virtual or [],
    )


def _labels(view: LabelsView) -> dict[str, list[tuple[str, str]]]:
    return {
        aisle.aisle: [(label.location.code, label.part) for label in aisle.labels]
        for aisle in view.aisles
    }


def _view(data: ImportData, state: PlanState | None = None, version: int = 1) -> LabelsView:
    return build_labels(data, state or PlanState.new(), version)


def test_fr48_labels_in_walk_path_order() -> None:
    locations = {
        "A-3": _location(100, "A"),
        "A-10": _location(9, "A"),
        "A-2b": _location(20, "A", "2"),
        "A-2a": _location(20, "A", "1"),
        "A-1": _location(30, "A"),
    }
    # Inventory order is not label order; part numbers are unrelated to the Walk Path.
    inventory = [
        _stock("P5", "A-1"),
        _stock("P1", "A-3"),
        _stock("P4", "A-2b"),
        _stock("P2", "A-10"),
        _stock("P3", "A-2a"),
    ]
    view = _view(_import(locations, inventory), version=7)

    # Walk Path is numeric (9 before 20 before 100); the tie at 20 breaks by code.
    assert _labels(view) == {
        "A": [("A-10", "P2"), ("A-2a", "P3"), ("A-2b", "P4"), ("A-1", "P5"), ("A-3", "P1")]
    }
    assert view.version == 7
    first = view.aisles[0].labels[0].location
    assert (first.aisle, first.level, first.is_best) == ("A", "1", False)


def test_fr48_labels_on_a_plan_with_no_moves_are_the_imported_stock(data: ImportData) -> None:
    view = _view(data)

    stocked = {(line.location, line.part) for line in data.inventory if line.quantity > 0}
    stocked = {pair for pair in stocked if pair[0] in data.locations}
    labels = [pair for aisle in _labels(view).values() for pair in aisle]
    assert len(labels) == len(set(labels))
    assert set(labels) == stocked
    assert [aisle.aisle for aisle in view.aisles] == sorted(
        {loc.aisle for loc in data.locations.values()}
    )
    for aisle in view.aisles:
        assert all(label.location.aisle == aisle.aisle for label in aisle.labels)
        walk = [data.locations[label.location.code].walk_path for label in aisle.labels]
        assert walk == sorted(walk)


def test_fr48_labels_follow_a_moved_part() -> None:
    locations = {"A-1": _location(1, "A"), "A-2": _location(2, "A"), "B-1": _location(3, "B")}
    data = _import(locations, [_stock("P", "A-1", 5), _stock("Q", "A-2")])
    assert _labels(_view(data)) == {"A": [("A-1", "P"), ("A-2", "Q")], "B": []}

    moved = append_step(
        PlanState.new(), part="P", from_location="A-1", to_location="B-1", rule="manual"
    )

    # A-1 is empty after the move: no label for it; the label follows P to B-1.
    assert _labels(_view(data, moved, 2)) == {"A": [("A-2", "Q")], "B": [("B-1", "P")]}


def test_fr48_labels_one_per_part_in_part_number_order() -> None:
    locations = {"A-1": _location(1, "A"), "A-2": _location(2, "A")}
    inventory = [
        _stock("P2", "A-1"),
        _stock("30400", "A-2"),
        _stock("P1", "A-1"),
        _stock("3050", "A-2"),
        # Two inventory rows of one part in one location are one label.
        _stock("P1", "A-1", 3),
    ]
    view = _view(_import(locations, inventory))

    # Part numbers compare as text: "30400" sorts before "3050".
    assert _labels(view) == {"A": [("A-1", "P1"), ("A-1", "P2"), ("A-2", "30400"), ("A-2", "3050")]}
    assert view.aisles[0].labels[0].location == view.aisles[0].labels[1].location


def test_fr48_labels_skip_zero_stock_rows() -> None:
    locations = {"A-1": _location(1, "A"), "A-2": _location(2, "A")}
    inventory = [_stock("P", "A-1", 0), _stock("Q", "A-1"), _stock("R", "A-2", 0)]
    view = _view(_import(locations, inventory))

    # (A-1, P) has stock 0: no label. A-2 holds only a zero row: it is empty, no label.
    assert _labels(view) == {"A": [("A-1", "Q")]}


def test_fr48_labels_list_an_aisle_without_stock() -> None:
    locations = {"C-1": _location(1, "C"), "A-1": _location(5, "A"), "B-1": _location(2, "B")}
    view = _view(_import(locations, [_stock("P", "A-1"), _stock("Q", "B-1")]))

    assert [aisle.aisle for aisle in view.aisles] == ["A", "B", "C"]
    assert _labels(view) == {"A": [("A-1", "P")], "B": [("B-1", "Q")], "C": []}


def test_fr48_labels_exclude_virtual_locations() -> None:
    locations = {"A-1": _location(1, "A")}
    inventory = [_stock("P", "A-1"), _stock("P", "FLSKRS", 9)]
    view = _view(_import(locations, inventory, virtual=["FLSKRS"]))

    assert _labels(view) == {"A": [("A-1", "P")]}


def test_fr48_labels_carry_the_plans_best_marks() -> None:
    locations = {"A-1": _location(1, "A"), "B-1": _location(2, "B")}
    data = _import(locations, [_stock("P", "A-1"), _stock("Q", "B-1")])
    state = PlanState(best_marks=[AisleMark(aisle="A")])

    best = {
        label.location.code: label.location.is_best
        for aisle in _view(data, state).aisles
        for label in aisle.labels
    }
    assert best == {"A-1": True, "B-1": False}
