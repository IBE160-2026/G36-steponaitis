"""FR-15/AD-14: the search view (domain only)."""

from swp.domain.analysis import Analysis, AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.ordering import location_order
from swp.domain.state import PlanState
from swp.domain.views.search import SEARCH_LIMIT, SearchView, build_search_view
from tests.domain.answer_key import answer_key_import, expected


def _analysis() -> Analysis:
    imported = answer_key_import()
    settings = AnalysisSettings.model_validate(expected()["settings"])
    analysis = build_analysis(imported.data_as_of, settings)
    return analysis.model_copy(update={"parts": classify_parts(imported.data, analysis)})


def _search(query: str, version: int = 3) -> SearchView:
    imported = answer_key_import()
    return build_search_view(imported.data, _analysis(), PlanState.new(), version, query)


def test_fr15_search_matches_description_case_insensitive() -> None:
    view = _search(" OIL filter")
    assert view.version == 3
    assert view.query == " OIL filter"
    assert [(p.part, p.movement_class) for p in view.parts] == [("1008614-00", "fast")]
    assert view.part_count == 1
    assert view.locations == []
    assert view.location_count == 0


def test_fr15_search_matches_part_number() -> None:
    view = _search("8100")
    assert [p.part for p in view.parts] == ["8100"]
    assert view.parts[0].description == answer_key_import().data.parts["8100"]


def test_fr15_search_matches_location_codes_in_location_order() -> None:
    view = _search("a-01-01")
    data = answer_key_import().data
    expected_codes = [code for code in location_order(data.locations) if "A-01-01" in code]
    assert [m.location.code for m in view.locations] == expected_codes
    assert expected_codes == ["A-01-01-01", "A-01-01-02", "A-01-01-03"]
    assert view.location_count == 3
    assert view.locations[0].location.aisle == "A"


def test_fr15_search_parts_in_part_order() -> None:
    view = _search("0")
    picks = {part: facts["picks"] for part, facts in expected()["parts"].items()}
    matched = [p.part for p in view.parts]
    assert matched == sorted(matched, key=lambda part: (-picks[part], part))


def test_fr15_search_only_classified_parts() -> None:
    assert _search("9999").parts == []


def test_fr15_search_blank_and_no_match() -> None:
    for query in ("  ", "", "zzzz"):
        view = _search(query)
        assert view.parts == [] and view.locations == []
        assert view.part_count == 0 and view.location_count == 0


def test_fr15_search_caps_each_list() -> None:
    view = _search("-")
    assert len(view.locations) == min(SEARCH_LIMIT, view.location_count)
    assert view.location_count == len(answer_key_import().data.locations)
    assert view.location_count > SEARCH_LIMIT
    assert len(view.parts) <= SEARCH_LIMIT
