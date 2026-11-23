"""FR-38/AD-14: the move list's lines, their order within a round and the rounds."""

import random
from collections import Counter
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from swp.domain import move_list
from swp.domain.import_data import ImportData, LocationData
from swp.domain.move_list import (
    MoveListLine,
    MoveListRound,
    MoveListSwap,
    build_move_list_rounds,
    build_move_list_view,
)
from swp.domain.planning import EffectiveMove, replay
from swp.domain.state import PlanState, Rule, Step


def _move(
    number: int,
    part: str,
    source: str,
    target: str,
    round_: int = 1,
    rule: Rule = "manual",
    swap_id: str | None = None,
) -> EffectiveMove:
    return EffectiveMove(
        move_number=number,
        part=part,
        from_location=source,
        to_location=target,
        rule=rule,
        round=round_,
        recommendation_id=None,
        swap_id=swap_id,
        steps=(number,),
    )


def _steps(moves: list[EffectiveMove], swap_size: int | None = None) -> list[Step]:
    """The step log behind `moves` when each move is its own step; a swap step carries
    `swap_size` (None models a step stored before sizes were kept)."""
    return [
        Step(
            move_number=m.move_number,
            part=m.part,
            from_location=m.from_location,
            to_location=m.to_location,
            rule=m.rule,
            round=m.round,
            swap_id=m.swap_id,
            swap_size=swap_size if m.swap_id is not None else None,
        )
        for m in sorted(moves, key=lambda m: m.move_number)
    ]


def _data(walk_paths: dict[str, int], parts: dict[str, str] | None = None) -> ImportData:
    return ImportData(
        locations={
            code: LocationData(
                walk_path=Decimal(path), aisle=code[0], level="1", section=None, position=None
            )
            for code, path in walk_paths.items()
        },
        inventory=[],
        parts=parts or {},
        transactions=[],
    )


def _lines(rounds: list[MoveListRound]) -> list[MoveListLine]:
    return [line for r in rounds for line in r.lines]


def _parts(rounds: list[MoveListRound]) -> list[str]:
    return [line.part for line in _lines(rounds)]


def test_fr38_lines_are_exactly_the_effective_moves(data: ImportData) -> None:
    moves = [
        _move(1, "1100", "C-01-01-01", "A-01-01-03", 1, "rule_1"),
        _move(2, "9300", "B-01-03-02", "C-01-01-01", 1),
        _move(5, "0100", "A-01-01-01", "B-01-03-02", 2),
        _move(7, "unknown", "Z-99", "A-01-01-02", 2),
    ]

    lines = _lines(build_move_list_rounds(data, moves, steps=[]))

    assert len(lines) == len(moves)
    assert Counter(
        (line.move_number, line.part, line.from_location, line.to_location, line.rule, line.round)
        for line in lines
    ) == Counter(
        (m.move_number, m.part, m.from_location, m.to_location, m.rule, m.round) for m in moves
    )
    by_part = {line.part: line for line in lines}
    assert by_part["1100"].description == data.parts["1100"]
    assert by_part["unknown"].description == ""


def _reaches(moves: list[EffectiveMove]) -> list[set[int]]:
    """Per move, every move reachable over `X -> Y when X.from == Y.to` (X != Y)."""
    successors = [
        [j for j, other in enumerate(moves) if j != i and move.from_location == other.to_location]
        for i, move in enumerate(moves)
    ]
    reach: list[set[int]] = []
    for start in range(len(moves)):
        seen: set[int] = set()
        todo = list(successors[start])
        while todo:
            node = todo.pop()
            if node not in seen:
                seen.add(node)
                todo.extend(successors[node])
        reach.append(seen)
    return reach


