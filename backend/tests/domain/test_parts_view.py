"""FR-13/AD-14: the parts roster view and the part order (domain only)."""

from collections import Counter

from swp.domain.analysis import AnalysisSettings, PartAnalysis, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.ordering import part_order
from swp.domain.pick_groups import find_pick_groups
from swp.domain.state import PlanState
from swp.domain.views.parts import PartsView, build_parts_view
from tests.domain.answer_key import answer_key_import, expected


def _view(version: int = 3) -> PartsView:
    imported = answer_key_import()
    settings = AnalysisSettings.model_validate(expected()["settings"])
    analysis = build_analysis(imported.data_as_of, settings)
    analysis = analysis.model_copy(
        update={
            "parts": classify_parts(imported.data, analysis),
            "pick_groups": find_pick_groups(imported.data, analysis),
        }
    )
    return build_parts_view(imported.data, analysis, PlanState.new(), version)


def test_fr13_parts_view_lists_every_inventory_part_once() -> None:
    view = _view()
    parts = [row.part for row in view.parts]
    assert sorted(parts) == sorted(expected()["parts"])
    assert len(parts) == len(set(parts))
    assert "9999" not in parts
    assert view.version == 3


def test_fr13_parts_view_order_and_ranks() -> None:
    view = _view()
    parts = [row.part for row in view.parts]
    picks = {part: facts["picks"] for part, facts in expected()["parts"].items()}
    assert parts == sorted(picks, key=lambda part: (-picks[part], part))
    assert [row.rank for row in view.parts] == list(range(1, len(parts) + 1))
    # 30400 and 3050 both have 10 picks: part-number text order puts "30400" first.
    assert parts.index("30400") + 1 == parts.index("3050")


def test_fr13_parts_view_row_fields() -> None:
    rows = {row.part: row for row in _view().parts}
    facts = expected()["parts"]
    for part, row in rows.items():
        assert row.picks == facts[part]["picks"]
        current = row.current_location.code if row.current_location else None
        assert current == facts[part]["current_location"]
        assert row.kept_in_place is False
    group_counts = Counter(
        part for group in expected()["pick_groups_in_order"] for part in group["parts"]
    )
    for part, row in rows.items():
        assert row.pick_group_count == group_counts.get(part, 0), part
    assert rows["8100"].pick_group_count == 2
    assert rows["1200"].description == "Spark plug - Ford Focus"
    assert [ref.code for ref in rows["1200"].other_locations] == ["A-01-02-01"]
    assert rows["1008614-00"].current_location is None
    assert rows["1008614-00"].other_locations == []
    assert rows["4400"].movement_class == "dead"
    json = rows["1200"].model_dump(mode="json")
    assert json["total_stock"] == "10"
    assert json["current_location"]["is_best"] is False


def test_fr13_total_stock_sort_rank_is_dense_ascending() -> None:
    rows = _view().parts
    totals = sorted({row.total_stock for row in rows})
    for row in rows:
        assert row.total_stock_sort_rank == totals.index(row.total_stock)
    by_rank = sorted(rows, key=lambda row: row.total_stock_sort_rank)
    assert [row.total_stock for row in by_rank] == sorted(row.total_stock for row in rows)
    assert min(row.total_stock_sort_rank for row in rows) == 0


def test_fr13_part_order() -> None:
    parts = {
        "3050": PartAnalysis(picks=10, movement_class="medium"),
        "30400": PartAnalysis(picks=10, movement_class="medium"),
        "0100": PartAnalysis(picks=1, movement_class="slow"),
        "9": PartAnalysis(picks=30, movement_class="fast"),
        "10": PartAnalysis(picks=0, movement_class="dead"),
        "01": PartAnalysis(picks=0, movement_class="dead"),
    }
    assert part_order(parts) == ["9", "30400", "3050", "0100", "01", "10"]
