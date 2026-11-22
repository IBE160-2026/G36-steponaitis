"""Kernel: the closed command and event unions, the command context and result (AD-6, AD-13).

Every plan change is one of these commands, sent to `POST /api/plans/{id}/commands`. Later
slices add their command and event types here and their handlers in their own modules.
"""

import uuid
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from swp.domain.state import BestMark, PlanState


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


Command = Annotated[SetBestMark | RemoveBestMark, Field(discriminator="type")]
"""Every command a plan accepts (closed union)."""


class MarkSet(BaseModel):
    type: Literal["mark_set"] = "mark_set"
    mark: BestMark


class MarkRemoved(BaseModel):
    type: Literal["mark_removed"] = "mark_removed"
    mark: BestMark


Event = Annotated[MarkSet | MarkRemoved, Field(discriminator="type")]
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
