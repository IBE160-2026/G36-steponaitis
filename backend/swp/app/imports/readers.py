"""Shell readers (AD-8): file bytes -> RawSheet of typed cells. No checks beyond readability."""

import csv
import io
import zipfile
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import PurePath

from openpyxl import load_workbook

from swp.domain.errors import DomainError
from swp.domain.import_ import Cell, RawSheet, row_limit_reached

MAX_UNPACKED_XLSX_BYTES = 50_000_000
MAX_COLUMNS = 100
MAX_CELL_CHARS = 1_000
# Blank rows tolerated beyond header + max_rows: openpyxl pads every missing row index, so a
# tiny hostile .xlsx with one row at r="2000000000" would otherwise spin for billions of rows.
MAX_BLANK_ROWS = 10_000


class UnreadableFile(Exception):
    """The file is not a readable .xlsx or UTF-8 .csv (or has another extension)."""


def read_sheet(file_name: str, data: bytes, *, max_rows: int) -> RawSheet:
    """Read the first sheet; raise UnreadableFile, or DomainError `limit_reached`."""
    extension = PurePath(file_name).suffix.lower()
    if extension == ".xlsx":
        return _read_xlsx(file_name, data, max_rows)
    if extension == ".csv":
        return _read_csv(file_name, data, max_rows)
    raise UnreadableFile(file_name)


def _cell(value: object) -> Cell:
    if value is None:
        return None
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int | Decimal | datetime | date):
        return value
    if isinstance(value, float):
        return Decimal(repr(value))
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    text = value if isinstance(value, str) else str(value)
    return text[:MAX_CELL_CHARS] or None


def _row(values: Iterable[object]) -> tuple[Cell, ...]:
    cells = [_cell(value) for value in list(values)[:MAX_COLUMNS]]
    while cells and cells[-1] is None:
        cells.pop()
    return tuple(cells)


def _is_blank(row: tuple[Cell, ...]) -> bool:
    return all(c is None or (isinstance(c, str) and not c.strip()) for c in row)


def _collect(file_name: str, rows: Iterable[Iterable[object]], max_rows: int) -> RawSheet:
    """Keep sheet row positions; stop once non-blank rows exceed header + max_rows."""
    kept: list[tuple[Cell, ...]] = []
    pending_blank = 0
    non_blank = 0
    scanned = 0
    for values in rows:
        scanned += 1
        if scanned > max_rows + 1 + MAX_BLANK_ROWS:
            raise row_limit_reached(file_name, max_rows)
        row = _row(values)
        if _is_blank(row):
            pending_blank += 1  # only kept when a non-blank row follows
            continue
        non_blank += 1
        if non_blank > max_rows + 1:
            raise row_limit_reached(file_name, max_rows)
        kept.extend([()] * pending_blank)
        pending_blank = 0
        kept.append(row)
    return RawSheet(rows=tuple(kept))


def _read_xlsx(file_name: str, data: bytes, max_rows: int) -> RawSheet:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            unpacked = sum(info.file_size for info in archive.infolist())
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        raise UnreadableFile(file_name) from exc
    if unpacked > MAX_UNPACKED_XLSX_BYTES:
        raise UnreadableFile(file_name)
    try:
        # openpyxl parses through defusedxml when it is installed (it is a pinned dependency).
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:
        raise UnreadableFile(file_name) from exc
    try:
        if not workbook.worksheets:
            raise UnreadableFile(file_name)
        sheet = workbook.worksheets[0]
        # Stored dimensions can be wrong or missing; read what is really there. In read-only
        # mode iter_rows still yields an empty row for every missing row, so row i stays
        # sheet row i + 1.
        sheet.reset_dimensions()
        return _collect(file_name, sheet.iter_rows(max_col=MAX_COLUMNS, values_only=True), max_rows)
    except (DomainError, UnreadableFile):
        raise
    except Exception as exc:
        raise UnreadableFile(file_name) from exc
    finally:
        workbook.close()


def _read_csv(file_name: str, data: bytes, max_rows: int) -> RawSheet:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UnreadableFile(file_name) from exc
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    try:
        reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
        return _collect(file_name, ([c or None for c in r] for r in reader), max_rows)
    except csv.Error as exc:
        raise UnreadableFile(file_name) from exc
