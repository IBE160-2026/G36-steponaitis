"""Slice: recommendations after a run: applying one, revalidating them and their view
(FR-28, FR-29, FR-30, AD-3, AD-7).

"Applied" is derived from the step log (a step that references the recommendation) and is
never stored. `_check` is the one implementation of AD-7's causes; `outdated_cause`,
`revalidate` and `apply_recommendation` share it. Pure: imports only the kernel.
"""

from collections import Counter
from typing import Annotated, Literal, assert_never, get_args

from pydantic import AwareDatetime, BaseModel, Field

from swp.domain.analysis import Analysis, ClassThreshold, MovementClass, class_threshold
from swp.domain.commands import (
    Applied,
    ApplyRecommendation,
    CommandContext,
    Event,
    MoveMade,
    RecommendationsOutdated,
)
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.planning import (
    Replay,
    aisle_of,
    append_step,
    current_aisle,
    is_best,
    is_empty,
    replay,
)
from swp.domain.state import (
    NoSpace,
    Outdated,
    OutdatedCause,
    PlanState,
    Recommendation,
    RecommendationRule,
    Run,
    Step,
)

CAUSE_ORDER: tuple[OutdatedCause, ...] = get_args(OutdatedCause)
"""AD-7's check order: the first true cause wins."""


def applied_step(state: PlanState, recommendation_id: str) -> Step | None:
    """The step that applied `recommendation_id`, or None (the one place "applied" is
    derived, AD-7)."""
    return next((s for s in state.steps if s.recommendation_id == recommendation_id), None)


def latest_run(state: PlanState) -> Run | None:
    """The run with the highest round, or None before the first run."""
    return max(state.runs, key=lambda run: run.round, default=None)


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


def _check(
    analysis: Analysis, state: PlanState, run: Run, rec: Recommendation, replayed: Replay
) -> Outdated | None:
    """AD-7's first true cause for `rec` of `run`, in order `moved`, `filled`, `marks`,
    `partner_aisle`, given the replay of the state's steps; None while it still holds."""
    if any(
        step.part == rec.part and step.round == run.round and step.recommendation_id != rec.id
        for step in state.steps
    ):
        return Outdated(cause="moved")
    copy = replayed.copy
    if not is_empty(copy, rec.to_location):
        filling = [m.move_number for m in replayed.moves if m.to_location == rec.to_location]
        return Outdated(
            cause="filled", location=rec.to_location, move_number=max(filling, default=None)
        )
    from_best = is_best(copy, rec.from_location, state.best_marks)
    to_best = is_best(copy, rec.to_location, state.best_marks)
    if _marks_fail(rec, analysis, from_best, to_best):
        return Outdated(cause="marks")
    if rec.rule == "rule_3" and rec.partner is not None:
        if current_aisle(copy, rec.partner) != aisle_of(copy, rec.to_location):
            return Outdated(cause="partner_aisle")
    return None


def outdated_cause(
    data: ImportData, analysis: Analysis, state: PlanState, run: Run, rec: Recommendation
) -> OutdatedCause | None:
    """AD-7's first true cause for `rec` of `run` on the state as it is now; None while
    the recommendation is still valid."""
    outdated = _check(analysis, state, run, rec, replay(data, state.steps))
    return outdated.cause if outdated is not None else None


def revalidate(data: ImportData, analysis: Analysis, state: PlanState) -> Applied:
    """Store `outdated(cause)` on every open, unapplied recommendation of the latest run
    that a cause of AD-7 now holds for (FR-29, AD-6). Outdated is sticky: it is never
    cleared here, only replaced by the next run. Emits one `recommendations_outdated`
    per cause that newly outdated at least one recommendation, in cause order."""
    latest = latest_run(state)
    if latest is None:
        return Applied(state=state)
    replayed = replay(data, state.steps)
    counts: Counter[OutdatedCause] = Counter()
    recommendations = []
    for rec in latest.recommendations:
        if rec.status == "open" and applied_step(state, rec.id) is None:
            outdated = _check(analysis, state, latest, rec, replayed)
            if outdated is not None:
                rec = rec.model_copy(update={"status": "outdated", "outdated": outdated})
                counts[outdated.cause] += 1
        recommendations.append(rec)
    if not counts:
        return Applied(state=state)
    new_run = latest.model_copy(update={"recommendations": recommendations})
    runs = [new_run if run.id == latest.id else run for run in state.runs]
    events: list[Event] = [
        RecommendationsOutdated(count=counts[cause], cause=cause)
        for cause in CAUSE_ORDER
        if counts[cause]
    ]
    return Applied(state=state.model_copy(update={"runs": runs}), events=events)


