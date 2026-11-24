"""Part categories (FR-43, FR-44): keyword rules give each part a category from its description.

A word is a maximal run of characters where `str.isalnum()` is true; everything else is a
boundary. A rule matches when the casefolded words of its keyword appear as a contiguous run in
the casefolded words of the description. Rules are tried in the planner's order and the first
match wins; no match gives no category. The part number is never read: part numbers change.

Pure: no storage, ids or clock here. `swp.app.categories` stores the rules.
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
