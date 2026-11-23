"""Generated imports at the AD-12 row limit (MAX_ROWS_PER_FILE = 25,000), for the 4 MB view
checks (AD-18, NFR-8). Synthetic only."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from swp.config import Settings
from swp.domain.import_data import (
    ImportData,
    InventoryLine,
    LocationData,
    NormalizedImport,
    TransactionLine,
)

NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)
# The configured MAX_ROWS_PER_FILE (AD-12, swp/config.py), not a copy of its value.
MAX_ROWS: int = Settings.model_fields["max_rows_per_file"].default


def max_size_import() -> NormalizedImport:
    """10 aisles x 25 sections x 5 levels x 20 positions = 25,000 locations."""
    locations: dict[str, LocationData] = {}
    for aisle in "ABCDEFGHIJ":
        for section in range(1, 26):
            for level in range(1, 6):
                for position in range(1, 21):
                    code = f"{aisle}-{section:02}-{level:02}-{position:02}"
                    locations[code] = LocationData(
                        walk_path=Decimal(len(locations) * 10),
                        aisle=aisle,
                        level=str(level),
                        section=str(section),
                        position=str(position),
                    )
    assert len(locations) == MAX_ROWS, "the generated layout must match MAX_ROWS_PER_FILE"
    data = ImportData(locations=locations, inventory=[], parts={}, transactions=[])
    return NormalizedImport(data_as_of=date(2026, 11, 1), data=data)


def stocked_max_size_import(parts: int = 100) -> NormalizedImport:
    """`max_size_import` with every location stocked by one of `parts` parts (worst case for
    rows that carry a class)."""
    imported = max_size_import()
    stocked = [
        InventoryLine(part=_part(n % parts), location=code, quantity=Decimal(1))
        for n, code in enumerate(imported.data.locations)
    ]
    names = {_part(n): f"Part {n}" for n in range(parts)}
    data = imported.data.model_copy(update={"inventory": stocked, "parts": names})
    return imported.model_copy(update={"data": data})


def full_max_size_import() -> NormalizedImport:
    """Every file at MAX_ROWS_PER_FILE rows: 25,000 locations, inventory lines, parts and
    transactions. Aisles A-E hold two parts per location, counted down from E (so the picked
    parts start far from the best aisle A); aisles F-J are empty, so a run has room to
    move. Half the transactions are Move to Repair lines (400 fast parts, 483 medium, 1
    slow), half Issue Part lines where parts 0-2,499 form quartets sharing 5 jobs each
    (3,750 pick groups)."""
    imported = max_size_import()
    codes = list(imported.data.locations)
    inventory = [
        InventoryLine(
            part=_part(n), location=codes[MAX_ROWS // 2 - 1 - n // 2], quantity=Decimal(1)
        )
        for n in range(MAX_ROWS)
    ]
    names = {_part(n): f"Part {n}" for n in range(MAX_ROWS)}
    last = imported.data_as_of
    picks = [(n, 24) for n in range(400)] + [(n, 6) for n in range(400, 883)] + [(883, 1)] * 2
    repairs = [
        TransactionLine(
            type="move_to_repair",
            part=_part(part),
            transaction_code="0",
            date=last - timedelta(days=pick * 7),
        )
        for part, count in picks
        for pick in range(count)
    ]
    issues = [
        TransactionLine(
            type="issue_part",
            part=_part(part),
            transaction_code=f"J{part // 4:04}-{job}",
            date=last - timedelta(days=job * 30),
        )
        for part in range(2_500)
        for job in range(5)
    ]
    transactions = repairs + issues
    assert len(transactions) == MAX_ROWS
    data = imported.data.model_copy(
        update={"inventory": inventory, "parts": names, "transactions": transactions}
    )
    return imported.model_copy(update={"data": data})


def _part(n: int) -> str:
    return f"P{n:05}"