def apply_recommendation(
    state: PlanState,
    command: ApplyRecommendation,
    _ctx: CommandContext,
    data: ImportData,
    analysis: Analysis,
) -> Applied:
    """Append the recommendation's move with its rule and its run's round (FR-30), or raise
    `command_rejected` with the plan unchanged (AD-7)."""
    latest = latest_run(state)
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
            details=[{"cause": rec.outdated.cause if rec.outdated else cause}],
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


# --- The recommendations view: GET /api/plans/{id}/recommendations (FR-28, FR-29, AD-3) ---


class RunMeta(BaseModel):
    id: str
    round: int
    created_at: AwareDatetime
    created_by: str


class AppliedInfo(BaseModel):
    """The effective move that applied a recommendation."""

    move_number: int
    round: int


ViewOutdatedCause = Literal[OutdatedCause, "moved_back"]
"""The stored causes plus the derived `moved_back`."""


class OutdatedInfo(BaseModel):
    """Why a recommendation is outdated: the stored cause, or the derived `moved_back` (an
    applied move that FR-34 removed). Only the fields of the cause are set, the rest are
    None: `location` and `move_number` for `filled`, `partner` and `aisle` for
    `partner_aisle`, `move_number` for `moved_back`."""

    cause: ViewOutdatedCause
    location: str | None
    move_number: int | None
    partner: str | None
    aisle: str | None


class ClassReason(BaseModel):
    """Rules 1 and 2: the part's class, its picks and the class threshold."""

    kind: Literal["class"] = "class"
    movement_class: MovementClass
    picks: int
    threshold: ClassThreshold


class PickGroupReason(BaseModel):
    """Rule 3: the partner, the partner's aisle and the pair's shared jobs."""

    kind: Literal["pick_group"] = "pick_group"
    partner: str
    partner_aisle: str | None
    shared_jobs: int
    min_shared_jobs: int


Reason = Annotated[ClassReason | PickGroupReason, Field(discriminator="kind")]


class RecommendationRow(BaseModel):
    id: str
    number: int
    rule: RecommendationRule
    part: str
    from_location: str
    to_location: str
    status: Literal["open", "applied", "outdated"]
    applied: AppliedInfo | None
    outdated: OutdatedInfo | None
    reason: Reason | None


class NoSpaceCause(BaseModel):
    """Where the rule looked: rule 1 any best location, rule 2 any location outside best
    ones, rule 3 the partner's `aisle` (outside best ones for a slow or dead mover)."""

    rule: RecommendationRule
    aisle: str | None
    outside_best: bool


class NoSpaceRow(BaseModel):
    part: str
    rule: RecommendationRule
    reason: Reason | None
    cause: NoSpaceCause


class RecommendationsView(BaseModel):
    version: int
    run: RunMeta | None
    recommendations: list[RecommendationRow]
    no_space: list[NoSpaceRow]


def _class_reason(analysis: Analysis, part: str) -> ClassReason | None:
    facts = analysis.parts.get(part)
    if facts is None:
        return None
    return ClassReason(
        movement_class=facts.movement_class,
        picks=facts.picks,
        threshold=class_threshold(analysis.settings, facts.movement_class),
    )


