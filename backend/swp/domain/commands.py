"""Kernel: the closed command and event unions, the command context and result (AD-6, AD-13).

Every plan change is one of these commands, sent to `POST /api/plans/{id}/commands`. Later
slices add their command and event types here and their handlers in their own modules.
"""

import uuid
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from swp.domain.state import BestMark, PlanState, Rule
from swp.domain.values import CODE_MAX_LENGTH


class CommandContext(BaseModel):
    """Time and user of a command; the domain never reads a clock (AD-1)."""

    model_config = ConfigDict(frozen=True)

    now: AwareDatetime
    user: str


class SetBestMark(BaseModel):
    type: Literal["set_best_mark"] = "set_best_mark"
    command_id: uuid.UUID
    base_version: int
    mark: BestMark


class RemoveBestMark(BaseModel):
    type: Literal["remove_best_mark"] = "remove_best_mark"
    command_id: uuid.UUID
    base_version: int
    mark: BestMark


class ManualMove(BaseModel):
    """Move all of `part`'s stock at `from` to `to` (FR-33); on the wire `from` and `to`."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["manual_move"] = "manual_move"
    command_id: uuid.UUID
    base_version: int
    part: str = Field(max_length=CODE_MAX_LENGTH)
    from_location: str = Field(alias="from", max_length=CODE_MAX_LENGTH)
    to_location: str = Field(alias="to", max_length=CODE_MAX_LENGTH)


class RunRecommendations(BaseModel):
    """Run the recommendation rules on the planning copy as a new round (FR-23)."""

    type: Literal["run"] = "run"
    command_id: uuid.UUID
    base_version: int


Command = Annotated[
    SetBestMark | RemoveBestMark | ManualMove | RunRecommendations, Field(discriminator="type")
]
"""Every command a plan accepts (closed union)."""


class MarkSet(BaseModel):
    type: Literal["mark_set"] = "mark_set"
    mark: BestMark


class MarkRemoved(BaseModel):
    type: Literal["mark_removed"] = "mark_removed"
    mark: BestMark


class MoveMade(BaseModel):
    """A manual move became a new effective move (FR-33)."""

    type: Literal["move_made"] = "move_made"
    move_number: int
    part: str
    from_location: str
    to_location: str
    rule: Rule
    round: int


class MovesCombined(BaseModel):
    """A manual move was combined into effective move `move_number` (FR-34)."""

    type: Literal["moves_combined"] = "moves_combined"
    move_number: int
    part: str
    from_location: str
    to_location: str
    round: int
    step_move_number: int


class MoveRemoved(BaseModel):
    """A manual move returned the part to `location`: move `move_number` is removed (FR-34)."""

    type: Literal["move_removed"] = "move_removed"
    move_number: int
    part: str
    location: str
    round: int
    step_move_number: int


class RunDone(BaseModel):
    """A run made round `round` with this many recommendations and "no space" entries."""

    type: Literal["run_done"] = "run_done"
    round: int
    recommendations: int
    no_space: int


Event = Annotated[
    MarkSet | MarkRemoved | MoveMade | MovesCombined | MoveRemoved | RunDone,
    Field(discriminator="type"),
]
"""Every event a command can produce (closed union)."""


class CommandResult(BaseModel):
    """The response of the command endpoint; also stored in `recent_commands`."""

    version: int
    events: list[Event]


class Applied(BaseModel):
    """The new state and the events of one applied command; no events means a no-op."""

    model_config = ConfigDict(frozen=True)

    state: PlanState
    events: list[Event] = Field(default_factory=list)
