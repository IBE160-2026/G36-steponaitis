---
title: 'Story 3.2: The command endpoint with best-location mark commands'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: 'e44d6307bc8c4ec35de42cf27d69e4ec9df0a394'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Marks can be stored and read (Story 3.1), but nothing can change a plan: there is no command union, no `domain.apply`, no command service and no `POST /api/plans/{id}/commands`. Every later plan change (Epics 4–15) needs this one idempotent, serialized write path.

**Approach:** Add the closed command and event unions (`set_best_mark`, `remove_best_mark` → `mark_set`, `mark_removed`) to the domain kernel `domain/commands.py`, mark handlers in a new slice `domain/marks.py`, a dispatcher `domain/apply.py`, a store writer that reads and conditionally updates the plan in one locking transaction, the command service `app/commands.py` (idempotency via `recent_commands`, no-ops, up to 3 retries), and the router `api/routers/commands.py`; then regenerate `schema.ts`.

## Boundaries & Constraints

**Always:** Commands name marks by value (the `BestMark` union from `domain/state.py`). The domain stays pure: `apply(state, command, ctx)` returns a new state plus events and never mutates its input; time and user come only from `CommandContext(now, user)` built in `swp.app` (`datetime.now(UTC)`, user `DEFAULT_USER` = `"planner"`). A mark command never appends a mark already in `best_marks` (duplicates collapse only on load, Story 3.1). Saving is `UPDATE plans SET state, version=version+1, last_edited_by, last_edited_at WHERE id=:id AND version=:read_version`, inside a transaction that starts with `BEGIN IMMEDIATE` on SQLite (and reads with `FOR UPDATE` on Postgres). `recent_commands` keeps the last 50 entries `{command_id, base_version, result}` (result = the JSON response `{version, events}`); a repeated `command_id` returns its stored result with no write. A no-op returns `{version: <current>, events: []}`, writes nothing and is not recorded. `base_version` is recorded in the entry but never compared. Errors use the AD-11 envelope; only `swp.api` maps codes to HTTP. Tests name FRs (SM-7).

