"""/api/keyword-rules request and response bodies (FR-43)."""

import uuid

from pydantic import AwareDatetime, BaseModel, ConfigDict


class KeywordRuleCreate(BaseModel):
    keyword: str
    category: str


class KeywordRuleEdit(BaseModel):
    """An omitted (or null) field keeps its stored value."""

    keyword: str | None = None
    category: str | None = None


class KeywordRuleOrder(BaseModel):
    """Every rule id exactly once, in the new order."""

    ids: list[str]


class KeywordRule(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    keyword: str
    category: str
    updated_at: AwareDatetime


class KeywordRules(BaseModel):
    rules: list[KeywordRule]
