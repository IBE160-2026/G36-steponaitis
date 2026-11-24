"""Location labels of an import behind GET /api/imports/{import_id}/labels (FR-48).

Pure and import-scoped: no plan state, marks or version. Every aisle of the Locations file,
in `aisle_order`, lists its locations in `walk_path_order` (Walk Path numeric, ties by code).
Virtual locations are not in `ImportData.locations`, so they are never labels. The frontend
renders these lists in order: it never sorts, filters or parses codes.
"""

from collections import defaultdict

from pydantic import BaseModel

from swp.domain.import_data import ImportData, LocationData
from swp.domain.ordering import aisle_order, walk_path_order
from swp.domain.planning import LocationRef


class AisleLabels(BaseModel):
    aisle: str
    locations: list[LocationRef]


class LabelsView(BaseModel):
    aisles: list[AisleLabels]


def _ref(code: str, location: LocationData) -> LocationRef:
    # An import has no marks: a label never shows best.
    return LocationRef(
        code=code,
        aisle=location.aisle,
        level=location.level,
        section=location.section,
        position=location.position,
        is_best=False,
    )


def build_labels(data: ImportData) -> LabelsView:
    """Every aisle of the import with its locations in Walk Path order (FR-48)."""
    locations = data.locations
    codes_by_aisle: dict[str, list[str]] = defaultdict(list)
    for code, location in locations.items():
        codes_by_aisle[location.aisle].append(code)
    return LabelsView(
        aisles=[
            AisleLabels(
                aisle=aisle,
                locations=[
                    _ref(code, locations[code])
                    for code in walk_path_order(codes_by_aisle[aisle], locations)
                ],
            )
            for aisle in aisle_order(codes_by_aisle)
        ]
    )