**Never:** No other command or event types (keep/run/apply/moves/undo/reset belong to later epics). No `recommendations.revalidate` (Epic 5). No client command flow, `lib/commands` or UI (Stories 3.3–3.4), so no new Playwright test. No `schema_version` bump (`recent_commands` keeps its untyped list-of-dicts shape). No new write endpoint besides the command endpoint. GET endpoints never write. No hand edits to `frontend/lib/api/schema.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set new mark | v1, no marks; `set_best_mark` `{kind:"aisle",aisle:"A"}` | 200 `{version:2, events:[{type:"mark_set", mark:{kind:"aisle",aisle:"A"}}]}`; state has the mark; `last_edited_by="planner"`, `last_edited_at` = now | none |
| Remove existing mark | v2, `[aisle A]`; `remove_best_mark` aisle A | 200 `{version:3, events:[{type:"mark_removed", mark:…}]}`; marks empty | none |
| Overlap | `[aisle A, level 1 null]`; remove aisle A | A level-1 location still best via level mark | none |
| Set existing mark (no-op) | `[aisle A]`; set aisle A | 200 `{version:<current>, events:[]}`; version, `last_edited_*`, state unchanged | none |
| Remove missing mark (no-op) | `[]`; remove `{kind:"location",location:"X"}` | 200 no events; nothing written | none |
| Repeated `command_id` | same body sent twice (after it applied) | second response equals first; version bumped once; mark present once | none |
| Stale `base_version` | plan at v3, command with `base_version:1` | applies on current state; `base_version` stored in its `recent_commands` entry | none |
| 51 commands | 51 applied commands | `recent_commands` has the last 50, oldest dropped | none |
| Two at once | two different commands, concurrent | both applied; final version = start + 2 | re-read/re-apply up to 3 times on 0 rows |
| Lost race 4 times | conditional update reports 0 rows on every attempt | no partial write | `internal` (500) |
| Unknown plan | random UUID | 404 `plan_not_found` envelope | — |
| Invalid command | unknown `type`, missing `mark`, bad `kind`, non-UUID `command_id`, non-int `base_version` | 422 `validation_failed` envelope; nothing written | — |
| Cross-site POST | no/foreign `Origin` | 403 `forbidden_origin` (existing guard) | — |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py` -- `AisleMark`/`LevelMark`/`LocationMark` (frozen, hashable), `BestMark` discriminated union, `PlanState.best_marks` (dedupe validator), `recent_commands: list[dict[str, object]]` (untyped; keep it so). Use `state.model_copy(update=...)` for new state.
- `backend/swp/domain/errors.py` -- `DomainError(code, message, details)`.
- `backend/swp/domain/planning.py` -- `planning_copy`, `is_best` (for the overlap test only).
- `backend/swp/store/db.py` -- `transaction()` context manager; `_configure_sqlite_connection` (WAL). Add the write transaction here.
- `backend/swp/store/plans.py` -- `StoredPlan`, `get_plan(plan_id)` builds a `StoredPlan` inside `transaction()` (factor the row→`StoredPlan` build into a helper reused by the writer).
- `backend/swp/store/models.py` -- `PlanRow` columns (`state` JSON, `version`, `last_edited_*`).
- `backend/swp/app/plans.py` -- `require(plan_id)` raises `plan_not_found`; `DEFAULT_USER = "planner"`; `PLAN_NOT_FOUND` message.
- `backend/swp/api/app.py` -- router mounting under `/api`; `OriginGuard` already rejects cross-site POSTs.
- `backend/swp/api/errors.py` -- `STATUS_BY_CODE` (`validation_failed` 422, `plan_not_found` 404, `internal` 500), `error_responses(...)`; request validation errors already become `validation_failed`.
- `backend/swp/api/routers/plans.py` -- router style to copy (`responses=error_responses(...)`, wire models as return types).
- `backend/.importlinter` -- `domain-slices` independence contract: add `swp.domain.marks`.
- `backend/tests/app/conftest.py` -- `empty_tables` fixture (SQLite locally, Postgres 17 in CI via `--database-url`).
- `backend/tests/app/test_plan_summary.py` -- helpers `_create(name, now)`, `_row(plan_id)`; `SAME_ORIGIN` from `tests/app/test_create_plan.py`; `test_fr9_get_never_writes` pattern.
- `frontend/lib/api/schema.ts` -- generated by `npm run gen:api`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/commands.py` (new, kernel) -- `CommandContext(now: AwareDatetime, user: str)` (frozen); `SetBestMark{type: Literal["set_best_mark"], command_id: UUID, base_version: int, mark: BestMark}`, `RemoveBestMark{…"remove_best_mark"…}`; `Command` = discriminated union on `type`; events `MarkSet{type:"mark_set", mark}`, `MarkRemoved{type:"mark_removed", mark}`, `Event` union on `type`; `CommandResult{version: int, events: list[Event]}`; `Applied{state: PlanState, events: list[Event]}` -- AD-6/AD-13 closed unions, the wire models.
- `backend/swp/domain/marks.py` (new slice) -- `set_best_mark(state, command, ctx) -> Applied` (append only if absent, else no events, same state) and `remove_best_mark` (remove if present, else no events) -- FR-21 handlers.
- `backend/swp/domain/apply.py` (new) -- `apply(state, command, ctx) -> Applied` dispatching on the command type to the slice handlers -- the single `domain.apply`.
- `backend/.importlinter` -- add `swp.domain.marks` to `domain-slices`.
- `backend/swp/store/db.py` -- `write_transaction()`: like `transaction()` but on SQLite the first statement is `BEGIN IMMEDIATE` -- AD-6 serialization.
- `backend/swp/store/plans.py` -- `plan_for_update(plan_id)` context manager yielding `None` or a writer with `.plan: StoredPlan` (read with `with_for_update`) and `.save_state(state, *, last_edited_by, last_edited_at) -> bool` running the conditional UPDATE on `version == plan.version` in the same transaction and returning whether 1 row changed.
- `backend/swp/app/commands.py` (new, shared service) -- `run_command(plan_id, command, *, now, user=DEFAULT_USER) -> CommandResult`: up to 4 attempts (1 + 3 retries); per attempt open `plan_for_update`; `None` → `plan_not_found`; `command_id` found in `recent_commands` → return stored result; `apply`; no events → `CommandResult(version=plan.version, events=[])`; else build result with `version+1`, append `{command_id, base_version, result}` and trim to 50, `save_state`; return on success, else retry; after the last failure raise `DomainError("internal", …)`.
- `backend/swp/api/routers/commands.py` (new) + `backend/swp/api/app.py` -- `POST /plans/{plan_id}/commands`, body `Command`, returns `CommandResult` (200), `responses=error_responses(403, 404, 422)`; mount under `/api`.
- `backend/tests/domain/test_mark_commands.py` (new) -- `test_fr21_*` for set/remove/no-op/overlap via `apply`, input state unchanged, `test_fr10_command_union_is_closed` (exactly the two command types and two event types; unknown type rejected by `TypeAdapter(Command)`).
- `backend/tests/app/test_commands.py` (new, runs on SQLite and Postgres) -- service and HTTP: set/remove response and stored state, `test_fr11_last_edited_by_planner`, `test_fr10_repeated_command_id_applies_once`, `test_fr21_noop_mark_does_not_bump_version` (set existing and remove missing), stale `base_version` applies and is recorded, 51 commands keep 50, `test_fr10_concurrent_commands_both_apply` (two threads, versions one apart), lost-race retry (monkeypatch the conditional update to report 0 rows once → applied once; always → `internal`, nothing written), 404/422/403 envelopes, `test_fr9_get_after_command_never_writes`.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.

**Acceptance Criteria:**
- Given a stored plan, when `POST /api/plans/{id}/commands` carries `set_best_mark` for a new mark, then the response is 200 `{version: n+1, events:[mark_set]}`, `GET /api/plans/{id}` shows the higher version and a non-zero `best_locations` for a covered aisle, and the row's `last_edited_by` is `planner`.
- Given `domain/commands.py`, when the story is done, then the command union holds only `set_best_mark` and `remove_best_mark` and the event union only `mark_set` and `mark_removed`.
- Given the OpenAPI output, when `npm run gen:api` runs after the commit, then `schema.ts` has no diff.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 30 findings — high 0, medium 2, low 24, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) 500 `internal` missing from the endpoint's documented responses — added 500 to `error_responses(...)`; regenerated `schema.ts`.
  - `[low]` `[reject]` (blind) command models accept unknown extra fields; `_body(**extra)` unused — the client is generated from the schema and sends no extras; forbidding them changes the public schema for a case nobody meets.
  - `[low]` `[reject]` (blind) `base_version` has no lower bound — it is recorded and never compared (AD-6); a bound guards nothing observable.
  - `[low]` `[patch]` (blind) `apply` has no exhaustive default; a later command type without a handler returns None — added `case _: assert_never(command)`.
  - `[low]` `[reject]` (blind) same `command_id` with a different payload returns the old result — ids are client-generated UUIDs (AD-12); a payload fingerprint adds stored state and a new error path for a case the client never produces.
  - `[low]` `[reject]` (blind) no-ops are not recorded, so a retried no-op after another change applies — the outcome is still the change the client asked for; recording would need a state write without a version bump, which AD-6 forbids for no-ops.
  - `[medium]` `[patch]` (blind) the real conditional UPDATE's 0-row path is never tested — grouped with the verification-gap row; added `test_fr10_conditional_update_on_changed_version_writes_nothing`.
  - `[low]` `[reject]` (blind) SQLite `database is locked` / Postgres lock errors are not retried — the write lock is held for milliseconds and pysqlite waits 5 s by default; retrying driver errors adds branching for a case not met in practice.
  - `[low]` `[patch]` (blind) layer-rule comment claims "no slice may import" `apply`, which nothing enforces — reworded to say it is listed as kernel only so the check accepts it.
  - `[low]` `[patch]` (blind) the router reads the clock, not `swp.app` (spec Always) — `run_command(now=None)` now reads `datetime.now(UTC)`; the router no longer passes `now`.
  - `[low]` `[reject]` (blind) no test for the same `command_id` sent concurrently — the write lock serializes it into the tested repeated-id path; an extra threaded test adds little.
  - `[low]` `[reject]` (blind) exhausted retries are not logged — the 500 already goes through the request log; the path is unreachable under the write lock.
  - `[low]` `[reject]` (blind) the spec's matrix lacks rows for reused ids with other payloads and retried no-ops — the fix edits this build's spec.
  - `[medium]` `[patch]` (verification-gap) `save_state`'s 0-row branch is never exercised (stubs replace it; the lock prevents a real mismatch) — same patch as the blind row: the new test calls the real method with a stale read version and checks nothing was written.
  - `[low]` `[patch]` (verification-gap other) layer-rule comment claims unenforced rule — same patch as the blind row.
  - `[low]` `[patch]` (verification-gap other) 500 not documented in OpenAPI — same patch as the blind row.
  - `[low]` `[reject]` (intent) raw stored `state` JSON is never inspected for duplicates — the no-op tests assert version and `last_edited_*` are unchanged, so no write (and no duplicate) happened; the domain test checks `apply` directly.
  - `[false]` `[reject]` (intent) concurrency is reconciled by the lock rather than the retry loop — AD-6 allows both (`BEGIN IMMEDIATE`, Postgres `FOR UPDATE`) and the retry loop is kept and now tested against a real 0-row update; the AC outcome (both applied, versions one apart) holds.
  - `[low]` `[reject]` (intent) a retried no-op after a state change re-applies — same root and reason as the blind no-op row.
  - `[low]` `[patch]` (intent) clock read in the API layer — same patch as the blind row.
  - `[low]` `[patch]` (edge) `apply` has no default case — same patch as the blind row.
  - `[low]` `[reject]` (edge) same id, different payload — same reason as the blind row.
  - `[false]` `[reject]` (edge) malformed `recent_commands` entry crashes the lookup — only `run_command` writes entries, always with `command_id`, `base_version` and a validated `result`.
  - `[low]` `[reject]` (edge) SQLite lock longer than 5 s fails without retry — same reason as the blind row.
  - `[false]` `[reject]` (edge) a naive `now` raises a pydantic error — no caller passes a naive datetime; the service now reads an aware clock itself.
  - `[low]` `[reject]` (edge) extra fields and empty mark strings accepted — same reason as the blind extra-fields row; Story 3.4 sends the import's own values.
  - `[false]` `[reject]` (edge) a mark naming an aisle/level/location not in the import is stored — Story 3.1 fixes that unknown targets cover nothing and are not an error.
  - `[low]` `[reject]` (edge) the timed overlap barrier can pass vacuously if the second thread is over 0.5 s late — both threads start from a shared barrier; without the lock they overlap within milliseconds (verified by the implementer by removing `BEGIN IMMEDIATE`).
  - `[low]` `[patch]` (edge) layer-rule comment — same patch as the blind row.
  - `[low]` `[patch]` (edge) clock in the router — same patch as the blind row.

## Design Notes

Store writer shape (store owns SQL; app sees only `StoredPlan` and a bool):

```python
@contextmanager
def plan_for_update(plan_id) -> Iterator[PlanWriter | None]:
    with write_transaction() as session:
        row = session.get(PlanRow, plan_id, with_for_update=True)
        yield None if row is None else PlanWriter(session, _stored(session, row))
