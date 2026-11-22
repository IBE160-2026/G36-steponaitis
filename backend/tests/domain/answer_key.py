"""The answer-key dataset (`data/answer-key/`) as a NormalizedImport, built in the domain only."""

import csv
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from swp.domain.analysis import Analysis, AnalysisSettings, MovementClass, build_analysis
from swp.domain.apply import apply
from swp.domain.classify import classify_parts
from swp.domain.commands import (
    Applied,
    ApplyRecommendation,
    Command,
    CommandContext,
    Event,
    ManualMove,
    Reset,
    RunRecommendations,
    SetKeep,
    Undo,
)
from swp.domain.import_ import Cell, FileRole, RawSheet, check_file, check_import, normalize_import
from swp.domain.import_data import ImportData, NormalizedImport
from swp.domain.pick_groups import find_pick_groups
from swp.domain.recommendations import revalidate
from swp.domain.state import AisleMark, PlanState, Run

ANSWER_KEY_DIR = Path(__file__).resolve().parents[3] / "data" / "answer-key"
FILES: dict[FileRole, str] = {
    "locations": "Locations.csv",
    "inventory": "Inventory.csv",
    "transactions": "transactions.csv",
}
CLASS_NAMES: dict[str, MovementClass] = {
    "fast-moving": "fast",
    "medium-moving": "medium",
    "slow-moving": "slow",
    "dead stock": "dead",
}
CTX = CommandContext(now=datetime(2026, 11, 22, 12, 0, tzinfo=UTC), user="planner")
MARKS = [AisleMark(aisle="A")]
"""The answer key's best marks: aisle A (`best_location_marks`)."""


def _sheet(path: Path) -> RawSheet:
    with path.open(encoding="utf-8", newline="") as file:
        rows: list[tuple[Cell, ...]] = [
            tuple(cell if cell != "" else None for cell in row) for row in csv.reader(file)
        ]
    return RawSheet(rows=tuple(rows))


def answer_key_import() -> NormalizedImport:
    """Read the three answer-key CSVs as str cells (blank -> None) and normalize them."""
    checked = [
        check_file(role, name, _sheet(ANSWER_KEY_DIR / name)) for role, name in FILES.items()
    ]
    return normalize_import(check_import(checked))


def expected() -> dict[str, Any]:
    """`data/answer-key/expected.json`."""
    return json.loads((ANSWER_KEY_DIR / "expected.json").read_text(encoding="utf-8"))


def empty_analysis() -> Analysis:
    """The answer-key settings and period with no part entries and no pick groups."""
    imported = answer_key_import()
    return build_analysis(
        imported.data_as_of, AnalysisSettings.model_validate(expected()["settings"])
    )


def answer_key_analysis() -> Analysis:
    """The answer-key analysis: classes and pick groups as the plan stores them."""
    data = answer_key_import().data
    base = empty_analysis()
    return base.model_copy(
        update={
            "parts": classify_parts(data, base),
            "pick_groups": find_pick_groups(data, base),
        }
    )


# Answer-key step helpers (retro items 37 and epic-5 #43): every command goes through
# `domain.apply` and then `revalidate`, the same as `app/commands.py`.

RunOutcome = tuple[list[tuple[int, str, str, str, str]], list[tuple[str, str]]]


def command(state: PlanState, cmd: Command, data: ImportData, analysis: Analysis) -> Applied:
    """`cmd` applied to `state`, then `revalidate` on the result, with the combined events
    (the write path of `app/commands.py`; a no-op is not revalidated)."""
    applied = apply(state, cmd, CTX, data, analysis)
    if not applied.events:
        return applied
    revalidated = revalidate(data, analysis, applied.state)
    return Applied(state=revalidated.state, events=[*applied.events, *revalidated.events])


def run_command(
    data: ImportData, analysis: Analysis, state: PlanState, command_id: uuid.UUID | None = None
) -> Applied:
    """The `run` command on `state`."""
    cmd = RunRecommendations(command_id=command_id or uuid.uuid4(), base_version=1)
    return command(state, cmd, data, analysis)


def apply_recommendation(
    state: PlanState, part: str, data: ImportData, analysis: Analysis
) -> PlanState:
    """Apply the latest run's recommendation for `part`."""
    [rec] = [r for r in state.runs[-1].recommendations if r.part == part]
    cmd = ApplyRecommendation(command_id=uuid.uuid4(), base_version=1, recommendation_id=rec.id)
    return command(state, cmd, data, analysis).state


