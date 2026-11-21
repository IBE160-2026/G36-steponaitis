"""Kernel: analysis settings and the per-plan analysis snapshot (FR-18, AD-4).

`parts` (picks and class) and `pick_groups` are filled by the classify and pick_groups
slices when the plan is created.
"""

import calendar
from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, PositiveInt, model_validator

MovementClass = Literal["fast", "medium", "slow", "dead"]


class AnalysisSettings(BaseModel):
    """The values from `backend/settings/analysis.toml`; a snapshot is stored per plan."""

    period_months: PositiveInt
    fast_min_picks: PositiveInt
    medium_min_picks: PositiveInt
    slow_min_picks: PositiveInt
    pick_group_min_shared_jobs: PositiveInt

    @model_validator(mode="after")
    def _class_limits_descend(self) -> Self:
        if not self.fast_min_picks > self.medium_min_picks > self.slow_min_picks:
            raise ValueError("Class limits must satisfy fast > medium > slow.")
        return self


class PartAnalysis(BaseModel):
    picks: int
    movement_class: MovementClass


class PickGroup(BaseModel):
    part_a: str
    part_b: str
    shared_jobs: int


class Analysis(BaseModel):
    schema_version: int = 1
    settings: AnalysisSettings
    period_start: date
    period_end: date
    parts: dict[str, PartAnalysis] = {}
    pick_groups: list[PickGroup] = []


def period_for(data_as_of: date, months: int) -> tuple[date, date]:
    """The analysis period: it ends on `data_as_of` and starts the day after the same date
    `months` earlier (day clamped to the month end)."""
    if months < 1:
        raise ValueError("months must be positive")
    index = data_as_of.year * 12 + (data_as_of.month - 1) - months
    year, month = divmod(index, 12)
    month += 1
    day = min(data_as_of.day, calendar.monthrange(year, month)[1])
    start = date.fromordinal(date(year, month, day).toordinal() + 1)
    return start, data_as_of


def build_analysis(data_as_of: date, settings: AnalysisSettings) -> Analysis:
    """The analysis of a new plan: settings snapshot and period.

    `parts` and `pick_groups` are filled by the classify and pick_groups slices at plan
    creation.
    """
    start, end = period_for(data_as_of, settings.period_months)
    return Analysis(settings=settings, period_start=start, period_end=end)
