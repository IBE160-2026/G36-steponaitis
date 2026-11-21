"""Picks and movement classes of every Inventory part (FR-16, FR-17, FR-18).

Pure slice: imports only the kernel. The period and class limits come from the plan's
`Analysis` snapshot, never from `analysis.toml`.
"""

from collections import Counter
from collections.abc import Iterable
from datetime import date

from swp.domain.analysis import Analysis, AnalysisSettings, MovementClass, PartAnalysis
from swp.domain.import_data import ImportData, TransactionLine


def count_picks(transactions: Iterable[TransactionLine], start: date, end: date) -> dict[str, int]:
    """Picks per part: one per Move to Repair line dated `start..end` (inclusive), whatever
    its quantity. Parts without a pick are absent."""
    return dict(
        Counter(
            line.part
            for line in transactions
            if line.type == "move_to_repair" and start <= line.date <= end
        )
    )


def movement_class(picks: int, settings: AnalysisSettings) -> MovementClass:
    """The class of a part with `picks` picks, by the snapshot's lower limits."""
    if picks >= settings.fast_min_picks:
        return "fast"
    if picks >= settings.medium_min_picks:
        return "medium"
    if picks >= settings.slow_min_picks:
        return "slow"
    return "dead"


def classify_parts(data: ImportData, analysis: Analysis) -> dict[str, PartAnalysis]:
    """Picks and class of every distinct Inventory part, keyed in part-number order.

    Parts that appear only in Transactions get no entry.
    """
    picks = count_picks(data.transactions, analysis.period_start, analysis.period_end)
    parts = sorted({line.part for line in data.inventory})
    result: dict[str, PartAnalysis] = {}
    for part in parts:
        count = picks.get(part, 0)
        result[part] = PartAnalysis(
            picks=count, movement_class=movement_class(count, analysis.settings)
        )
    return result