def _random_moves(rng: random.Random) -> tuple[ImportData, list[EffectiveMove], list[Step]]:
    """Random rounds of chains, cycles, swaps (some broken) and stray moves, and their log."""
    codes = [f"L{n:02d}" for n in range(rng.randint(2, 9))]
    data = _data({code: rng.randint(0, 5) * 10 for code in codes})
    pool = [*codes, "X-UNKNOWN"]
    moves: list[EffectiveMove] = []
    number = 0

    def add(source: str, target: str, round_: int, swap_id: str | None = None) -> None:
        nonlocal number
        number += 1
        part = str(rng.randint(1, 400))
        moves.append(_move(number, part, source, target, round_, swap_id=swap_id))

    for round_ in rng.sample(range(5), rng.randint(1, 3)):
        if rng.random() < 0.5:  # a chain
            chain = rng.sample(pool, min(len(pool), rng.randint(2, 4)))
            for source, target in zip(chain, chain[1:], strict=False):
                add(source, target, round_)
        if rng.random() < 0.5:  # a cycle
            cycle = rng.sample(pool, min(len(pool), rng.randint(2, 4)))
            for source, target in zip(cycle, [*cycle[1:], cycle[0]], strict=True):
                add(source, target, round_)
        if rng.random() < 0.5:  # a swap, sometimes with an extra part one way
            a, b = rng.sample(pool, 2)
            swap_id = f"swap-{number}"
            add(a, b, round_, swap_id)
            add(b, a, round_, swap_id)
            if rng.random() < 0.3:
                add(*rng.sample([a, b], 2), round_, swap_id)
        for _ in range(rng.randint(0, 8)):
            source, target = rng.sample(pool, 2)
            add(source, target, round_, rng.choice([None, None, None, "stray-1", "stray-2"]))
    steps = _steps(moves)
    # A step dropped from the log while its move stays listed: a swap it belonged to is then
    # not intact.
    if steps and rng.random() < 0.3:
        steps.pop(rng.randrange(len(steps)))
    rng.shuffle(moves)
    return data, moves, steps


def test_fr38_out_before_in() -> None:
    rng = random.Random(38)
    for _ in range(500):
        data, moves, steps = _random_moves(rng)
        rounds = build_move_list_rounds(data, moves, steps=steps)

        lines = _lines(rounds)
        assert Counter(line.move_number for line in lines) == Counter(m.move_number for m in moves)
        assert [r.round for r in rounds] == sorted({m.round for m in moves})
        by_number = {m.move_number: m for m in moves}
        for r in rounds:
            ordered = [by_number[line.move_number] for line in r.lines]
            assert all(m.round == r.round for m in ordered)
            reach = _reaches(ordered)
            for i, earlier in enumerate(ordered):
                for j in range(i + 1, len(ordered)):
                    if earlier.to_location == ordered[j].from_location:
                        # A later line empties the location `earlier` moves into: only in a cycle.
                        assert i in reach[j] and j in reach[i], (earlier, ordered[j])
            marked: dict[str | None, list[int]] = {}
            for at, line in enumerate(r.lines):
                if line.swap is not None:
                    marked.setdefault(by_number[line.move_number].swap_id, []).append(at)
            for swap_id, places in marked.items():
                group = [r.lines[at] for at in places]
                assert swap_id is not None
                assert places == list(range(places[0], places[0] + len(places))), swap_id
                assert [line.swap.index for line in group if line.swap] == list(
                    range(1, len(group) + 1)
                )
                first = group[0]
                assert all(
                    line.swap
                    == MoveListSwap(
                        index=line.swap.index,
                        size=len(group),
                        locations=(first.from_location, first.to_location),
                    )
                    for line in group
                    if line.swap
                )


def test_fr38_out_before_in_answer_key_round_1(data: ImportData) -> None:
    moves = [
        _move(1, "9300", "B-01-03-02", "C-01-01-01"),
        _move(2, "1100", "C-01-01-01", "A-01-01-03", rule="rule_1"),
    ]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["1100", "9300"]


def test_fr38_cycle_in_walk_path_order(data: ImportData) -> None:
    moves = [
        _move(1, "9200", "D-01-02-03", "D-01-02-02"),
        _move(2, "9100", "D-01-02-02", "D-01-02-03"),
    ]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["9100", "9200"]


