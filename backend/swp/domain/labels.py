"""Location labels of a plan behind GET /api/plans/{plan_id}/labels (FR-48).

Plan-scoped (decided 2026-11-28): one label per (location, part) with stock above 0 in the
planning copy, so the labels show the stock the plan ends with. Every aisle of the Locations
file is listed in `aisle_order`, also one without stock; its labels follow the locations in
`walk_path_order` (Walk Path numeric, ties by code) and, within a location, the parts in
`part_number_order`. A zero-stock row and an empty location give no label. Virtual locations
are not in `ImportData.locations`, so they are never labels. The frontend renders these lists
in order: it never sorts, filters or parses codes.
"""

from collections import defaultdict

from pydantic import BaseModel

from swp.domain.import_data import ImportData
from swp.domain.ordering import aisle_order, part_number_order, walk_path_order
from swp.domain.planning import LocationRef, location_ref, planning_copy
from swp.domain.state import PlanState


class Label(BaseModel):
    """One printed label: the location, and the part its QR code encodes."""

    location: LocationRef
    part: str


class AisleLabels(BaseModel):
    aisle: str
    labels: list[Label]


class LabelsView(BaseModel):
    version: int
    aisles: list[AisleLabels]


def build_labels(data: ImportData, state: PlanState, version: int) -> LabelsView:
    """Every aisle of the import with one label per stocked (location, part) of the plan as
    it is now: locations in Walk Path order, parts in part-number order (FR-48)."""
    copy = planning_copy(data, state)
    locations = copy.locations
    codes_by_aisle: dict[str, list[str]] = defaultdict(list)
    for code, location in locations.items():
        codes_by_aisle[location.aisle].append(code)
    aisles = []
    for aisle in aisle_order(codes_by_aisle):
        labels = []
        for code in walk_path_order(codes_by_aisle[aisle], locations):
            contents = copy.contents_of(code)
            stocked = part_number_order(part for part, stock in contents.items() if stock > 0)
            if not stocked:
                continue
            ref = location_ref(copy, code, state.best_marks)
            labels.extend(Label(location=ref, part=part) for part in stocked)
        aisles.append(AisleLabels(aisle=aisle, labels=labels))
    return LabelsView(version=version, aisles=aisles)
