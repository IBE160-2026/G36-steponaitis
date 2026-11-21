"""FR-5/FR-6/FR-7: cross-file checks, normalization and data-as-of (domain only)."""

from datetime import date, datetime
from decimal import Decimal

import pytest
from pydantic import BaseModel

from swp.domain.errors import DomainError
from swp.domain.import_ import (
    Cell,
    CheckedFile,
    NormalizedImport,
    RawSheet,
    check_file,
    check_import,
    normalize_import,
)
from swp.domain.values import Dec, dec_text

LOC_HEADER: tuple[Cell, ...] = ("Location", "Walk Path", "Aisle", "Level")
INV_HEADER: tuple[Cell, ...] = ("Part", "Part Description", "Quantity", "Location")
TX_HEADER: tuple[Cell, ...] = ("Transaction Type", "Part", "Location", "Transaction Code", "Date")

GOOD_LOCATIONS: tuple[tuple[Cell, ...], ...] = (("A-01", 0, "A", 1), ("A-02", 10, "A", 2))
GOOD_INVENTORY: tuple[tuple[Cell, ...], ...] = (("P1", "Bolt", 2, "A-01"),)
GOOD_TRANSACTIONS: tuple[tuple[Cell, ...], ...] = (("Issue Part", "P1", "FLSKRS", 7, "2026-09-30"),)


def _sheet(header: tuple[Cell, ...], rows: tuple[tuple[Cell, ...], ...]) -> RawSheet:
    return RawSheet(rows=(header, *rows))


def _files(
    locations: tuple[tuple[Cell, ...], ...] = GOOD_LOCATIONS,
    inventory: tuple[tuple[Cell, ...], ...] = GOOD_INVENTORY,
    transactions: tuple[tuple[Cell, ...], ...] = GOOD_TRANSACTIONS,
    *,
    loc_header: tuple[Cell, ...] = LOC_HEADER,
    inv_header: tuple[Cell, ...] = INV_HEADER,
    tx_header: tuple[Cell, ...] = TX_HEADER,
) -> list[CheckedFile]:
    return [
        check_file("locations", "Locations.xlsx", _sheet(loc_header, locations)),
        check_file("inventory", "Inventory.xlsx", _sheet(inv_header, inventory)),
        check_file("transactions", "transactions.xlsx", _sheet(tx_header, transactions)),
    ]


def _invalid(files: list[CheckedFile]) -> list[dict[str, object]]:
    with pytest.raises(DomainError) as raised:
        check_import(files)
    assert raised.value.code == "import_invalid"
    assert [d["file_role"] for d in raised.value.details] == [
        "locations",
        "inventory",
        "transactions",
    ]
    return raised.value.details


def _messages(detail: dict[str, object]) -> list[str]:
    errors = detail["errors"]
    assert isinstance(errors, list)
    return [error["message"] for error in errors]


def _normalize(files: list[CheckedFile]) -> NormalizedImport:
    return normalize_import(check_import(files))


def test_fr5_unknown_inventory_location_names_file_row_location() -> None:
    details = _invalid(_files(inventory=(("P1", "Bolt", 2, "A-01"), ("P2", "Nut", 1, "K-01"))))

    assert [d["status"] for d in details] == ["passed", "failed", "passed"]
    assert details[1]["errors"] == [
        {
            "row": 3,
            "column": "Location",
            "message": (
                "Inventory.xlsx · row 3 · column Location: “K-01” is not in the Locations file."
            ),
        }
    ]


def test_fr5_shelf_lines_checked_ignoring_case() -> None:
    details = _invalid(
        _files(
            transactions=(
                ("move to REPAIR", "P1", "K-01", 1, "2026-09-01"),
                (" Return to Stock ", "P1", "K-01", 2, "2026-09-02"),
                ("Receipt", "P1", "K-01", 3, "2026-09-03"),
                ("Move to Repair", "P1", "A-01", 4, "2026-09-04"),
            )
        )
    )

    assert [d["status"] for d in details] == ["passed", "passed", "failed"]
    assert _messages(details[2]) == [
        f"transactions.xlsx · row {row} · column Location: “K-01” is not in the Locations file."
        for row in (2, 3, 4)
    ]


def test_fr5_issue_part_at_virtual_location_accepted() -> None:
    result = _normalize(_files(transactions=(("Issue Part", "P1", "FLSKRS", 7, "2026-09-30"),)))

    assert [t.type for t in result.data.transactions] == ["issue_part"]


def test_fr5_other_types_accepted_and_ignored() -> None:
    result = _normalize(
        _files(
            transactions=(
                ("Issue Part", "P1", "FLSKRS", 7, "2026-09-01"),
                ("Count", "P1", "ZZZ", 8, "2026-10-05"),
            )
        )
    )

    assert [t.type for t in result.data.transactions] == ["issue_part"]
    assert result.data_as_of == date(2026, 10, 5)


