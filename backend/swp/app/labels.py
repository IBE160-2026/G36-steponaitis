"""Location labels service (FR-48): import-scoped and read-only, it never writes."""

import uuid

from swp.app.plans import IMPORT_NOT_FOUND
from swp.domain.errors import DomainError
from swp.domain.labels import LabelsView, build_labels
from swp.store import plans as store


def labels(import_id: uuid.UUID) -> LabelsView:
    """The location labels of the stored import; raise `not_found` for an unknown id."""
    stored = store.get_import(import_id)
    if stored is None:
        raise DomainError("not_found", IMPORT_NOT_FOUND)
    return build_labels(stored.data)
