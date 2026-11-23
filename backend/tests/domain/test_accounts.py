"""FR-39 account rules: username format, reserved names, password limits and mismatch."""

import pytest

from swp.domain.accounts import (
    PASSWORD_INVALID,
    PASSWORDS_DIFFER,
    RESERVED_USERNAMES,
    TAKEN,
    is_reserved,
    signup_errors,
    username_key,
)

OK = "secret"


def _username_errors(username: str) -> list[dict[str, str]]:
    return [dict(e) for e in signup_errors(username, OK, OK)]


def test_fr39_valid_signup_has_no_errors() -> None:
    assert signup_errors("Kari7", OK, OK) == []


def test_fr39_username_key_is_casefold() -> None:
    assert username_key("Kari7") == username_key("kARI7") == "kari7"
    assert username_key("Straße") == username_key("STRASSE")


@pytest.mark.parametrize("username", ["planner", "Planner", "DEMO", "demo", "PlAnNeR"])
def test_fr39_reserved_usernames_get_taken_message(username: str) -> None:
    assert is_reserved(username)
    assert _username_errors(username) == [{"field": "username", "message": TAKEN}]


def test_fr39_reserved_set_is_planner_and_demo() -> None:
    assert RESERVED_USERNAMES == {"planner", "demo"}


@pytest.mark.parametrize(
    ("username", "message"),
    [
        ("", "Enter a username."),
        ("a" * 33, "Use at most 32 letters and numbers."),
        ("ola nordmann", "Use letters and numbers only."),
        ("ola_n", "Use letters and numbers only."),
        ("ola-n", "Use letters and numbers only."),
    ],
    ids=["empty", "33-chars", "space", "underscore", "hyphen"],
)
def test_fr39_bad_username_format(username: str, message: str) -> None:
    assert _username_errors(username) == [{"field": "username", "message": message}]


@pytest.mark.parametrize("username", ["a", "a" * 32, "Øyvind2", "Kari7"])
def test_fr39_good_username_format(username: str) -> None:
    assert _username_errors(username) == []


@pytest.mark.parametrize(
    ("password", "message"),
    [
        ("abc", "Use at least 4 characters."),
        ("a" * 65, "Use at most 64 characters."),
        ("€" * 25, "This password is too long. Use fewer special characters."),
    ],
    ids=["3-chars", "65-chars", "25-euro-75-bytes"],
)
def test_fr39_password_limits(password: str, message: str) -> None:
    assert [dict(e) for e in signup_errors("Kari7", password, password)] == [
        {"field": "password", "message": message}
    ]


@pytest.mark.parametrize("password", ["abcd", "a" * 64, "€" * 24], ids=["4", "64", "72-bytes"])
def test_fr39_password_at_limits_accepted(password: str) -> None:
    assert signup_errors("Kari7", password, password) == []


def test_fr39_password_mismatch() -> None:
    assert [dict(e) for e in signup_errors("Kari7", OK, "secreT")] == [
        {"field": "password_repeat", "message": PASSWORDS_DIFFER}
    ]
    assert PASSWORDS_DIFFER == "The passwords don’t match."


def test_fr39_several_errors_in_form_order() -> None:
    errors = signup_errors("ola n", "abc", "abd")
    assert [e["field"] for e in errors] == ["username", "password", "password_repeat"]


def test_fr39_password_with_lone_surrogate_rejected() -> None:
    password = "ab\ud800cd"
    assert [dict(e) for e in signup_errors("Kari7", password, password)] == [
        {"field": "password", "message": PASSWORD_INVALID}
    ]
    assert PASSWORD_INVALID == "Use letters, numbers and ordinary symbols only."
