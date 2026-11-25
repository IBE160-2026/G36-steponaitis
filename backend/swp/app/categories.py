"""Keyword rules (FR-43) and aisle categories (FR-45) service: the global category tables.

Rules: list, create, edit, delete and reorder. Values are normalized (`normalize_text`), checked by
`swp.domain.categories` inside the store's write lock, and stored. The caller passes `now`; new
ids come from uuid4 here. Aisle categories: read one aisle, replace its whole list, or read every
aisle of a plan's import (read-only, it never writes the plan). The category check (FR-46) reads
the plan and both tables and writes nothing. The starter categories (FR-47) come from
`backend/settings/starter_categories.toml` and are seeded only by `bootstrap`.
"""

import logging
import tomllib
import uuid
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from swp.app.plans import require
from swp.config import BACKEND_DIR
from swp.domain.categories import (
    AisleCategories,
    CategoryCheck,
    KeywordRule,
    PlanAisleCategories,
    aisle_categories_view,
    aisle_category_errors,
    check,
    keyword_key,
    normalize_text,
    plan_aisle_categories_view,
    rule_errors,
)
from swp.domain.errors import DomainError, FieldError
from swp.domain.ordering import aisle_order
from swp.store import aisle_categories as aisle_store
from swp.store import category_seed
from swp.store import keyword_rules as store
from swp.store.aisle_categories import AisleCategoriesBusy
from swp.store.category_seed import CategorySeedBusy
from swp.store.keyword_rules import RuleDraft, RulesBusy, StoredKeywordRule

logger = logging.getLogger("swp.categories")

STARTER_CATEGORIES_PATH = BACKEND_DIR / "settings" / "starter_categories.toml"
RULE_NOT_FOUND = "That keyword rule no longer exists."
ORDER_INVALID = "List every keyword rule exactly once."
RULES_CHANGED = "The keyword rules were changed elsewhere. The list is reloaded. Try again."
RULES_BUSY = "The keyword rules are busy. Try again."
AISLES_BUSY = "The aisle categories are busy. Try again."


def _validation_failed(errors: list[FieldError]) -> DomainError:
    details: list[dict[str, object]] = [dict(error) for error in errors]
    return DomainError("validation_failed", errors[0]["message"], details)


def _not_found() -> DomainError:
    return DomainError("not_found", RULE_NOT_FOUND)


def _order_invalid() -> DomainError:
    return _validation_failed([{"field": "ids", "message": ORDER_INVALID}])


def _rules_changed() -> DomainError:
    return DomainError("command_rejected", RULES_CHANGED)


def _parse_ids(raw_ids: list[str]) -> list[uuid.UUID]:
    try:
        return [uuid.UUID(raw) for raw in raw_ids]
    except ValueError:
        raise _order_invalid() from None


def _parse_id(raw: str) -> uuid.UUID:
    """The rule id from the path; `not_found` when it is not a UUID (no rule has it)."""
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise _not_found() from None


def _draft(rule: StoredKeywordRule) -> RuleDraft:
    return RuleDraft(id=rule.id, keyword=rule.keyword, category=rule.category)


def _checked(keyword: str, category: str, others: list[StoredKeywordRule]) -> tuple[str, str]:
    """The normalized pair; raise `validation_failed` when it is not a valid rule beside
    `others`."""
    keyword = normalize_text(keyword)
    category = normalize_text(category)
    taken = {keyword_key(rule.keyword) for rule in others}
    errors = rule_errors(keyword, category, taken)
    if errors:
        raise _validation_failed(errors)
    return keyword, category


def _write(
    change: Callable[[list[StoredKeywordRule]], list[RuleDraft]], *, now: datetime
) -> list[StoredKeywordRule]:
    """`store.write_rules`, with a held lock as `unavailable` (503, the client retries)."""
    try:
        return store.write_rules(change, now=now)
    except RulesBusy as error:
        raise DomainError("unavailable", RULES_BUSY) from error


def list_rules() -> list[StoredKeywordRule]:
    return store.list_rules()


def create_rule(keyword: str, category: str, *, now: datetime) -> StoredKeywordRule:
    """Append a rule at the end of the list."""
    new_id = uuid.uuid4()

    def change(current: list[StoredKeywordRule]) -> list[RuleDraft]:
        checked_keyword, checked_category = _checked(keyword, category, current)
        return [*map(_draft, current), RuleDraft(new_id, checked_keyword, checked_category)]

    rules = _write(change, now=now)
    return next(rule for rule in rules if rule.id == new_id)


def edit_rule(
    raw_id: str, keyword: str | None, category: str | None, *, now: datetime
) -> StoredKeywordRule:
    """Change a rule's keyword and/or category; an omitted field keeps its stored value."""
    rule_id = _parse_id(raw_id)

    def change(current: list[StoredKeywordRule]) -> list[RuleDraft]:
        target = next((rule for rule in current if rule.id == rule_id), None)
        if target is None:
            raise _not_found()
        others = [rule for rule in current if rule.id != rule_id]
        checked_keyword, checked_category = _checked(
            target.keyword if keyword is None else keyword,
            target.category if category is None else category,
            others,
        )
        return [
            RuleDraft(rule.id, checked_keyword, checked_category)
            if rule.id == rule_id
            else _draft(rule)
            for rule in current
        ]

    rules = _write(change, now=now)
    return next(rule for rule in rules if rule.id == rule_id)


