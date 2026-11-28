"""FR-47/AD-9 starter categories on SQLite and (CI) Postgres.

`bootstrap(seed=True)` loads `backend/settings/starter_categories.toml` once, only when both the
keyword_rules and aisle_categories tables are empty; it never overwrites the planner's lists.
"""

import logging
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select, text
from sqlalchemy.exc import OperationalError

from swp.api.app import create_app
from swp.app import categories
from swp.app.bootstrap import bootstrap
from swp.app.categories import STARTER_CATEGORIES_PATH, load_starter_categories
from swp.app.imports import check_files
from swp.domain.categories import KeywordRule, category_key, category_of
from swp.store import category_seed
from swp.store.db import get_engine
from swp.store.models import AisleCategoryRow, KeywordRuleRow
from tests.app.test_import_readers import _data_files
from tests.app.test_parts_api import _sample_plan

T0 = datetime(2026, 11, 24, 9, 0, tzinfo=UTC)
T1 = datetime(2026, 11, 24, 10, 0, tzinfo=UTC)


def _rules() -> list[tuple[object, int, str, str, datetime]]:
    with get_engine().connect() as conn:
        query = select(KeywordRuleRow).order_by(KeywordRuleRow.position)
        return [
            (row.id, row.position, row.keyword, row.category, row.updated_at)
            for row in conn.execute(query)
        ]


def _aisles() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    with get_engine().connect() as conn:
        query = select(AisleCategoryRow.aisle, AisleCategoryRow.category).order_by(
            AisleCategoryRow.aisle, AisleCategoryRow.category
        )
        for row in conn.execute(query):
            found.setdefault(row.aisle, []).append(row.category)
    return found


def _starter_aisles() -> dict[str, list[str]]:
    return {
        aisle: sorted(values) for aisle, values in sorted(load_starter_categories().aisles.items())
    }


