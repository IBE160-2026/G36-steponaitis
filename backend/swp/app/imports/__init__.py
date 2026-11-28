"""Import service: read, check and normalize the three exports (FR-3 to FR-7)."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, timedelta

from swp.app.imports.readers import UnreadableFile, read_sheet
from swp.app.limits import max_rows_per_file
from swp.domain.import_ import (
    ROLES,
    CheckedFile,
    FileRole,
    check_file,
    check_import,
    normalize_import,
    unreadable_file,
)
from swp.domain.import_data import NormalizedImport


@dataclass(frozen=True)
class UploadedFile:
    file_name: str
    data: bytes


def check_files(
    files: Mapping[FileRole, UploadedFile], *, uploaded_on: date | None = None
) -> tuple[CheckedFile, CheckedFile, CheckedFile]:
    """Read and check all three files; raise `import_invalid` or `limit_reached`.

    With `uploaded_on` (the upload day, UTC), a date later than the day after it is an error:
    the extra day covers time zones ahead of UTC. None sets no upper limit.
    """
    max_rows = max_rows_per_file()
    latest_date = None if uploaded_on is None else uploaded_on + timedelta(days=1)
    checked: list[CheckedFile] = []
    for role in ROLES:
        upload = files[role]
        try:
            sheet = read_sheet(upload.file_name, upload.data, max_rows=max_rows)
        except UnreadableFile:
            checked.append(unreadable_file(role, upload.file_name))
            continue
        checked.append(check_file(role, upload.file_name, sheet, latest_date=latest_date))
    return check_import(checked)


def read_import(
    files: Mapping[FileRole, UploadedFile], *, uploaded_on: date | None = None
) -> NormalizedImport:
    """Read, check and normalize the three files; raise `import_invalid` or `limit_reached`.

    `uploaded_on` is the upload day (see `check_files`).
    """
    return normalize_import(check_files(files, uploaded_on=uploaded_on))
