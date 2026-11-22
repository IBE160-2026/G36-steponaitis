"""The printed move list: rounds of ordered lines and a header (FR-38, AD-14).

Pure: `build_move_list_rounds` turns the effective moves from `planning.replay` into one line
per move, grouped by round. Within a round a line that moves a part into a location comes
after every line that empties it; lines that form a cycle keep Walk Path order, and the rest
follow Walk Path order wherever that rule allows. `build_move_list_view` is the view behind
GET /api/plans/{id}/move-list: one `replay` per request, it never writes.
"""

import heapq
from collections.abc import Callable, Sequence
from datetime import date, datetime

from pydantic import AwareDatetime, BaseModel

from swp.domain.import_data import ImportData
from swp.domain.ordering import walk_path_key
from swp.domain.planning import EffectiveMove, replay
from swp.domain.state import PlanState, Rule

ROUND_0_LABEL = "before the first run"


class MoveListLine(BaseModel):
    move_number: int
    round: int
    part: str
    description: str
    from_location: str
    to_location: str
    rule: Rule


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


def _order_round(
    moves: Sequence[EffectiveMove], key: Callable[[EffectiveMove], tuple[object, ...]]
) -> list[EffectiveMove]:
    """One round in out-before-in order: an edge X -> Y when X empties Y's to-location, so Y
    comes after X. A cycle (one strongly connected component) is ordered by `key`; the
    components follow a Kahn sort that always takes the ready one with the lowest key."""
    by_to: dict[str, list[int]] = {}
    for at, move in enumerate(moves):
        by_to.setdefault(move.to_location, []).append(at)
    successors = [
        [other for other in by_to.get(move.from_location, []) if other != at]
        for at, move in enumerate(moves)
    ]

    components = [sorted(c, key=lambda at: key(moves[at])) for c in _components(successors)]
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


def build_move_list_rounds(data: ImportData, moves: Sequence[EffectiveMove]) -> list[MoveListRound]:
    """One line per effective move, rounds ascending (only rounds with a move, numbers as
    stored), each round in out-before-in, then Walk Path order (FR-38)."""
    base = walk_path_key(data.locations)

    def key(move: EffectiveMove) -> tuple[object, ...]:
        return base(move.from_location, move.part, move.move_number)

    by_round: dict[int, list[EffectiveMove]] = {}
    for move in moves:
        by_round.setdefault(move.round, []).append(move)
    return [
        MoveListRound(
            round=number,
            label=ROUND_0_LABEL if number == 0 else None,
            lines=[
                MoveListLine(
                    move_number=move.move_number,
                    round=move.round,
                    part=move.part,
                    description=data.parts.get(move.part, ""),
                    from_location=move.from_location,
                    to_location=move.to_location,
                    rule=move.rule,
                )
                for move in _order_round(by_round[number], key)
            ],
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
    rounds = build_move_list_rounds(data, replay(data, state.steps).moves)
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
