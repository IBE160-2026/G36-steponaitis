"""Slice: the recommendation rules and the `run` command (FR-23, FR-24, FR-25, FR-26, FR-27,
AD-5, AD-14).

A run computes the rules, in order, on the planning copy, the best marks and the keep marks of the
state, and stores the result as a new round in `state.runs`. Pure: the time, user and id
come from the command and its context; nothing reads a clock, a file or `uuid4`.
"""

import uuid
from collections.abc import Sequence

from pydantic import BaseModel, ConfigDict

from swp.domain.analysis import Analysis, PickGroup
from swp.domain.commands import Applied, CommandContext, RunDone, RunRecommendations
from swp.domain.import_data import ImportData
from swp.domain.ordering import (
    fewest_picks_order,
    location_code_order,
    part_order,
    pick_group_order,
)
from swp.domain.planning import (
    PlanningCopy,
    aisle_of,
    current_aisle,
    current_location,
    current_round,
    is_best,
    is_empty,
    listed_parts,
    run_baseline,
)
from swp.domain.state import NoSpace, PlanState, Recommendation, RecommendationRule, Run


class RuleMove(BaseModel):
    """A move a rule recommends, before it is numbered into a run."""

    model_config = ConfigDict(frozen=True)

    rule: RecommendationRule
    part: str
    from_location: str
    to_location: str


def _empty_pool(
    data: ImportData,
    copy: PlanningCopy,
    state: PlanState,
    *,
    best: bool | None,
    aisle: str | None = None,
) -> list[str]:
    """Empty, non-virtual locations of the planning copy that are best (`best=True`), not
    best (`best=False`) or either (`best=None`), in `aisle` when given, in location-code
    order."""
    virtual = set(data.virtual_locations)
    return location_code_order(
        code
        for code in copy.locations
        if code not in virtual
        and (aisle is None or aisle_of(copy, code) == aisle)
        and (best is None or is_best(copy, code, state.best_marks) == best)
        and is_empty(copy, code)
    )


def rule_1(
    data: ImportData, copy: PlanningCopy, analysis: Analysis, state: PlanState
) -> tuple[list[RuleMove], list[NoSpace]]:
    """Rule 1 (FR-24, FR-27): fast-moving parts outside best locations, most picks first
    (ties in part-number order), each get the first free empty best location in
    location-code order, or one "no space" entry. Parts with no current location, kept
    parts and parts already in a best location are skipped."""
    fast = {
        part: entry
        for part, entry in listed_parts(data, analysis).items()
        if entry.movement_class == "fast"
    }
    keep = set(state.keep_marks)
    free = iter(_empty_pool(data, copy, state, best=True))
    moves: list[RuleMove] = []
    no_space: list[NoSpace] = []
    for part in part_order(fast):
        if part in keep:
            continue
        source = current_location(copy, part)
        if source is None or is_best(copy, source, state.best_marks):
            continue
        target = next(free, None)
        if target is None:
            no_space.append(NoSpace(part=part, rule="rule_1"))
            continue
        moves.append(RuleMove(rule="rule_1", part=part, from_location=source, to_location=target))
    return moves, no_space


def rule_2(
    data: ImportData,
    copy: PlanningCopy,
    analysis: Analysis,
    state: PlanState,
    earlier_moves: Sequence[RuleMove],
    earlier_no_space: Sequence[NoSpace],
) -> tuple[list[RuleMove], list[NoSpace]]:
    """Rule 2 (FR-25, FR-27): slow-moving and dead parts in best locations, fewest picks
    first (ties in part-number order), each get the first free empty non-best location in
    location-code order, or one "no space" entry. Parts with no current location, kept
    parts and parts outside best locations are skipped, and so, silently, are parts an
    earlier rule of this run handled. Locations an earlier rule took are never offered."""
    candidates = {
        part: entry
        for part, entry in listed_parts(data, analysis).items()
        if entry.movement_class in {"slow", "dead"}
    }
    keep = set(state.keep_marks)
    handled = {move.part for move in earlier_moves} | {entry.part for entry in earlier_no_space}
    taken = {move.to_location for move in earlier_moves}
    free = iter([code for code in _empty_pool(data, copy, state, best=False) if code not in taken])
    moves: list[RuleMove] = []
    no_space: list[NoSpace] = []
    for part in fewest_picks_order(candidates):
        if part in keep or part in handled:
            continue
        source = current_location(copy, part)
        if source is None or not is_best(copy, source, state.best_marks):
            continue
        target = next(free, None)
        if target is None:
            no_space.append(NoSpace(part=part, rule="rule_2"))
            continue
        moves.append(RuleMove(rule="rule_2", part=part, from_location=source, to_location=target))
    return moves, no_space


