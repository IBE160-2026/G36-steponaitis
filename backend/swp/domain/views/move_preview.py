"""The manual move preview behind GET /api/plans/{id}/moves/preview (FR-33, FR-34, AD-3).

Pure and read-only: the same check the `manual_move` command runs, plus what the target
location holds now. The command re-checks on submit.
"""

from typing import Literal

from pydantic import BaseModel

from swp.domain.analysis import Analysis, MovementClass
from swp.domain.import_data import ImportData
from swp.domain.ordering import part_order
from swp.domain.planning import MoveEffect, check_manual_move, is_empty
from swp.domain.state import PlanState
from swp.domain.values import Dec

TargetKind = Literal["empty", "occupied", "none"]


class TargetPart(BaseModel):
    part: str
    description: str
    movement_class: MovementClass | None
    picks: int | None
    stock: Dec
    kept_in_place: bool


class MovePreview(BaseModel):
    version: int
    allowed: bool
    refusal_message: str | None
    effect: MoveEffect | None
    target: TargetKind
    target_parts: list[TargetPart]


def build_move_preview(
    data: ImportData,
    analysis: Analysis,
    state: PlanState,
    version: int,
    part: str,
    from_location: str,
    to_location: str,
) -> MovePreview:
    """Whether the move is allowed, what it does, and the parts at the target now.

    `target` is `none` for a code not in the Locations file; `target_parts` are the parts
    with stock above zero at the target, in `ordering.part_order` (parts without an
    analysis entry last, by part).
    """
    check = check_manual_move(data, state, part, from_location, to_location)
    copy = check.copy
    target: TargetKind
    parts: list[TargetPart] = []
    if to_location not in copy.locations:
        target = "none"
    else:
        target = "empty" if is_empty(copy, to_location) else "occupied"
        held = {p: qty for p, qty in copy.contents_of(to_location).items() if qty > 0}
        analysed = {p: analysis.parts[p] for p in held if p in analysis.parts}
        order = [*part_order(analysed), *sorted(p for p in held if p not in analysed)]
        for p in order:
            facts = analysis.parts.get(p)
            parts.append(
                TargetPart(
                    part=p,
                    description=data.parts.get(p, ""),
                    movement_class=facts.movement_class if facts is not None else None,
                    picks=facts.picks if facts is not None else None,
                    stock=held[p],
                    kept_in_place=p in state.keep_marks,
                )
            )
    return MovePreview(
        version=version,
        allowed=check.allowed,
        refusal_message=check.refusal_message,
        effect=check.effect,
        target=target,
        target_parts=parts,
    )
