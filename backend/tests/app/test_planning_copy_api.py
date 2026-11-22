"""FR-36/AD-5: stored steps are replayed in the plan views; the stored import never changes."""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select

from swp.api.app import create_app
from swp.domain.planning import append_step, current_location, is_empty, planning_copy
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from swp.store.plans import get_plan_import, plan_for_update
from tests.app.test_parts_api import _sample_plan


def _import_data(plan_id: uuid.UUID) -> object:
    with get_engine().connect() as conn:
        import_id = conn.execute(select(PlanRow.import_id).where(PlanRow.id == plan_id)).scalar()
        return conn.execute(select(ImportRow.data).where(ImportRow.id == import_id)).scalar()


def test_fr36_stored_steps_replay_in_views(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = uuid.UUID(_sample_plan(client))
        stored_import = _import_data(plan_id)

        data = get_plan_import(plan_id)
        assert data is not None
        with plan_for_update(plan_id) as writer:
            assert writer is not None
            plan = writer.plan
            copy = planning_copy(data, plan.state)
            part = next(
                p
                for p in sorted(data.parts)
                if sum(1 for qty in copy.stock_of(p).values() if qty > 0) == 1
            )
            source = current_location(copy, part)
            assert source is not None
            target = next(code for code in sorted(copy.locations) if is_empty(copy, code))
            state = append_step(
                plan.state, part=part, from_location=source, to_location=target, rule="manual"
            )
            assert writer.save_state(
                state, last_edited_by="planner", last_edited_at=datetime.now(UTC)
            )

        detail = client.get(f"/api/plans/{plan_id}/parts/{part}")
        locations = client.get(f"/api/plans/{plan_id}/locations")

    assert detail.status_code == 200, detail.text
    assert detail.json()["version"] == 2
    assert detail.json()["current_location"]["code"] == target
    rows = {row["location"]["code"]: row for row in locations.json()["locations"]}
    assert rows[target]["occupied"] is True
    assert [content["part"] for content in rows[target]["contents"]] == [part]
    assert part not in [content["part"] for content in rows[source]["contents"]]
    assert _import_data(plan_id) == stored_import