def delete_rule(raw_id: str, *, now: datetime) -> None:
    """Delete a rule and close the gap in the positions."""
    rule_id = _parse_id(raw_id)

    def change(current: list[StoredKeywordRule]) -> list[RuleDraft]:
        if not any(rule.id == rule_id for rule in current):
            raise _not_found()
        return [_draft(rule) for rule in current if rule.id != rule_id]

    _write(change, now=now)


def reorder_rules(
    raw_ids: list[str], raw_base_ids: list[str], *, now: datetime
) -> list[StoredKeywordRule]:
    """Put the rules in the order of `raw_ids`, which must list every rule exactly once.

    `raw_base_ids` is the order the client reordered from: when the stored rules are no longer in
    exactly that order (another tab or user added, deleted or moved a rule), raise
    `command_rejected` (409) with nothing written, so a stale list never overwrites a newer one.
    """
    ids = _parse_ids(raw_ids)
    base_ids = _parse_ids(raw_base_ids)

    def change(current: list[StoredKeywordRule]) -> list[RuleDraft]:
        if base_ids != [rule.id for rule in current]:
            raise _rules_changed()
        by_id = {rule.id: rule for rule in current}
        if len(ids) != len(current) or set(ids) != set(by_id):
            raise _order_invalid()
        return [_draft(by_id[rule_id]) for rule_id in ids]

    return _write(change, now=now)


def _domain_rules() -> list[KeywordRule]:
    return [KeywordRule(keyword=r.keyword, category=r.category) for r in store.list_rules()]


def aisle_categories(aisle: str) -> AisleCategories:
    """The categories of `aisle` (stripped, then exact text); an aisle with none has an empty
    list."""
    aisle = aisle.strip()
    errors = aisle_category_errors(aisle, [])
    if errors:
        raise _validation_failed(errors)
    return aisle_categories_view(aisle, aisle_store.list_for(aisle), _domain_rules())


def set_aisle_categories(aisle: str, categories: list[str]) -> AisleCategories:
    """Replace the whole category list of `aisle` (stripped, as the import strips Aisle text);
    the categories are stored normalized. An empty list clears it."""
    aisle = aisle.strip()
    errors = aisle_category_errors(aisle, categories)
    if errors:
        raise _validation_failed(errors)
    try:
        aisle_store.replace(aisle, [normalize_text(category) for category in categories])
    except AisleCategoriesBusy as error:
        raise DomainError("unavailable", AISLES_BUSY) from error
    return aisle_categories(aisle)


def plan_aisle_categories(plan_id: uuid.UUID) -> PlanAisleCategories:
    """Every distinct aisle of the plan's import in `aisle_order` with its categories, and the
    distinct rule categories in rule order; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    aisles = aisle_order(location.aisle for location in plan.imported.data.locations.values())
    return plan_aisle_categories_view(aisles, aisle_store.list_all(), _domain_rules())


def category_check(plan_id: uuid.UUID) -> CategoryCheck:
    """The category check of the plan as it is now (FR-46): one replay, read-only (it never
    writes the plan or the category tables); raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return check(
        plan.imported.data,
        plan.analysis,
        plan.state,
        plan.version,
        _domain_rules(),
        aisle_store.list_all(),
    )


class StarterRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keyword: str
    category: str


class StarterCategories(BaseModel):
    """The starter list (FR-47): keyword rules in rule order, then each aisle's categories."""

    model_config = ConfigDict(extra="forbid")

    rules: list[StarterRule]
    aisles: dict[str, list[str]]


def load_starter_categories(path: Path = STARTER_CATEGORIES_PATH) -> StarterCategories:
    """The checked starter list from `path`, aisles stripped and keywords and categories
    normalized (`normalize_text`); raise ValueError naming the first
    invalid entry (a bug in the shipped file, never skipped)."""
    with path.open("rb") as file:
        raw = StarterCategories.model_validate(tomllib.load(file))
    rules: list[StarterRule] = []
    taken: set[str] = set()
    for index, rule in enumerate(raw.rules):
        errors = rule_errors(rule.keyword, rule.category, taken)
        if errors:
            raise ValueError(
                f"{path.name}: rules[{index}] ({rule.keyword!r} -> {rule.category!r}): "
                f"{errors[0]['field']}: {errors[0]['message']}"
            )
        taken.add(keyword_key(rule.keyword))
        rules.append(
            StarterRule(
                keyword=normalize_text(rule.keyword), category=normalize_text(rule.category)
            )
        )
    for aisle, categories in raw.aisles.items():
        errors = aisle_category_errors(aisle, categories)
        if errors:
            raise ValueError(
                f"{path.name}: aisles.{aisle!r}: {errors[0]['field']}: {errors[0]['message']}"
            )
    aisles = {
        aisle.strip(): [normalize_text(c) for c in categories]
        for aisle, categories in raw.aisles.items()
    }
    return StarterCategories(rules=rules, aisles=aisles)


def seed_starter_categories(*, now: datetime, path: Path | None = None) -> bool:
    """Store the starter list once, only when both category tables are empty (FR-47, AD-9);
    True when it wrote. A busy lock means another writer holds the category tables (e.g. another
    worker seeding): logged and skipped."""
    starter = load_starter_categories(path or STARTER_CATEGORIES_PATH)
    drafts = [RuleDraft(uuid.uuid4(), rule.keyword, rule.category) for rule in starter.rules]
    try:
        return category_seed.seed_if_empty(drafts, starter.aisles, now=now)
    except CategorySeedBusy:
        logger.info("Starter categories skipped: another writer holds the category tables.")
        return False
