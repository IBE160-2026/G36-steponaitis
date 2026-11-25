"""FR-44 part categories from the description; FR-43 keyword rule checks; FR-45 aisle
categories."""

from decimal import Decimal

import pytest

from swp.domain.analysis import Analysis, PartAnalysis
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
    check,
    keyword_key,
    normalize_text,
    part_categories,
    plan_aisle_categories_view,
    rule_categories,
    rule_errors,
    words,
)
from swp.domain.import_data import ImportData, InventoryLine, LocationData
from swp.domain.ordering import category_check_order
from swp.domain.state import AisleMark, PlanState, Step

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


def _location(walk_path: int, aisle: str, level: str = "1") -> LocationData:
    return LocationData(
        walk_path=Decimal(walk_path), aisle=aisle, level=level, section=None, position=None
    )


# Aisle B comes first on the Walk Path; the check still lists aisle A first (location order).
CHECK_LOCATIONS = {
    "B-01": _location(0, "B"),
    "A-02": _location(1, "A", "2"),
    "A-01": _location(2, "A"),
    "C-01": _location(3, "C"),
    "D-01": _location(4, "D"),
}
CHECK_PARTS = {
    "P9": "Engine oil",
    "P2": "Oil, 5L",
    "P1": "Gear oil",
    "P3": "Air filter",
    "P4": "Bolt M8",
    "P5": "Hydraulic oil",
    "P6": "Brake oil",
}
CHECK_STOCK = [
    ("P9", "A-01", 2),
    ("P2", "B-01", 1),
    ("P1", "A-01", 3),
    ("P3", "A-02", 1),  # Filters in aisle A: in its aisle
    ("P4", "A-02", 5),  # no category: not checked
    ("P5", "A-01", 0),  # no stock: not checked
    ("P6", "C-01", 4),  # aisle C has no categories: not checked
]


def _check_data() -> ImportData:
    return ImportData(
        locations=CHECK_LOCATIONS,
        inventory=[
            InventoryLine(part=part, location=code, quantity=Decimal(quantity))
            for part, code, quantity in CHECK_STOCK
        ],
        parts=CHECK_PARTS,
        transactions=[],
    )


def _check_analysis(analysis: Analysis) -> Analysis:
    parts = {part: PartAnalysis(picks=1, movement_class="slow") for part in CHECK_PARTS}
    return analysis.model_copy(update={"parts": parts, "pick_groups": []})


CHECK_AISLES = {"A": ["Filters", "belts"], "B": [" FILTERS"], "Z": ["Oils"], "D": []}


def test_fr46_check_lists_parts_outside_their_aisle(analysis: Analysis) -> None:
    result = check(
        _check_data(), _check_analysis(analysis), PlanState.new(), 7, [OIL, FILTER], CHECK_AISLES
    )

    assert result.version == 7
    assert [(row.part, row.current_location.code) for row in result.rows] == [
        ("P1", "A-01"),
        ("P9", "A-01"),
        ("P2", "B-01"),
    ]
    first = result.rows[0]
    assert first.description == "Gear oil"
    assert first.category == "Oils"
    assert first.current_location.aisle == "A"
    assert first.aisle_categories == ["belts", "Filters"]
    assert result.rows[2].aisle_categories == [" FILTERS"]
    assert result.outside_count == 3
    # C and D have no categories ("Z" is not an aisle of the import).
    assert result.aisles_without_categories == 2


def test_fr46_category_in_aisle_matches_any_case(analysis: Analysis) -> None:
    result = check(
        _check_data(), _check_analysis(analysis), PlanState.new(), 1, [OIL], {"A": [" oils"]}
    )

    assert [row.part for row in result.rows] == []
    assert result.aisles_without_categories == 3


def test_fr46_not_checked_without_category_stock_or_aisle_categories(
    analysis: Analysis,
) -> None:
    result = check(
        _check_data(), _check_analysis(analysis), PlanState.new(), 1, [OIL, FILTER], CHECK_AISLES
    )

    assert {"P3", "P4", "P5", "P6"}.isdisjoint(row.part for row in result.rows)


def test_fr46_check_follows_the_planning_copy(analysis: Analysis) -> None:
    move = Step(
        move_number=1, part="P2", from_location="B-01", to_location="C-01", rule="manual", round=0
    )
    state = PlanState(steps=[move], best_marks=[AisleMark(aisle="A")])

    result = check(_check_data(), _check_analysis(analysis), state, 2, [OIL, FILTER], CHECK_AISLES)

    assert [row.part for row in result.rows] == ["P1", "P9"]
    assert result.rows[0].current_location.is_best is True


def test_fr46_check_is_deterministic(analysis: Analysis) -> None:
    args = (_check_data(), _check_analysis(analysis), PlanState.new(), 1, [OIL], CHECK_AISLES)

    assert check(*args).model_dump_json() == check(*args).model_dump_json()


def test_fr46_category_check_order_by_location_then_part() -> None:
    current = {"P2": "B-01", "P9": "A-01", "P1": "A-01", "P3": "A-02", "P0": "X-99"}

    assert category_check_order(current, CHECK_LOCATIONS) == ["P1", "P9", "P3", "P2", "P0"]


@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("  Oils  ", "Oils"),
        ("Engine \t\n  Oils", "Engine Oils"),
        ("Engine\u00a0Oils", "Engine Oils"),
        ("Oi\u200bls\u200d", "Oils"),
        ("\ufeffOils\u00ad", "Oils"),
        ("Cafe\u0301", "Caf\u00e9"),
        ("\u200b \u200b", ""),
    ],
)
def test_fr45_normalize_text_trims_collapses_nfc_and_drops_format_characters(
    raw: str, normalized: str
) -> None:
    assert normalize_text(raw) == normalized


def test_fr45_category_key_treats_lookalike_categories_as_one() -> None:
    lookalikes = ["Engine Oils", " engine  oils ", "ENGINE\tOILS", "Engine\u00a0Oils\u200b"]
    keys = {category_key(c) for c in lookalikes}
    assert keys == {"engine oils"}
    assert category_key("Caf\u00e9") == category_key("CAFE\u0301")
    assert category_key("Stra\u00dfe") == category_key("STRASSE")


def test_fr43_words_keep_combining_marks_and_ignore_format_characters() -> None:
    assert words("Cafe\u0301 fil\u200bter") == ("caf\u00e9", "filter")
    assert words("a\u0360b") == ("a\u0360b",)
    assert keyword_key("CAFE\u0301") == keyword_key("caf\u00e9")
    rules = [KeywordRule(keyword="caf\u00e9", category="Cafe")]
    assert category_of("Grand Cafe\u0301 sign", rules) == "Cafe"


def test_fr43_rule_errors_check_normalized_text() -> None:
    assert rule_errors("\u200b", "\u200b ", set()) == [
        {"field": "keyword", "message": KEYWORD_EMPTY},
        {"field": "category", "message": CATEGORY_EMPTY},
    ]
    assert rule_errors("oil", "O" + "\u200b" * 100 + "ils", set()) == []
    assert rule_errors("CAFE\u0301", "Cafe", {keyword_key("caf\u00e9")}) == [
        {"field": "keyword", "message": KEYWORD_TAKEN}
    ]


def test_fr45_aisle_category_errors_find_duplicates_after_normalization() -> None:
    assert aisle_category_errors(" A ", ["Engine Oils", "engine\u200b  oils"]) == [
        {"field": "categories[1]", "message": CATEGORY_TAKEN}
    ]
