"""FR-13/FR-14/FR-20/FR-36/AD-3: the plan views follow manual moves in the planning copy
(domain only, answer key)."""

import random
from decimal import Decimal

import pytest

from swp.domain import planning
from swp.domain.analysis import Analysis, PartAnalysis
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import (
    append_step,
    current_aisle,
    listed_parts,
    planning_copy,
    replay,
)
from swp.domain.state import PlanState
from swp.domain.views.locations import LocationsView, build_locations_view, occupied_percent
from swp.domain.views.parts import build_part_detail, build_parts_view
from swp.domain.views.pick_groups import build_pick_groups_view
from swp.domain.views.search import build_search_view
from tests.domain.answer_key import answer_key_import
from tests.domain.test_pick_groups_view import _analysis


@pytest.fixture(scope="module")
def data() -> ImportData:
    return answer_key_import().data


@pytest.fixture(scope="module")
def analysis() -> Analysis:
    return _analysis()


def _manual(state: PlanState, part: str, a: str, b: str) -> PlanState:
    return append_step(state, part=part, from_location=a, to_location=b, rule="manual")


def _aisle(view: LocationsView, aisle: str) -> tuple[int, int, int]:
    row = next(row for row in view.aisles if row.aisle == aisle)
    return row.locations, row.occupied, row.empty


def test_fr14_move_that_empties_a_location_updates_occupancy(data: ImportData) -> None:
    before = build_locations_view(data, PlanState.new(), 1)
    state = _manual(PlanState.new(), "9300", "B-01-03-02", "C-01-01-01")

    after = build_locations_view(data, state, 2)

    rows = {row.location.code: row for row in after.locations}
    assert rows["B-01-03-02"].occupied is False
    assert rows["B-01-03-02"].contents == []
    assert [(c.part, c.stock) for c in rows["C-01-01-01"].contents] == [
        ("1100", Decimal(12)),
        ("9300", Decimal(5)),
    ]
    total_b, occupied_b, empty_b = _aisle(before, "B")
    assert _aisle(after, "B") == (total_b, occupied_b - 1, empty_b + 1)
    assert _aisle(after, "C") == _aisle(before, "C")
    warehouse = after.warehouse
    assert warehouse.occupied == before.warehouse.occupied - 1
    assert warehouse.empty == before.warehouse.empty + 1
    assert warehouse.occupied_percent == occupied_percent(warehouse.occupied, warehouse.locations)
    assert after.version == 2


def test_fr13_parts_and_detail_follow_manual_moves(data: ImportData, analysis: Analysis) -> None:
    state = _manual(PlanState.new(), "9300", "B-01-03-02", "C-01-01-01")

    roster = build_parts_view(data, analysis, state, 2)
    detail = build_part_detail(data, analysis, state, 2, "9300")

    row = next(row for row in roster.parts if row.part == "9300")
    assert row.current_location is not None
    assert row.current_location.code == "C-01-01-01"
    assert row.other_locations == []
    assert row.total_stock == Decimal(5)
    assert detail.current_location is not None
    assert detail.current_location.code == "C-01-01-01"
    assert detail.version == roster.version == 2
    # The part that already held the target keeps it.
    kept = next(row for row in roster.parts if row.part == "1100")
    assert kept.current_location is not None
    assert kept.current_location.code == "C-01-01-01"


def test_fr20_mover_moved_into_partner_aisle_shows_same_aisle(
    data: ImportData, analysis: Analysis
) -> None:
    before = build_pick_groups_view(data, analysis, PlanState.new(), 1)
    state = _manual(PlanState.new(), "8100", "B-01-02-01", "C-01-03-01")

    after = build_pick_groups_view(data, analysis, state, 2)

    pair = next(r for r in after.pick_groups if (r.part_a.part, r.part_b.part) == ("8100", "8200"))
    assert (pair.part_a.aisle, pair.part_b.aisle) == ("C", "C")
    assert pair.same_aisle is True
    for old, new in zip(before.pick_groups, after.pick_groups, strict=True):
        for old_part, new_part in ((old.part_a, new.part_a), (old.part_b, new.part_b)):
            expected = "C" if old_part.part == "8100" else old_part.aisle
            assert new_part.aisle == expected, new_part.part
        if (old.part_a.part, old.part_b.part) != ("8100", "8200"):
            assert new.same_aisle == (
                new.part_a.aisle is not None and new.part_a.aisle == new.part_b.aisle
            )


