"""Part categories (FR-43, FR-44): keyword rules give each part a category from its description.

A word is a maximal run of characters where `str.isalnum()` is true; everything else is a
boundary. A rule matches when the casefolded words of its keyword appear as a contiguous run in
the casefolded words of the description. Rules are tried in the planner's order and the first
match wins; no match gives no category. The part number is never read: part numbers change.

Aisle categories (FR-45) are global and keyed by the exact Aisle text; categories compare by
`category_key` (stripped, casefolded).

Pure: no storage, ids or clock here. `swp.app.categories` stores the rules and aisle categories.
"""

from collections.abc import Collection, Iterable, Mapping, Sequence

from pydantic import BaseModel, ConfigDict

from swp.domain.errors import FieldError

TEXT_MAX = 64

KEYWORD_EMPTY = "Enter a keyword."
KEYWORD_NO_WORD = "Use letters or numbers in the keyword."
CATEGORY_EMPTY = "Enter a category."
TOO_LONG = f"Use at most {TEXT_MAX} characters."
TEXT_INVALID = "Use letters, numbers and ordinary symbols only."
KEYWORD_TAKEN = "That keyword already has a rule."
AISLE_EMPTY = "Enter an aisle."
CATEGORY_TAKEN = "That category is already on this aisle."


class KeywordRule(BaseModel):
    """One keyword → one category (e.g. "filter" → Filters)."""

    model_config = ConfigDict(frozen=True)

    keyword: str
    category: str


def words(text: str) -> tuple[str, ...]:
    """The casefolded words of `text`: maximal runs of `isalnum` characters."""
    found: list[str] = []
    current: list[str] = []
    for char in text:
        if char.isalnum():
            current.append(char)
        elif current:
            found.append("".join(current).casefold())
            current = []
    if current:
        found.append("".join(current).casefold())
    return tuple(found)


def keyword_key(keyword: str) -> str:
    """The key a keyword is unique by: its casefolded words ("Oil", " oil ", "OIL" are one)."""
    return " ".join(words(keyword))


def _contains(haystack: tuple[str, ...], needle: tuple[str, ...]) -> bool:
    if not needle:
        return False
    width = len(needle)
    return any(haystack[i : i + width] == needle for i in range(len(haystack) - width + 1))


def _category_of_words(
    description_words: tuple[str, ...], rule_words: Sequence[tuple[tuple[str, ...], str]]
) -> str | None:
    for keyword_words, category in rule_words:
        if _contains(description_words, keyword_words):
            return category
    return None


def _rule_words(rules: Iterable[KeywordRule]) -> list[tuple[tuple[str, ...], str]]:
    return [(words(rule.keyword), rule.category) for rule in rules]


def category_of(description: str, rules: Iterable[KeywordRule]) -> str | None:
    """The category of the first rule (in the given order) matching `description`, or None."""
    return _category_of_words(words(description), _rule_words(rules))


def part_categories(
    parts: Mapping[str, str], rules: Iterable[KeywordRule]
) -> dict[str, str | None]:
    """Each part number's category from its description (`ImportData.parts`), or None."""
    rule_words = _rule_words(rules)
    return {
        part: _category_of_words(words(description), rule_words)
        for part, description in parts.items()
    }


def _storable(text: str) -> bool:
    """False for text the database cannot store: NUL or a lone surrogate (from JSON)."""
    if "\x00" in text:
        return False
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def rule_errors(keyword: str, category: str, taken_keys: Collection[str]) -> list[FieldError]:
    """The failing fields of a keyword rule, in form order (keyword, category).

    Both values are stripped of surrounding whitespace first. `taken_keys` are the
    `keyword_key`s of the other rules; the duplicate check runs only when the keyword's own
    format is valid.
    """
    keyword = keyword.strip()
    category = category.strip()
    errors: list[FieldError] = []
    keyword_message: str | None = None
    if not keyword:
        keyword_message = KEYWORD_EMPTY
    elif len(keyword) > TEXT_MAX:
        keyword_message = TOO_LONG
    elif not _storable(keyword):
        keyword_message = TEXT_INVALID
    elif not words(keyword):
        keyword_message = KEYWORD_NO_WORD
    elif keyword_key(keyword) in taken_keys:
        keyword_message = KEYWORD_TAKEN
    if keyword_message is not None:
        errors.append({"field": "keyword", "message": keyword_message})
    if not category:
        errors.append({"field": "category", "message": CATEGORY_EMPTY})
    elif len(category) > TEXT_MAX:
        errors.append({"field": "category", "message": TOO_LONG})
    elif not _storable(category):
        errors.append({"field": "category", "message": TEXT_INVALID})
    return errors


