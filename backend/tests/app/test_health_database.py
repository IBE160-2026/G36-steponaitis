import os

from fastapi.testclient import TestClient
from sqlalchemy import inspect

from swp.api.app import create_app
from swp.store.db import get_engine


def test_nfr12_health_select_one_on_selected_database(app_database: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    engine = get_engine()
    # CI sets this, so a dropped or empty --database-url fails instead of passing on SQLite.
    expected_dialect = os.environ.get("SWP_EXPECT_DIALECT")
    if expected_dialect:
        assert engine.dialect.name == expected_dialect
    if app_database.startswith("postgresql"):
        assert (engine.dialect.name, engine.dialect.driver) == ("postgresql", "psycopg")
    else:
        assert engine.dialect.name == "sqlite"
    assert "alembic_version" in inspect(engine).get_table_names()
