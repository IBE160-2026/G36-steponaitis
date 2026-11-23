"""Wall layout service (FR-42, AD-15): import-scoped and read-only, it never writes."""

import uuid

from swp.app.plans import IMPORT_NOT_FOUND
from swp.domain.errors import DomainError
from swp.domain.layout import LayoutView, build_layout
from swp.store import plans as store


def layout(import_id: uuid.UUID) -> LayoutView:
    """The wall layout of the stored import; raise `not_found` for an unknown id."""
    stored = store.get_import(import_id)
    if stored is None:
        raise DomainError("not_found", IMPORT_NOT_FOUND)
    return build_layout(stored.data)
