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
    build_move_list_rounds,
    build_move_list_view,
)
from swp.domain.planning import EffectiveMove
from swp.domain.state import PlanState, Rule


def _move(
    number: int, part: str, source: str, target: str, round_: int = 1, rule: Rule = "manual"
) -> EffectiveMove:
    return EffectiveMove(
        move_number=number,
        part=part,
        from_location=source,
        to_location=target,
        rule=rule,
        round=round_,
        recommendation_id=None,
        swap_id=None,
        steps=(number,),
    )


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

    lines = _lines(build_move_list_rounds(data, moves))

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


def _random_moves(rng: random.Random) -> tuple[ImportData, list[EffectiveMove]]:
    codes = [f"L{n:02d}" for n in range(rng.randint(2, 9))]
    data = _data({code: rng.randint(0, 5) * 10 for code in codes})
    pool = [*codes, "X-UNKNOWN"]
    moves: list[EffectiveMove] = []
    number = 0

    def add(source: str, target: str, round_: int) -> None:
        nonlocal number
        number += 1
        moves.append(_move(number, str(rng.randint(1, 400)), source, target, round_))

    for round_ in rng.sample(range(5), rng.randint(1, 3)):
        if rng.random() < 0.5:  # a chain
            chain = rng.sample(pool, min(len(pool), rng.randint(2, 4)))
            for source, target in zip(chain, chain[1:], strict=False):
                add(source, target, round_)
        if rng.random() < 0.5:  # a cycle
            cycle = rng.sample(pool, min(len(pool), rng.randint(2, 4)))
            for source, target in zip(cycle, [*cycle[1:], cycle[0]], strict=True):
                add(source, target, round_)
        for _ in range(rng.randint(0, 8)):
            source, target = rng.sample(pool, 2)
            add(source, target, round_)
    rng.shuffle(moves)
    return data, moves


def test_fr38_out_before_in() -> None:
    rng = random.Random(38)
    for _ in range(500):
        data, moves = _random_moves(rng)
        rounds = build_move_list_rounds(data, moves)

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


def test_fr38_out_before_in_answer_key_round_1(data: ImportData) -> None:
    moves = [
        _move(1, "9300", "B-01-03-02", "C-01-01-01"),
        _move(2, "1100", "C-01-01-01", "A-01-01-03", rule="rule_1"),
    ]

    assert _parts(build_move_list_rounds(data, moves)) == ["1100", "9300"]


def test_fr38_cycle_in_walk_path_order(data: ImportData) -> None:
    moves = [
        _move(1, "9200", "D-01-02-03", "D-01-02-02"),
        _move(2, "9100", "D-01-02-02", "D-01-02-03"),
    ]

    assert _parts(build_move_list_rounds(data, moves)) == ["9100", "9200"]


def test_fr38_chain_orders_out_before_in() -> None:
    data = _data({"L1": 10, "L2": 20, "L3": 30, "L4": 40})
    moves = [
        _move(1, "a", "L1", "L2"),
        _move(2, "b", "L2", "L3"),
        _move(3, "c", "L3", "L4"),
    ]

    assert _parts(build_move_list_rounds(data, moves)) == ["c", "b", "a"]


def test_fr38_same_walk_path_by_part_text_order() -> None:
    data = _data({"L1": 10, "L2": 10, "T1": 90, "T2": 90})
    moves = [_move(1, "3050", "L1", "T1"), _move(2, "30400", "L2", "T2")]

    assert _parts(build_move_list_rounds(data, moves)) == ["30400", "3050"]


def test_fr38_unknown_from_location_sorts_last_by_code() -> None:
    data = _data({"L1": 900, "T1": 0})
    moves = [_move(1, "b", "Z-2", "T1"), _move(2, "a", "Z-1", "T1"), _move(3, "c", "L1", "T1")]

    assert _parts(build_move_list_rounds(data, moves)) == ["c", "a", "b"]


def test_fr38_rounds_keep_gaps_and_label_round_0() -> None:
    data = _data({"L1": 10, "L2": 20, "L3": 30})
    moves = [
        _move(1, "a", "L1", "L2", 3),
        _move(2, "b", "L2", "L3", 0),
        _move(3, "c", "L3", "L1", 1),
    ]

    rounds = build_move_list_rounds(data, moves)

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

    assert _parts(build_move_list_rounds(data, moves)) == ["a", "b", "c"]


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

    assert build_move_list_rounds(data, []) == []
    assert view.rounds == []
    assert view.version == 4
    assert view.header.model_dump() == {
        "name": "Plan",
        "data_as_of": date(2026, 10, 31),
        "uploaded_at": uploaded,
        "rounds": 0,
        "generated_at": generated,
    }