def test_fr38_chain_orders_out_before_in() -> None:
    data = _data({"L1": 10, "L2": 20, "L3": 30, "L4": 40})
    moves = [
        _move(1, "a", "L1", "L2"),
        _move(2, "b", "L2", "L3"),
        _move(3, "c", "L3", "L4"),
    ]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["c", "b", "a"]


def test_fr38_same_walk_path_by_part_text_order() -> None:
    data = _data({"L1": 10, "L2": 10, "T1": 90, "T2": 90})
    moves = [_move(1, "3050", "L1", "T1"), _move(2, "30400", "L2", "T2")]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["30400", "3050"]


def test_fr38_unknown_from_location_sorts_last_by_code() -> None:
    data = _data({"L1": 900, "T1": 0})
    moves = [_move(1, "b", "Z-2", "T1"), _move(2, "a", "Z-1", "T1"), _move(3, "c", "L1", "T1")]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["c", "a", "b"]


def test_fr38_rounds_keep_gaps_and_label_round_0() -> None:
    data = _data({"L1": 10, "L2": 20, "L3": 30})
    moves = [
        _move(1, "a", "L1", "L2", 3),
        _move(2, "b", "L2", "L3", 0),
        _move(3, "c", "L3", "L1", 1),
    ]

    rounds = build_move_list_rounds(data, moves, steps=[])

    assert [(r.round, r.label) for r in rounds] == [
        (0, "before the first run"),
        (1, None),
        (3, None),
    ]
    assert [[line.part for line in r.lines] for r in rounds] == [["b"], ["c"], ["a"]]


def test_fr38_header_counts_distinct_rounds(monkeypatch: pytest.MonkeyPatch) -> None:
    data = _data({"L1": 10, "L2": 20, "L3": 30})
    moves = (_move(1, "a", "L1", "L2", 3), _move(2, "b", "L2", "L3", 1))
    monkeypatch.setattr(move_list, "replay", lambda *_: SimpleNamespace(moves=moves))
    instant = datetime(2026, 11, 23, tzinfo=UTC)

    view = move_list.build_move_list_view(
        data,
        PlanState(),
        version=1,
        name="Plan",
        data_as_of=date(2026, 11, 1),
        uploaded_at=instant,
        generated_at=instant,
    )

    assert [r.round for r in view.rounds] == [1, 3]
    assert view.header.rounds == 2


def test_fr38_cycle_ranked_by_its_lowest_walk_path() -> None:
    data = _data({"L1": 10, "L3": 30, "L5": 50, "T": 90})
    moves = [_move(1, "c", "L3", "T"), _move(2, "b", "L5", "L1"), _move(3, "a", "L1", "L5")]

    assert _parts(build_move_list_rounds(data, moves, steps=[])) == ["a", "b", "c"]


def test_fr38_no_moves_gives_no_rounds(data: ImportData) -> None:
    generated = datetime(2026, 11, 23, 9, 30, tzinfo=UTC)
    uploaded = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)

    view = build_move_list_view(
        data,
        PlanState(),
        version=4,
        name="Plan",
        data_as_of=date(2026, 10, 31),
        uploaded_at=uploaded,
        generated_at=generated,
    )

    assert build_move_list_rounds(data, [], steps=[]) == []
    assert view.rounds == []
    assert view.version == 4
    assert view.header.model_dump() == {
        "name": "Plan",
        "data_as_of": date(2026, 10, 31),
        "uploaded_at": uploaded,
        "rounds": 0,
        "generated_at": generated,
    }


def _swap_step(
    number: int,
    part: str,
    source: str,
    target: str,
    swap_id: str | None,
    swap_size: int | None = None,
) -> Step:
    return Step(
        move_number=number,
        part=part,
        from_location=source,
        to_location=target,
        rule="manual",
        round=0,
        swap_id=swap_id,
        swap_size=swap_size,
    )


