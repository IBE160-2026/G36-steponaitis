"""FR-28/FR-29/AD-7/NFR-12: reasons, `revalidate` and the recommendations view (domain only).

`_do` mirrors the command service: `apply`, then `revalidate` when the command changed the
plan (AD-6).
"""

import json
import uuid
from pathlib import Path

import pytest

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    ApplyRecommendation,
    Command,
    Event,
    ManualMove,
    RecommendationsOutdated,
    RemoveBestMark,
    SetBestMark,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.recommendations import (
    RecommendationsView,
    build_recommendations_view,
    revalidate,
)
from swp.domain.state import AisleMark, Outdated, PlanState, Recommendation
from swp.domain.state_migrations import upcast
from tests.domain.answer_key import CTX, MARKS, run_command

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _do(
    state: PlanState, command: Command, data: ImportData, analysis: Analysis
) -> tuple[PlanState, list[Event]]:
    applied = apply(state, command, CTX, data, analysis)
    if not applied.events:
        return applied.state, []
    revalidated = revalidate(data, analysis, applied.state)
    return revalidated.state, [*applied.events, *revalidated.events]


def _manual(part: str, from_location: str, to_location: str) -> ManualMove:
    return ManualMove.model_validate(
        {
            "command_id": uuid.uuid4(),
            "base_version": 1,
            "part": part,
            "from": from_location,
            "to": to_location,
        }
    )


def _apply(rec_id: str) -> ApplyRecommendation:
    return ApplyRecommendation(command_id=uuid.uuid4(), base_version=1, recommendation_id=rec_id)


def _remove_aisle_a() -> RemoveBestMark:
    return RemoveBestMark(command_id=uuid.uuid4(), base_version=1, mark=MARKS[0])


@pytest.fixture
def run_1(data: ImportData, analysis: Analysis) -> PlanState:
    """Answer-key plan, aisle A marked, run 1 done."""
    return run_command(data, analysis, PlanState(best_marks=MARKS)).state


def _rec(state: PlanState, number: int) -> Recommendation:
    return next(r for r in state.runs[-1].recommendations if r.number == number)


def _view(state: PlanState, data: ImportData, analysis: Analysis) -> RecommendationsView:
    return build_recommendations_view(data, analysis, state, 7)


def _outdated_events(events: list[Event]) -> list[tuple[int, str]]:
    return [(e.count, e.cause) for e in events if isinstance(e, RecommendationsOutdated)]


def _rejected_cause(state: PlanState, rec_id: str, data: ImportData, analysis: Analysis) -> object:
    with pytest.raises(DomainError) as raised:
        apply(state, _apply(rec_id), CTX, data, analysis)
    assert raised.value.code == "command_rejected"
    return raised.value.details


# --- FR-28: reasons and "no space" causes ---


