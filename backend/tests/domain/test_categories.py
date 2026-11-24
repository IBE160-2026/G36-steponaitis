"""FR-44 part categories from the description; FR-43 keyword rule checks; FR-45 aisle
categories."""

import pytest

from swp.domain.categories import (
    AISLE_EMPTY,
    CATEGORY_EMPTY,
    CATEGORY_TAKEN,
    KEYWORD_EMPTY,
    KEYWORD_NO_WORD,
    KEYWORD_TAKEN,
    TEXT_INVALID,
    TOO_LONG,
    AisleCategory,
    KeywordRule,
    aisle_category_errors,
    aisle_category_list,
    category_key,
    category_of,
    keyword_key,
    part_categories,
    plan_aisle_categories_view,
    rule_categories,
    rule_errors,
    words,
)

OIL = KeywordRule(keyword="oil", category="Oils")
FILTER = KeywordRule(keyword="filter", category="Filters")


def test_fr44_words_are_casefolded_alnum_runs() -> None:
    assert words("Front brake-pad_set, 5L (OIL)") == ("front", "brake", "pad", "set", "5l", "oil")
    assert words("  --  ") == ()


@pytest.mark.parametrize(
    ("description", "expected"),
    [("Engine oil", "Oils"), ("Coil spring", None), ("Oily rag", None)],
)
def test_fr44_whole_word_match(description: str, expected: str | None) -> None:
    assert category_of(description, [OIL]) == expected


def test_fr44_match_ignores_case() -> None:
    assert category_of("engine Oil", [KeywordRule(keyword="OIL", category="Oils")]) == "Oils"


@pytest.mark.parametrize("description", ["oil-filter", "Oil, 5L", "(oil)", "x_oil_y"])
def test_fr44_punctuation_is_a_word_boundary(description: str) -> None:
    assert category_of(description, [OIL]) == "Oils"


def test_fr44_multi_word_keyword_needs_a_contiguous_run() -> None:
    rule = KeywordRule(keyword="brake pad", category="Brakes")

    assert category_of("Front brake-pad set", [rule]) == "Brakes"
    assert category_of("Brake disc pad", [rule]) is None


def test_fr44_first_matching_rule_wins() -> None:
    assert category_of("Oil filter", [FILTER, OIL]) == "Filters"
    assert category_of("Oil filter", [OIL, FILTER]) == "Oils"


def test_fr44_no_rules_or_no_match_gives_no_category() -> None:
    assert category_of("Bolt M8", []) is None
    assert category_of("Bolt M8", [OIL, FILTER]) is None


def test_fr44_part_categories_read_only_the_description() -> None:
    # The part number "OIL-1" holds the keyword; only the description counts.
    parts = {"OIL-1": "Bolt M8", "P2": "Engine oil", "P3": "Air filter"}

    assert part_categories(parts, [OIL, FILTER]) == {
        "OIL-1": None,
        "P2": "Oils",
        "P3": "Filters",
    }


def test_fr44_keyword_key_ignores_case_and_spacing() -> None:
    assert keyword_key("Oil") == keyword_key(" oil ") == keyword_key("OIL") == "oil"
    assert keyword_key("Brake  Pad") == "brake pad"


def test_fr43_valid_rule_has_no_errors() -> None:
    assert rule_errors(" filter ", " Filters ", set()) == []


def test_fr43_empty_fields_fail_in_form_order() -> None:
    assert rule_errors("", " ", set()) == [
        {"field": "keyword", "message": KEYWORD_EMPTY},
        {"field": "category", "message": CATEGORY_EMPTY},
    ]


def test_fr43_keyword_needs_a_letter_or_digit() -> None:
    assert rule_errors("--", "Filters", set()) == [{"field": "keyword", "message": KEYWORD_NO_WORD}]


def test_fr43_fields_at_most_64_characters() -> None:
    assert rule_errors("k" * 64, "c" * 64, set()) == []
    assert rule_errors("k" * 65, "c" * 65, set()) == [
        {"field": "keyword", "message": TOO_LONG},
        {"field": "category", "message": TOO_LONG},
    ]


@pytest.mark.parametrize("keyword", ["Oil", " oil ", "OIL"])
def test_fr43_duplicate_keyword_is_taken(keyword: str) -> None:
    assert rule_errors(keyword, "Oils", {"oil"}) == [{"field": "keyword", "message": KEYWORD_TAKEN}]


def test_fr43_duplicate_check_only_for_a_valid_keyword() -> None:
    assert rule_errors("k" * 65, "Oils", {"k" * 65}) == [{"field": "keyword", "message": TOO_LONG}]


@pytest.mark.parametrize("text", ["oil\x00", "oil\ud800"])
def test_fr43_unstorable_text_fails_per_field(text: str) -> None:
    assert rule_errors(text, text, {"oil"}) == [
        {"field": "keyword", "message": TEXT_INVALID},
        {"field": "category", "message": TEXT_INVALID},
    ]


def test_fr43_too_long_message_names_the_limit() -> None:
    assert TOO_LONG == "Use at most 64 characters."


def test_fr45_category_key_strips_and_casefolds() -> None:
    assert category_key(" Oils ") == category_key("OILS") == "oils"
    assert category_key("Straße") == category_key("STRASSE")


def test_fr45_rule_categories_dedupe_by_key_in_rule_order() -> None:
    rules = [
        KeywordRule(keyword="filter", category="Filters"),
        KeywordRule(keyword="oil", category="Oils"),
        KeywordRule(keyword="air filter", category="filters"),
        KeywordRule(keyword="grease", category="Oils"),
    ]

    assert rule_categories(rules) == ["Filters", "Oils"]
    assert rule_categories([]) == []


def test_fr45_valid_list_has_no_errors() -> None:
    assert aisle_category_errors("A", [" Oils", "Filters "]) == []
    assert aisle_category_errors("A", []) == []


def test_fr45_errors_name_aisle_then_each_category() -> None:
    errors = aisle_category_errors(" ", ["", "x" * 65, "Oils", "oils ", "a\x00"])

    assert errors == [
        {"field": "aisle", "message": AISLE_EMPTY},
        {"field": "categories[0]", "message": CATEGORY_EMPTY},
        {"field": "categories[1]", "message": TOO_LONG},
        {"field": "categories[3]", "message": CATEGORY_TAKEN},
        {"field": "categories[4]", "message": TEXT_INVALID},
    ]


def test_fr45_aisle_too_long_or_unstorable() -> None:
    assert aisle_category_errors("A" * 65, []) == [{"field": "aisle", "message": TOO_LONG}]
    assert aisle_category_errors("A\ud800", []) == [{"field": "aisle", "message": TEXT_INVALID}]


def test_fr45_aisle_list_sorted_by_key_and_marked_has_rule() -> None:
    listed = aisle_category_list(["oils", "Filters", "Belts", "Oils"], [OIL, FILTER])

    assert listed == [
        AisleCategory(category="Belts", has_rule=False),
        AisleCategory(category="Filters", has_rule=True),
        AisleCategory(category="Oils", has_rule=True),
        AisleCategory(category="oils", has_rule=True),
    ]


def test_fr45_plan_view_keeps_aisle_order_and_empty_aisles() -> None:
    view = plan_aisle_categories_view(["A", "B"], {"B": ["Oils"], "Z": ["Filters"]}, [OIL])

    assert view.model_dump() == {
        "aisles": [
            {"aisle": "A", "categories": []},
            {"aisle": "B", "categories": [{"category": "Oils", "has_rule": True}]},
        ],
        "rule_categories": ["Oils"],
    }
