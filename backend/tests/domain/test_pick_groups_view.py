"""FR-20/AD-14: the pick groups table view (domain only)."""

from swp.domain.analysis import Analysis, AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.pick_groups import find_pick_groups
from swp.domain.state import PlanState
from swp.domain.views.pick_groups import PickGroupsView, build_pick_groups_view
from tests.domain.answer_key import answer_key_import, expected


def _analysis() -> Analysis:
    imported = answer_key_import()
    settings = AnalysisSettings.model_validate(expected()["settings"])
    analysis = build_analysis(imported.data_as_of, settings)
    return analysis.model_copy(
        update={
            "parts": classify_parts(imported.data, analysis),
            "pick_groups": find_pick_groups(imported.data, analysis),
        }
    )


def _view(analysis: Analysis | None = None, version: int = 3) -> PickGroupsView:
    imported = answer_key_import()
    return build_pick_groups_view(imported.data, analysis or _analysis(), PlanState.new(), version)


def test_fr20_pick_groups_view_order_and_fields() -> None:
    view = _view()
    data = answer_key_import().data
    assert view.version == 3
    assert [
        {"parts": [row.part_a.part, row.part_b.part], "shared_jobs": row.shared_jobs}
        for row in view.pick_groups
    ] == expected()["pick_groups_in_order"]
    for row in view.pick_groups:
        assert row.part_a.description == data.parts.get(row.part_a.part, "")
        assert row.part_b.description == data.parts.get(row.part_b.part, "")


def test_fr20_same_aisle_from_planning_copy() -> None:
    rows = _view().pick_groups
    same = [row for row in rows if row.same_aisle]
    assert [(row.part_a.part, row.part_b.part) for row in same] == [("9100", "9200")]
    assert same[0].part_a.aisle == same[0].part_b.aisle == "D"
    no_location = next(row for row in rows if row.part_a.part == "1008614-00")
    assert no_location.part_b.part == "2300"
    assert no_location.part_a.aisle is None
    assert no_location.same_aisle is False
    for row in rows:
        assert row.same_aisle == (
            row.part_a.aisle is not None and row.part_a.aisle == row.part_b.aisle
        )


def test_fr20_no_pick_groups_gives_empty_list() -> None:
    analysis = _analysis().model_copy(update={"pick_groups": []})
    view = _view(analysis, version=1)
    assert view.pick_groups == []
    assert view.version == 1


def test_fr20_view_reorders_stored_groups() -> None:
    analysis = _analysis()
    reversed_groups = analysis.model_copy(update={"pick_groups": analysis.pick_groups[::-1]})
    assert [
        (row.part_a.part, row.part_b.part, row.shared_jobs)
        for row in _view(reversed_groups).pick_groups
    ] == [
        (group["parts"][0], group["parts"][1], group["shared_jobs"])
        for group in expected()["pick_groups_in_order"]
    ]
