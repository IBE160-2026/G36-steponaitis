"""FR-13/FR-20: the part detail view (domain only)."""

import pytest

from swp.domain.analysis import Analysis, AnalysisSettings, build_analysis
from swp.domain.classify import classify_parts
from swp.domain.errors import DomainError
from swp.domain.pick_groups import find_pick_groups
from swp.domain.state import PlanState
from swp.domain.views.parts import PartDetail, build_part_detail
from tests.domain.answer_key import answer_key_import, expected


def _analysis(settings: AnalysisSettings | None = None) -> Analysis:
    imported = answer_key_import()
    settings = settings or AnalysisSettings.model_validate(expected()["settings"])
    analysis = build_analysis(imported.data_as_of, settings)
    return analysis.model_copy(
        update={
            "parts": classify_parts(imported.data, analysis),
            "pick_groups": find_pick_groups(imported.data, analysis),
        }
    )


def _detail(part: str, analysis: Analysis | None = None, version: int = 3) -> PartDetail:
    imported = answer_key_import()
    return build_part_detail(imported.data, analysis or _analysis(), PlanState.new(), version, part)


def test_fr13_part_detail_fast_part() -> None:
    detail = _detail("2400")
    assert detail.version == 3
    assert detail.part == "2400"
    assert detail.description == answer_key_import().data.parts["2400"]
    assert detail.picks == 24
    assert detail.movement_class == "fast"
    assert detail.class_threshold.model_dump() == {"min_picks": 24, "max_picks": None}
    assert detail.current_location is not None
    assert detail.current_location.code == expected()["parts"]["2400"]["current_location"]


def test_fr20_part_pick_groups_partner_and_shared_jobs() -> None:
    detail = _detail("2400")
    assert [(g.partner.part, g.shared_jobs) for g in detail.pick_groups] == [("5000", 8)]
    partner = detail.pick_groups[0].partner
    assert partner.description == "Engine oil 5W-30"
    assert partner.aisle == "A"  # 5000 is at A-01-02-03


def test_fr20_part_pick_groups_in_pick_group_order() -> None:
    # 8100 is in two groups: with 8200 (10 jobs) then 8300 (6 jobs).
    detail = _detail("8100")
    assert [(g.partner.part, g.shared_jobs) for g in detail.pick_groups] == [
        ("8200", 10),
        ("8300", 6),
    ]
    # The partner may be part_a of the stored group.
    assert [g.partner.part for g in _detail("8300").pick_groups] == ["8100"]


def test_fr20_part_pick_groups_none() -> None:
    assert _detail("4400").pick_groups == []


def test_fr13_part_detail_no_current_location() -> None:
    detail = _detail("1008614-00")
    assert detail.current_location is None
    assert detail.other_locations == []
    assert str(detail.total_stock) == "0"


def test_fr13_part_detail_several_locations() -> None:
    detail = _detail("1200")
    assert detail.current_location is not None
    assert detail.current_location.code == "B-01-01-02"
    assert [(o.location.code, str(o.stock)) for o in detail.other_locations] == [
        ("A-01-02-01", "2")
    ]
    assert detail.total_stock == 10


def test_fr13_part_detail_thresholds_per_class() -> None:
    assert _detail("4400").class_threshold.model_dump() == {"min_picks": 0, "max_picks": 0}
    assert _detail("0600").class_threshold.model_dump() == {"min_picks": 6, "max_picks": 23}
    slow = next(
        part for part, facts in expected()["parts"].items() if facts["class"] == "slow-moving"
    )
    assert _detail(slow).class_threshold.model_dump() == {"min_picks": 1, "max_picks": 5}


def test_fr13_part_detail_thresholds_come_from_settings() -> None:
    settings = AnalysisSettings.model_validate(
        {
            **expected()["settings"],
            "fast_min_picks": 30,
            "medium_min_picks": 10,
            "slow_min_picks": 2,
        }
    )
    analysis = _analysis(settings)
    detail = _detail("2400", analysis)
    assert detail.movement_class == "medium"
    assert detail.class_threshold.model_dump() == {"min_picks": 10, "max_picks": 29}
    slow = next(p for p, f in analysis.parts.items() if f.movement_class == "slow")
    assert _detail(slow, analysis).class_threshold.model_dump() == {
        "min_picks": 2,
        "max_picks": 9,
    }
    dead = next(p for p, f in analysis.parts.items() if f.movement_class == "dead")
    assert _detail(dead, analysis).class_threshold.model_dump() == {"min_picks": 0, "max_picks": 1}
    fast = next(p for p, f in analysis.parts.items() if f.movement_class == "fast")
    assert _detail(fast, analysis).class_threshold.model_dump() == {
        "min_picks": 30,
        "max_picks": None,
    }


@pytest.mark.parametrize("part", ["9999", "nope"])
def test_fr13_part_detail_unclassified_part_not_found(part: str) -> None:
    with pytest.raises(DomainError) as raised:
        _detail(part)
    assert raised.value.code == "not_found"
    assert raised.value.message == f"No part {part} in this plan."
