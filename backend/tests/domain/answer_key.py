"""The answer-key dataset (`data/answer-key/`) as a NormalizedImport, built in the domain only."""

import csv
import json
from pathlib import Path
from typing import Any

from swp.domain.analysis import Analysis, AnalysisSettings, MovementClass, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.import_ import Cell, FileRole, RawSheet, check_file, check_import, normalize_import
from swp.domain.import_data import NormalizedImport
from swp.domain.pick_groups import find_pick_groups

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


def empty_analysis() -> Analysis:
    """The answer-key settings and period with no part entries and no pick groups."""
    imported = answer_key_import()
    return build_analysis(
        imported.data_as_of, AnalysisSettings.model_validate(expected()["settings"])
    )


def answer_key_analysis() -> Analysis:
    """The answer-key analysis: classes and pick groups as the plan stores them."""
    data = answer_key_import().data
    base = empty_analysis()
    return base.model_copy(
        update={
            "parts": classify_parts(data, base),
            "pick_groups": find_pick_groups(data, base),
        }
    )
