"""FR-1/FR-4/NFR: readers turn .xlsx/.csv bytes into RawSheets; check_files joins the checks."""

import io
import time
import zipfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import openpyxl.xml
import pytest
from openpyxl import Workbook

from swp.app.imports import UploadedFile, check_files
from swp.app.imports.readers import UnreadableFile, read_sheet
from swp.domain.errors import DomainError
from swp.domain.import_ import Cell
from tests.conftest import _clear_caches

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
ROLE_NAMES = {"locations": "Locations", "inventory": "Inventory", "transactions": "transactions"}
LOC_CSV = b"Location,Walk Path,Aisle,Level\nA-01,0,A,1\n"
INV_CSV = b"Part,Part Description,Quantity,Location\nP1,Bolt,2,A-01\n"
TX_CSV_HEADER = b"Transaction Type,Part,Location,Transaction Code,Date\n"
TX_CSV = TX_CSV_HEADER + b"Issue Part,P1,FLSKRS,7,2026-09-30\n"


def _xlsx(rows: list[list[object]], *, start_row: int = 1) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    for offset, row in enumerate(rows):
        for column, value in enumerate(row, start=1):
            if value is not None:
                sheet.cell(row=start_row + offset, column=column, value=value)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _read(name: str, data: bytes, max_rows: int = 25_000) -> tuple[tuple[Cell, ...], ...]:
    return read_sheet(name, data, max_rows=max_rows).rows


def _transactions_dated(day: str) -> UploadedFile:
    """A transactions file with one line dated `day`."""
    line = b"Issue Part,P1,FLSKRS,7," + day.encode() + b"\n"
    return UploadedFile("transactions.csv", TX_CSV_HEADER + line)


def _good_files(**overrides: UploadedFile) -> dict[str, UploadedFile]:
    files = {
        "locations": UploadedFile("Locations.csv", LOC_CSV),
        "inventory": UploadedFile("Inventory.csv", INV_CSV),
        "transactions": UploadedFile("transactions.csv", TX_CSV),
    }
    files.update(overrides)
    return files


def test_nfr_openpyxl_parses_through_defusedxml() -> None:
    assert openpyxl.xml.DEFUSEDXML is True


def test_fr4_xlsx_row_index_matches_sheet_row_when_header_on_row_3() -> None:
    rows = _read(
        "Locations.xlsx",
        _xlsx([["Location", "Walk Path"], ["A-01", 3], [], ["A-02", 4]], start_row=3),
    )

    assert rows == ((), (), ("Location", "Walk Path"), ("A-01", 3), (), ("A-02", 4))


def test_fr4_xlsx_cell_types() -> None:
    when = datetime(2026, 9, 30, 13, 0)
    rows = _read(
        "x.xlsx", _xlsx([["A", "B", "C", "D", "E", "F"], [2.5, 3.0, 7, True, when, "  t  "]])
    )

    assert rows[1] == (Decimal("2.5"), Decimal("3.0"), 7, "TRUE", when, "  t  ")


def test_fr4_xlsx_integral_float_becomes_integer_identifier() -> None:
    data = _xlsx([["Part", "Part Description", "Quantity", "Location"], [3.0, "Bolt", 2.5, "A-01"]])
    files = _good_files(inventory=UploadedFile("Inventory.xlsx", data))

    _, inventory, _ = check_files(files)

    assert inventory.rows[0].values["Part"] == "3"
    assert inventory.rows[0].values["Quantity"] == Decimal("2.5")


def test_nfr_wide_rows_cut_to_100_columns_and_long_text_to_1000_chars() -> None:
    wide = [f"c{i}" for i in range(105)]
    rows = _read("x.xlsx", _xlsx([wide, ["x" * 1_500]]))

    assert len(rows[0]) == 100
    assert rows[1] == ("x" * 1_000,)
    csv_rows = _read("x.csv", (",".join(wide) + "\n" + "y" * 1_500 + "\n").encode())
    assert len(csv_rows[0]) == 100
    assert csv_rows[1] == ("y" * 1_000,)


def test_fr4_csv_bom_and_semicolon_delimiter() -> None:
    data = "﻿Location;Walk Path;Aisle;Level\nA-01;2,5;A;1\n".encode()

    rows = _read("Locations.csv", data)

    assert rows == (("Location", "Walk Path", "Aisle", "Level"), ("A-01", "2,5", "A", "1"))


