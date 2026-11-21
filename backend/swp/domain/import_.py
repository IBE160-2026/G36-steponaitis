"""Import checks (FR-3, FR-4, AD-8): header, required columns and cell values per file.

Pure: takes a RawSheet of typed cells from the shell readers and returns a CheckedFile
with a FileCheck report (the `import_invalid` details shape) and the parsed rows.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from swp.domain.errors import DomainError

type Cell = str | int | Decimal | datetime | date | None
type Value = str | Decimal | date | None
FileRole = Literal["locations", "inventory", "transactions"]
CheckStatus = Literal["passed", "failed", "not_checked"]

ROLES: tuple[FileRole, ...] = ("locations", "inventory", "transactions")
MAX_ERRORS_PER_FILE = 20
IMPORT_STOPPED = "Import stopped: nothing was saved."

REQUIRED_COLUMNS: Mapping[FileRole, tuple[str, ...]] = {
    "locations": ("Location", "Walk Path", "Aisle", "Level"),
    "inventory": ("Part", "Part Description", "Quantity", "Location"),
    "transactions": ("Transaction Type", "Part", "Location", "Transaction Code", "Date"),
}
OPTIONAL_COLUMNS: Mapping[FileRole, tuple[str, ...]] = {
    "locations": ("Section", "Position", "Warehouse"),
    "inventory": ("Warehouse",),
    "transactions": ("Warehouse",),
}

ColumnKind = Literal["identifier", "number", "date", "text"]
COLUMN_KINDS: Mapping[str, ColumnKind] = {
    "Location": "identifier",
    "Aisle": "identifier",
    "Level": "identifier",
    "Section": "identifier",
    "Position": "identifier",
    "Warehouse": "identifier",
    "Part": "identifier",
    "Transaction Code": "identifier",
    "Walk Path": "number",
    "Quantity": "number",
    "Date": "date",
    "Part Description": "text",
    "Transaction Type": "text",
}
NON_NEGATIVE_COLUMNS = frozenset({"Quantity"})


@dataclass(frozen=True)
class RawSheet:
    """Rows of typed cells; row i is sheet row i + 1."""

    rows: tuple[tuple[Cell, ...], ...]


class CellError(BaseModel):
    row: int | None
    column: str | None
    message: str


class FileCheck(BaseModel):
    file_role: FileRole
    file_name: str
    status: CheckStatus
    errors: list[CellError]
    more_count: int


@dataclass(frozen=True)
class CheckedRow:
    """One data row; `row` is the spreadsheet row number (header = row 1)."""

    row: int
    values: Mapping[str, Value]


@dataclass(frozen=True)
class CheckedFile:
    check: FileCheck
    rows: tuple[CheckedRow, ...]


class _BadValue(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


_PLAIN_NUMBER = re.compile(r"-?\d+([.,]\d+)?")
_THOUSANDS = re.compile(r"-?\d{1,3}([ ,. ']\d{3})+([.,]\d+)?")
_TIME_SUFFIX = r"(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?"
_ISO_DATE = re.compile(r"(\d{4})-(\d{2})-(\d{2})" + _TIME_SUFFIX)
_DOTTED_DATE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})" + _TIME_SUFFIX)


def _is_blank(cell: Cell) -> bool:
    return cell is None or (isinstance(cell, str) and cell.strip() == "")


def _decimal_text(value: Decimal) -> str:
    return format(value, "f")


def _display(cell: Cell) -> str:
    if isinstance(cell, Decimal):
        return _decimal_text(cell)
    return str(cell)


def _parse_identifier(cell: Cell) -> str:
    if isinstance(cell, date):  # datetime is a date too
        raise _BadValue("is not a valid code")
    if isinstance(cell, int):
        return str(cell)
    if isinstance(cell, Decimal):
        if not cell.is_finite() or cell != cell.to_integral_value():
            raise _BadValue("is not a whole number")
        return str(int(cell))
    assert isinstance(cell, str)
    return cell.strip()


def _parse_number(cell: Cell) -> Decimal:
    if isinstance(cell, date):
        raise _BadValue("is not a number")
    if isinstance(cell, int):
        return Decimal(cell)
    if isinstance(cell, Decimal):
        if not cell.is_finite():
            raise _BadValue("is not a number")
        return cell
    assert isinstance(cell, str)
    text = cell.strip()
    if _PLAIN_NUMBER.fullmatch(text):
        return Decimal(text.replace(",", "."))
    if _THOUSANDS.fullmatch(text):
        raise _BadValue("uses a thousands separator")
    raise _BadValue("is not a number")


def _parse_date(cell: Cell) -> date:
    if isinstance(cell, datetime):
        return cell.date()
    if isinstance(cell, date):
        return cell
    if not isinstance(cell, str):
        raise _BadValue("is not a valid date")
    text = cell.strip()
    try:
        if match := _ISO_DATE.fullmatch(text):
            year, month, day = match.group(1, 2, 3)
            return date(int(year), int(month), int(day))
        if match := _DOTTED_DATE.fullmatch(text):
            day, month, year = match.group(1, 2, 3)
            return date(int(year), int(month), int(day))
    except ValueError:
        pass
    raise _BadValue("is not a valid date")


def _parse_text(cell: Cell) -> str:
    if isinstance(cell, Decimal):
        return _decimal_text(cell)
    return str(cell).strip()


def _parse(column: str, cell: Cell) -> Value:
    kind = COLUMN_KINDS[column]
    if kind == "identifier":
        return _parse_identifier(cell)
    if kind == "number":
        number = _parse_number(cell)
        if column in NON_NEGATIVE_COLUMNS and number < 0:
            raise _BadValue("is negative")
        return number
    if kind == "date":
        return _parse_date(cell)
    return _parse_text(cell)


def _header_key(cell: Cell) -> str | None:
    if _is_blank(cell):
        return None
    return _display(cell).strip().casefold()


def _failed(role: FileRole, file_name: str, errors: list[CellError]) -> CheckedFile:
    check = FileCheck(
        file_role=role,
        file_name=file_name,
        status="failed",
        errors=errors[:MAX_ERRORS_PER_FILE],
        more_count=max(0, len(errors) - MAX_ERRORS_PER_FILE),
    )
    return CheckedFile(check=check, rows=())


def check_file(role: FileRole, file_name: str, sheet: RawSheet) -> CheckedFile:
    """Check the header and every value of one file; report every error found."""
    no_data = CellError(row=None, column=None, message=f"{file_name} has no data rows.")
    header_index = next(
        (i for i, row in enumerate(sheet.rows) if not all(_is_blank(c) for c in row)), None
    )
    if header_index is None:
        return _failed(role, file_name, [no_data])

    header_keys = [_header_key(cell) for cell in sheet.rows[header_index]]
    required = REQUIRED_COLUMNS[role]
    errors: list[CellError] = []
    positions: dict[str, int] = {}
    for column in required:
        found = [i for i, key in enumerate(header_keys) if key == column.casefold()]
        if not found:
            errors.append(
                CellError(
                    row=None,
                    column=column,
                    message=(
                        f"{file_name} is missing the column {column}. "
                        f"Required: {', '.join(required)}."
                    ),
                )
            )
        elif len(found) > 1:
            errors.append(
                CellError(
                    row=None,
                    column=column,
                    message=f"{file_name} has the column {column} more than once.",
                )
            )
        else:
            positions[column] = found[0]
    optional = OPTIONAL_COLUMNS[role]
    for column in optional:
        found = [i for i, key in enumerate(header_keys) if key == column.casefold()]
        if found:
            positions[column] = found[0]

    rows: list[CheckedRow] = []
    first_location_row: dict[str, int] = {}
    for index in range(header_index + 1, len(sheet.rows)):
        cells = sheet.rows[index]
        if all(_is_blank(c) for c in cells):
            continue
        row_number = index - header_index + 1
        values: dict[str, Value] = {column: None for column in (*required, *optional)}
        for column in (*required, *optional):
            position = positions.get(column)
            if position is None:
                continue
            cell = cells[position] if position < len(cells) else None
            if _is_blank(cell):
                if column in required:
                    errors.append(
                        CellError(
                            row=row_number,
                            column=column,
                            message=(
                                f"{file_name} · row {row_number:,} · column {column} is blank."
                            ),
                        )
                    )
                continue
            prefix = f"{file_name} · row {row_number:,} · column {column}: “{_display(cell)}”"
            try:
                value = _parse(column, cell)
            except _BadValue as bad:
                errors.append(
                    CellError(row=row_number, column=column, message=f"{prefix} {bad.reason}.")
                )
                continue
            if role == "locations" and column == "Location":
                assert isinstance(value, str)
                first = first_location_row.setdefault(value, row_number)
                if first != row_number:
                    errors.append(
                        CellError(
                            row=row_number,
                            column=column,
                            message=(
                                f"{prefix} appears more than once in the Locations file "
                                f"(first in row {first:,})."
                            ),
                        )
                    )
            values[column] = value
        rows.append(CheckedRow(row=row_number, values=values))

    if not rows:
        errors.append(no_data)
    if errors:
        return _failed(role, file_name, errors)
    check = FileCheck(file_role=role, file_name=file_name, status="passed", errors=[], more_count=0)
    return CheckedFile(check=check, rows=tuple(rows))


def unreadable_file(role: FileRole, file_name: str) -> CheckedFile:
    """The report for a file that is neither a readable .xlsx nor a UTF-8 .csv."""
    message = f"{file_name} can't be read as .xlsx or .csv."
    return _failed(role, file_name, [CellError(row=None, column=None, message=message)])


def row_limit_reached(file_name: str, max_rows: int) -> DomainError:
    """The request-level error for a file with more than `max_rows` data rows (AD-12)."""
    return DomainError(
        "limit_reached",
        f"{file_name} has more than {max_rows:,} rows. One file can hold at most {max_rows:,}.",
    )


def check_import(
    files: Sequence[CheckedFile],
) -> tuple[CheckedFile, CheckedFile, CheckedFile]:
    """Order the three files by role; raise `import_invalid` with every report if any fails."""
    by_role = {file.check.file_role: file for file in files}
    if len(files) != len(ROLES) or set(by_role) != set(ROLES):
        raise ValueError("check_import needs exactly one file per role")
    ordered = (by_role["locations"], by_role["inventory"], by_role["transactions"])
    if any(file.check.status != "passed" for file in ordered):
        raise DomainError(
            "import_invalid",
            IMPORT_STOPPED,
            [file.check.model_dump(mode="json") for file in ordered],
        )
    return ordered
