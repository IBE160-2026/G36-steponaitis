"""FR-3/FR-4: header, required columns and value checks of one import file (domain only)."""

from datetime import date, datetime
from decimal import Decimal

import pytest

from swp.domain.analysis import period_for
from swp.domain.errors import DomainError
from swp.domain.import_ import (
    EARLIEST_DATE,
    REQUIRED_COLUMNS,
    Cell,
    CheckedFile,
    RawSheet,
    check_file,
    check_import,
    unreadable_file,
)

LOC_HEADER: tuple[Cell, ...] = ("Location", "Walk Path", "Aisle", "Level")
INV_HEADER: tuple[Cell, ...] = ("Part", "Part Description", "Quantity", "Location")
TX_HEADER: tuple[Cell, ...] = ("Transaction Type", "Part", "Location", "Transaction Code", "Date")


def _sheet(*rows: tuple[Cell, ...]) -> RawSheet:
    return RawSheet(rows=tuple(rows))


def _locations(*rows: tuple[Cell, ...]) -> CheckedFile:
    return check_file("locations", "Locations.xlsx", _sheet(LOC_HEADER, *rows))


def _inventory(*rows: tuple[Cell, ...]) -> CheckedFile:
    return check_file("inventory", "Inventory.xlsx", _sheet(INV_HEADER, *rows))


def _transactions(*rows: tuple[Cell, ...]) -> CheckedFile:
    return check_file("transactions", "transactions.xlsx", _sheet(TX_HEADER, *rows))


def _messages(checked: CheckedFile) -> list[str]:
    return [error.message for error in checked.check.errors]


def _quantity(value: Cell) -> CheckedFile:
    return _inventory(("P1", "Bolt", value, "A-01"))


def _walk_path(value: Cell) -> CheckedFile:
    return _locations(("A-01", value, "A", "1"))


def _date(value: Cell) -> CheckedFile:
    return _transactions(("Issue Part", "P1", "FLSKRS", "7", value))


def test_fr3_required_columns_match_fr3() -> None:
    assert REQUIRED_COLUMNS["locations"] == ("Location", "Walk Path", "Aisle", "Level")
    assert REQUIRED_COLUMNS["inventory"] == ("Part", "Part Description", "Quantity", "Location")
    assert REQUIRED_COLUMNS["transactions"] == (
        "Transaction Type",
        "Part",
        "Location",
        "Transaction Code",
        "Date",
    )


def test_fr3_valid_file_passes_with_parsed_rows() -> None:
    checked = _locations(("A-01-01-01", 0, "A", "1"), ("A-01-01-02", "10", "A", 1))

    assert checked.check.status == "passed"
    assert checked.check.errors == []
    assert [row.row for row in checked.rows] == [2, 3]
    assert checked.rows[1].values["Walk Path"] == Decimal("10")
    assert checked.rows[1].values["Level"] == "1"
    assert checked.rows[0].values["Warehouse"] is None


def test_fr3_missing_column_names_file_and_column() -> None:
    checked = check_file(
        "inventory",
        "Inventory.xlsx",
        _sheet(("Part", "Part Description", "Location"), ("P1", "Bolt", "A-01")),
    )

    assert checked.check.status == "failed"
    assert checked.rows == ()
    [error] = checked.check.errors
    assert error.row is None
    assert error.column == "Quantity"
    assert error.message == (
        "Inventory.xlsx is missing the column Quantity. "
        "Required: Part, Part Description, Quantity, Location."
    )


def test_fr3_present_columns_still_checked_when_one_is_missing() -> None:
    checked = check_file(
        "inventory",
        "Inventory.xlsx",
        _sheet(("Part", "Part Description", "Location"), (None, "Bolt", "A-01")),
    )

    assert [e.column for e in checked.check.errors] == ["Quantity", "Part"]


def test_fr3_duplicated_required_column_fails() -> None:
    checked = check_file(
        "locations",
        "Locations.xlsx",
        _sheet(("Location", "Walk Path", "location ", "Aisle", "Level"), ("A", 1, "A", "A", "1")),
    )

    [error] = checked.check.errors
    assert (error.row, error.column) == (None, "Location")
    assert error.message == "Locations.xlsx has the column Location more than once."


def test_fr3_duplicated_optional_column_uses_first() -> None:
    checked = check_file(
        "inventory",
        "Inventory.xlsx",
        _sheet((*INV_HEADER, "Warehouse", "WAREHOUSE"), ("P1", "Bolt", 1, "A-01", "NO", "SE")),
    )

    assert checked.check.status == "passed"
    assert checked.rows[0].values["Warehouse"] == "NO"


def test_fr3_header_matches_trimmed_and_ignoring_case() -> None:
    checked = check_file(
        "locations",
        "Locations.csv",
        _sheet(("  LOCATION", "walk path ", "aisle", "Level ", "Extra"), ("A-01", 0, "A", 1)),
    )

    assert checked.check.status == "passed"
    assert set(checked.rows[0].values) == {
        "Location",
        "Walk Path",
        "Aisle",
        "Level",
        "Section",
        "Position",
        "Warehouse",
    }


