"""The plan summary view behind GET /api/plans/{id} (FR-7, FR-9, FR-18, AD-3, AD-13).

Pure: built from the stored plan's fields; it never writes. Steps 5 to 8 stay unchecked
and without counts until the epics that own them fill them in.
"""

import uuid
from datetime import date
from typing import Literal

from pydantic import AwareDatetime, BaseModel

from swp.domain.analysis import Analysis, AnalysisSettings
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
    steps: list[StepSummary]


def current_round(state: PlanState) -> int:
    """The highest `round` among the plan's runs, 0 before the first run."""
    rounds = [run.get("round") for run in state.runs]
    return max((r for r in rounds if isinstance(r, int) and not isinstance(r, bool)), default=0)


def class_counts(analysis: Analysis) -> ClassCounts:
    counts = {"fast": 0, "medium": 0, "slow": 0, "dead": 0}
    for part in analysis.parts.values():
        counts[part.movement_class] += 1
    return ClassCounts(**counts)


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
    location_count: int,
    part_count: int,
) -> PlanSummary:
    """The summary of one plan from its stored fields, analysis and state."""
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
        steps=steps(analysis, state, location_count=location_count, part_count=part_count),
    )
