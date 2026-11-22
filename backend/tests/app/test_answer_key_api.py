"""SM-1/AD-6/FR-36/FR-37: the whole answer-key scenario over `POST /api/plans/{id}/commands`
(SQLite here, Postgres in CI).

The commands are the domain scenario's (`tests.domain.answer_key.scenario`) with their
fixed command ids, so the run's recommendation ids and every event match the domain run.
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from swp.api.app import create_app
from swp.domain.commands import Event
from swp.store.plans import get_plan_inputs
from tests.app.test_apply_command import _command, _state
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.domain.answer_key import answer_key_import, expected, scenario
from tests.domain.test_answer_key import _rule

EVENTS = TypeAdapter(list[Event])


def _answer_key_marked(client: TestClient) -> str:
    """Answer-key plan over HTTP with aisle A marked (version 2); returns the plan id."""
    created = client.post(
        "/api/plans",
        data={"name": "Answer key"},
        files=_multipart(_data_files("answer-key", "csv")),
        headers=SAME_ORIGIN,
    )
    assert created.status_code == 201, created.text
    plan_id = created.json()["id"]
    marked = _command(
        client,
        plan_id,
        {
            "type": "set_best_mark",
            "command_id": str(uuid.uuid4()),
            "base_version": 1,
            "mark": {"kind": "aisle", "aisle": "A"},
        },
    )
    assert marked.status_code == 200, marked.text
    assert marked.json()["version"] == 2
    return plan_id


def test_ad6_answer_key_scenario_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _answer_key_marked(client)
        inputs = get_plan_inputs(uuid.UUID(plan_id))
        assert inputs is not None
        played = scenario(inputs.data, inputs.analysis)
        assert len(played) == 20

        version = 2
        body: dict[str, Any] = {}
        last: Any = None
        for step in played:
            body = {**step.command.model_dump(mode="json", by_alias=True), "base_version": version}
            response = _command(client, plan_id, body)
            number = step.step["step"]
            assert response.status_code == 200, (number, response.text)
            last = response.json()
            assert last["version"] == version + 1, number
            assert EVENTS.validate_python(last["events"]) == step.applied.events, number
            version = last["version"]

        stored = _state(plan_id)
        steps_before = len(stored.steps)
        repeated = _command(client, plan_id, body)
        steps_after = len(_state(plan_id).steps)
        summary_version = client.get(f"/api/plans/{plan_id}").json()["version"]

        after = get_plan_inputs(uuid.UUID(plan_id))
        total = client.get(f"/api/plans/{plan_id}/before-after").json()["total"]
        move_list = client.get(f"/api/plans/{plan_id}/move-list").json()

    assert repeated.status_code == 200, repeated.text
    assert repeated.json() == last
    assert summary_version == version == 22
    assert steps_after == steps_before == len(played[-1].applied.state.steps)
    assert after == inputs
    assert inputs.data == answer_key_import().data  # the import as uploaded (FR-36)
    domain = played[-1].applied.state
    assert stored.steps == domain.steps
    assert stored.best_marks == domain.best_marks
    assert stored.keep_marks == domain.keep_marks
    assert stored.next_move_number == domain.next_move_number
    meta = {"created_at", "created_by"}
    assert [r.model_dump(exclude=meta) for r in stored.runs] == [
        r.model_dump(exclude=meta) for r in domain.runs
    ]
    assert (total["fast_in_best"]["before"], total["fast_in_best"]["after"]) == (1, 5)
    assert (total["pick_groups_together"]["before"], total["pick_groups_together"]["after"]) == (
        1,
        6,
    )
    want = expected()["move_list"]
    assert move_list["version"] == version
    assert move_list["header"]["rounds"] == want["rounds"] == 3
    assert [
        (line["round"], line["part"], line["from_location"], line["to_location"], line["rule"])
        for r in move_list["rounds"]
        for line in r["lines"]
    ] == [
        (e["round"], e["part"], e["from"], e["to"], _rule(e["rule"]))
        for e in want["lines_in_order"]
    ]