def _write(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "starter_categories.toml"
    path.write_text(body, encoding="utf-8")
    return path


def test_fr47_starter_categories_check_runs(empty_tables: str) -> None:
    bootstrap(upgrade=False, seed=True)

    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        response = client.get(f"/api/plans/{plan_id}/category-check")

    assert response.status_code == 200, response.text
    view = response.json()
    assert view["outside_count"] > 0
    assert view["outside_count"] == len(view["rows"])
    assert view["aisles_without_categories"] == 0


def test_fr47_fresh_database_gets_rules_in_file_order_and_aisles(empty_tables: str) -> None:
    starter = load_starter_categories()

    assert categories.seed_starter_categories(now=T0) is True

    rows = _rules()
    assert [(position, keyword, category) for _, position, keyword, category, _ in rows] == [
        (index, rule.keyword, rule.category) for index, rule in enumerate(starter.rules)
    ]
    assert {updated_at for *_, updated_at in rows} == {T0}
    assert len({row_id for row_id, *_ in rows}) == len(rows)
    assert _aisles() == _starter_aisles()
    assert list(_aisles()) == list("ABCDEFGHI")


def test_fr47_seed_twice_changes_nothing(empty_tables: str) -> None:
    bootstrap(upgrade=False, seed=True)
    rules, aisles = _rules(), _aisles()

    assert categories.seed_starter_categories(now=T1) is False
    bootstrap(upgrade=True, seed=True)

    assert _rules() == rules
    assert _aisles() == aisles


def test_fr47_existing_rule_blocks_the_seed(empty_tables: str) -> None:
    categories.create_rule("bolt", "Fasteners", now=T0)
    before = _rules()

    bootstrap(upgrade=False, seed=True)

    assert _rules() == before
    assert _aisles() == {}


def test_fr47_existing_aisle_category_blocks_the_seed(empty_tables: str) -> None:
    categories.set_aisle_categories("Z", ["Fasteners"])

    bootstrap(upgrade=False, seed=True)

    assert _rules() == []
    assert _aisles() == {"Z": ["Fasteners"]}


def test_fr47_seed_false_seeds_nothing(empty_tables: str) -> None:
    bootstrap(upgrade=True, seed=False)

    assert _rules() == []
    assert _aisles() == {}


@pytest.mark.parametrize(
    ("body", "names"),
    [
        (
            '[[rules]]\nkeyword = "oil"\ncategory = "Fluids"\n'
            '[[rules]]\nkeyword = " OIL "\ncategory = "Engine"\n[aisles]\n',
            "rules[1]",
        ),
        ('[[rules]]\nkeyword = "oil"\ncategory = " "\n[aisles]\n', "rules[0]"),
        (
            '[[rules]]\nkeyword = "oil"\ncategory = "Fluids"\n'
            '[aisles]\nA = ["Fluids", "fluids "]\n',
            "aisles.'A'",
        ),
        ('[[rules]]\nkeyword = "oil"\ncategory = "Fluids"\n[aisles]\nA = [""]\n', "aisles.'A'"),
    ],
    ids=["duplicate-keyword", "empty-category", "duplicate-aisle-category", "empty-aisle-category"],
)
def test_fr47_invalid_file_raises_and_writes_nothing(
    empty_tables: str, tmp_path: Path, body: str, names: str
) -> None:
    path = _write(tmp_path, body)

    with pytest.raises(ValueError, match=names.replace("[", r"\[").replace("]", r"\]")):
        categories.seed_starter_categories(now=T0, path=path)

    assert _rules() == []
    assert _aisles() == {}


def test_fr47_busy_lock_skips_without_crashing(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def locked(*_args: object, **_kwargs: object) -> bool:
        raise OperationalError("LOCK", {}, Exception("database is locked"))

    monkeypatch.setattr(category_seed, "_seed_if_empty", locked)

    assert categories.seed_starter_categories(now=T0, sleep=lambda _s: None) is False
    assert _rules() == []
    assert _aisles() == {}


def test_fr47_seed_skips_toml_when_tables_not_empty(empty_tables: str, tmp_path: Path) -> None:
    # The planner's list exists: the (missing) file is never opened, and startup still works.
    categories.create_rule("bolt", "Fasteners", now=T0)
    missing = tmp_path / "missing.toml"

    assert categories.seed_starter_categories(now=T1, path=missing) is False
    bootstrap(upgrade=False, seed=True)

    assert [keyword for _, _, keyword, _, _ in _rules()] == ["bolt"]


def test_fr47_seed_retries_busy_then_logs_cause(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    tries: list[None] = []
    waits: list[float] = []

    def locked(*_args: object, **_kwargs: object) -> bool:
        tries.append(None)
        raise OperationalError("LOCK", {}, Exception("database is locked"))

    monkeypatch.setattr(category_seed, "_seed_if_empty", locked)
    caplog.set_level(logging.INFO, logger="swp.categories")

    assert categories.seed_starter_categories(now=T0, sleep=waits.append) is False

    assert len(tries) == categories.SEED_TRIES == 3
    assert waits == [categories.SEED_RETRY_SECONDS] * 2
    messages = [r.getMessage() for r in caplog.records if r.name == "swp.categories"]
    assert messages == [
        "Starter categories skipped: the database was busy (database is locked). "
        "Run swp db upgrade again to add them; a local start also adds them."
    ]
    assert _rules() == []


def test_fr47_seed_busy_on_empty_check_retries_then_skips(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    # The plain emptiness read meets the busy database itself; `tables_empty` maps it to
    # CategorySeedBusy, so the seed retries and skips instead of crashing.
    class BusySession:
        def __enter__(self) -> "BusySession":
            raise OperationalError("SELECT", {}, Exception("database is locked"))

        def __exit__(self, *_exc: object) -> None:
            return None

    monkeypatch.setattr(category_seed, "transaction", BusySession)
    waits: list[float] = []
    caplog.set_level(logging.INFO, logger="swp.categories")

    assert categories.seed_starter_categories(now=T0, sleep=waits.append) is False

    assert waits == [categories.SEED_RETRY_SECONDS] * 2
    messages = [r.getMessage() for r in caplog.records if r.name == "swp.categories"]
    assert messages == [
        "Starter categories skipped: the database was busy (database is locked). "
        "Run swp db upgrade again to add them; a local start also adds them."
    ]


def test_fr47_seed_busy_once_then_succeeds(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    real = category_seed._seed_if_empty
    tries: list[None] = []

    def busy_once(*args: Any, **kwargs: Any) -> bool:
        tries.append(None)
        if len(tries) == 1:
            raise OperationalError("LOCK", {}, Exception("database is locked"))
        return real(*args, **kwargs)

    monkeypatch.setattr(category_seed, "_seed_if_empty", busy_once)

    assert categories.seed_starter_categories(now=T0, sleep=lambda _s: None) is True
    assert len(tries) == 2
    assert _aisles() == _starter_aisles()


def test_fr47_real_lock_held_skips_the_seed(empty_tables: str) -> None:
    """Another writer really holds the lock: SQLite BEGIN IMMEDIATE, Postgres LOCK TABLE."""
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        database = engine.url.database
        assert database is not None
        engine.dispose()

        def short_busy_timeout(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA busy_timeout=50")
            cursor.close()

        event.listen(engine, "connect", short_busy_timeout)
        holder = sqlite3.connect(database, isolation_level=None)
        try:
            holder.execute("BEGIN IMMEDIATE")
            wrote = categories.seed_starter_categories(now=T0, sleep=lambda _s: None)
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)
    else:
        # The seed's write transaction waits `PG_LOCK_TIMEOUT` (3 s), then gets 55P03.
        with engine.connect() as holder:
            holder.begin()
            holder.execute(text("LOCK TABLE aisle_categories IN EXCLUSIVE MODE"))
            try:
                wrote = categories.seed_starter_categories(now=T0, sleep=lambda _s: None)
            finally:
                holder.rollback()

    assert wrote is False
    assert _rules() == []
    assert _aisles() == {}


def test_fr47_concurrent_seeds_write_once(empty_tables: str) -> None:
    barrier = threading.Barrier(4)
    results: list[bool] = []
    errors: list[BaseException] = []

    def seed() -> None:
        try:
            barrier.wait()
            results.append(categories.seed_starter_categories(now=T0))
        except BaseException as error:  # noqa: BLE001 - reported below
            errors.append(error)

    threads = [threading.Thread(target=seed) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert sorted(results) == [False, False, False, True]
    assert len(_rules()) == len(load_starter_categories().rules)
    assert _aisles() == _starter_aisles()


def test_fr47_starter_file_is_the_shipped_settings_file() -> None:
    assert STARTER_CATEGORIES_PATH.name == "starter_categories.toml"
    assert STARTER_CATEGORIES_PATH.parent.name == "settings"
    assert load_starter_categories().rules[0].keyword == "filter"


def test_fr47_starter_rules_cover_every_sample_part() -> None:
    starter = load_starter_categories()
    rules = [KeywordRule(keyword=rule.keyword, category=rule.category) for rule in starter.rules]
    locations, inventory, _ = check_files(_data_files("sample", "xlsx"))

    without = sorted(
        {
            str(row.values["Part Description"])
            for row in inventory.rows
            if category_of(str(row.values["Part Description"]), rules) is None
        }
    )
    sample_aisles = {str(row.values["Aisle"]) for row in locations.rows}
    rule_keys = {category_key(rule.category) for rule in rules}
    aisle_keys = {
        category_key(category) for values in starter.aisles.values() for category in values
    }

    assert without == []
    assert sample_aisles == set(starter.aisles)
    assert all(starter.aisles[aisle] for aisle in sample_aisles)
    assert aisle_keys <= rule_keys
    # Each category sits on exactly one aisle, so a part has one aisle meant for it.
    assert sum(len(values) for values in starter.aisles.values()) == len(aisle_keys)
    assert aisle_keys == rule_keys
