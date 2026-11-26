"""FR-51/FR-33/FR-34/AD-6/AD-16: the drag commands expand into manual moves (domain only)."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from swp.domain.analysis import Analysis
from swp.domain.apply import apply
from swp.domain.commands import (
    Applied,
    Command,
    CommandContext,
    MoveMade,
    MoveParts,
    MoveRemoved,
    MovesCombined,
    PutTogether,
    RecommendationsOutdated,
    Swap,
    SwapMade,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import IS_FROM_LOCATION, is_empty, planning_copy, stock_at
from swp.domain.recommendations import revalidate
from swp.domain.state import PlanState, Step
from swp.domain.values import CODE_MAX_LENGTH
from tests.domain.answer_key import (
    after_run_1,
    command,
    empty_analysis,
    manual_step,
    run_command,
    undo_step,
)

CTX = CommandContext(now=datetime(2026, 11, 23, 12, 0, tzinfo=UTC), user="planner")
EMPTY_ANALYSIS = empty_analysis()
COMMANDS: TypeAdapter[Command] = TypeAdapter(Command)

EMPTY = "B-01-04-01"  # empty in the answer key
EMPTY_2 = "B-01-04-02"


def _drag(type_: str, frm: str, to: str, parts: list[str], **extra: Any) -> Command:
    """A drag command parsed from its wire shape (`from`/`to`)."""
    body = {
        "type": type_,
        "command_id": str(extra.pop("command_id", uuid.uuid4())),
        "base_version": 1,
        "from": frm,
        "to": to,
        "parts": parts,
        **extra,
    }
    return COMMANDS.validate_python(body)


def _do(data: ImportData, state: PlanState, cmd: Command) -> Applied:
    return apply(state, cmd, CTX, data, EMPTY_ANALYSIS)


def _two_parts(data: ImportData) -> PlanState:
    """D-01-02-03 holds 9200 and (after move 1) 8300."""
    cmd = _drag("put_together", "D-01-01-01", "D-01-02-03", ["8300"])
    return _do(data, PlanState.new(), cmd).state


def _rejected(data: ImportData, state: PlanState, cmd: Command) -> str:
    before = state.model_copy(deep=True)
    with pytest.raises(DomainError) as caught:
        _do(data, state, cmd)
    assert caught.value.code == "command_rejected"
    assert state == before
    return caught.value.message


def test_fr51_move_parts_to_empty_in_listed_order_round_0(data: ImportData) -> None:
    state = _two_parts(data)

    applied = _do(data, state, _drag("move_parts", "D-01-02-03", EMPTY, ["8300", "9200"]))

    assert applied.state.steps[1:] == [
        Step(
            move_number=2,
            part="8300",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=0,
        ),
        Step(
            move_number=3,
            part="9200",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=0,
        ),
    ]
    assert applied.state.next_move_number == 4
    # FR-34 per step: 8300's step continues move 1 (D-01-01-01 → D-01-02-03, which held none).
    assert applied.events == [
        MovesCombined(
            move_number=1,
            part="8300",
            from_location="D-01-01-01",
            to_location=EMPTY,
            round=0,
            step_move_number=2,
        ),
        MoveMade(
            move_number=3,
            part="9200",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=0,
        ),
    ]
    copy = planning_copy(data, applied.state)
    assert stock_at(copy, "9200", EMPTY) == Decimal(8)
    assert stock_at(copy, "8300", EMPTY) == Decimal(6)


def test_fr51_move_parts_from_two_parts_makes_one_move_each_in_listed_order(
    data: ImportData, analysis: Analysis
) -> None:
    """Move 1 was made in round 0; after run 1 the two parts move as two new moves."""
    state = run_command(data, analysis, _two_parts(data)).state

    applied = _do(data, state, _drag("move_parts", "D-01-02-03", EMPTY, ["9200", "8300"]))

    assert applied.events == [
        MoveMade(
            move_number=2,
            part="9200",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=1,
        ),
        MoveMade(
            move_number=3,
            part="8300",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=1,
        ),
    ]


def test_fr51_move_parts_after_a_run_is_in_the_current_round(
    data: ImportData, analysis: Analysis
) -> None:
    state, _rec = after_run_1(data, analysis)
    first = state.next_move_number
    target = next(
        code
        for code in sorted(planning_copy(data, state).locations)
        if code.startswith("B-01-04") and not planning_copy(data, state).contents_of(code)
    )

    applied = command(state, _drag("move_parts", "D-01-02-02", target, ["9100"]), data, analysis)

    [step] = applied.state.steps[len(state.steps) :]
    assert (step.move_number, step.round, step.rule, step.swap_id) == (first, 1, "manual", None)
    assert applied.events[0] == MoveMade(
        move_number=first,
        part="9100",
        from_location="D-01-02-02",
        to_location=target,
        rule="manual",
        round=1,
    )


def test_fr51_fr33_put_together_adds_stock_of_the_same_part(data: ImportData) -> None:
    applied = _do(
        data, PlanState.new(), _drag("put_together", "A-01-02-01", "B-01-01-02", ["1200"])
    )

    assert applied.events == [
        MoveMade(
            move_number=1,
            part="1200",
            from_location="A-01-02-01",
            to_location="B-01-01-02",
            rule="manual",
            round=0,
        )
    ]
    copy = planning_copy(data, applied.state)
    assert stock_at(copy, "1200", "B-01-01-02") == Decimal(10)
    assert stock_at(copy, "1200", "A-01-02-01") == 0


def test_fr51_fr34_drag_step_back_to_first_from_location_removes_the_move(
    data: ImportData,
) -> None:
    state = manual_step(PlanState.new(), "9100", "D-01-02-02", EMPTY, data, EMPTY_ANALYSIS)

    applied = _do(data, state, _drag("move_parts", EMPTY, "D-01-02-02", ["9100"]))

    assert applied.events == [
        MoveRemoved(move_number=1, part="9100", location="D-01-02-02", round=0, step_move_number=2)
    ]


def test_fr51_swap_expands_with_one_swap_id(data: ImportData) -> None:
    command_id = uuid.uuid4()
    cmd = _drag(
        "swap", "D-01-02-02", "D-01-02-03", ["9100"], back_parts=["9200"], command_id=command_id
    )

    applied = _do(data, PlanState.new(), cmd)

    swap_id = str(uuid.uuid5(command_id, "swap:1"))
    assert [
        (s.part, s.from_location, s.to_location, s.swap_id, s.swap_size)
        for s in applied.state.steps
    ] == [
        ("9100", "D-01-02-02", "D-01-02-03", swap_id, 2),
        ("9200", "D-01-02-03", "D-01-02-02", swap_id, 2),
    ]
    assert applied.events[0] == SwapMade(
        swap_id=swap_id,
        from_location="D-01-02-02",
        to_location="D-01-02-03",
        move_numbers=[1, 2],
        round=0,
    )
    assert [(e.type, getattr(e, "part", None)) for e in applied.events[1:]] == [
        ("move_made", "9100"),
        ("move_made", "9200"),
    ]


def test_fr51_move_parts_and_put_together_steps_have_no_swap_id(data: ImportData) -> None:
    state = _two_parts(data)
    applied = _do(data, state, _drag("move_parts", "D-01-02-03", EMPTY, ["9200"]))

    assert all(step.swap_id is None for step in applied.state.steps)
    assert all(step.swap_size is None for step in applied.state.steps)


def test_fr51_fr32_kept_part_may_be_swapped_and_stays_kept(data: ImportData) -> None:
    state = PlanState(keep_marks=["9200"])
    cmd = _drag("swap", "D-01-02-02", "D-01-02-03", ["9100"], back_parts=["9200"])

    applied = _do(data, state, cmd)

    assert applied.state.keep_marks == ["9200"]
    assert stock_at(planning_copy(data, applied.state), "9200", "D-01-02-02") == Decimal(8)


def test_fr51_answer_key_swap_from_two_parts_and_undo(data: ImportData) -> None:
    state = _two_parts(data)
    command_id = uuid.uuid4()
    cmd = _drag(
        "swap", "D-01-02-03", "D-01-02-02", ["9200"], back_parts=["9100"], command_id=command_id
    )

    applied = command(state, cmd, data, EMPTY_ANALYSIS)

    copy = planning_copy(data, applied.state)
    assert stock_at(copy, "9200", "D-01-02-02") == Decimal(8)
    assert stock_at(copy, "9100", "D-01-02-03") == Decimal(3)
    assert stock_at(copy, "8300", "D-01-02-03") == Decimal(6)
    assert stock_at(copy, "9200", "D-01-02-03") == 0
    new_steps = applied.state.steps[1:]
    swap_id = str(uuid.uuid5(command_id, "swap:1"))
    assert [(s.move_number, s.part, s.swap_id) for s in new_steps] == [
        (2, "9200", swap_id),
        (3, "9100", swap_id),
    ]
    assert applied.state.steps[0].swap_id is None

    undone = undo_step(applied.state, data, EMPTY_ANALYSIS).state

    assert [s.move_number for s in undone.steps] == [1, 2]
    copy = planning_copy(data, undone)
    assert stock_at(copy, "9200", "D-01-02-02") == Decimal(8)
    assert stock_at(copy, "9100", "D-01-02-02") == Decimal(3)
    assert stock_at(copy, "9100", "D-01-02-03") == 0


def _rejections() -> list[Any]:
    long_code = "X" * CODE_MAX_LENGTH
    return [
        pytest.param("move_parts", "D-01-02-03", EMPTY, [], {}, "Choose at least one part to move.",
                     id="no part"),
        pytest.param("swap", "D-01-02-02", "D-01-02-03", ["9100"], {"back_parts": []},
                     "Choose at least one part to move back.", id="swap without back"),
        pytest.param("swap", "D-01-02-03", "D-01-02-03", ["9200"], {"back_parts": ["9200"]},
                     IS_FROM_LOCATION, id="from == to (swap)"),
        pytest.param("move_parts", "D-01-02-03", "D-01-02-03", ["9200"], {}, IS_FROM_LOCATION,
                     id="from == to"),
        pytest.param("move_parts", "FLSKRS", EMPTY, ["9200"], {},
                     "FLSKRS is a virtual location, not a shelf.", id="virtual from"),
        pytest.param("move_parts", "D-01-02-03", "FLSKRS", ["9200"], {},
                     "FLSKRS is a virtual location, not a shelf.", id="virtual to"),
        pytest.param("move_parts", "ZZ-99", EMPTY, ["9200"], {},
                     "ZZ-99 is not in the Locations file.", id="unknown from"),
        pytest.param("put_together", "D-01-02-03", long_code, ["9200"], {},
                     f"{long_code} is not in the Locations file.", id="unknown to"),
        pytest.param("swap", "D-01-02-03", "D-01-02-02", ["9200"], {"back_parts": ["9200"]},
                     "9200 cannot move both ways.", id="both ways"),
        pytest.param("move_parts", "D-01-02-03", EMPTY, ["9200", "9200"], {},
                     "9200 is chosen twice.", id="twice"),
        pytest.param("swap", "D-01-02-03", "D-01-02-02", ["9200"],
                     {"back_parts": ["9100", "9100"]}, "9100 is chosen twice.", id="back twice"),
        pytest.param("move_parts", "D-01-02-02", EMPTY, ["9200"], {},
                     "9200 has no stock at D-01-02-02.", id="not at from"),
        pytest.param("move_parts", "D-01-02-03", EMPTY, ["9200", "NOPE"], {},
                     "NOPE has no stock at D-01-02-03.", id="unknown part"),
        pytest.param("swap", "D-01-02-03", "D-01-02-02", ["9200"], {"back_parts": ["8300"]},
                     "8300 has no stock at D-01-02-02.", id="back-part not at to"),
        pytest.param("move_parts", "D-01-02-03", "D-01-02-02", ["9200"], {},
                     "D-01-02-02 is occupied. Choose Swap or Put together.", id="onto occupied"),
        pytest.param("put_together", "D-01-02-03", EMPTY, ["9200"], {},
                     f"{EMPTY} is empty. Move the parts there instead.", id="together onto empty"),
    ]  # fmt: skip


@pytest.mark.parametrize(("type_", "frm", "to", "parts", "extra", "message"), _rejections())
def test_fr51_rejected_drag_changes_nothing(
    data: ImportData,
    type_: str,
    frm: str,
    to: str,
    parts: list[str],
    extra: dict[str, Any],
    message: str,
) -> None:
    state = _two_parts(data)

    assert _rejected(data, state, _drag(type_, frm, to, parts, **extra)) == message


def test_fr51_rejection_after_a_valid_first_step_changes_nothing(data: ImportData) -> None:
    """The whole command is checked before any step: a bad second part refuses it all."""
    state = PlanState.new()
    cmd = _drag("move_parts", "D-01-02-03", EMPTY_2, ["9200", "9100"])

    assert _rejected(data, state, cmd) == "9100 has no stock at D-01-02-03."


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"parts": ["9200"] * 101}, id="101 parts"),
        pytest.param({"parts": ["X" * (CODE_MAX_LENGTH + 1)]}, id="long part"),
        pytest.param({"back_parts": ["9100"] * 101}, id="101 back-parts"),
        pytest.param({"back_parts": None}, id="no back_parts field"),
    ],
)
def test_fr51_ad6_oversized_drag_fails_validation(change: dict[str, Any]) -> None:
    body: dict[str, Any] = {
        "type": "swap",
        "command_id": str(uuid.uuid4()),
        "base_version": 1,
        "from": "D-01-02-03",
        "to": "D-01-02-02",
        "parts": ["9200"],
        "back_parts": ["9100"],
        **change,
    }
    body = {key: value for key, value in body.items() if value is not None}

    with pytest.raises(ValidationError):
        COMMANDS.validate_python(body)


def test_fr51_ad6_drag_commands_are_in_the_closed_union() -> None:
    frm_to = {"command_id": str(uuid.uuid4()), "base_version": 1, "from": "A", "to": "B"}
    parsed = [
        COMMANDS.validate_python({"type": "move_parts", "parts": ["1"], **frm_to}),
        COMMANDS.validate_python({"type": "put_together", "parts": ["1"], **frm_to}),
        COMMANDS.validate_python({"type": "swap", "parts": ["1"], "back_parts": ["2"], **frm_to}),
    ]

    assert [type(c) for c in parsed] == [MoveParts, PutTogether, Swap]
    assert parsed[2].model_dump(by_alias=True)["from"] == "A"


def test_fr51_fr34_swap_folded_leg_is_not_listed_in_swap_made(data: ImportData) -> None:
    """Move 1: 8300 D-01-01-01 → D-01-02-03; move 2: 9100 D-01-02-02 → D-01-01-01. The swap
    returns 8300 to D-01-01-01 (move 1 removed) and carries 9100 on to D-01-02-03 (combined
    into move 2): neither step stands as its own move, so `swap_made` lists none."""
    state = _two_parts(data)
    state = _do(data, state, _drag("move_parts", "D-01-02-02", "D-01-01-01", ["9100"])).state
    command_id = uuid.uuid4()
    cmd = _drag(
        "swap", "D-01-02-03", "D-01-01-01", ["8300"], back_parts=["9100"], command_id=command_id
    )

    applied = _do(data, state, cmd)

    swap_id = str(uuid.uuid5(command_id, "swap:1"))
    assert applied.events == [
        SwapMade(
            swap_id=swap_id,
            from_location="D-01-02-03",
            to_location="D-01-01-01",
            move_numbers=[],
            round=0,
        ),
        MoveRemoved(move_number=1, part="8300", location="D-01-01-01", round=0, step_move_number=3),
        MovesCombined(
            move_number=2,
            part="9100",
            from_location="D-01-02-02",
            to_location="D-01-02-03",
            round=0,
            step_move_number=4,
        ),
    ]
    assert [(s.move_number, s.swap_id) for s in applied.state.steps[2:]] == [
        (3, swap_id),
        (4, swap_id),
    ]


def test_fr51_fr34_swap_lists_only_the_leg_that_is_its_own_move(data: ImportData) -> None:
    """Move 1: 9100 D-01-02-02 → B-01-04-01. The swap moves 9200 D-01-02-03 → B-01-04-01
    (move 2, its own move) and carries 9100 on to D-01-02-03 (combined into move 1)."""
    state = _do(data, PlanState.new(), _drag("move_parts", "D-01-02-02", EMPTY, ["9100"])).state
    command_id = uuid.uuid4()
    cmd = _drag("swap", "D-01-02-03", EMPTY, ["9200"], back_parts=["9100"], command_id=command_id)

    applied = _do(data, state, cmd)

    swap_id = str(uuid.uuid5(command_id, "swap:1"))
    assert applied.events == [
        SwapMade(
            swap_id=swap_id,
            from_location="D-01-02-03",
            to_location=EMPTY,
            move_numbers=[2],
            round=0,
        ),
        MoveMade(
            move_number=2,
            part="9200",
            from_location="D-01-02-03",
            to_location=EMPTY,
            rule="manual",
            round=0,
        ),
        MovesCombined(
            move_number=1,
            part="9100",
            from_location="D-01-02-02",
            to_location="D-01-02-03",
            round=0,
            step_move_number=3,
        ),
    ]
    assert [(s.swap_id, s.swap_size) for s in applied.state.steps[1:]] == [
        (swap_id, 2),
        (swap_id, 2),
    ]


def test_fr51_swap_after_a_run_reports_the_current_round(
    data: ImportData, analysis: Analysis
) -> None:
    state, _rec = after_run_1(data, analysis)
    cmd = _drag("swap", "D-01-02-02", "D-01-02-03", ["9100"], back_parts=["9200"])

    applied = command(state, cmd, data, analysis)

    made = applied.events[0]
    assert isinstance(made, SwapMade)
    assert made.round == 1
    assert [s.round for s in applied.state.steps[len(state.steps) :]] == [1, 1]


@pytest.mark.parametrize("type_", ["move_parts", "put_together"])
def test_fr51_fr32_kept_chosen_part_may_be_moved_and_stays_kept(
    data: ImportData, type_: str
) -> None:
    state = PlanState(keep_marks=["9100"])
    target = EMPTY if type_ == "move_parts" else "D-01-02-03"

    applied = _do(data, state, _drag(type_, "D-01-02-02", target, ["9100"]))

    assert applied.state.keep_marks == ["9100"]
    assert stock_at(planning_copy(data, applied.state), "9100", target) == Decimal(3)


def test_fr51_drag_outdates_recommendations_like_a_manual_move(
    data: ImportData, analysis: Analysis
) -> None:
    """Run 1 recommends 1100 C-01-01-01 → A-01-01-03; dragging 1100 elsewhere outdates it."""
    state, _rec = after_run_1(data, analysis)
    targets = {r.to_location for r in state.runs[-1].recommendations}
    copy = planning_copy(data, state)
    target = next(
        code
        for code in sorted(copy.locations)
        if code not in targets and code not in data.virtual_locations and is_empty(copy, code)
    )
    dragged = _do(data, state, _drag("move_parts", "C-01-01-01", target, ["1100"]))

    revalidated = revalidate(data, analysis, dragged.state)

    assert RecommendationsOutdated(count=1, cause="moved", round=1) in revalidated.events
    [rec] = [r for r in revalidated.state.runs[-1].recommendations if r.part == "1100"]
    assert rec.status == "outdated"