# The answer key's 9100 (at D-01-02-02) and 9200 (at D-01-02-03) swapped as one swap "s1".
_SWAP = [
    _swap_step(1, "9100", "D-01-02-02", "D-01-02-03", "s1", 2),
    _swap_step(2, "9200", "D-01-02-03", "D-01-02-02", "s1", 2),
]


def _replayed(data: ImportData, steps: list[Step]) -> list[MoveListLine]:
    return _lines(build_move_list_rounds(data, replay(data, steps).moves, steps=steps))


def test_fr38_intact_swap_lines_are_marked(data: ImportData) -> None:
    lines = _replayed(data, _SWAP)

    pair = ("D-01-02-02", "D-01-02-03")
    assert [(line.part, line.rule) for line in lines] == [("9100", "manual"), ("9200", "manual")]
    assert [line.swap for line in lines] == [
        MoveListSwap(index=1, size=2, locations=pair),
        MoveListSwap(index=2, size=2, locations=pair),
    ]
    assert lines[0].model_dump()["swap"] == {"index": 1, "size": 2, "locations": pair}


def test_fr38_swap_mark_only_when_intact(data: ImportData) -> None:
    undone = _replayed(data, _SWAP[:1])
    combined = _replayed(data, [*_SWAP, _swap_step(3, "9200", "D-01-02-02", "A-01-01-02", None)])
    moved_back = _replayed(data, [*_SWAP, _swap_step(3, "9200", "D-01-02-02", "D-01-02-03", None)])

    assert [(line.part, line.swap) for line in undone] == [("9100", None)]
    assert sorted((line.part, line.to_location, line.swap) for line in combined) == [
        ("9100", "D-01-02-03", None),
        ("9200", "A-01-01-02", None),
    ]
    assert [(line.part, line.swap) for line in moved_back] == [("9100", None)]

    # A 3-step swap whose back step was undone: two lines one way only.
    data_ab = _data({"La": 10, "Lb": 20})
    p1, p2 = _move(1, "p1", "La", "Lb", swap_id="s2"), _move(2, "p2", "La", "Lb", swap_id="s2")
    rounds = build_move_list_rounds(data_ab, [p1, p2], steps=_steps([p1, p2]))
    assert [(line.part, line.rule, line.swap) for line in _lines(rounds)] == [
        ("p1", "manual", None),
        ("p2", "manual", None),
    ]

    # A 3-step swap whose p2 is moved back: one line each way is left, but the log holds
    # three steps of it.
    three = [
        Step(
            move_number=1,
            part="p1",
            from_location="La",
            to_location="Lb",
            rule="manual",
            round=0,
            swap_id="s4",
            swap_size=3,
        ),
        Step(
            move_number=2,
            part="p2",
            from_location="La",
            to_location="Lb",
            rule="manual",
            round=0,
            swap_id="s4",
            swap_size=3,
        ),
        Step(
            move_number=3,
            part="q",
            from_location="Lb",
            to_location="La",
            rule="manual",
            round=0,
            swap_id="s4",
            swap_size=3,
        ),
        Step(
            move_number=4, part="p2", from_location="Lb", to_location="La", rule="manual", round=0
        ),
    ]
    left = _replayed(data_ab, three)
    assert sorted((line.part, line.swap) for line in left) == [("p1", None), ("q", None)]

    # Its steps in different rounds.
    there, back = (
        _move(1, "x", "La", "Lb", 1, swap_id="s3"),
        _move(2, "y", "Lb", "La", 2, "manual", "s3"),
    )
    split = build_move_list_rounds(data_ab, [there, back], steps=_steps([there, back], 2))
    assert [line.swap for line in _lines(split)] == [None, None]


