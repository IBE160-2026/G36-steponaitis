"""The printed move list: rounds of ordered lines and a header (FR-38, AD-14).

Pure: `build_move_list_rounds` turns the effective moves from `planning.replay` into one line
per move, grouped by round. Within a round a line that moves a part into a location comes
after every line that empties it; lines that form a cycle keep Walk Path order, and the rest
follow Walk Path order wherever that rule allows. The lines of an intact swap (FR-51, AD-16/17:
moves sharing a `swap_id`, every step of it still logged - its stored `swap_size` - and each
its own effective move, in one round, both ways between one pair of locations) follow each
other and carry `swap`; any other line, including a cycle of plain manual moves, has
`swap = None`. `build_move_list_view` is the view behind GET /api/plans/{id}/move-list: one
`replay` per request, it never writes.
"""

import heapq
from collections.abc import Callable, Collection, Sequence
from datetime import date, datetime

from pydantic import AwareDatetime, BaseModel

from swp.domain.import_data import ImportData
from swp.domain.ordering import walk_path_key
from swp.domain.planning import EffectiveMove, replay
from swp.domain.state import PlanState, Rule, Step

ROUND_0_LABEL = "before the first run"


class MoveListSwap(BaseModel):
    """A line's place in an intact swap: line `index` of `size`; `locations` is the
    (from-location, to-location) of the group's first printed line, the same on every line."""

    index: int
    size: int
    locations: tuple[str, str]


class MoveListLine(BaseModel):
    move_number: int
    round: int
    part: str
    description: str
    from_location: str
    to_location: str
    rule: Rule
    swap: MoveListSwap | None


class MoveListRound(BaseModel):
    round: int
    label: str | None
    lines: list[MoveListLine]


class MoveListHeader(BaseModel):
    name: str
    data_as_of: date
    uploaded_at: AwareDatetime
    rounds: int
    generated_at: AwareDatetime


class MoveListView(BaseModel):
    version: int
    header: MoveListHeader
    rounds: list[MoveListRound]


def _components(successors: list[list[int]]) -> list[list[int]]:
    """Strongly connected components of a graph given as successor lists (iterative Tarjan)."""
    count = len(successors)
    index = [-1] * count
    low = [0] * count
    on_stack = [False] * count
    stack: list[int] = []
    components: list[list[int]] = []
    counter = 0
    for root in range(count):
        if index[root] != -1:
            continue
        work: list[tuple[int, int]] = [(root, 0)]
        while work:
            node, child = work.pop()
            if child == 0:
                index[node] = low[node] = counter
                counter += 1
                stack.append(node)
                on_stack[node] = True
            if child < len(successors[node]):
                work.append((node, child + 1))
                nxt = successors[node][child]
                if index[nxt] == -1:
                    work.append((nxt, 0))
                elif on_stack[nxt]:
                    low[node] = min(low[node], index[nxt])
                continue
            if low[node] == index[node]:
                component: list[int] = []
                while True:
                    member = stack.pop()
                    on_stack[member] = False
                    component.append(member)
                    if member == node:
                        break
                components.append(component)
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
    return components


def _intact_swaps(moves: Sequence[EffectiveMove], steps: Sequence[Step]) -> set[str]:
    """The swap ids whose swap is intact (AD-17): every step of it still logged (exactly its
    stored `swap_size`; at least two for an older step stored without a size), each its own
    effective move (none undone, combined or moved back), all in one round, and the moves
    go both ways between one pair of locations."""
    logged: dict[str, list[int]] = {}
    sizes: dict[str, int] = {}
    for step in steps:
        if step.swap_id is not None:
            logged.setdefault(step.swap_id, []).append(step.move_number)
            if step.swap_size is not None:
                sizes.setdefault(step.swap_id, step.swap_size)
    grouped: dict[str, list[EffectiveMove]] = {}
    for move in moves:
        if move.swap_id is not None:
            grouped.setdefault(move.swap_id, []).append(move)
    intact: set[str] = set()
    for swap_id, group in grouped.items():
        numbers = logged.get(swap_id, [])
        size = sizes.get(swap_id)
        if len(numbers) < 2 or (size is not None and len(numbers) != size):
            continue
        if sorted(numbers) != sorted(m.move_number for m in group):
            continue
        # Safeguard for AD-17's "its own effective move": replay already clears `swap_id`
        # on a combined move, so this cannot fire on replay output today.
        if any(m.steps != (m.move_number,) for m in group):
            continue
        if len({m.round for m in group}) != 1:
            continue
        pairs = {frozenset((m.from_location, m.to_location)) for m in group}
        directions = {(m.from_location, m.to_location) for m in group}
        if len(pairs) == 1 and len(next(iter(pairs))) == 2 and len(directions) == 2:
            intact.add(swap_id)
    return intact


