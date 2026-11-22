"""Slice: undo the last move and reset the planning copy (FR-35, AD-5).

The step log is the only truth: undo drops the last step and every view replays the rest.
Runs, best marks, keep marks and `next_move_number` never change, so move numbers are
never reused. `revalidate` cannot tell that a step was removed, so undo stores
`outdated(undo)` itself on every open recommendation of the latest run and on the undone
step's recommendation.

Reset deletes every step and run and restarts move numbering at 1; best marks, keep marks
and `recent_commands` stay, so idempotency still works and the import never changes.
"""

from swp.domain.analysis import Analysis
from swp.domain.commands import (
    Applied,
    CommandContext,
    Event,
    PlanReset,
    RecommendationsOutdated,
    Reset,
    StepUndone,
    Undo,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import applied_step, latest_run, replay, undo_preview
from swp.domain.state import Outdated, PlanState, Recommendation, Run

UNDO_OUTDATED = Outdated(cause="undo")


def _outdate(rec: Recommendation) -> Recommendation:
    return rec.model_copy(update={"status": "outdated", "outdated": UNDO_OUTDATED})


def _outdate_runs(state: PlanState, undone_rec: str | None) -> tuple[list[Run], int]:
    """The runs with `outdated(undo)` stored on every open, unapplied recommendation of the
    latest run (kept parts included) and on `undone_rec` when it is stored open; and how
    many of the latest run's recommendations that outdated."""
    latest = latest_run(state)
    count = 0
    runs: list[Run] = []
    for run in state.runs:
        is_latest = latest is not None and run.id == latest.id
        recommendations: list[Recommendation] = []
        changed = False
        for rec in run.recommendations:
            if rec.status == "open" and (
                rec.id == undone_rec or (is_latest and applied_step(state, rec.id) is None)
            ):
                rec = _outdate(rec)
                changed = True
                if is_latest:
                    count += 1
            recommendations.append(rec)
        runs.append(run.model_copy(update={"recommendations": recommendations}) if changed else run)
    return runs, count


def undo(
    state: PlanState,
    command: Undo,
    _ctx: CommandContext,
    data: ImportData,
    _analysis: Analysis,
) -> Applied:
    """Drop the last step when its move number is `expected_move_number`; reject an undo
    with no steps or with another number (the log changed since the client read it)."""
    if not state.steps:
        raise DomainError("command_rejected", "There is no move to undo.")
    last = state.steps[-1]
    if last.move_number != command.expected_move_number:
        raise DomainError(
            "command_rejected",
            f"Move {command.expected_move_number} is no longer the last move. "
            "Undo the last move again.",
            details=[{"last_move_number": last.move_number}],
        )
    preview = undo_preview(replay(data, state.steps).last)
    assert preview is not None  # there is a last step
    after = state.model_copy(update={"steps": state.steps[:-1]})
    runs, count = _outdate_runs(after, last.recommendation_id)
    events: list[Event] = [StepUndone(undone=preview)]
    if count:
        events.append(RecommendationsOutdated(count=count, cause="undo"))
    return Applied(state=after.model_copy(update={"runs": runs}), events=events)


def reset(
    state: PlanState,
    _command: Reset,
    _ctx: CommandContext,
    data: ImportData,
    _analysis: Analysis,
) -> Applied:
    """Delete every step and run and set `next_move_number` to 1; a no-op (no events) when
    there is nothing to reset. `moves_removed` counts effective moves, not raw steps."""
    if not state.steps and not state.runs and state.next_move_number == 1:
        return Applied(state=state)
    moves_removed = len(replay(data, state.steps).moves)
    after = state.model_copy(update={"steps": [], "runs": [], "next_move_number": 1})
    return Applied(state=after, events=[PlanReset(moves_removed=moves_removed)])