def test_fr3_header_is_first_non_blank_row() -> None:
    checked = check_file(
        "locations",
        "Locations.xlsx",
        _sheet((), (None, "  "), LOC_HEADER, ("A-01", 0, "A", 1), (), ("A-02", None, "A", 1)),
    )

    # Header is sheet row 3 = row 1; the blank sheet row 5 still counts.
    assert [e.message for e in checked.check.errors] == [
        "Locations.xlsx · row 4 · column Walk Path is blank."
    ]


def test_fr4_blank_required_cell() -> None:
    checked = _inventory(("  ", "Bolt", 1, "A-01"), (None, "Nut", 1, "A-01"))

    assert [(e.row, e.column) for e in checked.check.errors] == [(2, "Part"), (3, "Part")]
    assert _messages(checked)[0] == "Inventory.xlsx · row 2 · column Part is blank."


def test_fr4_quantity_not_a_number_or_negative() -> None:
    assert _messages(_quantity("abc")) == [
        "Inventory.xlsx · row 2 · column Quantity: “abc” is not a number."
    ]
    assert _messages(_quantity(-1)) == [
        "Inventory.xlsx · row 2 · column Quantity: “-1” is negative."
    ]
    assert _messages(_quantity("-3")) == [
        "Inventory.xlsx · row 2 · column Quantity: “-3” is negative."
    ]


def test_fr4_thousands_separator_rejected() -> None:
    for value in ("1,234.5", "1 234", "1.234,5"):
        assert _messages(_quantity(value)) == [
            f"Inventory.xlsx · row 2 · column Quantity: “{value}” uses a thousands separator."
        ]


@pytest.mark.parametrize(
    ("cell", "expected"),
    [
        ("2,5", Decimal("2.5")),
        ("10", Decimal("10")),
        (Decimal("2.5"), Decimal("2.5")),
        (" 7 ", Decimal("7")),
        ("1,234", Decimal("1.234")),
    ],
)
def test_fr4_numbers_accepted(cell: Cell, expected: Decimal) -> None:
    checked = _quantity(cell)

    assert checked.check.status == "passed"
    assert checked.rows[0].values["Quantity"] == expected


def test_fr4_walk_path_may_be_negative() -> None:
    checked = _walk_path("-3")

    assert checked.check.status == "passed"
    assert checked.rows[0].values["Walk Path"] == Decimal("-3")


def test_fr4_walk_path_not_a_number() -> None:
    assert _messages(_walk_path("ten")) == [
        "Locations.xlsx · row 2 · column Walk Path: “ten” is not a number."
    ]


@pytest.mark.parametrize(
    "cell",
    [
        datetime(2026, 9, 30, 13, 0),
        date(2026, 9, 30),
        "2026-09-30 13:00",
        "2026-09-30",
        "30.09.2026",
        "30.09.2026 13:00",
        "2026-09-30T13:00+02:00",
    ],
)
def test_fr4_date_formats(cell: Cell) -> None:
    checked = _date(cell)

    assert checked.check.status == "passed"
    assert checked.rows[0].values["Date"] == date(2026, 9, 30)


@pytest.mark.parametrize("cell", ["09/30/2026", "2026-13-02", 45000, "2026-09-30 later"])
def test_fr4_unreadable_date(cell: Cell) -> None:
    assert _messages(_date(cell)) == [
        f"transactions.xlsx · row 2 · column Date: “{cell}” is not a valid date."
    ]


@pytest.mark.parametrize(
    "cell",
    ["0001-01-15", "31.12.1899", date(1899, 12, 31), datetime(1, 1, 15, 8, 30)],
)
def test_fr4_date_before_1900_is_a_cell_error(cell: Cell) -> None:
    # Epic 1 retro R2: a year-1 date as data-as-of made `period_for` raise (500).
    assert _messages(_date(cell)) == [
        f"transactions.xlsx · row 2 · column Date: “{cell}” is before 1900-01-01."
    ]


def test_fr4_earliest_date_passes_and_gives_a_period() -> None:
    checked = _date("1900-01-01")

    assert checked.check.status == "passed"
    assert checked.rows[0].values["Date"] == EARLIEST_DATE
    # A period of 100 years, far more than any real setting, still has a start.
    assert period_for(EARLIEST_DATE, 12 * 100) == (date(1800, 1, 2), EARLIEST_DATE)


@pytest.mark.parametrize("cell", ["2026-10-02", "02.10.2026 07:00", datetime(2999, 1, 1)])
def test_fr4_date_after_the_latest_date_is_a_cell_error(cell: Cell) -> None:
    checked = check_file(
        "transactions",
        "transactions.xlsx",
        _sheet(TX_HEADER, ("Issue Part", "P1", "FLSKRS", "7", cell)),
        latest_date=date(2026, 10, 1),
    )

    assert _messages(checked) == [
        f"transactions.xlsx · row 2 · column Date: “{cell}” is in the future."
    ]


