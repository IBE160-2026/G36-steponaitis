"""FR-31/AD-7: other locations of a recommendation and `apply_other_location` (domain only).

A small hand-built import (FR-31 uses its own fixture): aisle A is best, plus C-2-1. Run 1
is stored directly with one recommendation per rule case:

- #1 rule 1: fast F1 C-1-1 -> A-1-1
- #2 rule 2: slow S1 A-2-2 -> B-1-1
- #3 rule 3: slow M1 B-2-2 -> C-2-2, partner P1 (C-1-2)
- #4 rule 3: medium M2 B-1-2 -> C-1-3, partner P1

B-9-9 is a virtual location that is also in the Locations file, so only the virtual filter
keeps it out.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from swp.domain.analysis import Analysis, MovementClass, PartAnalysis
from swp.domain.apply import apply
from swp.domain.commands import ApplyOtherLocation, ManualMove, MoveMade, SetKeep
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.planning import fits_rule_target, is_empty, replay
from swp.domain.recommendations import (
    build_other_locations_view,
    build_recommendations_view,
    other_locations,
    revalidate,
)
from swp.domain.state import (
    AisleMark,
    LocationMark,
    Outdated,
    PlanState,
    Recommendation,
    Run,
    Step,
)
from tests.domain.answer_key import CTX, apply_command, empty_analysis, run_command

RUN_ID = "run-1"
CODES = [
    "A-1-1",
    "A-1-2",
    "A-1-3",
    "A-2-1",
    "A-2-2",
    "B-1-1",
    "B-1-2",
    "B-2-1",
    "B-2-2",
    "B-9-9",
    "C-1-1",
    "C-1-2",
    "C-1-3",
    "C-2-1",
    "C-2-2",
]
STOCK = {
    "F1": "C-1-1",
    "S1": "A-2-2",
    "M1": "B-2-2",
    "M2": "B-1-2",
    "P1": "C-1-2",
}
CLASSES: dict[str, MovementClass] = {
    "F1": "fast",
    "S1": "slow",
    "M1": "slow",
    "M2": "medium",
    "P1": "fast",
}


def _location(code: str) -> LocationData:
    aisle, level, position = code.split("-")
    return LocationData(
        walk_path=Decimal(CODES.index(code)),
        aisle=aisle,
        level=level,
        section=None,
        position=position,
    )


DATA = ImportData(
    locations={code: _location(code) for code in reversed(CODES)},
    inventory=[
        InventoryLine(part=part, location=location, quantity=Decimal(5))
        for part, location in STOCK.items()
    ],
    parts={part: f"Part {part}" for part in STOCK},
    transactions=[],
    virtual_locations=["B-9-9"],
)


def _analysis() -> Analysis:
    parts = {
        part: PartAnalysis(picks=10 - n, movement_class=cls)
        for n, (part, cls) in enumerate(CLASSES.items())
    }
    return empty_analysis().model_copy(update={"parts": parts})


ANALYSIS = _analysis()


def _rec(
    number: int, rule: str, part: str, to_location: str, partner: str | None = None
) -> Recommendation:
    return Recommendation.model_validate(
        {
            "id": f"{RUN_ID}:{number}",
            "number": number,
            "rule": rule,
            "part": part,
            "from_location": STOCK[part],
            "to_location": to_location,
            "partner": partner,
        }
    )


RECS = [
    _rec(1, "rule_1", "F1", "A-1-1"),
    _rec(2, "rule_2", "S1", "B-1-1"),
    _rec(3, "rule_3", "M1", "C-2-2", partner="P1"),
    _rec(4, "rule_3", "M2", "C-1-3", partner="P1"),
]
STATE = PlanState(
    best_marks=[AisleMark(aisle="A"), LocationMark(location="C-2-1")],
    runs=[
        Run(
            id=RUN_ID,
            round=1,
            created_at=datetime(2026, 11, 22, 11, 0, tzinfo=UTC),
            created_by="planner",
            recommendations=RECS,
        )
    ],
)


def _id(number: int) -> str:
    return f"{RUN_ID}:{number}"


def _others(state: PlanState, number: int) -> list[str]:
    return other_locations(DATA, ANALYSIS, state, _id(number))


def _other(number: int, to_location: str) -> ApplyOtherLocation:
    return ApplyOtherLocation(
        command_id=uuid.uuid4(),
        base_version=1,
        recommendation_id=_id(number),
        to_location=to_location,
    )


def _manual(part: str, from_location: str, to_location: str) -> PlanState:
    command = ManualMove.model_validate(
        {
            "command_id": uuid.uuid4(),
            "base_version": 1,
            "part": part,
            "from": from_location,
            "to": to_location,
        }
    )
    return apply(STATE, command, CTX, DATA, ANALYSIS).state


def _rejected(state: PlanState, command: ApplyOtherLocation) -> DomainError:
    with pytest.raises(DomainError) as raised:
        apply(state, command, CTX, DATA, ANALYSIS)
    assert raised.value.code == "command_rejected"
    return raised.value


# --- The allowed set ---


def test_fr31_rule_1_set_is_empty_best_locations_but_suggested() -> None:
    assert _others(STATE, 1) == ["A-1-2", "A-1-3", "A-2-1", "C-2-1"]


def test_fr31_rule_2_set_is_empty_non_best_non_virtual_but_suggested() -> None:
    assert _others(STATE, 2) == ["B-2-1", "C-1-3", "C-2-2"]


def test_fr31_virtual_location_never_offered() -> None:
    copy = replay(DATA, []).copy
    assert is_empty(copy, "B-9-9")
    assert all("B-9-9" not in _others(STATE, n) for n in range(1, 5))


def test_fr31_suggested_location_never_offered() -> None:
    for rec in RECS:
        assert rec.to_location not in _others(STATE, rec.number)


def test_fr31_rule_3_slow_part_only_non_best_in_partner_aisle() -> None:
    assert _others(STATE, 3) == ["C-1-3"]


def test_fr31_rule_3_fast_part_best_and_non_best_in_partner_aisle() -> None:
    assert _others(STATE, 4) == ["C-2-1", "C-2-2"]


def test_fr31_rule_3_without_partner_uses_suggested_aisle() -> None:
    legacy = RECS[3].model_copy(update={"partner": None})
    run = STATE.runs[0].model_copy(update={"recommendations": [*RECS[:3], legacy]})
    state = STATE.model_copy(update={"runs": [run]})

    assert _others(state, 4) == ["C-2-1", "C-2-2"]


def test_fr31_location_emptied_this_round_not_offered() -> None:
    state = _manual("S1", "A-2-2", "B-2-1")
    assert is_empty(replay(DATA, state.steps).copy, "A-2-2")

    assert _others(state, 1) == ["A-1-2", "A-1-3", "A-2-1", "C-2-1"]


def test_fr31_location_filled_since_run_not_offered() -> None:
    state = _manual("M2", "B-1-2", "A-1-2")

    assert _others(state, 1) == ["A-1-3", "A-2-1", "C-2-1"]


def test_fr31_fits_rule_target() -> None:
    assert fits_rule_target("rule_1", "fast", True)
    assert not fits_rule_target("rule_1", "fast", False)
    assert fits_rule_target("rule_2", "slow", False)
    assert not fits_rule_target("rule_2", "dead", True)
    assert fits_rule_target("rule_3", "medium", True)
    assert fits_rule_target("rule_3", None, True)
    assert not fits_rule_target("rule_3", "slow", True)
    assert not fits_rule_target("rule_3", "dead", True)
    assert fits_rule_target("rule_3", "dead", False)


# --- Not applicable: an empty set ---


def test_fr31_unknown_recommendation_has_empty_set() -> None:
    assert other_locations(DATA, ANALYSIS, STATE, "nope") == []
    assert other_locations(DATA, ANALYSIS, PlanState(), _id(1)) == []


def test_fr31_applied_recommendation_has_empty_set() -> None:
    state = apply(STATE, apply_command(_id(1)), CTX, DATA, ANALYSIS).state

    assert _others(state, 1) == []


def test_fr31_stored_outdated_recommendation_has_empty_set() -> None:
    outdated = RECS[0].model_copy(
        update={"status": "outdated", "outdated": Outdated(cause="marks")}
    )
    run = STATE.runs[0].model_copy(update={"recommendations": [outdated, *RECS[1:]]})
    state = STATE.model_copy(update={"runs": [run]})

    assert _others(state, 1) == []


def test_fr31_recommendation_with_cause_now_has_empty_set() -> None:
    state = STATE.model_copy(update={"best_marks": [LocationMark(location="C-2-1")]})

    assert _others(state, 1) == []


def test_fr31_kept_recommendation_has_empty_set() -> None:
    command = SetKeep(command_id=uuid.uuid4(), base_version=1, part="F1")
    state = apply(STATE, command, CTX, DATA, ANALYSIS).state

    assert _others(state, 1) == []


def test_fr31_earlier_run_recommendation_has_empty_set() -> None:
    state = run_command(DATA, ANALYSIS, STATE).state
    assert state.runs[-1].round == 2

    assert _others(state, 1) == []


# --- apply_other_location ---


def test_fr31_apply_other_location_appends_rec_step() -> None:
    applied = apply(STATE, _other(1, "A-2-1"), CTX, DATA, ANALYSIS)

    assert applied.state.steps == [
        Step(
            move_number=1,
            part="F1",
            from_location="C-1-1",
            to_location="A-2-1",
            rule="rule_1",
            round=1,
            recommendation_id=_id(1),
        )
    ]
    assert applied.events == [
        MoveMade(
            move_number=1,
            part="F1",
            from_location="C-1-1",
            to_location="A-2-1",
            rule="rule_1",
            round=1,
        )
    ]
    assert applied.state.next_move_number == 2


def test_fr31_apply_other_location_keeps_stored_recommendation() -> None:
    applied = apply(STATE, _other(1, "A-2-1"), CTX, DATA, ANALYSIS)
    state = revalidate(DATA, ANALYSIS, applied.state).state

    assert state.runs == STATE.runs
    assert state.runs[0].recommendations[0].to_location == "A-1-1"


def test_fr31_view_shows_applied_with_chosen_location() -> None:
    state = apply(STATE, _other(3, "C-1-3"), CTX, DATA, ANALYSIS).state

    view = build_recommendations_view(DATA, ANALYSIS, state, 2)

    row = next(r for r in view.recommendations if r.number == 3)
    assert row.status == "applied"
    assert row.to_location == "C-2-2"
    assert row.applied is not None
    assert row.applied.model_dump() == {
        "move_number": 1,
        "round": 1,
        "to_location": "C-1-3",
        "to_best": False,
    }


def test_fr31_other_locations_view_has_location_refs() -> None:
    view = build_other_locations_view(DATA, ANALYSIS, STATE, 7, _id(4))

    assert view.version == 7
    assert view.recommendation_id == _id(4)
    assert [ref.model_dump() for ref in view.locations] == [
        {
            "code": "C-2-1",
            "aisle": "C",
            "level": "2",
            "section": None,
            "position": "1",
            "is_best": True,
        },
        {
            "code": "C-2-2",
            "aisle": "C",
            "level": "2",
            "section": None,
            "position": "2",
            "is_best": False,
        },
    ]


@pytest.mark.parametrize("to_location", ["A-2-2", "A-1-1", "B-2-1", "B-9-9", "Z-1-1"])
def test_fr31_location_outside_set_rejected(to_location: str) -> None:
    error = _rejected(STATE, _other(1, to_location))

    assert error.message == f"{to_location} is not an allowed location for recommendation #1."


def test_fr31_not_in_latest_run_rejected() -> None:
    error = _rejected(STATE, _other(1, "A-2-1").model_copy(update={"recommendation_id": "nope"}))

    assert error.message == "This recommendation is not in the latest run."


def test_fr31_applied_rejected() -> None:
    state = apply(STATE, _other(1, "A-2-1"), CTX, DATA, ANALYSIS).state

    error = _rejected(state, _other(1, "A-1-2"))

    assert error.message == "Recommendation #1 is already applied."


def test_fr31_outdated_rejected_with_cause() -> None:
    state = _manual("M2", "B-1-2", "A-1-1")

    error = _rejected(state, _other(1, "A-2-1"))

    assert error.message == "Recommendation #1 is outdated."
    assert error.details == [{"cause": "filled"}]


def test_fr31_kept_rejected() -> None:
    command = SetKeep(command_id=uuid.uuid4(), base_version=1, part="F1")
    state = apply(STATE, command, CTX, DATA, ANALYSIS).state

    error = _rejected(state, _other(1, "A-2-1"))

    assert error.message == "F1 is kept in place."
