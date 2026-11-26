"""Pick groups: Inventory parts used together on the same jobs (FR-18, FR-19).

Pure slice: imports only the kernel. The period and the minimum of shared jobs come from
the plan's `Analysis` snapshot, never from `analysis.toml`.
"""

import itertools
import re
from collections import Counter
from collections.abc import Iterable, Mapping, Set
from datetime import date

from swp.domain.analysis import Analysis, PickGroup
from swp.domain.import_data import ImportData, TransactionLine
from swp.domain.ordering import pick_group_order

NO_JOB_CODE = re.compile(r"[+-]?0+([.,]0+)?")
"""A transaction code that is zero ("0", "00", "0.0", "0,0", "-0", ...) after strip never
forms a job."""
MAX_JOB_PARTS = 100
"""A job with more distinct parts adds no pairs: it keeps pair counting from going quadratic
on one huge job (issue 86; the sample data's largest job has 4 parts)."""


def build_jobs(
    transactions: Iterable[TransactionLine], parts: Set[str], start: date, end: date
) -> dict[str, frozenset[str]]:
    """Jobs by transaction code: the distinct considered parts on the Issue Part lines dated
    `start..end` (inclusive) that share the code. A zero code (`"0"`, `"00"`, `"0.0"`,
    `"0,0"`, `"-0"`, ... after strip) never forms a job; parts not in `parts` are dropped."""
    jobs: dict[str, set[str]] = {}
    for line in transactions:
        if (
            line.type == "issue_part"
            and not NO_JOB_CODE.fullmatch(line.transaction_code.strip())
            and start <= line.date <= end
            and line.part in parts
        ):
            jobs.setdefault(line.transaction_code, set()).add(line.part)
    return {code: frozenset(members) for code, members in jobs.items()}


def count_shared_jobs(jobs: Mapping[str, Iterable[str]]) -> dict[tuple[str, str], int]:
    """Shared jobs per part pair, keyed `(a, b)` with `a < b` in `str` order. A job with more
    than `MAX_JOB_PARTS` distinct parts adds no pairs."""
    counts: Counter[tuple[str, str]] = Counter()
    for members in jobs.values():
        distinct = set(members)
        if len(distinct) <= MAX_JOB_PARTS:
            counts.update(itertools.combinations(sorted(distinct), 2))
    return dict(counts)


def find_pick_groups(data: ImportData, analysis: Analysis) -> list[PickGroup]:
    """Every pair of Inventory parts sharing at least the snapshot minimum of jobs, in the
    AD-14 order."""
    parts = {line.part for line in data.inventory}
    jobs = build_jobs(data.transactions, parts, analysis.period_start, analysis.period_end)
    minimum = analysis.settings.pick_group_min_shared_jobs
    return pick_group_order(
        PickGroup(part_a=a, part_b=b, shared_jobs=shared)
        for (a, b), shared in count_shared_jobs(jobs).items()
        if shared >= minimum
    )