def test_fr4_date_on_the_latest_date_passes() -> None:
    checked = check_file(
        "transactions",
        "transactions.xlsx",
        _sheet(TX_HEADER, ("Issue Part", "P1", "FLSKRS", "7", "2026-10-01")),
        latest_date=date(2026, 10, 1),
    )

    assert checked.check.status == "passed"


def test_fr4_no_latest_date_sets_no_upper_limit() -> None:
    assert _date("9999-12-31").check.status == "passed"


def test_fr4_non_integral_identifier() -> None:
    assert _messages(_inventory((Decimal("1.5"), "Bolt", 1, "A-01"))) == [
        "Inventory.xlsx · row 2 · column Part: “1.5” is not a whole number."
    ]
    assert _messages(_inventory((datetime(2026, 1, 2), "Bolt", 1, "A-01"))) == [
        "Inventory.xlsx · row 2 · column Part: “2026-01-02 00:00:00” is not a valid code."
    ]


def test_fr4_identifiers_kept_as_exact_text() -> None:
    checked = _inventory(
        ("0100", "Bolt", 1, " A-01-01-01-A1 "),
        (Decimal("3.0"), "Nut", 1, "A-01"),
        (42, "X", 1, "B"),
    )

    assert [row.values["Part"] for row in checked.rows] == ["0100", "3", "42"]
    assert checked.rows[0].values["Location"] == "A-01-01-01-A1"


def test_fr4_text_columns_trimmed_and_numbers_become_text() -> None:
    checked = _inventory(("P1", Decimal("2.50"), 1, "A"), ("P2", "  Brake pad ", 1, "A"))

    assert [row.values["Part Description"] for row in checked.rows] == ["2.50", "Brake pad"]


def test_fr4_duplicate_location_code() -> None:
    checked = _locations(
        ("A-01-01-01", 0, "A", 1),
        ("A-01-01-02", 10, "A", 1),
        ("A-01-01-03", 20, "A", 1),
        ("A-01-01-04", 30, "A", 1),
        ("A-01-01-01", 40, "A", 1),
    )

    [error] = checked.check.errors
    assert (error.row, error.column) == (6, "Location")
    assert error.message == (
        "Locations.xlsx · row 6 · column Location: “A-01-01-01” appears more than once "
        "in the Locations file (first in row 2)."
    )


def test_fr4_row_numbers_use_thousands_separators() -> None:
    rows: list[tuple[Cell, ...]] = [(f"A-{i}", i, "A", 1) for i in range(2, 1_201)]
    rows[-1] = ("A-1200", "x", "A", 1)
    rows.append(("A-2", 0, "A", 1))

    assert _messages(_locations(*rows)) == [
        "Locations.xlsx · row 1,200 · column Walk Path: “x” is not a number.",
        "Locations.xlsx · row 1,201 · column Location: “A-2” appears more than once "
        "in the Locations file (first in row 2).",
    ]


@pytest.mark.parametrize(
    "sheet",
    [_sheet(), _sheet((), (None,)), _sheet(INV_HEADER), _sheet(INV_HEADER, (), ("  ",))],
)
def test_fr4_empty_file_rejected(sheet: RawSheet) -> None:
    checked = check_file("inventory", "Inventory.xlsx", sheet)

    assert checked.check.status == "failed"
    assert _messages(checked) == ["Inventory.xlsx has no data rows."]


def test_fr4_reports_every_error_capped_at_20() -> None:
    checked = _inventory(*[(None, "Bolt", 1, "A-01") for _ in range(25)])

    assert len(checked.check.errors) == 20
    assert checked.check.more_count == 5
    assert [e.row for e in checked.check.errors] == list(range(2, 22))


def test_fr4_unreadable_file_names_the_file() -> None:
    checked = unreadable_file("inventory", "Inventory.pdf")

    assert checked.check.status == "failed"
    assert _messages(checked) == ["Inventory.pdf can't be read as .xlsx or .csv."]


def test_fr4_import_invalid_details_for_every_file() -> None:
    good_locations = _locations(("A-01", 0, "A", 1))
    bad_inventory = _quantity("abc")
    good_transactions = _date("2026-09-30")

    with pytest.raises(DomainError) as raised:
        check_import([good_transactions, bad_inventory, good_locations])

    error = raised.value
    assert error.code == "import_invalid"
    assert str(error) == "Import stopped: nothing was saved."
    assert [d["file_role"] for d in error.details] == ["locations", "inventory", "transactions"]
    assert [d["status"] for d in error.details] == ["passed", "failed", "passed"]
    for detail in error.details:
        assert set(detail) == {"file_role", "file_name", "status", "errors", "more_count"}
    assert error.details[1]["errors"] == [
        {
            "row": 2,
            "column": "Quantity",
            "message": "Inventory.xlsx · row 2 · column Quantity: “abc” is not a number.",
        }
    ]


def test_fr4_check_import_orders_passing_files_by_role() -> None:
    files = [_date("2026-09-30"), _locations(("A-01", 0, "A", 1)), _quantity(1)]

    ordered = check_import(files)

    assert [f.check.file_role for f in ordered] == ["locations", "inventory", "transactions"]
