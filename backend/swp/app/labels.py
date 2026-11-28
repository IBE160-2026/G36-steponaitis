"""Location labels service (FR-48): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.labels import LabelsView, build_labels


def labels(plan_id: uuid.UUID) -> LabelsView:
    """The location labels of the plan as it is now; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_labels(plan.imported.data, plan.state, plan.version)
