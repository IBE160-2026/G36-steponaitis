"""FR-7/FR-18: the plan summary view (fields, check rules, counts, current round)."""

import uuid
from datetime import UTC, date, datetime

from swp.domain.analysis import (
    AnalysisSettings,
    PartAnalysis,
    PickGroup,
    build_analysis,
)
from swp.domain.planning import replay
from swp.domain.state import AisleMark, Outdated, PlanState, Recommendation, Run, Step
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
        copy=(replayed := replay(answer_key_import().data, state.steps)).copy,
        last_step=replayed.last,
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
    assert body["apply_all_count"] == 0
    assert body["kept_in_place"] == 0
    assert body["undo_preview"] is None
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
        "apply_all_count",
        "kept_in_place",
        "undo_preview",
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
    runs = [Run(id=f"run-{n}", round=n, created_at=NOW, created_by="planner") for n in (1, 3, 2)]

    assert _summary(PlanState(runs=runs)).current_round == 3
    assert _summary(PlanState()).current_round == 0


def test_fr22_summary_carries_best_and_empty_best_counts() -> None:
    body = _summary(PlanState(best_marks=[AisleMark(aisle="A")])).model_dump(mode="json")

    assert body["best_locations"] == 9
    assert body["empty_best_locations"] == 1


def _run_with(*statuses: str, round: int = 1) -> Run:
    """A run whose recommendation n (1-based) has part `P<n>` and the given stored status."""
    return Run(
        id=f"run-{round}",
        round=round,
        created_at=NOW,
        created_by="planner",
        recommendations=[
            Recommendation(
                id=f"run-{round}:{n}",
                number=n,
                rule="rule_1",
                part=f"P{n}",
                from_location="B-01-01-01",
                to_location="A-01-01-01",
                status=status,  # type: ignore[arg-type]
                outdated=Outdated(cause="marks") if status == "outdated" else None,
            )
            for n, status in enumerate(statuses, start=1)
        ],
    )


def _applied(rec_id: str, move_number: int) -> Step:
    return Step(
        move_number=move_number,
        part="X",
        from_location="B-01-01-01",
        to_location="A-01-01-01",
        rule="rule_1",
        round=1,
        recommendation_id=rec_id,
    )


def _recommendations_step(summary: PlanSummary) -> tuple[bool, int | None]:
    [step] = [s for s in summary.steps if s.key == "recommendations"]
    return step.checked, step.count


def test_ad3_apply_all_count_is_open_minus_kept() -> None:
    state = PlanState(
        runs=[_run_with("open", "open", "outdated", "open", "open")],
        steps=[_applied("run-1:1", 1)],
        next_move_number=2,
        keep_marks=["P2"],
    )

    assert _summary(state).apply_all_count == 2  # #4 and #5; #1 applied, #2 kept, #3 outdated


def test_ad3_apply_all_count_reads_only_the_latest_run() -> None:
    earlier = _run_with("open", "open", round=1)
    latest = _run_with("open", round=2)

    assert _summary(PlanState(runs=[latest, earlier])).apply_all_count == 1
    assert _summary(PlanState()).apply_all_count == 0


def test_fr7_recommendations_unchecked_without_run() -> None:
    assert _recommendations_step(_summary(PlanState(best_marks=[AisleMark(aisle="A")]))) == (
        False,
        None,
    )


def test_fr7_recommendations_unchecked_while_open_left() -> None:
    state = PlanState(runs=[_run_with("open", "outdated")])

    assert _recommendations_step(_summary(state)) == (False, None)


def test_fr7_recommendations_unchecked_while_kept_open_left() -> None:
    """A kept recommendation is still open: the round is not done (UX-DR6)."""
    state = PlanState(runs=[_run_with("open")], keep_marks=["P1"])
    summary = _summary(state)

    assert summary.apply_all_count == 0
    assert _recommendations_step(summary) == (False, None)


def test_fr7_recommendations_checked_when_none_open() -> None:
    state = PlanState(
        runs=[_run_with("open", "outdated")],
        steps=[_applied("run-1:1", 1)],
        next_move_number=2,
    )

    assert _recommendations_step(_summary(state)) == (True, None)
    assert _recommendations_step(_summary(PlanState(runs=[_run_with()]))) == (True, None)


def test_ad5_undo_preview_in_summary_from_last_step() -> None:
    step = Step(
        move_number=2,
        part="0100",
        from_location="A-01-01-01",
        to_location="C-01-03-02",
        rule="manual",
        round=0,
    )
    state = PlanState(steps=[step], next_move_number=3)

    preview = _summary(state).undo_preview

    assert preview is not None
    assert preview.model_dump(mode="json") == {
        "move_number": 2,
        "part": "0100",
        "from_location": "A-01-01-01",
        "to_location": "C-01-03-02",
        "effect": {"kind": "reverts_move", "move_number": 2},
    }