def test_fr28_reasons_after_run_1(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    view = _view(run_1, data, analysis)

    assert view.version == 7
    assert view.run is not None
    assert (view.run.round, view.run.created_by) == (1, "planner")
    assert view.run.id == run_1.runs[-1].id
    assert [r.number for r in view.recommendations] == list(range(1, 9))
    assert all(r.status == "open" and r.applied is None for r in view.recommendations)
    one, two, six = view.recommendations[0], view.recommendations[1], view.recommendations[5]
    assert one.reason is not None and one.reason.model_dump() == {
        "kind": "class",
        "movement_class": "fast",
        "picks": analysis.parts["1100"].picks,
        "threshold": {"min_picks": 24, "max_picks": None},
    }
    assert two.part == "4400"
    assert two.reason is not None and two.reason.model_dump() == {
        "kind": "class",
        "movement_class": "dead",
        "picks": 0,
        "threshold": {"min_picks": 0, "max_picks": 0},
    }
    assert (six.part, six.to_location) == ("8100", "C-01-03-01")
    assert six.reason is not None and six.reason.model_dump() == {
        "kind": "pick_group",
        "partner": "8200",
        "partner_aisle": "C",
        "shared_jobs": 10,
        "min_shared_jobs": 5,
    }


def test_fr28_no_space_causes(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    view = _view(run_1, data, analysis)

    assert [(n.part, n.rule) for n in view.no_space] == [
        ("1200", "rule_1"),
        ("10240", "rule_1"),
        ("2400", "rule_1"),
        ("6600", "rule_3"),
    ]
    first, last = view.no_space[0], view.no_space[-1]
    assert first.cause.model_dump() == {"rule": "rule_1", "aisle": None, "outside_best": False}
    assert first.reason is not None and first.reason.kind == "class"
    assert last.cause.model_dump() == {"rule": "rule_3", "aisle": "A", "outside_best": True}
    assert last.reason is not None and last.reason.model_dump() == {
        "kind": "pick_group",
        "partner": "7000",
        "partner_aisle": "A",
        "shared_jobs": 5,
        "min_shared_jobs": 5,
    }


def test_fr28_no_space_rule_2_cause(data: ImportData, analysis: Analysis) -> None:
    state = run_command(
        data, analysis, PlanState(best_marks=[AisleMark(aisle=a) for a in "ABCD"])
    ).state

    rule_2 = [n for n in _view(state, data, analysis).no_space if n.rule == "rule_2"]

    assert rule_2
    assert rule_2[0].cause.model_dump() == {"rule": "rule_2", "aisle": None, "outside_best": True}


def test_fr28_view_rows_carry_display_facts(
    run_1: PlanState, data: ImportData, analysis: Analysis
) -> None:
    view = _view(run_1, data, analysis)

    one, two = view.recommendations[0], view.recommendations[1]
    assert (one.part, one.to_location) == ("1100", "A-01-01-03")
    assert one.description == "Brake pad set, front - VW Golf"
    assert (one.movement_class, one.picks) == ("fast", analysis.parts["1100"].picks)
    assert (one.from_best, one.to_best) == (False, True)
    assert (two.part, two.movement_class, two.picks) == ("4400", "dead", 0)
    assert (two.from_best, two.to_best) == (True, False)
    spark = view.no_space[0]
    assert (spark.part, spark.description) == ("1200", "Spark plug - Ford Focus")
    assert (spark.movement_class, spark.picks) == ("fast", analysis.parts["1200"].picks)
    assert (spark.from_location, spark.from_best) == ("B-01-01-02", False)


def test_fr28_no_run_view(data: ImportData, analysis: Analysis) -> None:
    view = _view(PlanState.new(), data, analysis)

    assert view.model_dump() == {
        "version": 7,
        "run": None,
        "recommendations": [],
        "no_space": [],
        "kept_parts": [],
    }


# --- FR-29: revalidate and each cause ---


def test_fr29_filled(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, events = _do(run_1, _manual("1200", "B-01-01-02", "A-01-01-03"), data, analysis)

    assert _rec(state, 1).status == "outdated"
    assert _rec(state, 1).outdated == Outdated(cause="filled", location="A-01-01-03", move_number=1)
    assert _outdated_events(events) == [(1, "filled")]
    row = _view(state, data, analysis).recommendations[0]
    assert row.status == "outdated"
    assert row.outdated is not None
    assert (row.outdated.cause, row.outdated.location, row.outdated.move_number) == (
        "filled",
        "A-01-01-03",
        1,
    )
    assert _rejected_cause(state, _rec(state, 1).id, data, analysis) == [{"cause": "filled"}]


def test_fr29_moved(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, events = _do(run_1, _manual("1100", "C-01-01-01", "C-01-03-02"), data, analysis)

    assert _rec(state, 1).outdated == Outdated(cause="moved")
    assert _outdated_events(events) == [(1, "moved")]
    assert _rejected_cause(state, _rec(state, 1).id, data, analysis) == [{"cause": "moved"}]


def test_fr29_moved_beats_filled(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, events = _do(run_1, _manual("1100", "C-01-01-01", "A-01-01-03"), data, analysis)

    assert _rec(state, 1).outdated == Outdated(cause="moved")
    assert _outdated_events(events) == [(1, "moved")]


def test_fr29_marks(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, events = _do(run_1, _remove_aisle_a(), data, analysis)

    by_rule = {r.number: (r.rule, r.status) for r in state.runs[-1].recommendations}
    assert all(status == "outdated" for rule, status in by_rule.values() if rule != "rule_3")
    assert all(status == "open" for rule, status in by_rule.values() if rule == "rule_3")
    assert {r.outdated.cause for r in state.runs[-1].recommendations if r.outdated} == {"marks"}
    assert _outdated_events(events) == [(5, "marks")]


def test_fr29_partner_aisle(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, events = _do(run_1, _manual("8200", "C-01-02-01", "D-01-03-03"), data, analysis)

    assert _rec(state, 6).outdated == Outdated(cause="partner_aisle")
    assert _outdated_events(events) == [(1, "partner_aisle")]
    row = _view(state, data, analysis).recommendations[5]
    assert row.outdated is not None
    assert (row.outdated.cause, row.outdated.partner, row.outdated.aisle) == (
        "partner_aisle",
        "8200",
        "C",
    )
    assert _rejected_cause(state, _rec(state, 6).id, data, analysis) == [{"cause": "partner_aisle"}]


def test_fr29_cause_order_moved_before_marks(
    run_1: PlanState, data: ImportData, analysis: Analysis
) -> None:
    state = apply(run_1, _manual("1100", "C-01-01-01", "C-01-03-02"), CTX, data, analysis).state
    state = apply(state, _remove_aisle_a(), CTX, data, analysis).state

    applied = revalidate(data, analysis, state)

    assert _rec(applied.state, 1).outdated == Outdated(cause="moved")
    assert _outdated_events(applied.events) == [(1, "moved"), (4, "marks")]


def test_fr29_filled_beats_marks(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state = apply(run_1, _manual("1200", "B-01-01-02", "A-01-01-03"), CTX, data, analysis).state
    state = apply(state, _remove_aisle_a(), CTX, data, analysis).state

    applied = revalidate(data, analysis, state)

    assert _rec(applied.state, 1).outdated == Outdated(
        cause="filled", location="A-01-01-03", move_number=1
    )


def test_fr29_marks_beats_partner_aisle(
    run_1: PlanState, data: ImportData, analysis: Analysis
) -> None:
    # #6: 8100 B-01-02-01 -> C-01-03-01 next to partner 8200. Marking aisle B makes its
    # from-location best (a rule 3 mark condition fails) and 8200 leaves aisle C.
    mark_b = SetBestMark(command_id=uuid.uuid4(), base_version=1, mark=AisleMark(aisle="B"))
    state = apply(run_1, mark_b, CTX, data, analysis).state
    state = apply(state, _manual("8200", "C-01-02-01", "D-01-03-03"), CTX, data, analysis).state

    applied = revalidate(data, analysis, state)

    assert _rec(applied.state, 6).outdated == Outdated(cause="marks")


def test_fr29_outdated_is_sticky(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, _ = _do(run_1, _manual("1200", "B-01-01-02", "A-01-01-03"), data, analysis)
    state, events = _do(state, _manual("1200", "A-01-01-03", "B-01-01-02"), data, analysis)

    assert _outdated_events(events) == []
    assert _rec(state, 1).status == "outdated"
    assert _rejected_cause(state, _rec(state, 1).id, data, analysis) == [{"cause": "filled"}]

    fresh = run_command(data, analysis, state).state
    assert fresh.runs[-1].round == 2
    assert all(r.status == "open" for r in fresh.runs[-1].recommendations)
    assert all(r.status == "open" for r in _view(fresh, data, analysis).recommendations)


def test_fr29_applied_never_revalidated(
    run_1: PlanState, data: ImportData, analysis: Analysis
) -> None:
    state, _ = _do(run_1, _apply(_rec(run_1, 1).id), data, analysis)
    state, events = _do(state, _remove_aisle_a(), data, analysis)

    assert _rec(state, 1).status == "open"
    assert _outdated_events(events) == [(4, "marks")]
    row = _view(state, data, analysis).recommendations[0]
    assert row.status == "applied"
    assert row.applied is not None and row.applied.model_dump() == {"move_number": 1, "round": 1}
    assert row.outdated is None


def test_fr29_moved_back(run_1: PlanState, data: ImportData, analysis: Analysis) -> None:
    state, _ = _do(run_1, _apply(_rec(run_1, 1).id), data, analysis)
    state, events = _do(state, _manual("1100", "A-01-01-03", "C-01-01-01"), data, analysis)

    assert _outdated_events(events) == []
    row = _view(state, data, analysis).recommendations[0]
    assert (row.status, row.applied) == ("outdated", None)
    assert row.outdated is not None
    assert (row.outdated.cause, row.outdated.move_number) == ("moved_back", 1)


def test_fr29_revalidate_without_run_or_change(
    run_1: PlanState, data: ImportData, analysis: Analysis
) -> None:
    empty = PlanState(best_marks=MARKS)
    assert revalidate(data, analysis, empty).state is empty
    assert revalidate(data, analysis, run_1).events == []
    assert revalidate(data, analysis, run_1).state is run_1


# --- NFR-12: legacy rule 3 entries without a stored partner ---


def test_nfr12_legacy_rule_3_entries(data: ImportData, analysis: Analysis) -> None:
    doc = json.loads((FIXTURES / "state_v1_with_run.json").read_text(encoding="utf-8"))
    state = PlanState.model_validate(upcast("state", doc))

    view = _view(state, data, analysis)

    assert view.recommendations[0].reason is not None
    assert view.recommendations[1].reason is None
    assert view.no_space[0].reason is None
    assert view.no_space[0].cause.model_dump() == {
        "rule": "rule_3",
        "aisle": None,
        "outside_best": True,
    }
    # No partner_aisle check without a stored partner.
    state, events = _do(state, _manual("8200", "C-01-02-01", "D-01-03-03"), data, analysis)
    assert _outdated_events(events) == []
    assert state.runs[-1].recommendations[1].status == "open"