def manual_step(
    state: PlanState, part: str, source: str, target: str, data: ImportData, analysis: Analysis
) -> PlanState:
    """A manual move of `part` from `source` to `target`."""
    cmd = ManualMove(
        command_id=uuid.uuid4(),
        base_version=1,
        part=part,
        from_location=source,
        to_location=target,
    )
    return command(state, cmd, data, analysis).state


def keep_step(state: PlanState, part: str, data: ImportData, analysis: Analysis) -> PlanState:
    """Keep `part` in place with the `set_keep` command (FR-32)."""
    cmd = SetKeep(command_id=uuid.uuid4(), base_version=1, part=part)
    return command(state, cmd, data, analysis).state


def undo_command(move_number: int) -> Undo:
    """An `undo` command expecting `move_number` to be the last step (FR-35)."""
    return Undo(command_id=uuid.uuid4(), base_version=1, expected_move_number=move_number)


def undo_step(state: PlanState, data: ImportData, analysis: Analysis) -> Applied:
    """Undo the last step of `state` (FR-35)."""
    return command(state, undo_command(state.steps[-1].move_number), data, analysis)


def reset_step(state: PlanState, data: ImportData, analysis: Analysis) -> Applied:
    """Reset the planning copy of `state` (FR-35)."""
    return command(state, Reset(command_id=uuid.uuid4(), base_version=1), data, analysis)


def play_steps(data: ImportData, analysis: Analysis, through: int) -> tuple[PlanState, list[Event]]:
    """Answer-key steps 1 to `through` of `expected.json` through the helpers, from aisle A
    marked; the state and the last step's events (only an undo step reports them)."""
    state = PlanState(best_marks=MARKS)
    events: list[Event] = []
    for step in expected()["steps"][:through]:
        events = []
        match step["action"]:
            case "run":
                state = run_command(data, analysis, state).state
            case "keep_in_place":
                state = keep_step(state, step["part"], data, analysis)
            case "apply":
                state = apply_recommendation(state, step["part"], data, analysis)
            case "manual_move":
                state = manual_step(state, step["part"], step["from"], step["to"], data, analysis)
            case "undo":
                applied = undo_step(state, data, analysis)
                state, events = applied.state, applied.events
            case action:
                raise AssertionError(f"step {step['step']}: unexpected action {action}")
    return state, events


def run_outcome(run: Run) -> RunOutcome:
    """A run's recommendations (number, rule, part, from, to) and "no space" (part, rule)."""
    recs = [(r.number, r.rule, r.part, r.from_location, r.to_location) for r in run.recommendations]
    return recs, [(n.part, n.rule) for n in run.no_space]


def expected_run_outcome(step: dict[str, Any]) -> RunOutcome:
    """A run step of `expected.json` in `run_outcome`'s shape."""
    return (
        [
            (n, f"rule_{r['rule']}", r["part"], r["from"], r["to"])
            for n, r in enumerate(step["recommendations_in_order"], start=1)
        ],
        [(n["part"], f"rule_{n['rule']}") for n in step["no_space"]],
    )


def after_run_1(data: ImportData, analysis: Analysis) -> tuple[PlanState, str]:
    """Answer-key plan, aisle A marked, run 1 done; returns the state and rec #1's id."""
    state = run_command(data, analysis, PlanState(best_marks=MARKS)).state
    return state, state.runs[-1].recommendations[0].id


def apply_command(rec_id: str) -> ApplyRecommendation:
    """An `apply` command for `rec_id`."""
    return ApplyRecommendation(command_id=uuid.uuid4(), base_version=1, recommendation_id=rec_id)


def manual_command(part: str, from_location: str, to_location: str) -> ManualMove:
    """A `manual_move` command, built from the wire names `from`/`to`."""
    return ManualMove.model_validate(
        {
            "command_id": uuid.uuid4(),
            "base_version": 1,
            "part": part,
            "from": from_location,
            "to": to_location,
        }
    )


def do(state: PlanState, command: Command, data: ImportData, analysis: Analysis) -> PlanState:
    """`command` applied to `state`; the new state."""
    return apply(state, command, CTX, data, analysis).state
