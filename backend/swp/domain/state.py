"""Kernel: the plan's working state, stored whole as the `plans.state` JSON (AD-4).

`PlanState.new()` is the only constructor app code uses; every field has a default so an
older stored document validates after `state_migrations.upcast`.
"""

from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator


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


RecommendationRule = Literal["rule_1", "rule_2", "rule_3"]
"""The rule that made a recommendation or a "no space" entry."""


OutdatedCause = Literal["moved", "filled", "marks", "partner_aisle", "undo"]
"""A stored cause that made an open recommendation outdated, in AD-7's check order. `undo`
comes last: the undo command stores it itself and `revalidate` never produces it (AD-5)."""


class Outdated(BaseModel):
    """Why a recommendation is outdated (AD-7): sticky until the next run. `filled` records
    the target `location` and the effective move that filled it (None when none did)."""

    model_config = ConfigDict(frozen=True)

    cause: OutdatedCause
    location: str | None = None
    move_number: int | None = None


class Recommendation(BaseModel):
    """One recommendation of a run (FR-24): move `part` from `from_location` to
    `to_location`. `id` is `"<run_id>:<number>"`; numbers are never reassigned (AD-14)."""

    model_config = ConfigDict(frozen=True)

    id: str
    number: int = Field(ge=1)
    rule: RecommendationRule
    part: str
    from_location: str
    to_location: str
    status: Literal["open", "outdated"] = "open"
    outdated: Outdated | None = None
    partner: str | None = None
    """Rule 3 only: the partner of the pick group the move serves (None before v2)."""


class NoSpace(BaseModel):
    """A part a rule found no free location for; keyed by (run id, part), no number."""

    model_config = ConfigDict(frozen=True)

    part: str
    rule: RecommendationRule
    partner: str | None = None
    """Rule 3 only: the partner of the pick group (None before v2)."""
    aisle: str | None = None
    """Rule 3 only: the partner's aisle at run time, where no location was free."""


class Run(BaseModel):
    """One run of the rules (FR-23): a round, its metadata, its recommendations and its
    "no space" entries. The id is `uuid5(command_id, "run:<round>")`."""

    model_config = ConfigDict(frozen=True)

    id: str
    round: int = Field(ge=1)
    created_at: AwareDatetime
    created_by: str
    recommendations: list[Recommendation] = Field(default_factory=list)
    no_space: list[NoSpace] = Field(default_factory=list)


BestMark = Annotated[AisleMark | LevelMark | LocationMark, Field(discriminator="kind")]
"""A best-location mark: a whole aisle, a level (optionally in one aisle) or one location."""


class PlanState(BaseModel):
    schema_version: int = 2
    best_marks: list[BestMark] = Field(default_factory=list)
    keep_marks: list[str] = Field(default_factory=list)
    runs: list[Run] = Field(default_factory=list)
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
