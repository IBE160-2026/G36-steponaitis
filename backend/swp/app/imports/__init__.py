"""Import service: read the three exports and check their columns and values (FR-3, FR-4)."""

from collections.abc import Mapping
from dataclasses import dataclass

from swp.app.imports.readers import UnreadableFile, read_sheet
from swp.app.limits import max_rows_per_file
from swp.domain.import_ import (
    ROLES,
    CheckedFile,
    FileRole,
    check_file,
    check_import,
    unreadable_file,
)


@dataclass(frozen=True)
class UploadedFile:
    file_name: str
    data: bytes


def check_files(
    files: Mapping[FileRole, UploadedFile],
) -> tuple[CheckedFile, CheckedFile, CheckedFile]:
    """Read and check all three files; raise `import_invalid` or `limit_reached`."""
    max_rows = max_rows_per_file()
    checked: list[CheckedFile] = []
    for role in ROLES:
        upload = files[role]
        try:
            sheet = read_sheet(upload.file_name, upload.data, max_rows=max_rows)
        except UnreadableFile:
            checked.append(unreadable_file(role, upload.file_name))
            continue
        checked.append(check_file(role, upload.file_name, sheet))
    return check_import(checked)
