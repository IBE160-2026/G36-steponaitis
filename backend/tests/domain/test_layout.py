"""FR-42/AD-15: the wall layout of an import, from all three sources (SM-7)."""

from decimal import Decimal

import pytest

from swp.domain.import_data import ImportData, LocationData
from swp.domain.layout import AisleLayout, LayoutView, build_layout
from swp.domain.ordering import identifier_key, level_key


def _location(
    walk_path: int, aisle: str, level: str, section: str | None = None, position: str | None = None
) -> LocationData:
    return LocationData(
        walk_path=Decimal(walk_path), aisle=aisle, level=level, section=section, position=position
    )


def _import(locations: dict[str, LocationData], virtual: list[str] | None = None) -> ImportData:
    return ImportData(
        locations=locations,
        inventory=[],
        parts={},
        transactions=[],
        virtual_locations=virtual or [],
    )


def _grid(
    aisle: str, sections: list[str], levels: list[str], positions: list[str]
) -> dict[str, LocationData]:
    """A full grid with Section/Position set; Walk Path follows the code order."""
    locations: dict[str, LocationData] = {}
    for section in sections:
        for level in levels:
            for position in positions:
                code = f"{aisle}-{section}-{level}-{position}"
                locations[code] = _location(len(locations) * 10, aisle, level, section, position)
    return locations


def _codes(aisle: AisleLayout) -> list[str]:
    return [cell.location.code for cell in aisle.cells if cell.location is not None]


def _only(view: LayoutView) -> AisleLayout:
    assert len(view.aisles) == 1
    return view.aisles[0]


def test_fr42_layout_identifier_key_numeric_only_when_all_digits() -> None:
    assert sorted(["10", "2", "1"], key=identifier_key(["10", "2", "1"])) == ["1", "2", "10"]
    assert sorted(["10", "2", "x"], key=identifier_key(["10", "2", "x"])) == ["10", "2", "x"]
    assert sorted(["2", "10"], key=level_key(["2", "10"])) == ["2", "10"]


def test_fr42_layout_answer_key_codes_without_columns(data: ImportData) -> None:
    stripped = _import(
        {
            code: location.model_copy(update={"section": None, "position": None})
            for code, location in data.locations.items()
        }
    )

    view = build_layout(stripped)

    assert [aisle.aisle for aisle in view.aisles] == ["A", "B", "C", "D"]
    aisle = view.aisles[0]
    assert aisle.source == "code"
    assert len(aisle.runs) == 1
    run = aisle.runs[0]
    assert run.levels == ["3", "2", "1"]
    assert run.columns == 3
    assert [span.model_dump() for span in run.sections] == [
        {"section": "01", "first_column": 0, "columns": 3}
    ]
    assert not any(cell.gap for cell in aisle.cells)
    first = aisle.cells[0]
    assert (first.run, first.row, first.column) == (0, 0, 0)
    assert first.location is not None
    assert first.location.code == "A-01-03-01"
    assert (first.location.section, first.location.position) == (None, None)
    assert first.location.is_best is False
    assert [aisle.walk_path_first, aisle.walk_path_last] == [Decimal(0), Decimal(80)]
    assert view.aisles[1].runs[0].levels == ["4", "3", "2", "1"]


def test_fr42_layout_answer_key_with_columns(data: ImportData) -> None:
    view = build_layout(data)

    assert {aisle.source for aisle in view.aisles} == {"columns"}
    assert view.aisles[0].runs[0].sections[0].section == "1"


def test_fr42_layout_other_pattern_falls_to_walk_path() -> None:
    view = build_layout(
        _import(
            {
                "X300": _location(30, "X", "1"),
                "X100": _location(10, "X", "1"),
                "X200": _location(20, "X", "2"),
                "X150": _location(10, "X", "1"),
                "X250": _location(5, "X", "2"),
            }
        )
    )

    aisle = _only(view)
    assert aisle.source == "walk_path"
    assert len(aisle.runs) == 1
    assert aisle.runs[0].sections == []
    assert aisle.runs[0].levels == ["2", "1"]
    assert aisle.runs[0].columns == 3
    rows = [
        (cell.row, cell.column, cell.location.code if cell.location else None)
        for cell in aisle.cells
    ]
    assert rows == [
        (0, 0, "X250"),
        (0, 1, "X200"),
        (1, 0, "X100"),
        (1, 1, "X150"),
        (1, 2, "X300"),
    ]
    assert not any(cell.gap for cell in aisle.cells)
    assert (aisle.walk_path_first, aisle.walk_path_last) == (Decimal(5), Decimal(30))


