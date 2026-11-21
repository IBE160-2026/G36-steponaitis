"""FR-1/FR-7: read_import normalizes the answer-key and sample files."""

import json
from datetime import date
from decimal import Decimal

from swp.app.imports import read_import
from tests.app.test_import_readers import DATA_DIR, _data_files


def test_fr7_answer_key_data_as_of_and_merged_inventory() -> None:
    expected = json.loads((DATA_DIR / "answer-key" / "expected.json").read_text(encoding="utf-8"))

    result = read_import(_data_files("answer-key", "csv"))

    assert result.data_as_of == date.fromisoformat(expected["data_as_of"])
    assert len(result.data.locations) == expected["occupancy_import"]["total"]["locations"]
    for merged in expected["merged_inventory"]:
        lines = [
            line
            for line in result.data.inventory
            if (line.part, line.location) == (merged["part"], merged["location"])
        ]
        assert len(lines) == 1
        assert lines[0].quantity == Decimal(merged["quantity"])
    dumped = result.model_dump(mode="json")["data"]
    assert {"part": "9300", "location": "B-01-03-02", "quantity": "5"} in dumped["inventory"]
    assert {"part": "1008614-00", "location": "A-01-01-03", "quantity": "0"} in dumped["inventory"]
    assert {"0100", "1008614-00"} <= set(result.data.parts)
    assert "9999" not in result.data.parts


def test_fr1_sample_files_normalize() -> None:
    result = read_import(_data_files("sample", "xlsx"))

    assert len(result.data.locations) == 2_000
    assert result.data_as_of == date(2026, 9, 30)