def test_fr38_fr35_partly_undone_swap_of_three_loses_its_marks() -> None:
    """Epic-8 retro item 72: p La → Lb with back-parts q1, q2 Lb → La (one swap of three
    steps); undoing q2's step leaves one move each way between the pair, which the stored
    size shows is not the whole swap."""
    data_ab = _data({"La": 10, "Lb": 20})
    p = _move(1, "p", "La", "Lb", swap_id="s5")
    q1 = _move(2, "q1", "Lb", "La", swap_id="s5")
    q2 = _move(3, "q2", "Lb", "La", swap_id="s5")

    whole = _lines(build_move_list_rounds(data_ab, [p, q1, q2], steps=_steps([p, q1, q2], 3)))
    partly = _lines(build_move_list_rounds(data_ab, [p, q1], steps=_steps([p, q1], 3)))

    assert [(line.part, line.swap and line.swap.index) for line in whole] == [
        ("p", 1),
        ("q1", 2),
        ("q2", 3),
    ]
    assert {line.swap.size for line in whole if line.swap} == {3}
    assert [(line.part, line.rule, line.swap) for line in partly] == [
        ("p", "manual", None),
        ("q1", "manual", None),
    ]


def test_fr38_nfr12_swap_stored_without_size_keeps_the_old_rule() -> None:
    """Steps stored before swap sizes were kept: two logged steps both ways count as intact."""
    data_ab = _data({"La": 10, "Lb": 20})
    p = _move(1, "p", "La", "Lb", swap_id="s6")
    q = _move(2, "q", "Lb", "La", swap_id="s6")

    lines = _lines(build_move_list_rounds(data_ab, [p, q], steps=_steps([p, q])))

    assert [line.swap for line in lines] == [
        MoveListSwap(index=1, size=2, locations=("La", "Lb")),
        MoveListSwap(index=2, size=2, locations=("La", "Lb")),
    ]


def test_fr38_swap_lines_follow_each_other() -> None:
    data = _data({"L2": 20, "L3": 30, "L5": 50})
    # One component: a (L2 -> L5) and b (L5 -> L2) swap; c (L5 -> L3) and d (L3 -> L2) close
    # a bigger cycle through it; d's key (Walk Path 30) falls between a's (20) and b's (50).
    plain = [
        _move(1, "a", "L2", "L5"),
        _move(2, "b", "L5", "L2"),
        _move(3, "c", "L5", "L3"),
        _move(4, "d", "L3", "L2"),
    ]
    swapped = [m.model_copy(update={"swap_id": "s1"}) if m.part in ("a", "b") else m for m in plain]

    assert _parts(build_move_list_rounds(data, plain, steps=_steps(plain))) == ["a", "d", "b", "c"]
    lines = _lines(build_move_list_rounds(data, swapped, steps=_steps(swapped)))
    assert [line.part for line in lines] == ["a", "b", "d", "c"]
    assert [(line.swap.index, line.swap.size) if line.swap else None for line in lines] == [
        (1, 2),
        (2, 2),
        None,
        None,
    ]


def test_fr38_manual_cycle_has_no_swap_mark(data: ImportData) -> None:
    steps = [step.model_copy(update={"swap_id": None}) for step in _SWAP]

    lines = _replayed(data, steps)

    assert [(line.part, line.swap) for line in lines] == [("9100", None), ("9200", None)]


def test_fr38_three_line_swap_is_marked() -> None:
    data = _data({"La": 10, "Lb": 20})
    moves = [
        _move(1, "p1", "La", "Lb", swap_id="s1"),
        _move(2, "p2", "La", "Lb", swap_id="s1"),
        _move(3, "q", "Lb", "La", swap_id="s1"),
    ]

    lines = _lines(build_move_list_rounds(data, moves, steps=_steps(moves)))

    assert [line.part for line in lines] == ["p1", "p2", "q"]
    pair = (lines[0].from_location, lines[0].to_location)
    assert pair == ("La", "Lb")
    assert [line.swap for line in lines] == [
        MoveListSwap(index=index, size=3, locations=pair) for index in (1, 2, 3)
    ]
