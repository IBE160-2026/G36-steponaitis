"""Slice: applying a recommendation and its derived status (FR-29, FR-30, AD-7).

"Applied" is derived from the step log (a step that references the recommendation) and is
never stored. `outdated_cause` is the one implementation of AD-7's causes; Story 5.5's
`revalidate` reuses it. Pure: imports only the kernel.
"""

from typing import Literal, assert_never

from swp.domain.analysis import Analysis
from swp.domain.commands import Applied, ApplyRecommendation, CommandContext, MoveMade
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import append_step, is_best, is_empty, replay
from swp.domain.state import PlanState, Recommendation, Run, Step

OutdatedCause = Literal["moved", "filled", "marks"]


def applied_step(state: PlanState, recommendation_id: str) -> Step | None:
    """The step that applied `recommendation_id`, or None (the one place "applied" is
    derived, AD-7)."""
    return next((s for s in state.steps if s.recommendation_id == recommendation_id), None)


def _marks_fail(rec: Recommendation, analysis: Analysis, from_best: bool, to_best: bool) -> bool:
    """True when a mark condition of the recommendation's rule no longer holds."""
    match rec.rule:
        case "rule_1":
            return not to_best or from_best
        case "rule_2":
            return not from_best or to_best
        case "rule_3":
            part = analysis.parts.get(rec.part)
            slow = part is not None and part.movement_class in ("slow", "dead")
            return from_best or (slow and to_best)
        case _:
            assert_never(rec.rule)


def outdated_cause(
    data: ImportData, analysis: Analysis, state: PlanState, run: Run, rec: Recommendation
) -> OutdatedCause | None:
    """AD-7's first true cause for `rec` of `run`, in order `moved`, `filled`, `marks`;
    None while the recommendation is still valid. (`partner_aisle` is Story 5.4/5.5.)"""
    if any(
        step.part == rec.part and step.round == run.round and step.recommendation_id != rec.id
        for step in state.steps
    ):
        return "moved"
    copy = replay(data, state.steps).copy
    if not is_empty(copy, rec.to_location):
        return "filled"
    from_best = is_best(copy, rec.from_location, state.best_marks)
    to_best = is_best(copy, rec.to_location, state.best_marks)
    if _marks_fail(rec, analysis, from_best, to_best):
        return "marks"
    return None


def apply_recommendation(
    state: PlanState,
    command: ApplyRecommendation,
    _ctx: CommandContext,
    data: ImportData,
    analysis: Analysis,
) -> Applied:
    """Append the recommendation's move with its rule and its run's round (FR-30), or raise
    `command_rejected` with the plan unchanged (AD-7)."""
    latest = max(state.runs, key=lambda run: run.round, default=None)
    rec = None
    if latest is not None:
        rec = next((r for r in latest.recommendations if r.id == command.recommendation_id), None)
    if latest is None or rec is None:
        raise DomainError("command_rejected", "This recommendation is not in the latest run.")
    if applied_step(state, rec.id) is not None:
        raise DomainError("command_rejected", f"Recommendation #{rec.number} is already applied.")
    cause = outdated_cause(data, analysis, state, latest, rec)
    if rec.status != "open" or cause is not None:
        raise DomainError(
            "command_rejected",
            f"Recommendation #{rec.number} is outdated.",
            details=[{"cause": cause or rec.status}],
        )
    if rec.part in state.keep_marks:
        raise DomainError("command_rejected", f"{rec.part} is kept in place.")
    new_state = append_step(
        state,
        part=rec.part,
        from_location=rec.from_location,
        to_location=rec.to_location,
        rule=rec.rule,
        recommendation_id=rec.id,
    )
    step = new_state.steps[-1]
    assert step.round == latest.round, f"Step round {step.round} is not run round {latest.round}."
    event = MoveMade(
        move_number=step.move_number,
        part=step.part,
        from_location=step.from_location,
        to_location=step.to_location,
        rule=step.rule,
        round=step.round,
    )
    return Applied(state=new_state, events=[event])