def test_fr5_locations_failed_marks_others_not_checked() -> None:
    details = _invalid(
        _files(
            locations=(("A-01", None, "A", 1),),
            inventory=(("P1", "Bolt", 2, "K-01"),),
        )
    )

    assert [d["status"] for d in details] == ["failed", "not_checked", "not_checked"]
    assert details[1]["errors"] == [] and details[2]["errors"] == []
    assert details[1]["more_count"] == 0


def test_fr6_more_than_one_warehouse_in_a_file() -> None:
    details = _invalid(
        _files(
            locations=(("A-01", 0, "A", 1, "NO"), ("A-02", 10, "A", 2, "SE")),
            loc_header=(*LOC_HEADER, "Warehouse"),
        )
    )

    assert [d["status"] for d in details] == ["failed", "passed", "passed"]
    assert details[0]["errors"] == [
        {
            "row": None,
            "column": "Warehouse",
            "message": (
                "Locations.xlsx holds more than one warehouse. One import holds one warehouse."
            ),
        }
    ]


def test_fr6_different_warehouse_across_files() -> None:
    details = _invalid(
        _files(
            locations=(("A-01", 0, "A", 1, "NO"),),
            inventory=(("P1", "Bolt", 2, "A-01", "SE"),),
            transactions=(("Issue Part", "P1", "FLSKRS", 7, "2026-09-30", "NO"),),
            loc_header=(*LOC_HEADER, "Warehouse"),
            inv_header=(*INV_HEADER, "Warehouse"),
            tx_header=(*TX_HEADER, "Warehouse"),
        )
    )

    assert [d["status"] for d in details] == ["passed", "failed", "passed"]
    assert _messages(details[1]) == [
        "Inventory.xlsx holds a different warehouse than Locations.xlsx. "
        "One import holds one warehouse."
    ]


def test_fr6_warehouse_error_comes_before_row_errors() -> None:
    details = _invalid(
        _files(
            locations=(("A-01", 0, "A", 1, "NO"),),
            inventory=(("P1", "Bolt", 2, "K-01", "SE"),),
            loc_header=(*LOC_HEADER, "Warehouse"),
            inv_header=(*INV_HEADER, "Warehouse"),
        )
    )

    errors = details[1]["errors"]
    assert isinstance(errors, list)
    assert [e["column"] for e in errors] == ["Warehouse", "Location"]


def test_fr6_warehouse_checked_when_locations_failed() -> None:
    details = _invalid(
        _files(
            locations=(("A-01", None, "A", 1),),
            inventory=(("P1", "Bolt", 2, "A-01", "NO"),),
            transactions=(("Issue Part", "P1", "FLSKRS", 7, "2026-09-30", "SE"),),
            inv_header=(*INV_HEADER, "Warehouse"),
            tx_header=(*TX_HEADER, "Warehouse"),
        )
    )

    assert [d["status"] for d in details] == ["failed", "not_checked", "failed"]
    assert _messages(details[2]) == [
        "transactions.xlsx holds a different warehouse than Inventory.xlsx. "
        "One import holds one warehouse."
    ]


def test_fr6_blank_warehouse_cells_never_fail() -> None:
    result = _normalize(
        _files(
            locations=(("A-01", 0, "A", 1, None), ("A-02", 10, "A", 2, " ")),
            inventory=(("P1", "Bolt", 2, "A-01", "NO"),),
            loc_header=(*LOC_HEADER, "Warehouse"),
            inv_header=(*INV_HEADER, "Warehouse"),
        )
    )

    assert list(result.data.locations) == ["A-01", "A-02"]


def test_fr6_missing_warehouse_column_ok() -> None:
    result = _normalize(
        _files(
            locations=(("A-01", 0, "A", 1, "NO"),),
            transactions=(("Issue Part", "P1", "FLSKRS", 7, "2026-09-30", "NO"),),
            loc_header=(*LOC_HEADER, "Warehouse"),
            tx_header=(*TX_HEADER, "Warehouse"),
        )
    )

    assert list(result.data.locations) == ["A-01"]


def test_fr6_text_trimmed_including_nbsp_keeps_case() -> None:
    result = _normalize(
        _files(
            inventory=((" Ab-01 ", " Brake Pad ", 2, "A-01"),),
            transactions=(("Issue Part", " Ab-01 ", "FLSKRS", 7, "2026-09-30"),),
        )
    )

    assert result.data.parts == {"Ab-01": "Brake Pad"}
    assert result.data.inventory[0].part == "Ab-01"
    assert result.data.transactions[0].part == "Ab-01"


