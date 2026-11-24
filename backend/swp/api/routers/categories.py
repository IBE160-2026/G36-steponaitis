"""Keyword rules (FR-43): one global, ordered list, the same in every plan.

GET/POST /api/keyword-rules, PATCH/DELETE /api/keyword-rules/{rule_id} and
PUT /api/keyword-rules/order. Writes pass the same-origin guard (AD-19); errors use the
AD-11 envelope.
"""

from collections.abc import Iterable
from datetime import UTC, datetime

from fastapi import APIRouter, Response, status

from swp.api.errors import error_responses
from swp.api.schemas.categories import (
    KeywordRule,
    KeywordRuleCreate,
    KeywordRuleEdit,
    KeywordRuleOrder,
    KeywordRules,
)
from swp.app import categories

router = APIRouter()


def _rules(rules: Iterable[object]) -> KeywordRules:
    return KeywordRules(rules=[KeywordRule.model_validate(rule) for rule in rules])


@router.get("/keyword-rules", responses=error_responses(401))
def list_keyword_rules() -> KeywordRules:
    return _rules(categories.list_rules())


@router.post(
    "/keyword-rules",
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(401, 403, 422, 503),
)
def create_keyword_rule(body: KeywordRuleCreate) -> KeywordRule:
    rule = categories.create_rule(body.keyword, body.category, now=datetime.now(UTC))
    return KeywordRule.model_validate(rule)


# Declared before /{rule_id} routes: "order" is a fixed path, not a rule id.
@router.put("/keyword-rules/order", responses=error_responses(401, 403, 422, 503))
def reorder_keyword_rules(body: KeywordRuleOrder) -> KeywordRules:
    return _rules(categories.reorder_rules(body.ids, now=datetime.now(UTC)))


@router.patch("/keyword-rules/{rule_id}", responses=error_responses(401, 403, 404, 422, 503))
def edit_keyword_rule(rule_id: str, body: KeywordRuleEdit) -> KeywordRule:
    rule = categories.edit_rule(rule_id, body.keyword, body.category, now=datetime.now(UTC))
    return KeywordRule.model_validate(rule)


@router.delete(
    "/keyword-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=error_responses(401, 403, 404, 422, 503),
)
def delete_keyword_rule(rule_id: str) -> Response:
    categories.delete_rule(rule_id, now=datetime.now(UTC))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
