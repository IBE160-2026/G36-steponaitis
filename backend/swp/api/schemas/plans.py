"""GET /api/plans response rows."""

import uuid
from datetime import date

from pydantic import AwareDatetime, BaseModel


class SavedPlanRow(BaseModel):
    id: uuid.UUID
    name: str
    data_as_of: date
    uploaded_at: AwareDatetime
    created_by: str
    created_at: AwareDatetime
    last_edited_by: str
    last_edited_at: AwareDatetime
