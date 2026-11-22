"""FR-7/FR-18: the plan summary view (fields, check rules, counts, current round)."""

import uuid
from datetime import UTC, date, datetime

from swp.domain.analysis import (
    AnalysisSettings,
    PartAnalysis,
    PickGroup,
    build_analysis,
)
from swp.domain.planning import planning_copy
from swp.domain.state import AisleMark, PlanState
from swp.domain.views.summary import STEP_KEYS, PlanSummary, build_summary
from tests.domain.answer_key import answer_key_import

SETTINGS = AnalysisSettings(
    period_months=12,
    fast_min_picks=24,
    medium_min_picks=6,
    slow_min_picks=1,
    pick_group_min_shared_jobs=5,
)
NOW = datetime(2026, 11, 21, 12, 30, tzinfo=UTC)
DATA_AS_OF = date(2026, 9, 30)


def _summary(state: PlanState | None = None, **analysis_fields: object) -> PlanSummary:
    analysis = build_analysis(DATA_AS_OF, SETTINGS).model_copy(update=analysis_fields)
    state = state if state is not None else PlanState.new()
    return build_summary(
        id=uuid.UUID(int=1),
        name="Demo",
        import_id=uuid.UUID(int=2),
        data_as_of=DATA_AS_OF,
        uploaded_at=NOW,
        created_by="planner",
        created_at=NOW,
        last_edited_by="planner",
        last_edited_at=NOW,
        version=1,
        analysis=analysis,
        state=state,
        copy=planning_copy(answer_key_import().data, state),
        location_count=2_000,
        part_count=350,
    )


def test_fr7_summary_fields_of_new_plan() -> None:
    summary = _summary()
    body = summary.model_dump(mode="json")

    assert body["data_as_of"] == "2026-09-30"
    assert body["uploaded_at"] == "2026-11-21T12:30:00Z"
    assert body["period_start"] == "2025-10-01"
    assert body["period_end"] == "2026-09-30"
    assert body["current_round"] == 0
    assert body["version"] == 1
    assert body["class_counts"] == {"fast": 0, "medium": 0, "slow": 0, "dead": 0}
    assert body["best_locations"] == 0
    assert body["empty_best_locations"] == 0
    assert set(body) == {
        "id",
        "name",
        "import_id",
        "data_as_of",
        "uploaded_at",
        "created_by",
        "created_at",
        "last_edited_by",
        "last_edited_at",
        "version",
        "current_round",
        "settings",
        "period_start",
        "period_end",
        "class_counts",
        "best_locations",
        "empty_best_locations",
        "steps",
    }


def test_fr18_summary_carries_settings_snapshot() -> None:
    assert _summary().settings == SETTINGS


def test_fr7_steps_in_flow_order_with_m1_check_rules_and_counts() -> None:
    steps = [(s.key, s.checked, s.count) for s in _summary().steps]

    assert [key for key, _, _ in steps] == list(STEP_KEYS)
    assert steps == [
        ("overview", True, None),
        ("parts", True, 350),
        ("locations", True, 2_000),
        ("pick-groups", True, 0),
        ("best-locations", False, None),
        ("recommendations", False, None),
        ("before-after", False, None),
        ("move-list", False, None),
    ]


def test_fr7_best_locations_checked_once_marked() -> None:
    state = PlanState(best_marks=[AisleMark(aisle="A")])
    checked = {s.key: s.checked for s in _summary(state).steps}

    assert checked["best-locations"] is True
    assert checked["recommendations"] is False


def test_fr7_class_counts_and_pick_groups_from_analysis() -> None:
    summary = _summary(
        parts={
            "P1": PartAnalysis(picks=30, movement_class="fast"),
            "P2": PartAnalysis(picks=10, movement_class="medium"),
            "P3": PartAnalysis(picks=12, movement_class="medium"),
            "P4": PartAnalysis(picks=0, movement_class="dead"),
        },
        pick_groups=[PickGroup(part_a="P1", part_b="P2", shared_jobs=6)],
    )

    assert summary.class_counts.model_dump() == {"fast": 1, "medium": 2, "slow": 0, "dead": 1}
    assert {s.key: s.count for s in summary.steps}["pick-groups"] == 1


def test_fr7_current_round_is_highest_run_round() -> None:
    state = PlanState(runs=[{"round": 1}, {"round": 3}, {"round": 2}, {"round": "x"}, {}])

    assert _summary(state).current_round == 3
    assert _summary(PlanState(runs=[{"other": 1}])).current_round == 0


def test_fr22_summary_carries_best_and_empty_best_counts() -> None:
    body = _summary(PlanState(best_marks=[AisleMark(aisle="A")])).model_dump(mode="json")

    assert body["best_locations"] == 9
    assert body["empty_best_locations"] == 1