def _random_moves(data: ImportData, seed: int, count: int = 12) -> PlanState:
    rng = random.Random(seed)
    codes = sorted(data.locations)
    state = PlanState.new()
    for _ in range(count):
        copy = planning_copy(data, state)
        held = sorted({(p, loc) for p, at in copy.by_part.items() for loc, q in at.items() if q})
        part, source = rng.choice(held)
        target = rng.choice([code for code in codes if code != source])
        state = _manual(state, part, source, target)
    return state


def test_fr36_classes_and_groups_stable_after_moves(data: ImportData, analysis: Analysis) -> None:
    def classes(state: PlanState) -> list[tuple[str, str, int]]:
        rows = build_parts_view(data, analysis, state, 1).parts
        return sorted((row.part, row.movement_class, row.picks) for row in rows)

    def groups(state: PlanState) -> list[tuple[str, str, int]]:
        rows = build_pick_groups_view(data, analysis, state, 1).pick_groups
        return [(row.part_a.part, row.part_b.part, row.shared_jobs) for row in rows]

    base_classes, base_groups = classes(PlanState.new()), groups(PlanState.new())
    sequences = [
        _manual(PlanState.new(), "9300", "B-01-03-02", "C-01-01-01"),
        _manual(PlanState.new(), "8100", "B-01-02-01", "C-01-03-01"),
        *(_random_moves(data, seed) for seed in range(10)),
    ]
    for index, state in enumerate(sequences):
        assert classes(state) == base_classes, index
        assert groups(state) == base_groups, index
        for part in listed_parts(data, analysis):
            detail = build_part_detail(data, analysis, state, 1, part)
            facts = analysis.parts[part]
            assert (detail.movement_class, detail.picks) == (facts.movement_class, facts.picks)


def test_ad3_views_replay_once_per_request(
    data: ImportData, analysis: Analysis, monkeypatch: pytest.MonkeyPatch
) -> None:
    state = _manual(PlanState.new(), "9300", "B-01-03-02", "C-01-01-01")
    calls: list[int] = []
    real = planning.replay

    def counting(*args: object, **kwargs: object) -> planning.Replay:
        calls.append(1)
        return real(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(planning, "replay", counting)
    builds = {
        "parts": lambda: build_parts_view(data, analysis, state, 2),
        "part": lambda: build_part_detail(data, analysis, state, 2, "9300"),
        "locations": lambda: build_locations_view(data, state, 2),
        "pick_groups": lambda: build_pick_groups_view(data, analysis, state, 2),
        "search": lambda: build_search_view(data, analysis, state, 2, "C-01"),
    }
    for name, build in builds.items():
        calls.clear()
        view = build()
        assert len(calls) == 1, name
        assert view.version == 2, name


def test_fr13_current_aisle_and_listed_parts(data: ImportData, analysis: Analysis) -> None:
    copy = replay(data, []).copy
    assert current_aisle(copy, "9300") == "B"
    assert current_aisle(copy, "1008614-00") is None  # only a zero-stock row
    assert current_aisle(copy, "unknown") is None
    moved = planning_copy(data, _manual(PlanState.new(), "9300", "B-01-03-02", "C-01-01-01"))
    assert current_aisle(moved, "9300") == "C"

    listed = listed_parts(data, analysis)
    assert list(listed) == [part for part in data.parts if part in analysis.parts]
    assert all(listed[part] == analysis.parts[part] for part in listed)
    assert set(listed) == set(analysis.parts) & set(data.parts)

    extra = analysis.model_copy(
        update={
            "parts": {**analysis.parts, "ONLY-TX": PartAnalysis(picks=3, movement_class="slow")}
        }
    )
    assert "ONLY-TX" not in listed_parts(data, extra)
    with pytest.raises(DomainError) as error:
        build_part_detail(data, extra, PlanState.new(), 1, "ONLY-TX")
    assert error.value.code == "not_found"


def test_fr20_pick_groups_view_carries_min_shared_jobs(
    data: ImportData, analysis: Analysis
) -> None:
    view = build_pick_groups_view(data, analysis, PlanState.new(), 1)
    assert view.min_shared_jobs == analysis.settings.pick_group_min_shared_jobs == 5
    changed = analysis.model_copy(
        update={"settings": analysis.settings.model_copy(update={"pick_group_min_shared_jobs": 3})}
    )
    assert build_pick_groups_view(data, changed, PlanState.new(), 1).min_shared_jobs == 3
