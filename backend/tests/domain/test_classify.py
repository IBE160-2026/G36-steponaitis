"""FR-16/FR-17/FR-18: picks in the period and the movement class of every part (domain only)."""

from datetime import date
from decimal import Decimal

from swp.domain.analysis import AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts, count_picks, movement_class
from swp.domain.import_ import FileRole, RawSheet, check_file, check_import, normalize_import
from swp.domain.import_data import (
    ImportData,
    InventoryLine,
    LocationData,
    TransactionLine,
    TransactionType,
)
from tests.domain.answer_key import CLASS_NAMES, answer_key_import, expected

DATA_AS_OF = date(2026, 9, 30)
SETTINGS = AnalysisSettings(
    period_months=12,
    fast_min_picks=24,
    medium_min_picks=6,
    slow_min_picks=1,
    pick_group_min_shared_jobs=5,
)


def _line(part: str, on: date, kind: TransactionType = "move_to_repair") -> TransactionLine:
    return TransactionLine(type=kind, part=part, transaction_code="5000001", date=on)


def _data(inventory: list[tuple[str, str]], transactions: list[TransactionLine]) -> ImportData:
    return ImportData(
        locations={
            "A-01-01-01": LocationData(
                walk_path=Decimal("0"), aisle="A", level="1", section=None, position=None
            )
        },
        inventory=[
            InventoryLine(part=part, location="A-01-01-01", quantity=Decimal(quantity))
            for part, quantity in inventory
        ],
        parts={},
        transactions=transactions,
    )


def test_fr16_period_boundaries() -> None:
    analysis = build_analysis(DATA_AS_OF, SETTINGS)
    lines = [
        _line("before", date(2025, 9, 30)),
        _line("first", date(2025, 10, 1)),
        _line("last", date(2026, 9, 30)),
        _line("after", date(2026, 10, 1)),
    ]

    picks = count_picks(lines, analysis.period_start, analysis.period_end)

    assert picks == {"first": 1, "last": 1}


def test_fr16_only_move_to_repair_counts() -> None:
    on = date(2026, 1, 15)
    lines = [
        _line("P1", on),
        _line("P1", on, "issue_part"),
        _line("P1", on, "return_to_stock"),
        _line("P1", on, "receipt"),
        _line("P2", on, "issue_part"),
    ]

    assert count_picks(lines, date(2025, 10, 1), DATA_AS_OF) == {"P1": 1}


def test_fr17_class_limits() -> None:
    classes = [movement_class(picks, SETTINGS) for picks in (0, 1, 5, 6, 23, 24)]

    assert classes == ["dead", "slow", "slow", "medium", "medium", "fast"]


def test_fr18_limits_from_settings_snapshot() -> None:
    settings = SETTINGS.model_copy(
        update={"fast_min_picks": 10, "medium_min_picks": 3, "slow_min_picks": 2}
    )
    analysis = build_analysis(DATA_AS_OF, settings)
    on = date(2026, 3, 1)
    counts = {"P00": 0, "P01": 1, "P05": 5, "P06": 6, "P23": 23, "P24": 24}
    data = _data(
        [(part, "1") for part in counts],
        [_line(part, on) for part, n in counts.items() for _ in range(n)],
    )

    parts = classify_parts(data, analysis)

    assert {part: result.movement_class for part, result in parts.items()} == {
        "P00": "dead",
        "P01": "dead",
        "P05": "medium",
        "P06": "medium",
        "P23": "fast",
        "P24": "fast",
    }


def test_fr17_answer_key_classes() -> None:
    imported = answer_key_import()
    analysis = build_analysis(imported.data_as_of, SETTINGS)
    key = expected()
    assert analysis.settings.model_dump() == key["settings"]

    parts = classify_parts(imported.data, analysis)

    assert {part: (result.picks, result.movement_class) for part, result in parts.items()} == {
        part: (e["picks"], CLASS_NAMES[e["class"]]) for part, e in key["parts"].items()
    }
    assert set(parts) == set(key["parts"])
    assert list(parts) == sorted(parts)
    for part in key["not_classified"]:
        assert part not in parts
    boundary = {"9000": 0, "0100": 1, "0500": 5, "0600": 6, "2300": 23, "10240": 24, "2400": 24}
    assert {part: parts[part].picks for part in boundary} == boundary


def test_fr17_zero_stock_part_classified() -> None:
    analysis = build_analysis(DATA_AS_OF, SETTINGS)
    on = date(2026, 3, 1)
    data = _data(
        [("ZERO", "0"), ("ZERO", "0"), ("STOCK", "3")],
        [_line("ZERO", on), _line("ONLY-TX", on)],
    )

    parts = classify_parts(data, analysis)

    assert list(parts) == ["STOCK", "ZERO"]
    assert parts["ZERO"].picks == 1
    assert parts["ZERO"].movement_class == "slow"
    assert parts["STOCK"].movement_class == "dead"
    assert "ONLY-TX" not in parts


def test_fr17_answer_key_zero_stock_part_classified() -> None:
    imported = answer_key_import()
    rows = [line for line in imported.data.inventory if line.part == "1008614-00"]
    assert rows
    assert all(line.quantity == Decimal("0") for line in rows)

    parts = classify_parts(imported.data, build_analysis(imported.data_as_of, SETTINGS))

    assert parts["1008614-00"].movement_class == "fast"


def test_fr16_quantity_ignored_one_line_one_pick() -> None:
    sheets: dict[FileRole, RawSheet] = {
        "locations": RawSheet(
            rows=(("Location", "Walk Path", "Aisle", "Level"), ("A-01", "1", "A", "1"))
        ),
        "inventory": RawSheet(
            rows=(("Part", "Part Description", "Quantity", "Location"), ("P1", "Bolt", "2", "A-01"))
        ),
        "transactions": RawSheet(
            rows=(
                ("Transaction Type", "Part", "Location", "Transaction Code", "Date", "Quantity"),
                ("Move to Repair", "P1", "A-01", "5000001", "2026-09-30 09:00", "7"),
            )
        ),
    }
    checked = [check_file(role, f"{role}.csv", sheet) for role, sheet in sheets.items()]
    imported = normalize_import(check_import(checked))

    parts = classify_parts(imported.data, build_analysis(imported.data_as_of, SETTINGS))

    assert parts["P1"].picks == 1