def test_fr4_csv_blank_cells_become_none_and_trailing_trimmed() -> None:
    rows = _read("x.csv", b"\nA,B,C\n1,,\n,,\n2,,3\n")

    assert rows == ((), ("A", "B", "C"), ("1",), (), ("2", None, "3"))


def test_fr4_csv_not_utf8_is_unreadable() -> None:
    with pytest.raises(UnreadableFile):
        _read("Inventory.csv", "Part,Part Description\nP1,R\xe6kke\n".encode("cp1252"))


@pytest.mark.parametrize(
    ("name", "data"),
    [("Inventory.pdf", INV_CSV), ("Inventory", INV_CSV), ("Inventory.xlsx", b"\x00\x01 random")],
)
def test_fr4_wrong_extension_or_corrupt_xlsx_is_unreadable(name: str, data: bytes) -> None:
    with pytest.raises(UnreadableFile):
        _read(name, data)


def test_fr4_zip_without_workbook_is_unreadable() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "hi")

    with pytest.raises(UnreadableFile):
        _read("Inventory.xlsx", buffer.getvalue())


def test_nfr_xlsx_over_50mb_unpacked_is_rejected_before_opening(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/big.bin", b"\0" * 50_000_001)

    def _never(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("workbook was opened")

    monkeypatch.setattr("swp.app.imports.readers.load_workbook", _never)

    with pytest.raises(UnreadableFile):
        _read("Inventory.xlsx", buffer.getvalue())


def test_nfr_too_many_rows_stops_reading() -> None:
    data = b"A\n" + b"x\n" * 4

    assert len(_read("x.csv", data, max_rows=4)) == 5
    with pytest.raises(DomainError) as raised:
        _read("x.csv", data + b"\n\ny\n", max_rows=4)
    assert raised.value.code == "limit_reached"


def test_nfr_limit_reached_uses_max_rows_setting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MAX_ROWS_PER_FILE", "3")
    _clear_caches()
    try:
        data = _xlsx(
            [["Part", "Part Description", "Quantity", "Location"]] + [["P", "B", 1, "A"]] * 5
        )
        with pytest.raises(DomainError) as raised:
            check_files(_good_files(inventory=UploadedFile("Inventory.xlsx", data)))
    finally:
        monkeypatch.delenv("MAX_ROWS_PER_FILE")
        _clear_caches()

    assert raised.value.code == "limit_reached"
    assert raised.value.message == (
        "Inventory.xlsx has more than 3 rows. One file can hold at most 3."
    )


def test_nfr_limit_reached_default_message_has_separators() -> None:
    with pytest.raises(DomainError) as raised:
        _read("transactions.csv", b"A\n" + b"x\n" * 25_001)

    assert str(raised.value) == (
        "transactions.csv has more than 25,000 rows. One file can hold at most 25,000."
    )


def test_fr4_one_failing_file_reports_all_three() -> None:
    files = _good_files(inventory=UploadedFile("Inventory.pdf", INV_CSV))

    with pytest.raises(DomainError) as raised:
        check_files(files)

    error = raised.value
    assert error.code == "import_invalid"
    assert error.message == "Import stopped: nothing was saved."
    assert len(error.details) == 3
    assert [d["status"] for d in error.details] == ["passed", "failed", "passed"]
    for detail in error.details:
        assert set(detail) == {"file_role", "file_name", "status", "errors", "more_count"}
        for item in detail["errors"]:  # type: ignore[attr-defined]
            assert set(item) == {"row", "column", "message"}
    assert error.details[1]["errors"] == [
        {"row": None, "column": None, "message": "Inventory.pdf can't be read as .xlsx or .csv."}
    ]


def test_fr4_bad_values_in_xlsx_report_file_row_and_column() -> None:
    data = _xlsx(
        [
            ["Transaction Type", "Part", "Location", "Transaction Code", "Date"],
            ["Issue Part", "P1", "FLSKRS", 7, "09/30/2026"],
            ["Issue Part", "P1", "FLSKRS", 7, datetime(2026, 9, 30, 13)],
        ]
    )

    with pytest.raises(DomainError) as raised:
        check_files(_good_files(transactions=UploadedFile("transactions.xlsx", data)))

    assert raised.value.details[2]["errors"] == [
        {
            "row": 2,
            "column": "Date",
            "message": "transactions.xlsx · row 2 · column Date: “09/30/2026” is not a valid date.",
        }
    ]


def test_fr4_date_one_day_after_the_upload_day_passes() -> None:
    # The upload day is UTC; a warehouse east of UTC can already be on the next day.
    files = _good_files(transactions=_transactions_dated("2026-10-01"))

    _, _, transactions = check_files(files, uploaded_on=date(2026, 9, 30))

    assert transactions.check.status == "passed"


def test_fr4_date_two_days_after_the_upload_day_is_a_cell_error() -> None:
    files = _good_files(transactions=_transactions_dated("2026-10-02"))

    with pytest.raises(DomainError) as raised:
        check_files(files, uploaded_on=date(2026, 9, 30))

    assert raised.value.details[2]["errors"] == [
        {
            "row": 2,
            "column": "Date",
            "message": "transactions.csv · row 2 · column Date: “2026-10-02” is in the future.",
        }
    ]


def test_fr4_good_csv_files_pass() -> None:
    locations, inventory, transactions = check_files(_good_files())

    assert transactions.rows[0].values["Date"] == date(2026, 9, 30)
    assert inventory.rows[0].values["Quantity"] == Decimal("2")
    assert locations.check.status == "passed"


def _data_files(folder: str, extension: str) -> dict[str, UploadedFile]:
    return {
        role: UploadedFile(
            f"{name}.{extension}", (DATA_DIR / folder / f"{name}.{extension}").read_bytes()
        )
        for role, name in ROLE_NAMES.items()
    }


def test_fr1_sample_files_pass_column_and_value_checks() -> None:
    checked = check_files(_data_files("sample", "xlsx"))

    assert [f.check.status for f in checked] == ["passed", "passed", "passed"]
    assert [len(f.rows) for f in checked] == [2_000, 1_625, 20_000]


def test_fr4_answer_key_files_pass_column_and_value_checks() -> None:
    locations, inventory, transactions = check_files(_data_files("answer-key", "csv"))

    assert [f.check.status for f in (locations, inventory, transactions)] == ["passed"] * 3
    assert inventory.rows[0].values["Part"] == "0100"
    assert transactions.rows[0].values["Date"] == date(2025, 9, 30)


def _patch_sheet_xml(data: bytes, old: bytes, new: bytes) -> bytes:
    """Rewrite xl/worksheets/sheet1.xml of an openpyxl-saved workbook."""
    source = zipfile.ZipFile(io.BytesIO(data))
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                assert old in content
                content = content.replace(old, new)
            target.writestr(info, content)
    return buffer.getvalue()


def test_nfr_xlsx_with_far_away_row_stops_quickly() -> None:
    data = _patch_sheet_xml(
        _xlsx([["A"], ["far"]]), b'<row r="2"><c r="A2"', b'<row r="2000000000"><c r="A2000000000"'
    )
    started = time.monotonic()

    with pytest.raises(DomainError) as raised:
        _read("Inventory.xlsx", data, max_rows=3)

    assert raised.value.code == "limit_reached"
    assert time.monotonic() - started < 5


def test_fr4_xlsx_formula_cells_read_as_cached_values() -> None:
    data = _patch_sheet_xml(
        _xlsx([["A"], [7]]), b'<c r="A2" t="n"><v>7</v></c>', b'<c r="A2"><f>1+1</f><v>2</v></c>'
    )

    assert _read("x.xlsx", data) == (("A",), (2,))


def test_fr4_csv_many_blank_rows_do_not_count_against_row_limit() -> None:
    data = b"A\n1\n" + b"\n" * 12_000 + b"2\n" + b",,\n" * 12_000

    rows = _read("Inventory.csv", data, max_rows=3)

    assert rows[:2] == (("A",), ("1",))
    assert rows[-1] == ("2",)
    assert len(rows) == 12_003


def test_fr4_xlsx_many_trailing_blank_rows_do_not_count_against_row_limit() -> None:
    data = _patch_sheet_xml(
        _xlsx([["A"], ["x"], ["end"]]), b'<row r="3"><c r="A3"', b'<row r="20000"><c r="A20000"'
    )

    rows = _read("Inventory.xlsx", data, max_rows=3)

    assert rows[:2] == (("A",), ("x",))
    assert rows[-1] == ("end",)