def test_fr42_layout_numeric_sort_of_levels_and_sections() -> None:
    view = build_layout(_import(_grid("A", ["10", "2"], ["1", "10", "2"], ["1"])))

    aisle = _only(view)
    assert aisle.source == "columns"
    assert [run.levels for run in aisle.runs] == [["10", "2", "1"], ["10", "2", "1"]]
    assert [[span.section for span in run.sections] for run in aisle.runs] == [["2"], ["10"]]


def test_fr42_layout_text_values_sort_as_str() -> None:
    view = build_layout(_import(_grid("A", ["b", "a", "C"], ["1"], ["y", "x"])))

    run = _only(view).runs[0]
    assert [span.section for span in run.sections] == ["C", "a"]
    assert _codes(_only(view))[:2] == ["A-C-1-x", "A-C-1-y"]


def test_fr42_layout_duplicate_cell_falls_to_code() -> None:
    locations = _grid("A", ["1"], ["1"], ["1", "2"])
    locations["A-1-1-2"] = locations["A-1-1-2"].model_copy(update={"position": "1"})

    aisle = _only(build_layout(_import(locations)))

    assert aisle.source == "code"
    assert len(aisle.cells) == 2


def test_fr42_layout_duplicate_cell_and_code_falls_to_walk_path() -> None:
    locations = {
        "A-1-1-1": _location(0, "A", "1", "1", "1"),
        "A-1-2-1": _location(10, "A", "1", "1", "1"),
    }

    aisle = _only(build_layout(_import(locations)))

    assert aisle.source == "walk_path"
    assert len(aisle.cells) == 2


def test_fr42_layout_code_needs_the_aisle_prefix() -> None:
    locations = {"B-1-1-1": _location(0, "A", "1"), "B-1-1-2": _location(10, "A", "1")}

    assert _only(build_layout(_import(locations))).source == "walk_path"


def test_fr42_layout_source_is_decided_per_aisle() -> None:
    locations = {**_grid("A", ["1"], ["1"], ["1"]), "B9": _location(100, "B", "1")}

    view = build_layout(_import(locations))

    assert [(aisle.aisle, aisle.source) for aisle in view.aisles] == [
        ("A", "columns"),
        ("B", "walk_path"),
    ]


@pytest.mark.parametrize(
    ("sections", "split"),
    [(1, [1]), (4, [2, 2]), (5, [3, 2])],
)
def test_fr42_layout_two_run_split(sections: int, split: list[int]) -> None:
    names = [str(n) for n in range(1, sections + 1)]

    aisle = _only(build_layout(_import(_grid("A", names, ["1", "2"], ["1", "2"]))))

    assert [len(run.sections) for run in aisle.runs] == split
    assert [run.columns for run in aisle.runs] == [2 * count for count in split]
    assert aisle.runs[0].sections[0].section == "1"
    if len(split) == 2:
        assert aisle.runs[1].sections[0].model_dump() == {
            "section": str(split[0] + 1),
            "first_column": 0,
            "columns": 2,
        }


def test_fr42_layout_gaps_pad_each_section_to_its_positions() -> None:
    locations = _grid("A", ["1"], ["1", "2"], ["1", "2", "3"])
    locations.update(_grid("A", ["2"], ["1"], ["1", "2"]))
    locations["A-2-2-1"] = _location(500, "A", "2", "2", "1")
    del locations["A-1-2-3"]

    aisle = _only(build_layout(_import(locations)))

    run0, run1 = aisle.runs
    assert run0.sections[0].columns == 3
    assert run1.sections[0].columns == 2
    grid = {
        (cell.run, cell.row, cell.column): cell.location.code if cell.location else None
        for cell in aisle.cells
    }
    assert grid == {
        (0, 0, 0): "A-1-2-1",
        (0, 0, 1): "A-1-2-2",
        (0, 0, 2): None,
        (0, 1, 0): "A-1-1-1",
        (0, 1, 1): "A-1-1-2",
        (0, 1, 2): "A-1-1-3",
        (1, 0, 0): "A-2-2-1",
        (1, 0, 1): None,
        (1, 1, 0): "A-2-1-1",
        (1, 1, 1): "A-2-1-2",
    }
    assert all(cell.gap == (cell.location is None) for cell in aisle.cells)
    keys = [(cell.run, cell.row, cell.column) for cell in aisle.cells]
    assert keys == sorted(keys)


