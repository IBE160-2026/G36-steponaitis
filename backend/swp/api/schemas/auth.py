"""POST /api/auth/* request and response bodies (FR-39, AD-10)."""

from pydantic import BaseModel


class SignupRequest(BaseModel):
    username: str
    password: str
    password_repeat: str


class SignupResponse(BaseModel):
    user: str