def _blocked(
    copy: PlanningCopy,
    analysis: Analysis,
    state: PlanState,
    group: PickGroup,
    mover: str,
    source: str,
    partner: str,
) -> bool:
    """Whether rule 3 is blocked for `group` (FR-26), given the mover's current location
    `source`: the partner has no current location, the mover is kept or in a best
    location, both parts already share an aisle, or the mover already shares an aisle with
    another partner it has at least as many shared jobs with (the loop limit)."""
    if current_location(copy, partner) is None:
        return True
    if mover in state.keep_marks or is_best(copy, source, state.best_marks):
        return True
    mover_aisle = aisle_of(copy, source)
    if mover_aisle == current_aisle(copy, partner):
        return True
    return any(
        mover in (other.part_a, other.part_b)
        and other.shared_jobs >= group.shared_jobs
        and other != group
        and current_aisle(copy, other.part_b if other.part_a == mover else other.part_a)
        == mover_aisle
        for other in analysis.pick_groups
    )


def rule_3(
    data: ImportData,
    copy: PlanningCopy,
    analysis: Analysis,
    state: PlanState,
    earlier_moves: Sequence[RuleMove],
    earlier_no_space: Sequence[NoSpace],
) -> tuple[list[RuleMove], list[NoSpace]]:
    """Rule 3 (FR-26, FR-27): pick groups whose parts sit in different aisles, most shared
    jobs first (ties by the lower part number, then the higher). The mover is the part with
    fewer picks (on a tie the later part number); it gets the first free empty location of
    the partner's aisle in location-code order, never a best one when it is slow or dead,
    or one "no space" entry. A group with a part this run already handled is skipped
    silently, and a blocked group gives nothing. Locations taken this run are never
    offered again."""
    parts = listed_parts(data, analysis)
    handled = {move.part for move in earlier_moves} | {entry.part for entry in earlier_no_space}
    taken = {move.to_location for move in earlier_moves}
    moves: list[RuleMove] = []
    no_space: list[NoSpace] = []
    for group in pick_group_order(analysis.pick_groups):
        pair = (group.part_a, group.part_b)
        if any(part in handled for part in pair):
            continue
        if any(part not in parts for part in pair):
            continue
        partner, mover = part_order({part: parts[part] for part in pair})
        source = current_location(copy, mover)
        if source is None or _blocked(copy, analysis, state, group, mover, source, partner):
            continue
        best = False if parts[mover].movement_class in {"slow", "dead"} else None
        pool = _empty_pool(data, copy, state, best=best, aisle=current_aisle(copy, partner))
        target = next((code for code in pool if code not in taken), None)
        handled.add(mover)
        if target is None:
            no_space.append(NoSpace(part=mover, rule="rule_3"))
            continue
        taken.add(target)
        moves.append(RuleMove(rule="rule_3", part=mover, from_location=source, to_location=target))
    return moves, no_space


def _pruned(runs: Sequence[Run], referenced: set[str]) -> list[Run]:
    """Earlier runs keep their metadata and only the recommendations a step references;
    their "no space" entries go."""
    return [
        run.model_copy(
            update={
                "recommendations": [r for r in run.recommendations if r.id in referenced],
                "no_space": [],
            }
        )
        for run in runs
    ]


def run(
    state: PlanState,
    command: RunRecommendations,
    ctx: CommandContext,
    data: ImportData,
    analysis: Analysis,
) -> Applied:
    """Run rules 1, 2 and 3 as a new round and store the run (FR-23, FR-25, FR-26).
    Never a no-op.

    The rules share one allocation on the run baseline (AD-5), which at run time is the
    replay of every step: a location a rule frees is offered only in a later run."""
    round_ = current_round(state) + 1
    copy = run_baseline(data, state.steps, round_).copy
    moves_1, no_space_1 = rule_1(data, copy, analysis, state)
    moves_2, no_space_2 = rule_2(data, copy, analysis, state, moves_1, no_space_1)
    moves_3, no_space_3 = rule_3(
        data, copy, analysis, state, [*moves_1, *moves_2], [*no_space_1, *no_space_2]
    )
    moves = [*moves_1, *moves_2, *moves_3]
    no_space = [*no_space_1, *no_space_2, *no_space_3]
    run_id = str(uuid.uuid5(command.command_id, f"run:{round_}"))
    recommendations = [
        Recommendation(
            id=f"{run_id}:{number}",
            number=number,
            rule=move.rule,
            part=move.part,
            from_location=move.from_location,
            to_location=move.to_location,
        )
        for number, move in enumerate(moves, start=1)
    ]
    referenced = {step.recommendation_id for step in state.steps if step.recommendation_id}
    new_run = Run(
        id=run_id,
        round=round_,
        created_at=ctx.now,
        created_by=ctx.user,
        recommendations=recommendations,
        no_space=no_space,
    )
    new_state = state.model_copy(update={"runs": [*_pruned(state.runs, referenced), new_run]})
    event = RunDone(round=round_, recommendations=len(recommendations), no_space=len(no_space))
    return Applied(state=new_state, events=[event])
