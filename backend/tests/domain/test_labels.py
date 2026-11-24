"""FR-48: the location labels of an import, per aisle in Walk Path order (SM-7)."""

from decimal import Decimal

from swp.domain.import_data import ImportData, LocationData
from swp.domain.labels import LabelsView, build_labels


def _location(walk_path: int, aisle: str, level: str = "1") -> LocationData:
    return LocationData(
        walk_path=Decimal(walk_path), aisle=aisle, level=level, section=None, position=None
    )


def _import(locations: dict[str, LocationData], virtual: list[str] | None = None) -> ImportData:
    return ImportData(
        locations=locations,
        inventory=[],
        parts={},
        transactions=[],
        virtual_locations=virtual or [],
    )


def _codes(view: LabelsView) -> dict[str, list[str]]:
    return {aisle.aisle: [ref.code for ref in aisle.locations] for aisle in view.aisles}


def test_fr48_labels_in_walk_path_order() -> None:
    view = build_labels(
        _import(
            {
                "A-3": _location(100, "A"),
                "A-10": _location(9, "A"),
                "A-2b": _location(20, "A", "2"),
                "A-2a": _location(20, "A", "1"),
                "A-1": _location(30, "A"),
            }
        )
    )

    # Walk Path is numeric (9 before 20 before 100); the tie at 20 breaks by code.
    assert _codes(view) == {"A": ["A-10", "A-2a", "A-2b", "A-1", "A-3"]}
    first = view.aisles[0].locations[0]
    assert (first.aisle, first.level, first.is_best) == ("A", "1", False)


def test_fr48_labels_exclude_virtual_locations(data: ImportData) -> None:
    view = build_labels(_import(data.locations, virtual=["FLSKRS"]))

    codes = [code for aisle in _codes(view).values() for code in aisle]
    assert "FLSKRS" not in codes
    assert sorted(codes) == sorted(data.locations)


def test_fr48_labels_list_every_aisle() -> None:
    view = build_labels(
        _import({"C-1": _location(1, "C"), "A-1": _location(5, "A"), "B-1": _location(2, "B")})
    )

    assert [aisle.aisle for aisle in view.aisles] == ["A", "B", "C"]
    assert _codes(view) == {"A": ["A-1"], "B": ["B-1"], "C": ["C-1"]}