# save_state: session.execute(update(PlanRow).where(PlanRow.id == id, PlanRow.version == read_version)
#             .values(state=..., version=PlanRow.version + 1, ...)).rowcount == 1
```

`BEGIN IMMEDIATE` with pysqlite: SQLAlchemy's pysqlite `begin` is a no-op and Python's sqlite3 (legacy mode) does not open a transaction before a SELECT, so `session.execute(text("BEGIN IMMEDIATE"))` as the first statement works; if it does not, use the documented SQLAlchemy recipe (connect event sets `isolation_level = None`, begin event emits `BEGIN IMMEDIATE`) scoped to the write transaction. The concurrency test proves it either way.

## Verification

**Commands:**
- `npm run lint:py` and `uv run --directory backend --locked ruff format --check .` -- expected: no errors
- `npm run lint:imports` -- expected: all contracts kept
- `npm run test:py` -- expected: all pass (Postgres runs in CI)
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` (after committing) -- expected: no diff
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: existing tests stay green

## Auto Run Result

Status: done

**Summary:** Plans can now be changed through one command endpoint. `POST /api/plans/{id}/commands` takes `set_best_mark` or `remove_best_mark` with the mark by value and returns `{version, events}` (`mark_set` / `mark_removed`). The service reads the plan in a write transaction (`BEGIN IMMEDIATE` on SQLite, `FOR UPDATE` on Postgres), runs the pure `domain.apply`, and saves with a conditional update on the version read, retrying up to 3 times. A repeated `command_id` returns its stored result (the last 50 are kept with their `base_version`); setting an existing mark or removing a missing one is a no-op that writes nothing. `last_edited_by` is `planner`.