def _order_round(
    moves: Sequence[EffectiveMove],
    key: Callable[[EffectiveMove], tuple[object, ...]],
    swaps: Collection[str] = frozenset(),
) -> list[EffectiveMove]:
    """One round in out-before-in order: an edge X -> Y when X empties Y's to-location, so Y
    comes after X. A cycle (one strongly connected component) is ordered by `key`, except
    that the lines of an intact swap in `swaps` sit together at their group's lowest key;
    the components follow a Kahn sort that always takes the ready one with the lowest key."""
    by_to: dict[str, list[int]] = {}
    for at, move in enumerate(moves):
        by_to.setdefault(move.to_location, []).append(at)
    successors = [
        [other for other in by_to.get(move.from_location, []) if other != at]
        for at, move in enumerate(moves)
    ]

    lowest: dict[str, tuple[object, ...]] = {}
    for move in moves:
        if move.swap_id is not None and move.swap_id in swaps:
            own = key(move)
            held = lowest.get(move.swap_id)
            lowest[move.swap_id] = own if held is None else min(held, own)

    def inside(at: int) -> tuple[tuple[object, ...], tuple[object, ...]]:
        """A swap line at its group's lowest key, then by its own; others by their own."""
        own = key(moves[at])
        swap_id = moves[at].swap_id
        group = lowest.get(swap_id) if swap_id is not None else None
        return (own if group is None else group, own)

    components = [sorted(c, key=inside) for c in _components(successors)]
    component_of = [0] * len(moves)
    for number, component in enumerate(components):
        for at in component:
            component_of[at] = number
    after: list[set[int]] = [set() for _ in components]
    waiting = [0] * len(components)
    for at, targets in enumerate(successors):
        for other in targets:
            source, target = component_of[at], component_of[other]
            if source != target and target not in after[source]:
                after[source].add(target)
                waiting[target] += 1

    ready = [
        (key(moves[component[0]]), number)
        for number, component in enumerate(components)
        if waiting[number] == 0
    ]
    heapq.heapify(ready)
    ordered: list[EffectiveMove] = []
    while ready:
        _, number = heapq.heappop(ready)
        ordered.extend(moves[at] for at in components[number])
        for target in after[number]:
            waiting[target] -= 1
            if waiting[target] == 0:
                heapq.heappush(ready, (key(moves[components[target][0]]), target))
    return ordered


def _lines(
    data: ImportData, ordered: Sequence[EffectiveMove], swaps: Collection[str]
) -> list[MoveListLine]:
    """The lines of one ordered round; each intact swap's lines carry their place in it."""
    printed: dict[str, list[EffectiveMove]] = {}
    for move in ordered:
        if move.swap_id is not None and move.swap_id in swaps:
            printed.setdefault(move.swap_id, []).append(move)
    lines: list[MoveListLine] = []
    for move in ordered:
        group = printed.get(move.swap_id) if move.swap_id is not None else None
        swap = (
            MoveListSwap(
                index=group.index(move) + 1,
                size=len(group),
                locations=(group[0].from_location, group[0].to_location),
            )
            if group
            else None
        )
        lines.append(
            MoveListLine(
                move_number=move.move_number,
                round=move.round,
                part=move.part,
                description=data.parts.get(move.part, ""),
                from_location=move.from_location,
                to_location=move.to_location,
                rule=move.rule,
                swap=swap,
            )
        )
    return lines


def build_move_list_rounds(
    data: ImportData, moves: Sequence[EffectiveMove], *, steps: Sequence[Step]
) -> list[MoveListRound]:
    """One line per effective move, rounds ascending (only rounds with a move, numbers as
    stored), each round in out-before-in, then Walk Path order (FR-38); the lines of an
    intact swap (checked against the step log `steps`) follow each other and are marked."""
    base = walk_path_key(data.locations)

    def key(move: EffectiveMove) -> tuple[object, ...]:
        return base(move.from_location, move.part, move.move_number)

    swaps = _intact_swaps(moves, steps)
    by_round: dict[int, list[EffectiveMove]] = {}
    for move in moves:
        by_round.setdefault(move.round, []).append(move)
    return [
        MoveListRound(
            round=number,
            label=ROUND_0_LABEL if number == 0 else None,
            lines=_lines(data, _order_round(by_round[number], key, swaps), swaps),
        )
        for number in sorted(by_round)
    ]


def build_move_list_view(
    data: ImportData,
    state: PlanState,
    *,
    version: int,
    name: str,
    data_as_of: date,
    uploaded_at: datetime,
    generated_at: datetime,
) -> MoveListView:
    """The plan's move list as it is now, with its header."""
    rounds = build_move_list_rounds(data, replay(data, state.steps).moves, steps=state.steps)
    return MoveListView(
        version=version,
        header=MoveListHeader(
            name=name,
            data_as_of=data_as_of,
            uploaded_at=uploaded_at,
            rounds=len(rounds),
            generated_at=generated_at,
        ),
        rounds=rounds,
    )
