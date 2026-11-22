"""Kernel: the plan's working state, stored whole as the `plans.state` JSON (AD-4).

`PlanState.new()` is the only constructor app code uses; every field has a default so an
older stored document validates after `state_migrations.upcast`.
"""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AisleMark(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["aisle"] = "aisle"
    aisle: str


class LevelMark(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["level"] = "level"
    level: str
    aisle: str | None = None


class LocationMark(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: Literal["location"] = "location"
    location: str


Rule = Literal["rule_1", "rule_2", "rule_3", "manual"]
"""The rule that made a step: one of the three recommendation rules or a manual move."""


class Step(BaseModel):
    """One entry of the append-only step log (AD-5).

    A step moves all of `part`'s stock at `from_location` to `to_location`. The move
    number is never reused; `round` is the plan's current round when the step was added.
    """

    model_config = ConfigDict(frozen=True)

    move_number: int = Field(ge=1)
    part: str
    from_location: str
    to_location: str
    rule: Rule
    round: int = Field(ge=0)
    recommendation_id: str | None = None
    swap_id: str | None = None


BestMark = Annotated[AisleMark | LevelMark | LocationMark, Field(discriminator="kind")]
"""A best-location mark: a whole aisle, a level (optionally in one aisle) or one location."""


class PlanState(BaseModel):
    schema_version: int = 1
    best_marks: list[BestMark] = Field(default_factory=list)
    keep_marks: list[str] = Field(default_factory=list)
    # `runs` stays untyped until Epic 5 types it (with an upcaster if the shape changes).
    runs: list[dict[str, object]] = Field(default_factory=list)
    steps: list[Step] = Field(default_factory=list)
    next_move_number: int = 1
    recent_commands: list[dict[str, object]] = Field(default_factory=list)

    @field_validator("best_marks")
    @classmethod
    def _unique_marks(cls, marks: list[BestMark]) -> list[BestMark]:
        """Marks are a set of values: duplicates collapse to the first occurrence."""
        return list(dict.fromkeys(marks))

    @classmethod
    def new(cls) -> Self:
        """The state of a freshly created plan."""
        return cls()
