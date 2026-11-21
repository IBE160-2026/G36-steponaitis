"""Kernel: the home of every rule-defined order (AD-14).

Text compares in Python `str` (code-point) order, so `"30400" < "3050"`.
"""

from collections.abc import Iterable

from swp.domain.analysis import PickGroup


def pick_group_order(groups: Iterable[PickGroup]) -> list[PickGroup]:
    """Most shared jobs first, ties by the lower part number, then the higher."""
    return sorted(groups, key=lambda group: (-group.shared_jobs, group.part_a, group.part_b))
