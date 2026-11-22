"""The plan summary view behind GET /api/plans/{id} (FR-7, FR-9, FR-18, AD-3, AD-13).

Pure: built from the stored plan's fields; it never writes. Recommendations is checked
when the latest run has no open recommendation left (UX-DR6); before-after and move list
stay unchecked and without counts until the epics that own them fill them in.
"""

import uuid
from datetime import date
from typing import Literal

from pydantic import AwareDatetime, BaseModel

from swp.domain.analysis import Analysis, AnalysisSettings
from swp.domain.planning import (
    PlanningCopy,
    StepOutcome,
    UndoKind,
    best_counts,
    current_round,
    latest_run,
    open_recommendations,
)
from swp.domain.state import PlanState

StepKey = Literal[
    "overview",
    "parts",
    "locations",
    "pick-groups",
    "best-locations",
    "recommendations",
    "before-after",
    "move-list",
]

STEP_KEYS: tuple[StepKey, ...] = (
    "overview",
    "parts",
    "locations",
    "pick-groups",
    "best-locations",
    "recommendations",
    "before-after",
    "move-list",
)


class ClassCounts(BaseModel):
    fast: int
    medium: int
    slow: int
    dead: int


class StepSummary(BaseModel):
    key: StepKey
    checked: bool
    count: int | None


class UndoEffect(BaseModel):
    """What undoing the last step does (AD-5): `reverts_move` takes back move `move_number`
    (the step's own), `splits_combined_move` takes the step out of combined move
    `move_number`, `restores_removed_move` brings back removed move `move_number`."""

    kind: UndoKind
    move_number: int


class UndoPreview(BaseModel):
    """The last step of the log and what undoing it would do (AD-5); never stored."""

    move_number: int
    part: str
    from_location: str
    to_location: str
    effect: UndoEffect


def undo_preview(last: StepOutcome | None) -> UndoPreview | None:
    """The undo preview of the log's last step as the replay folded it; None without steps."""
    if last is None:
        return None
    step = last.step
    return UndoPreview(
        move_number=step.move_number,
        part=step.part,
        from_location=step.from_location,
        to_location=step.to_location,
        effect=UndoEffect(kind=last.kind, move_number=last.move_number),
    )


class PlanSummary(BaseModel):
    id: uuid.UUID
    name: str
    import_id: uuid.UUID
    data_as_of: date
    uploaded_at: AwareDatetime
    created_by: str
    created_at: AwareDatetime
    last_edited_by: str
    last_edited_at: AwareDatetime
    version: int
    current_round: int
    settings: AnalysisSettings
    period_start: date
    period_end: date
    class_counts: ClassCounts
    best_locations: int
    empty_best_locations: int
    apply_all_count: int
    kept_in_place: int
    undo_preview: UndoPreview | None
    steps: list[StepSummary]


def class_counts(analysis: Analysis) -> ClassCounts:
    counts = {"fast": 0, "medium": 0, "slow": 0, "dead": 0}
    for part in analysis.parts.values():
        counts[part.movement_class] += 1
    return ClassCounts(**counts)


def apply_all_count(state: PlanState) -> int:
    """Open recommendations of the latest run minus kept ones (FR-30, AD-3)."""
    return sum(1 for rec in open_recommendations(state) if rec.part not in state.keep_marks)


def steps(
    analysis: Analysis, state: PlanState, *, location_count: int, part_count: int
) -> list[StepSummary]:
    """The eight flow steps in order with their check state and count (M1 rules)."""
    checked: dict[StepKey, bool] = {
        "overview": True,
        "parts": True,
        "locations": True,
        "pick-groups": True,
        "best-locations": bool(state.best_marks),
        "recommendations": latest_run(state) is not None and not open_recommendations(state),
    }
    counts: dict[StepKey, int] = {
        "parts": part_count,
        "locations": location_count,
        "pick-groups": len(analysis.pick_groups),
    }
    return [
        StepSummary(key=key, checked=checked.get(key, False), count=counts.get(key))
        for key in STEP_KEYS
    ]


def build_summary(
    *,
    id: uuid.UUID,
    name: str,
    import_id: uuid.UUID,
    data_as_of: date,
    uploaded_at: AwareDatetime,
    created_by: str,
    created_at: AwareDatetime,
    last_edited_by: str,
    last_edited_at: AwareDatetime,
    version: int,
    analysis: Analysis,
    state: PlanState,
    copy: PlanningCopy,
    last_step: StepOutcome | None,
    location_count: int,
    part_count: int,
) -> PlanSummary:
    """The summary of one plan from its stored fields, analysis, state, and the planning
    copy and last-step outcome of one replay of its steps (AD-3, AD-5)."""
    best = best_counts(copy, state.best_marks)
    return PlanSummary(
        id=id,
        name=name,
        import_id=import_id,
        data_as_of=data_as_of,
        uploaded_at=uploaded_at,
        created_by=created_by,
        created_at=created_at,
        last_edited_by=last_edited_by,
        last_edited_at=last_edited_at,
        version=version,
        current_round=current_round(state),
        settings=analysis.settings,
        period_start=analysis.period_start,
        period_end=analysis.period_end,
        class_counts=class_counts(analysis),
        best_locations=best.best,
        empty_best_locations=best.empty,
        apply_all_count=apply_all_count(state),
        kept_in_place=len(state.keep_marks),
        undo_preview=undo_preview(last_step),
        steps=steps(analysis, state, location_count=location_count, part_count=part_count),
    )
