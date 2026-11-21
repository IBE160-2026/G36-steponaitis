"""The answer-key dataset (`data/answer-key/`) as a NormalizedImport, built in the domain only."""

import csv
import json
from pathlib import Path
from typing import Any

from swp.domain.analysis import MovementClass
from swp.domain.import_ import Cell, FileRole, RawSheet, check_file, check_import, normalize_import
from swp.domain.import_data import NormalizedImport

ANSWER_KEY_DIR = Path(__file__).resolve().parents[3] / "data" / "answer-key"
FILES: dict[FileRole, str] = {
    "locations": "Locations.csv",
    "inventory": "Inventory.csv",
    "transactions": "transactions.csv",
}
CLASS_NAMES: dict[str, MovementClass] = {
    "fast-moving": "fast",
    "medium-moving": "medium",
    "slow-moving": "slow",
    "dead stock": "dead",
}


def _sheet(path: Path) -> RawSheet:
    with path.open(encoding="utf-8", newline="") as file:
        rows: list[tuple[Cell, ...]] = [
            tuple(cell if cell != "" else None for cell in row) for row in csv.reader(file)
        ]
    return RawSheet(rows=tuple(rows))


def answer_key_import() -> NormalizedImport:
    """Read the three answer-key CSVs as str cells (blank -> None) and normalize them."""
    checked = [
        check_file(role, name, _sheet(ANSWER_KEY_DIR / name)) for role, name in FILES.items()
    ]
    return normalize_import(check_import(checked))


def expected() -> dict[str, Any]:
    """`data/answer-key/expected.json`."""
    return json.loads((ANSWER_KEY_DIR / "expected.json").read_text(encoding="utf-8"))
