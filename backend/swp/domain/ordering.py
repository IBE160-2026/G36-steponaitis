"""Kernel: the home of every rule-defined order (AD-14).

Text compares in Python `str` (code-point) order, so `"30400" < "3050"`.
"""

from collections.abc import Iterable, Mapping

from swp.domain.analysis import PartAnalysis, PickGroup


def pick_group_order(groups: Iterable[PickGroup]) -> list[PickGroup]:
    """Most shared jobs first, ties by the lower part number, then the higher."""
    return sorted(groups, key=lambda group: (-group.shared_jobs, group.part_a, group.part_b))


def part_order(parts: Mapping[str, PartAnalysis]) -> list[str]:
    """Most picks first, ties in part-number (`str`) order."""
    return sorted(parts, key=lambda part: (-parts[part].picks, part))
