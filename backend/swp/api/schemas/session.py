"""GET /api/session response."""

from pydantic import BaseModel


class Session(BaseModel):
    user: str | None
    feature_auth: bool
    feature_demo: bool
    max_upload_bytes: int
