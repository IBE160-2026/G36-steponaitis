"""Kernel: the home of every rule-defined order (AD-14).

Text compares in Python `str` (code-point) order, so `"30400" < "3050"`.
"""

from collections.abc import Callable, Iterable, Mapping

from swp.domain.analysis import PartAnalysis, PickGroup
from swp.domain.import_data import LocationData
from swp.domain.state import AisleMark, BestMark, LevelMark, LocationMark


def pick_group_order(groups: Iterable[PickGroup]) -> list[PickGroup]:
    """Most shared jobs first, ties by the lower part number, then the higher."""
    return sorted(groups, key=lambda group: (-group.shared_jobs, group.part_a, group.part_b))


def part_order(parts: Mapping[str, PartAnalysis]) -> list[str]:
    """Most picks first, ties in part-number (`str`) order."""
    return sorted(parts, key=lambda part: (-parts[part].picks, part))


def fewest_picks_order(parts: Mapping[str, PartAnalysis]) -> list[str]:
    """Fewest picks first, ties in part-number (`str`) order (rule 2's order)."""
    return sorted(parts, key=lambda part: (parts[part].picks, part))


SortKey = Callable[[str], tuple[int, str] | tuple[str]]
"""The key `identifier_key` and `level_key` return."""


def identifier_key(values: Iterable[str]) -> SortKey:
    """The sort key for Level, Section or Position values: numeric when every value in
    `values` is all decimal digits (`isdecimal`, which `int` always accepts), else `str`
    order. Equal numbers (`"1"`, `"01"`) tie-break in `str` order."""
    if all(value.isdecimal() for value in values):
        return lambda value: (int(value), value)
    return lambda value: (value,)


def level_key(levels: Iterable[str]) -> SortKey:
    """The sort key for Level values (`identifier_key` over `levels`)."""
    return identifier_key(levels)


def aisle_order(aisles: Iterable[str]) -> list[str]:
    """Distinct aisles in `str` order."""
    return sorted(set(aisles))


def part_number_order(parts: Iterable[str]) -> list[str]:
    """Distinct part numbers in `str` order."""
    return sorted(set(parts))


def location_code_order(codes: Iterable[str]) -> list[str]:
    """Distinct location codes in plain `str` order of the code (rule 1's pool order)."""
    return sorted(set(codes))


def walk_path_order(codes: Iterable[str], locations: Mapping[str, LocationData]) -> list[str]:
    """Distinct location codes by Walk Path (numeric), ties by code (`str`) (FR-48)."""
    return sorted(set(codes), key=lambda code: (locations[code].walk_path, code))


def location_order(locations: Mapping[str, LocationData]) -> list[str]:
    """By aisle (`str`), level (`level_key` over the whole import), Walk Path (numeric),
    then code (`str`)."""
    by_level = level_key(location.level for location in locations.values())

    def key(code: str) -> tuple[object, ...]:
        location = locations[code]
        return (location.aisle, by_level(location.level), location.walk_path, code)

    return sorted(locations, key=key)


def category_check_order(
    current: Mapping[str, str], locations: Mapping[str, LocationData]
) -> list[str]:
    """The category check's rows (FR-46): the parts of `current` (part → current location
    code) by their location's `location_order` position, then part number (`str`). A code
    missing from `locations` sorts after every known one, by code."""
    position = {code: index for index, code in enumerate(location_order(locations))}

    def key(part: str) -> tuple[object, ...]:
        code = current[part]
        return (code not in position, position.get(code, 0), code, part)

    return sorted(current, key=key)


def mark_order(marks: Iterable[BestMark], locations: Mapping[str, LocationData]) -> list[BestMark]:
    """Aisle marks (by aisle); then level marks (by `level_key` over the import's levels, all
    aisles before one aisle, then by aisle); then location marks (by `location_order`
    position, codes not in the import last, by code)."""
    marks = list(marks)
    numeric = all(location.level.isdecimal() for location in locations.values())
    by_level = level_key(location.level for location in locations.values())

    def level_sort(mark: LevelMark) -> tuple[object, ...]:
        # A text level against an all-numeric import has no numeric key: it sorts last.
        if numeric and not mark.level.isdecimal():
            level: tuple[object, ...] = (1, (mark.level,))
        else:
            level = (0, by_level(mark.level))
        return (level, mark.aisle is not None, mark.aisle or "")

    position = {code: index for index, code in enumerate(location_order(locations))}
    return [
        *sorted((m for m in marks if isinstance(m, AisleMark)), key=lambda m: m.aisle),
        *sorted((m for m in marks if isinstance(m, LevelMark)), key=level_sort),
        *sorted(
            (m for m in marks if isinstance(m, LocationMark)),
            key=lambda m: (m.location not in position, position.get(m.location, 0), m.location),
        ),
    ]


def walk_path_key(
    locations: Mapping[str, LocationData],
) -> Callable[[str, str, int], tuple[object, ...]]:
    """The base key of a move-list line (FR-38): the from-location's Walk Path (numeric), then
    part number (`str`), then move number. A from-location missing from `locations` sorts
    after every known one, by code."""

    def key(from_location: str, part: str, move_number: int) -> tuple[object, ...]:
        location = locations.get(from_location)
        if location is None:
            return (1, 0, from_location, part, move_number)
        return (0, location.walk_path, "", part, move_number)

    return key
