"""FR-33/FR-34/AD-3/AD-6: the manual move command and its preview (domain only)."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import TypeAdapter

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    Applied,
    Command,
    CommandContext,
    ManualMove,
    MoveMade,
    MoveRemoved,
    MovesCombined,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import (
    AddsToStock,
    CombinesWith,
    NewMove,
    RemovesMove,
    current_location,
    is_empty,
    planning_copy,
    replay,
    stock_at,
)
from swp.domain.state import PlanState, Run, Step
from swp.domain.views.move_preview import MovePreview, build_move_preview
from tests.domain.answer_key import (
    answer_key_analysis,
    answer_key_import,
    empty_analysis,
)

CTX = CommandContext(now=datetime(2026, 11, 22, 12, 0, tzinfo=UTC), user="planner")
# A manual move never reads the analysis; `apply` takes the plan's analysis for every command.
EMPTY_ANALYSIS = empty_analysis()


@pytest.fixture(scope="module")
def data() -> ImportData:
    return answer_key_import().data


@pytest.fixture(scope="module")
def analysis() -> Analysis:
    return answer_key_analysis()


def _run(round_: int) -> Run:
    return Run(id=f"run-{round_}", round=round_, created_at=CTX.now, created_by="planner")


def _move(part: str, a: str, b: str) -> ManualMove:
    return ManualMove(
        command_id=uuid.uuid4(), base_version=1, part=part, from_location=a, to_location=b
    )


def _do(data: ImportData, state: PlanState, part: str, a: str, b: str) -> Applied:
    return apply(state, _move(part, a, b), CTX, data, EMPTY_ANALYSIS)


def _preview(
    data: ImportData, analysis: Analysis, state: PlanState, part: str, a: str, b: str
) -> MovePreview:
    return build_move_preview(data, analysis, state, 7, part, a, b)


def _empty_location(data: ImportData, state: PlanState) -> str:
    copy = planning_copy(data, state)
    return next(code for code in sorted(copy.locations) if is_empty(copy, code))


def test_fr33_new_move_in_round_0(data: ImportData, analysis: Analysis) -> None:
    state = PlanState.new()
    target = _empty_location(data, state)

    preview = _preview(data, analysis, state, "9300", "B-01-03-02", target)
    applied = _do(data, state, "9300", "B-01-03-02", target)

    assert preview.allowed is True
    assert preview.refusal_message is None
    assert preview.effect == NewMove()
    assert preview.target == "empty"
    assert preview.target_parts == []
    assert preview.version == 7
    assert applied.state.steps == [
        Step(
            move_number=1,
            part="9300",
            from_location="B-01-03-02",
            to_location=target,
            rule="manual",
            round=0,
        )
    ]
    assert applied.state.next_move_number == 2
    assert applied.events == [
        MoveMade(
            move_number=1,
            part="9300",
            from_location="B-01-03-02",
            to_location=target,
            rule="manual",
            round=0,
        )
    ]


def test_fr33_answer_key_9300_into_location_left_by_1100(data: ImportData) -> None:
    rule_step = Step(
        move_number=1,
        part="1100",
        from_location="C-01-01-01",
        to_location="A-01-01-03",
        rule="rule_1",
        round=1,
    )
    state = PlanState(runs=[_run(1)], steps=[rule_step], next_move_number=2)

    applied = _do(data, state, "9300", "B-01-03-02", "C-01-01-01")

    assert applied.events == [
        MoveMade(
            move_number=2,
            part="9300",
            from_location="B-01-03-02",
            to_location="C-01-01-01",
            rule="manual",
            round=1,
        )
    ]
    assert applied.state.steps[-1].round == 1
    copy = planning_copy(data, applied.state)
    assert current_location(copy, "9300") == "C-01-01-01"


def test_fr33_answer_key_swap_through_occupied_location(
    data: ImportData, analysis: Analysis
) -> None:
    state = PlanState.new()

    preview = _preview(data, analysis, state, "9100", "D-01-02-02", "D-01-02-03")
    first = _do(data, state, "9100", "D-01-02-02", "D-01-02-03")

    assert preview.allowed is True
    assert preview.effect == NewMove()
    assert preview.target == "occupied"
    assert [p.part for p in preview.target_parts] == ["9200"]
    target_part = preview.target_parts[0]
    assert target_part.stock == Decimal(8)
    assert target_part.movement_class == "medium"
    assert target_part.picks == 11
    assert target_part.description == data.parts["9200"]
    assert target_part.kept_in_place is False

    copy = planning_copy(data, first.state)
    assert stock_at(copy, "9100", "D-01-02-03") == Decimal(3)
    assert stock_at(copy, "9200", "D-01-02-03") == Decimal(8)

    second_preview = _preview(data, analysis, first.state, "9200", "D-01-02-03", "D-01-02-02")
    second = _do(data, first.state, "9200", "D-01-02-03", "D-01-02-02")

    assert second_preview.effect == NewMove()
    assert second_preview.target == "empty"
    assert [type(e) for e in second.events] == [MoveMade]
    moves = replay(data, second.state.steps).moves
    assert [(m.move_number, m.part, m.from_location, m.to_location) for m in moves] == [
        (1, "9100", "D-01-02-02", "D-01-02-03"),
        (2, "9200", "D-01-02-03", "D-01-02-02"),
    ]


def test_fr33_adds_to_stock(data: ImportData, analysis: Analysis) -> None:
    state = PlanState.new()

    preview = _preview(data, analysis, state, "1200", "A-01-02-01", "B-01-01-02")
    applied = _do(data, state, "1200", "A-01-02-01", "B-01-01-02")

    assert preview.effect == AddsToStock()
    assert preview.target == "occupied"
    assert [(p.part, p.stock) for p in preview.target_parts] == [("1200", Decimal(8))]
    assert [type(e) for e in applied.events] == [MoveMade]
    copy = planning_copy(data, applied.state)
    assert stock_at(copy, "1200", "B-01-01-02") == Decimal(10)


def test_fr33_leaves_other_locations_alone(data: ImportData) -> None:
    state = PlanState.new()
    target = _empty_location(data, state)

    applied = _do(data, state, "1200", "B-01-01-02", target)

    copy = planning_copy(data, applied.state)
    assert stock_at(copy, "1200", "A-01-02-01") == Decimal(2)
    assert stock_at(copy, "1200", target) == Decimal(8)


def test_fr34_answer_key_0100_combined(data: ImportData, analysis: Analysis) -> None:
    state = PlanState.new()
    assert is_empty(planning_copy(data, state), "C-01-03-02")
    first = _do(data, state, "0100", "A-01-01-01", "C-01-03-02")
    number = first.state.steps[-1].move_number

    preview = _preview(data, analysis, first.state, "0100", "C-01-03-02", "B-01-03-02")
    second = _do(data, first.state, "0100", "C-01-03-02", "B-01-03-02")

    assert preview.effect == CombinesWith(move_number=number)
    assert preview.target == "occupied"
    assert second.events == [
        MovesCombined(
            move_number=number,
            part="0100",
            from_location="A-01-01-01",
            to_location="B-01-03-02",
            round=0,
            step_move_number=number + 1,
        )
    ]
    moves = replay(data, second.state.steps).moves
    assert [(m.move_number, m.from_location, m.to_location, m.rule) for m in moves] == [
        (number, "A-01-01-01", "B-01-03-02", "manual")
    ]


def test_fr34_combine_into_location_holding_part_is_combines_with(
    data: ImportData, analysis: Analysis
) -> None:
    # Combine wins over adds_to_stock: B-01-01-02 already holds 8 of 1200.
    state = PlanState.new()
    target = _empty_location(data, state)
    first = _do(data, state, "1200", "A-01-02-01", target)
    number = first.state.steps[-1].move_number

    preview = _preview(data, analysis, first.state, "1200", target, "B-01-01-02")
    second = _do(data, first.state, "1200", target, "B-01-01-02")

    assert preview.effect == CombinesWith(move_number=number)
    assert second.events == [
        MovesCombined(
            move_number=number,
            part="1200",
            from_location="A-01-02-01",
            to_location="B-01-01-02",
            round=0,
            step_move_number=number + 1,
        )
    ]
    copy = planning_copy(data, second.state)
    assert stock_at(copy, "1200", "B-01-01-02") == Decimal(10)


def test_fr34_move_back_removes_move(data: ImportData, analysis: Analysis) -> None:
    state = PlanState.new()
    target = _empty_location(data, state)
    first = _do(data, state, "9300", "B-01-03-02", target)

    preview = _preview(data, analysis, first.state, "9300", target, "B-01-03-02")
    second = _do(data, first.state, "9300", target, "B-01-03-02")

    assert preview.effect == RemovesMove(move_number=1)
    assert second.events == [
        MoveRemoved(move_number=1, part="9300", location="B-01-03-02", round=0, step_move_number=2)
    ]
    assert second.state.next_move_number == 3
    assert len(second.state.steps) == 2
    assert replay(data, second.state.steps).moves == ()
    third = _do(data, second.state, "9300", "B-01-03-02", target)
    assert third.state.steps[-1].move_number == 3


@pytest.mark.parametrize(
    ("part", "from_location", "to_location", "message"),
    [
        ("9300", "B-01-03-02", "", "Enter a to-location."),
        ("9300", "B-01-03-02", "   ", "Enter a to-location."),
        ("9300", "B-01-03-02", "B-01-03-02", "This is the from-location. Choose another."),
        ("9300", "B-01-03-02", "FLSKRS", "FLSKRS is a virtual location, not a shelf."),
        ("9300", "B-01-03-02", "ZZ-99", "ZZ-99 is not in the Locations file."),
        ("1008614-00", "A-01-01-03", "C-01-03-02", "1008614-00 has no stock at A-01-01-03."),
        ("NOPE", "B-01-03-02", "C-01-03-02", "NOPE has no stock at B-01-03-02."),
        ("9300", "A-01-01-01", "C-01-03-02", "9300 has no stock at A-01-01-01."),
        # Order: a blank to-location is reported before anything else.
        ("NOPE", "NOWHERE", "", "Enter a to-location."),
        ("NOPE", "FLSKRS", "FLSKRS", "This is the from-location. Choose another."),
    ],
)
def test_fr33_refusals_agree_in_command_and_preview(
    data: ImportData,
    analysis: Analysis,
    part: str,
    from_location: str,
    to_location: str,
    message: str,
) -> None:
    state = PlanState.new()

    preview = _preview(data, analysis, state, part, from_location, to_location)
    with pytest.raises(DomainError) as raised:
        _do(data, state, part, from_location, to_location)

    assert raised.value.code == "command_rejected"
    assert raised.value.message == message
    assert preview.allowed is False
    assert preview.refusal_message == message
    assert preview.effect is None


def test_ad3_preview_target_none_for_unknown_code(data: ImportData, analysis: Analysis) -> None:
    preview = _preview(data, analysis, PlanState.new(), "9300", "B-01-03-02", "FLSKRS")

    assert preview.target == "none"
    assert preview.target_parts == []


def test_ad3_preview_target_parts_order_and_keep_marks(
    data: ImportData, analysis: Analysis
) -> None:
    # Gather 9100 (9 picks) and 9200 (11 picks) in one location: 9200 lists first.
    state = _do(data, PlanState.new(), "9100", "D-01-02-02", "D-01-02-03").state
    state = state.model_copy(update={"keep_marks": ["9100"]})

    preview = _preview(data, analysis, state, "9300", "B-01-03-02", "D-01-02-03")

    assert [(p.part, p.kept_in_place) for p in preview.target_parts] == [
        ("9200", False),
        ("9100", True),
    ]


def test_ad3_preview_parts_without_analysis_last(data: ImportData, analysis: Analysis) -> None:
    trimmed = analysis.model_copy(
        update={"parts": {k: v for k, v in analysis.parts.items() if k != "9200"}}
    )
    state = _do(data, PlanState.new(), "9100", "D-01-02-02", "D-01-02-03").state

    preview = _preview(data, trimmed, state, "9300", "B-01-03-02", "D-01-02-03")

    assert [(p.part, p.movement_class, p.picks) for p in preview.target_parts] == [
        ("9100", "medium", 9),
        ("9200", None, None),
    ]


def test_ad3_preview_never_changes_state(data: ImportData, analysis: Analysis) -> None:
    state = _do(data, PlanState.new(), "9100", "D-01-02-02", "D-01-02-03").state
    snapshot = state.model_dump(mode="json")

    for to in ("D-01-02-02", "FLSKRS", "", "C-01-03-02"):
        _preview(data, analysis, state, "9100", "D-01-02-03", to)

    assert state.model_dump(mode="json") == snapshot


def test_ad6_manual_move_wire_shape() -> None:
    command_id = uuid.uuid4()
    parsed = TypeAdapter(Command).validate_python(
        {
            "type": "manual_move",
            "command_id": str(command_id),
            "base_version": 1,
            "part": "9300",
            "from": "B-01-03-02",
            "to": "C-01-01-01",
        }
    )

    assert parsed == ManualMove(
        command_id=command_id,
        base_version=1,
        part="9300",
        from_location="B-01-03-02",
        to_location="C-01-01-01",
    )
    assert parsed.model_dump(mode="json", by_alias=True)["from"] == "B-01-03-02"