def test_fr42_layout_one_cell_per_location_and_no_virtual(data: ImportData) -> None:
    virtual = _import(data.locations, virtual=["FLSKRS"])

    view = build_layout(virtual)

    codes = [code for aisle in view.aisles for code in _codes(aisle)]
    assert sorted(codes) == sorted(data.locations)
    assert "FLSKRS" not in codes
    json = view.model_dump(mode="json")
    assert json["aisles"][0]["walk_path_last"] == "80"
    assert set(json["aisles"][0]["cells"][0]) == {"run", "row", "column", "gap", "location"}


def test_fr42_layout_sparse_grid_falls_to_next_source(data: ImportData) -> None:
    # One section, levels 1..4, each level on its own three positions: a 4 x 12 grid for 12
    # locations, more than twice the locations.
    locations = {
        f"A-1-{level}-{position}": _location(
            level * 10 + position, "A", str(level), "1", f"{level}{position}"
        )
        for level in range(1, 5)
        for position in range(1, 4)
    }

    aisle = _only(build_layout(_import(locations)))

    assert aisle.source == "code"
    assert aisle.runs[0].columns == 3
    assert not any(cell.gap for cell in aisle.cells)
    assert {a.source for a in build_layout(data).aisles} == {"columns"}


def test_fr42_layout_sparse_code_grid_falls_to_walk_path() -> None:
    locations = {
        f"A-1-{level}-{level}{position}": _location(level * 10 + position, "A", str(level))
        for level in range(1, 5)
        for position in range(1, 4)
    }

    aisle = _only(build_layout(_import(locations)))

    assert aisle.source == "walk_path"
    assert len(aisle.cells) == 12


def test_fr42_layout_section_order_is_import_wide() -> None:
    locations = {**_grid("A", ["2", "10"], ["1"], ["1"]), **_grid("B", ["x"], ["1"], ["1"])}

    aisle = build_layout(_import(locations)).aisles[0]

    assert [span.section for run in aisle.runs for span in run.sections] == ["10", "2"]


def test_fr42_layout_level_order_is_import_wide() -> None:
    locations = {**_grid("A", ["1"], ["2", "10"], ["1"]), **_grid("B", ["1"], ["x"], ["1"])}

    aisle = build_layout(_import(locations)).aisles[0]

    assert aisle.runs[0].levels == ["2", "10"]


@pytest.mark.parametrize("code", ["A-01-01", "A-01-01-01-01", "A--01-01"])
def test_fr42_layout_malformed_code_falls_to_walk_path(code: str) -> None:
    locations = {code: _location(0, "A", "1"), "A-02-01-01": _location(10, "A", "1")}

    assert _only(build_layout(_import(locations))).source == "walk_path"


def test_fr42_layout_partial_columns_fall_to_code() -> None:
    locations = _grid("A", ["1"], ["1"], ["1", "2"])
    locations["A-1-1-2"] = locations["A-1-1-2"].model_copy(update={"section": None})

    assert _only(build_layout(_import(locations))).source == "code"


def test_fr42_layout_code_rows_come_from_the_level_column() -> None:
    locations = {
        "A-01-09-01": _location(0, "A", "1"),
        "A-01-09-02": _location(10, "A", "2"),
    }

    aisle = _only(build_layout(_import(locations)))

    assert aisle.source == "code"
    assert aisle.runs[0].levels == ["2", "1"]
    rows = [
        (cell.row, cell.column, cell.location.code if cell.location else None)
        for cell in aisle.cells
    ]
    assert rows == [(0, 0, None), (0, 1, "A-01-09-02"), (1, 0, "A-01-09-01"), (1, 1, None)]
