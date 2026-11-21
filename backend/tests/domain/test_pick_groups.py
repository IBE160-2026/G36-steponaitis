"""FR-18/FR-19/AD-14: jobs, shared jobs and pick groups (domain only)."""

from datetime import date
from decimal import Decimal

from swp.domain.analysis import AnalysisSettings, PickGroup, build_analysis
from swp.domain.import_data import (
    ImportData,
    InventoryLine,
    LocationData,
    TransactionLine,
    TransactionType,
)
from swp.domain.ordering import pick_group_order
from swp.domain.pick_groups import build_jobs, count_shared_jobs, find_pick_groups
from tests.domain.answer_key import answer_key_import, expected

DATA_AS_OF = date(2026, 9, 30)
IN_PERIOD = date(2026, 3, 1)
SETTINGS = AnalysisSettings(
    period_months=12,
    fast_min_picks=24,
    medium_min_picks=6,
    slow_min_picks=1,
    pick_group_min_shared_jobs=5,
)


def _line(
    part: str, code: str, on: date = IN_PERIOD, kind: TransactionType = "issue_part"
) -> TransactionLine:
    return TransactionLine(type=kind, part=part, transaction_code=code, date=on)


def _job(code: str, *parts: str, on: date = IN_PERIOD) -> list[TransactionLine]:
    return [_line(part, code, on) for part in parts]


def _data(parts: list[str], transactions: list[TransactionLine]) -> ImportData:
    return ImportData(
        locations={
            "A-01-01-01": LocationData(
                walk_path=Decimal("0"), aisle="A", level="1", section=None, position=None
            )
        },
        inventory=[
            InventoryLine(part=part, location="A-01-01-01", quantity=Decimal("1")) for part in parts
        ],
        parts={},
        transactions=transactions,
    )


def _groups(data: ImportData, settings: AnalysisSettings = SETTINGS) -> list[tuple[str, str, int]]:
    analysis = build_analysis(DATA_AS_OF, settings)
    return [(g.part_a, g.part_b, g.shared_jobs) for g in find_pick_groups(data, analysis)]


def _shared(data: ImportData) -> dict[tuple[str, str], int]:
    analysis = build_analysis(DATA_AS_OF, SETTINGS)
    parts = {line.part for line in data.inventory}
    jobs = build_jobs(data.transactions, parts, analysis.period_start, analysis.period_end)
    return count_shared_jobs(jobs)


def test_fr19_answer_key_pick_groups() -> None:
    imported = answer_key_import()
    analysis = build_analysis(imported.data_as_of, SETTINGS)

    groups = find_pick_groups(imported.data, analysis)

    assert [(g.part_a, g.part_b, g.shared_jobs) for g in groups] == [
        (e["parts"][0], e["parts"][1], e["shared_jobs"]) for e in expected()["pick_groups_in_order"]
    ]
    assert sum("8100" in (g.part_a, g.part_b) for g in groups) == 2
    assert [g.shared_jobs for g in groups].count(5) == 3


def test_fr19_traps_do_not_count() -> None:
    imported = answer_key_import()
    analysis = build_analysis(imported.data_as_of, SETTINGS)
    parts = {line.part for line in imported.data.inventory}
    jobs = build_jobs(imported.data.transactions, parts, analysis.period_start, analysis.period_end)

    shared = count_shared_jobs(jobs)
    groups = find_pick_groups(imported.data, analysis)

    assert shared[("6100", "6200")] == 4
    pairs = {(g.part_a, g.part_b) for g in groups}
    assert ("6100", "6200") not in pairs
    assert not any("9999" in pair for pair in pairs)
    for entry in expected()["not_pick_groups"]:
        assert tuple(entry["parts"]) not in pairs


def test_fr19_five_shared_jobs_form_a_group_four_do_not() -> None:
    lines = [line for n in range(5) for line in _job(f"J{n}", "P", "Q")]
    lines += [line for n in range(4) for line in _job(f"K{n}", "R", "S")]

    assert _groups(_data(["P", "Q", "R", "S"], lines)) == [("P", "Q", 5)]