def _pick_group_reason(
    analysis: Analysis, part: str, partner: str | None, partner_aisle: str | None
) -> PickGroupReason | None:
    """None for a legacy rule 3 entry without a stored partner."""
    if partner is None:
        return None
    group = next((g for g in analysis.pick_groups if {g.part_a, g.part_b} == {part, partner}), None)
    if group is None:
        return None
    return PickGroupReason(
        partner=partner,
        partner_aisle=partner_aisle,
        shared_jobs=group.shared_jobs,
        min_shared_jobs=analysis.settings.pick_group_min_shared_jobs,
    )


def _reason(
    analysis: Analysis,
    rule: RecommendationRule,
    part: str,
    partner: str | None,
    partner_aisle: str | None,
) -> ClassReason | PickGroupReason | None:
    if rule == "rule_3":
        return _pick_group_reason(analysis, part, partner, partner_aisle)
    return _class_reason(analysis, part)


def _status(
    state: PlanState, replayed: Replay, rec: Recommendation, partner_aisle: str
) -> tuple[Literal["open", "applied", "outdated"], AppliedInfo | None, OutdatedInfo | None]:
    step = applied_step(state, rec.id)
    if step is not None:
        move = next((m for m in replayed.moves if m.recommendation_id == rec.id), None)
        if move is not None:
            return "applied", AppliedInfo(move_number=move.move_number, round=move.round), None
        moved_back = OutdatedInfo(
            cause="moved_back",
            location=None,
            move_number=step.move_number,
            partner=None,
            aisle=None,
        )
        return "outdated", None, moved_back
    if rec.status == "outdated" and rec.outdated is not None:
        stored = rec.outdated
        partner_cause = stored.cause == "partner_aisle"
        info = OutdatedInfo(
            cause=stored.cause,
            location=stored.location,
            move_number=stored.move_number,
            partner=rec.partner if partner_cause else None,
            aisle=partner_aisle if partner_cause else None,
        )
        return "outdated", None, info
    return "open", None, None


def _no_space_row(analysis: Analysis, entry: NoSpace) -> NoSpaceRow:
    match entry.rule:
        case "rule_1":
            cause = NoSpaceCause(rule="rule_1", aisle=None, outside_best=False)
        case "rule_2":
            cause = NoSpaceCause(rule="rule_2", aisle=None, outside_best=True)
        case "rule_3":
            facts = analysis.parts.get(entry.part)
            slow = facts is not None and facts.movement_class in ("slow", "dead")
            cause = NoSpaceCause(rule="rule_3", aisle=entry.aisle, outside_best=slow)
        case _:
            assert_never(entry.rule)
    return NoSpaceRow(
        part=entry.part,
        rule=entry.rule,
        reason=_reason(analysis, entry.rule, entry.part, entry.partner, entry.aisle),
        cause=cause,
    )


def build_recommendations_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int
) -> RecommendationsView:
    """The latest run's recommendations and "no space" entries in stored order, each with
    its status and reason data, from one replay (FR-28, FR-29, AD-3). Read-only."""
    latest = latest_run(state)
    if latest is None:
        return RecommendationsView(version=version, run=None, recommendations=[], no_space=[])
    replayed = replay(data, state.steps)
    rows = []
    for rec in latest.recommendations:
        target_aisle = aisle_of(replayed.copy, rec.to_location)
        status, applied, outdated = _status(state, replayed, rec, target_aisle)
        rows.append(
            RecommendationRow(
                id=rec.id,
                number=rec.number,
                rule=rec.rule,
                part=rec.part,
                from_location=rec.from_location,
                to_location=rec.to_location,
                status=status,
                applied=applied,
                outdated=outdated,
                reason=_reason(analysis, rec.rule, rec.part, rec.partner, target_aisle),
            )
        )
    return RecommendationsView(
        version=version,
        run=RunMeta(
            id=latest.id,
            round=latest.round,
            created_at=latest.created_at,
            created_by=latest.created_by,
        ),
        recommendations=rows,
        no_space=[_no_space_row(analysis, entry) for entry in latest.no_space],
    )
