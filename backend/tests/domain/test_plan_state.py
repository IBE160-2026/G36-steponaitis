"""FR-18 period and settings, NFR-12 stored-state upcasting (AD-4)."""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

from swp.domain.analysis import AnalysisSettings, build_analysis, period_for
from swp.domain.import_data import ImportData
from swp.domain.state import (
    AisleMark,
    LevelMark,
    LocationMark,
    NoSpace,
    PlanState,
    Recommendation,
    Run,
    Step,
)
from swp.domain.state_migrations import CURRENT_VERSIONS, upcast

FIXTURES = Path(__file__).resolve().parent / "fixtures"
SETTINGS = {
    "period_months": 12,
    "fast_min_picks": 24,
    "medium_min_picks": 6,
    "slow_min_picks": 1,
    "pick_group_min_shared_jobs": 5,
}


@pytest.mark.parametrize(
    ("data_as_of", "months", "start"),
    [
        (date(2026, 9, 30), 12, date(2025, 10, 1)),
        (date(2024, 2, 29), 12, date(2023, 3, 1)),
        (date(2026, 3, 31), 1, date(2026, 3, 1)),
        (date(2026, 1, 15), 24, date(2024, 1, 16)),
        (date(2026, 12, 31), 12, date(2026, 1, 1)),
    ],
)
def test_fr18_period_ends_on_data_as_of(data_as_of: date, months: int, start: date) -> None:
    assert period_for(data_as_of, months) == (start, data_as_of)


def test_fr18_period_rejects_non_positive_months() -> None:
    with pytest.raises(ValueError):
        period_for(date(2026, 9, 30), 0)


def test_fr18_period_in_built_analysis() -> None:
    analysis = build_analysis(date(2026, 9, 30), AnalysisSettings.model_validate(SETTINGS))

    dumped = analysis.model_dump(mode="json")
    assert dumped == {
        "schema_version": 1,
        "settings": SETTINGS,
        "period_start": "2025-10-01",
        "period_end": "2026-09-30",
        "parts": {},
        "pick_groups": [],
    }


@pytest.mark.parametrize(
    "override",
    [
        {"period_months": 0},
        {"slow_min_picks": -1},
        {"fast_min_picks": 6},
        {"medium_min_picks": 1},
        {"fast_min_picks": "x"},
    ],
)
def test_fr18_settings_validation(override: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        AnalysisSettings.model_validate({**SETTINGS, **override})


def test_fr18_settings_validation_accepts_answer_key_values() -> None:
    assert AnalysisSettings.model_validate(SETTINGS).model_dump() == SETTINGS


def test_nfr12_state_v1_fixture_upcasts_to_new() -> None:
    doc = json.loads((FIXTURES / "state_v1.json").read_text(encoding="utf-8"))

    upcast_doc = upcast("state", doc)

    assert upcast_doc == doc
    assert PlanState.model_validate(upcast_doc) == PlanState.new()
    assert PlanState.new().model_dump(mode="json") == doc


def test_nfr12_data_v1_fixture_upcasts() -> None:
    doc = json.loads((FIXTURES / "data_v1.json").read_text(encoding="utf-8"))

    data = ImportData.model_validate(upcast("data", doc))

    assert data.schema_version == CURRENT_VERSIONS["data"] == 2
    assert data.virtual_locations == []
    assert list(data.locations) == ["A-01-01-01"]
    assert data.inventory[0].quantity == Decimal("2.5")


def test_nfr12_missing_schema_version_is_version_1() -> None:
    assert upcast("analysis", {"a": 1}) == {"a": 1, "schema_version": 1}


@pytest.mark.parametrize("kind", sorted(CURRENT_VERSIONS))
def test_nfr12_future_version_rejected(kind: str) -> None:
    with pytest.raises(ValueError):
        upcast(kind, {"schema_version": CURRENT_VERSIONS[kind] + 1})  # type: ignore[arg-type]


def test_nfr12_best_marks_discriminated_by_kind() -> None:
    state = PlanState.model_validate(
        {
            "best_marks": [
                {"kind": "aisle", "aisle": "A"},
                {"kind": "level", "level": "1", "aisle": None},
                {"kind": "location", "location": "A-01-01-01"},
            ]
        }
    )

    assert [type(mark) for mark in state.best_marks] == [AisleMark, LevelMark, LocationMark]
    with pytest.raises(ValidationError):
        PlanState.model_validate({"best_marks": [{"kind": "shelf", "aisle": "A"}]})


def test_nfr12_steps_are_typed() -> None:
    doc = json.loads((FIXTURES / "state_v1.json").read_text(encoding="utf-8"))
    step = {
        "move_number": 1,
        "part": "9300",
        "from_location": "B-01-03-02",
        "to_location": "C-01-01-01",
        "rule": "manual",
        "round": 0,
    }

    state = PlanState.model_validate(upcast("state", {**doc, "steps": [step]}))

    assert state.steps == [Step(**step)]
    assert state.steps[0].recommendation_id is None
    assert state.steps[0].swap_id is None
    assert PlanState.model_validate(state.model_dump(mode="json")) == state
    for bad in ({"rule": "rule_4"}, {"move_number": 0}, {"round": -1}):
        with pytest.raises(ValidationError):
            PlanState.model_validate({**doc, "steps": [{**step, **bad}]})
    assert PlanState.model_validate(upcast("state", doc)) == PlanState.new()


def test_nfr12_runs_are_typed() -> None:
    doc = json.loads((FIXTURES / "state_v1.json").read_text(encoding="utf-8"))
    run = {
        "id": "4c6e0d9e-0000-5000-8000-000000000001",
        "round": 1,
        "created_at": "2026-11-22T12:00:00Z",
        "created_by": "planner",
        "recommendations": [
            {
                "id": "4c6e0d9e-0000-5000-8000-000000000001:1",
                "number": 1,
                "rule": "rule_1",
                "part": "1100",
                "from_location": "C-01-01-01",
                "to_location": "A-01-01-03",
            }
        ],
        "no_space": [{"part": "1200", "rule": "rule_1"}],
    }

    assert PlanState.model_validate(upcast("state", doc)).runs == []
    state = PlanState.model_validate(upcast("state", {**doc, "runs": [run]}))

    assert isinstance(state.runs[0], Run)
    assert state.runs[0].recommendations[0] == Recommendation(**run["recommendations"][0])
    assert state.runs[0].recommendations[0].status == "open"
    assert state.runs[0].no_space == [NoSpace(part="1200", rule="rule_1")]
    assert PlanState.model_validate(state.model_dump(mode="json")) == state
    for bad in (
        {"round": 0},
        {"created_at": "2026-11-22T12:00:00"},
        {"no_space": [{"part": "1200", "rule": "manual"}]},
    ):
        with pytest.raises(ValidationError):
            PlanState.model_validate({**doc, "runs": [{**run, **bad}]})