def test_fr19_repeated_part_counts_once() -> None:
    lines = [line for n in range(4) for line in _job(f"J{n}", "P", "Q")]
    lines += _job("J9", "P", "P", "Q")
    data = _data(["P", "Q"], lines)

    assert _shared(data) == {("P", "Q"): 5}
    assert _groups(data) == [("P", "Q", 5)]


def test_fr19_code_zero_is_not_a_job() -> None:
    lines = [line for n in range(4) for line in _job(f"J{n}", "P", "Q")]
    lines += _job("0", "P", "Q") + _job("0", "P", "Q")
    data = _data(["P", "Q"], lines)

    assert _shared(data) == {("P", "Q"): 4}
    assert _groups(data) == []


def test_fr19_period_boundaries() -> None:
    lines = [line for n in range(3) for line in _job(f"J{n}", "P", "Q")]
    lines += _job("FIRST", "P", "Q", on=date(2025, 10, 1))
    lines += _job("LAST", "P", "Q", on=date(2026, 9, 30))
    lines += _job("BEFORE", "R", "S", on=date(2025, 9, 30))
    lines += _job("AFTER", "R", "S", on=date(2026, 10, 1))
    data = _data(["P", "Q", "R", "S"], lines)

    assert _shared(data) == {("P", "Q"): 5}
    assert _groups(data) == [("P", "Q", 5)]


def test_fr19_only_issue_part_lines_form_jobs() -> None:
    lines = [line for n in range(4) for line in _job(f"J{n}", "P", "Q")]
    for kind in ("move_to_repair", "receipt", "return_to_stock"):
        lines += [_line("P", f"X-{kind}", kind=kind), _line("Q", f"X-{kind}", kind=kind)]
    data = _data(["P", "Q"], lines)

    assert _shared(data) == {("P", "Q"): 4}
    assert _groups(data) == []


def test_fr19_only_inventory_parts() -> None:
    lines = [line for n in range(6) for line in _job(f"J{n}", "6100", "9999")]
    data = _data(["6100"], lines)

    assert _shared(data) == {}
    assert _groups(data) == []


def test_fr19_zero_stock_inventory_part_is_considered() -> None:
    lines = [line for n in range(5) for line in _job(f"J{n}", "P", "Q")]
    data = _data(["P", "Q"], lines)
    data.inventory[1] = data.inventory[1].model_copy(update={"quantity": Decimal("0")})

    assert _groups(data) == [("P", "Q", 5)]


def test_fr18_pick_group_minimum_from_settings_snapshot() -> None:
    lines = [line for n in range(5) for line in _job(f"J{n}", "P", "Q")]
    lines += [line for n in range(4) for line in _job(f"K{n}", "R", "S")]
    data = _data(["P", "Q", "R", "S"], lines)
    lower = SETTINGS.model_copy(update={"pick_group_min_shared_jobs": 4})

    assert _groups(data, lower) == [("P", "Q", 5), ("R", "S", 4)]


def test_fr19_part_in_several_groups() -> None:
    lines = [line for n in range(6) for line in _job(f"J{n}", "8100", "8200")]
    lines += [line for n in range(5) for line in _job(f"K{n}", "8100", "8300")]

    assert _groups(_data(["8100", "8200", "8300"], lines)) == [
        ("8100", "8200", 6),
        ("8100", "8300", 5),
    ]


def test_fr19_pick_group_order() -> None:
    groups = [
        PickGroup(part_a="3050", part_b="9000", shared_jobs=5),
        PickGroup(part_a="30400", part_b="9000", shared_jobs=5),
        PickGroup(part_a="30400", part_b="3050", shared_jobs=5),
        PickGroup(part_a="9100", part_b="9200", shared_jobs=7),
    ]

    ordered = pick_group_order(groups)

    assert [(g.part_a, g.part_b, g.shared_jobs) for g in ordered] == [
        ("9100", "9200", 7),
        ("30400", "3050", 5),
        ("30400", "9000", 5),
        ("3050", "9000", 5),
    ]
