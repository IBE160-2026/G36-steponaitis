"""Kernel: the home of every rule-defined order (AD-14).

Text compares in Python `str` (code-point) order, so `"30400" < "3050"`.
"""

from collections.abc import Callable, Iterable, Mapping

from swp.domain.analysis import PartAnalysis, PickGroup
from swp.domain.import_data import LocationData


def pick_group_order(groups: Iterable[PickGroup]) -> list[PickGroup]:
    """Most shared jobs first, ties by the lower part number, then the higher."""
    return sorted(groups, key=lambda group: (-group.shared_jobs, group.part_a, group.part_b))


def part_order(parts: Mapping[str, PartAnalysis]) -> list[str]:
    """Most picks first, ties in part-number (`str`) order."""
    return sorted(parts, key=lambda part: (-parts[part].picks, part))


def level_key(levels: Iterable[str]) -> Callable[[str], tuple[int, str] | tuple[str]]:
    """The sort key for Level values: numeric when every value in `levels` is all decimal
    digits (`isdecimal`, which `int` always accepts), else `str` order."""
    if all(level.isdecimal() for level in levels):
        return lambda level: (int(level), level)
    return lambda level: (level,)


def aisle_order(aisles: Iterable[str]) -> list[str]:
    """Distinct aisles in `str` order."""
    return sorted(set(aisles))


def location_order(locations: Mapping[str, LocationData]) -> list[str]:
    """By aisle (`str`), level (`level_key` over the whole import), Walk Path (numeric),
    then code (`str`)."""
    by_level = level_key(location.level for location in locations.values())

    def key(code: str) -> tuple[object, ...]:
        location = locations[code]
        return (location.aisle, by_level(location.level), location.walk_path, code)

    return sorted(locations, key=key)