**Files changed:**
- `backend/swp/domain/commands.py` (new, kernel) -- `CommandContext`, closed `Command` and `Event` unions, `CommandResult`, `Applied`.
- `backend/swp/domain/marks.py` (new slice) -- set/remove handlers; never append an existing mark.
- `backend/swp/domain/apply.py` (new) -- the single `apply` dispatcher, exhaustive.
- `backend/swp/store/db.py` -- `write_transaction()` with `BEGIN IMMEDIATE` on SQLite.
- `backend/swp/store/plans.py` -- `_stored` helper, `PlanWriter.save_state` (conditional update), `plan_for_update`.
- `backend/swp/app/commands.py` (new) -- `run_command`: idempotency, no-ops, retries, `recent_commands` trim; reads the clock.
- `backend/swp/api/routers/commands.py` (new), `backend/swp/api/app.py` -- the endpoint, mounted under `/api`.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- `marks` slice; `apply`/`commands` listed as kernel.
- `backend/tests/domain/test_mark_commands.py`, `backend/tests/app/test_commands.py` (new) -- FR-9/10/11/21 tests for every matrix row.
- `frontend/lib/api/schema.ts` -- regenerated.

**Review:** 30 findings (high 0, medium 2, low 24, false 4). Patched 5 entries: 1 medium (real 0-row conditional update test) and 4 low (500 documented, exhaustive `apply`, accurate layer-rule comment, clock read in `swp.app`). Deferred: 0. Rejected: 15 low and 4 false findings, each with its reason in the triage log.

**Follow-up review recommended:** false (patched entries: high 0, medium 1, low 4).

**Verification:**
- `npm run lint:py`, `ruff format --check`: pass.
- `npm run lint:imports`: 5 kept, 0 broken.
- `npm run test:py`: 338 passed (SQLite; Postgres runs in CI).
- `npm run lint`, `npm run typecheck`: pass; `npm run test:web`: 138 passed.
- `npm run gen:api`: reproduces the committed `schema.ts`.
- `npm run e2e -- --project=chromium`: 34 passed.

**Residual risks:**
- No-ops are not recorded in `recent_commands`, so a retried no-op `command_id` is evaluated again against the current state.
- A reused `command_id` with a different payload returns the first result (ids are client UUIDs).
- SQLite lock waits longer than the 5 s driver timeout become a 500 without retry.
- The Postgres run of `tests/app` happens only in CI after push.