def test_fr6_codes_kept_as_exact_text() -> None:
    result = _normalize(
        _files(
            locations=(
                ("A-01-01-01-A1", Decimal("2.50"), "A", 1),
                ("06-01-30-D1", 20, "06", 30),
            ),
            inventory=(
                ("0100", "Wiper", 1, "A-01-01-01-A1"),
                ("1008614-00", "Filter", 0, "A-01-01-01-A1"),
                (Decimal("3.0"), "Bolt", 1, "A-01-01-01-A1"),
                ("0200", "Hose", 1, "06-01-30-D1"),
            ),
            transactions=(("Issue Part", "0100", "FLSKRS", Decimal("5000007"), "2026-09-30"),),
        )
    )

    assert list(result.data.locations) == ["A-01-01-01-A1", "06-01-30-D1"]
    assert [line.part for line in result.data.inventory] == ["0100", "1008614-00", "3", "0200"]
    assert result.data.inventory[3].location == "06-01-30-D1"
    assert result.data.transactions[0].transaction_code == "5000007"
    location = result.model_dump(mode="json")["data"]["locations"]["A-01-01-01-A1"]
    assert location == {
        "walk_path": "2.5",
        "aisle": "A",
        "level": "1",
        "section": None,
        "position": None,
    }


def test_fr5_location_codes_compare_case_sensitive() -> None:
    details = _invalid(_files(inventory=(("P1", "Bolt", 2, "a-01"),)))

    assert _messages(details[1]) == [
        "Inventory.xlsx · row 2 · column Location: “a-01” is not in the Locations file."
    ]


def test_fr6_duplicate_inventory_rows_merged_zero_kept() -> None:
    result = _normalize(
        _files(
            inventory=(
                ("P1", "Bolt", 2, "A-01"),
                ("P2", "Nut", 0, "A-01"),
                ("P1", "Bolt", Decimal("3.00"), "A-01"),
                ("P1", "Bolt", 1, "A-02"),
            )
        )
    )

    inventory = result.model_dump(mode="json")["data"]["inventory"]
    assert inventory == [
        {"part": "P1", "location": "A-01", "quantity": "5"},
        {"part": "P2", "location": "A-01", "quantity": "0"},
        {"part": "P1", "location": "A-02", "quantity": "1"},
    ]


def test_fr6_parts_take_first_description() -> None:
    result = _normalize(_files(inventory=(("P1", "Bolt", 1, "A-01"), ("P1", "Screw", 1, "A-02"))))

    assert result.data.parts == {"P1": "Bolt"}


def test_fr7_data_as_of_is_newest_date_over_every_row() -> None:
    result = _normalize(
        _files(
            transactions=(
                ("Move to Repair", "P1", "A-01", 1, "2026-09-30 09:00"),
                ("Issue Part", "P1", "FLSKRS", 2, datetime(2026, 10, 2, 8, 0)),
                ("Count", "P1", "ZZZ", 3, "15.10.2026"),
                ("Receipt", "P1", "A-02", 4, date(2026, 1, 1)),
            )
        )
    )

    assert result.data_as_of == date(2026, 10, 15)
    assert [(t.type, t.date) for t in result.data.transactions] == [
        ("move_to_repair", date(2026, 9, 30)),
        ("issue_part", date(2026, 10, 2)),
        ("receipt", date(2026, 1, 1)),
    ]


class _Holder(BaseModel):
    value: Dec


@pytest.mark.parametrize(
    ("value", "text"),
    [
        (Decimal("2.50"), "2.5"),
        (Decimal("5.00"), "5"),
        (Decimal("100"), "100"),
        (Decimal("-0"), "0"),
        (Decimal("0.000"), "0"),
        (Decimal("1E+3"), "1000"),
    ],
)
def test_fr6_dec_serializes_normalized(value: Decimal, text: str) -> None:
    assert dec_text(value) == text
    assert _Holder(value=value).model_dump(mode="json") == {"value": text}


@pytest.mark.parametrize("raw", ["2.5", 2, Decimal("2.5")])
def test_fr6_dec_validates_from_str_int_decimal(raw: object) -> None:
    holder = _Holder.model_validate({"value": raw})

    assert holder.value == Decimal(str(raw))
    assert _Holder.model_validate(holder.model_dump(mode="json")) == holder


def test_fr6_import_data_json_keys() -> None:
    result = _normalize(_files())

    dumped = result.model_dump(mode="json")
    assert set(dumped) == {"data_as_of", "data"}
    assert dumped["data_as_of"] == "2026-09-30"
    assert list(dumped["data"]) == [
        "schema_version",
        "locations",
        "inventory",
        "parts",
        "transactions",
    ]
    assert dumped["data"]["schema_version"] == 1
    assert dumped["data"]["transactions"] == [
        {"type": "issue_part", "part": "P1", "transaction_code": "7", "date": "2026-09-30"}
    ]
