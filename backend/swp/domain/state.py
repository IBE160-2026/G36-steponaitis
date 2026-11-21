"""Kernel: the plan's working state, stored whole as the `plans.state` JSON (AD-4).

`PlanState.new()` is the only constructor app code uses; every field has a default so an
older stored document validates after `state_migrations.upcast`.
"""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field


class AisleMark(BaseModel):
    kind: Literal["aisle"] = "aisle"
    aisle: str


class LevelMark(BaseModel):
    kind: Literal["level"] = "level"
    level: str
    aisle: str | None = None


class LocationMark(BaseModel):
    kind: Literal["location"] = "location"
    location: str


BestMark = Annotated[AisleMark | LevelMark | LocationMark, Field(discriminator="kind")]
"""A best-location mark: a whole aisle, a level (optionally in one aisle) or one location."""


class PlanState(BaseModel):
    schema_version: int = 1
    best_marks: list[BestMark] = Field(default_factory=list)
    keep_marks: list[str] = Field(default_factory=list)
    # Untyped until the epics that own them type them (with an upcaster if the shape changes).
    runs: list[dict[str, object]] = Field(default_factory=list)
    steps: list[dict[str, object]] = Field(default_factory=list)
    next_move_number: int = 1
    recent_commands: list[dict[str, object]] = Field(default_factory=list)

    @classmethod
    def new(cls) -> Self:
        """The state of a freshly created plan."""
        return cls()