def category_key(category: str) -> str:
    """The key categories compare by (FR-45): stripped and casefolded ("Oils", " oils ")."""
    return category.strip().casefold()


def rule_categories(rules: Iterable[KeywordRule]) -> list[str]:
    """The distinct categories the rules give, in rule order; the first spelling of each
    `category_key` is kept."""
    seen: set[str] = set()
    found: list[str] = []
    for rule in rules:
        key = category_key(rule.category)
        if key not in seen:
            seen.add(key)
            found.append(rule.category)
    return found


class AisleCategory(BaseModel):
    """One category on an aisle; `has_rule` is false when no keyword rule gives it any more."""

    model_config = ConfigDict(frozen=True)

    category: str
    has_rule: bool


def aisle_category_list(
    categories: Iterable[str], rules: Iterable[KeywordRule]
) -> list[AisleCategory]:
    """An aisle's categories sorted by `category_key`, then text, each marked `has_rule`."""
    rule_keys = {category_key(rule.category) for rule in rules}
    ordered = sorted(categories, key=lambda category: (category_key(category), category))
    return [
        AisleCategory(category=category, has_rule=category_key(category) in rule_keys)
        for category in ordered
    ]


class AisleCategories(BaseModel):
    """One aisle (exact Aisle text) and its categories (FR-45)."""

    aisle: str
    categories: list[AisleCategory]


class PlanAisleCategories(BaseModel):
    """Every aisle of a plan's import with its categories, and the rule categories to pick."""

    aisles: list[AisleCategories]
    rule_categories: list[str]


def aisle_categories_view(
    aisle: str, categories: Iterable[str], rules: Sequence[KeywordRule]
) -> AisleCategories:
    return AisleCategories(aisle=aisle, categories=aisle_category_list(categories, rules))


def plan_aisle_categories_view(
    aisles: Iterable[str], stored: Mapping[str, Iterable[str]], rules: Sequence[KeywordRule]
) -> PlanAisleCategories:
    """`aisles` in the given order (the caller passes `ordering.aisle_order`), each with its
    stored categories, and `rule_categories(rules)`."""
    return PlanAisleCategories(
        aisles=[aisle_categories_view(aisle, stored.get(aisle, ()), rules) for aisle in aisles],
        rule_categories=rule_categories(rules),
    )


def _text_error(text: str, empty_message: str) -> str | None:
    if not text.strip():
        return empty_message
    if len(text) > TEXT_MAX:
        return TOO_LONG
    if not _storable(text):
        return TEXT_INVALID
    return None


def aisle_category_errors(aisle: str, categories: Sequence[str]) -> list[FieldError]:
    """The failing fields of an aisle's category list (FR-45): `aisle`, then `categories[i]`.

    The aisle is kept exactly (it is matched by its text in each import) and fails only when it
    is empty after stripping, too long or unstorable. Every category is stripped first. A
    category whose `category_key` repeats an earlier one on the list fails with CATEGORY_TAKEN.
    Any valid category text is accepted, whether or not a keyword rule gives it.
    """
    errors: list[FieldError] = []
    aisle_message = _text_error(aisle, AISLE_EMPTY)
    if aisle_message is not None:
        errors.append({"field": "aisle", "message": aisle_message})
    seen: set[str] = set()
    for index, raw in enumerate(categories):
        category = raw.strip()
        message = _text_error(category, CATEGORY_EMPTY)
        if message is None:
            key = category_key(category)
            if key in seen:
                message = CATEGORY_TAKEN
            seen.add(key)
        if message is not None:
            errors.append({"field": f"categories[{index}]", "message": message})
    return errors
