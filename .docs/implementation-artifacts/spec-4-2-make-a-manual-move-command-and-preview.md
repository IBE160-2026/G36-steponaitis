---
title: 'Story 4.2: Make a manual move (command and preview)'
type: 'feature'
created: '2026-11-22'
baseline_revision: '8d894abc34dcdf3ca099dfe7866e6bb8625d76fe'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 4.1 gave the plan a step log and `replay`, but nothing can add a step: there is no `manual_move` command, no way to refuse a bad target, and no read-only preview telling the dialog (Story 4.3) what a move will do (FR-33, FR-34, AD-3, AD-6).

**Approach:** One kernel check in `domain.planning` decides whether a manual move is allowed (with a final English refusal) and what it does (`new | adds_to_stock | combines_with(n) | removes_move(n)`) by replaying the step log with and without the new step. The `manual_move` command handler and `GET /api/plans/{id}/moves/preview` both call it. Virtual locations become known to the domain by storing them in the import (data schema v2). While touching `run_command`, retro item 22 is closed: lock errors map to 503 and only `id/version/state` are read under the write lock.

## Boundaries & Constraints

**Always:**
- Command wire shape `{type:"manual_move", command_id, base_version, part, from, to}` (pydantic fields `from_location`/`to_location` with aliases `from`/`to`, `populate_by_name`). It goes through the existing endpoint and `run_command`; no new write endpoint.
- Accepted move: `append_step(..., rule="manual")` (current round, next move number, number never reused even when the move is removed), so `domain.apply` invariants hold. Exactly one event: `move_made {move_number, part, from_location, to_location, rule, round}` for `new`/`adds_to_stock`; `moves_combined {move_number (kept), part, from_location (first), to_location, round, step_move_number}`; `move_removed {move_number (removed), part, location (returned to), round, step_move_number}`.
- Refusals, checked in this order, raise `DomainError("command_rejected", message)` from the command (409, version and `last_edited_*` unchanged) and return `allowed: false, refusal_message` from the preview:
  1. blank `to` → "Enter a to-location."
  2. `to == from` → "This is the from-location. Choose another."
  3. `to` in `data.virtual_locations` → "{to} is a virtual location, not a shelf."
  4. `to` not in the Locations file → "{to} is not in the Locations file."
  5. part has no stock above zero at `from` (incl. unknown part/from) → "{part} has no stock at {from}."
- Effect precedence: `removes_move(n)` (an effective move present before is gone after) > `combines_with(n)` (the new step number lands in an existing move n) > `adds_to_stock` (part already has stock > 0 at `to`) > `new`.
- Preview response `MovePreview {version, allowed, refusal_message: str|null, effect: <discriminated union on kind: new | adds_to_stock | combines_with{move_number} | removes_move{move_number}> | null, target: "empty"|"occupied"|"none", target_parts: [{part, description, movement_class|null, picks|null, stock, kept_in_place}]}`. `target` is `none` when `to` is not a Locations-file code; `target_parts` are the parts with stock > 0 at `to` in the planning copy, in `ordering.part_order` (parts without an analysis entry last, by part). Effect is `null` when refused. The preview never writes.
- `ImportData` gains `virtual_locations: list[str]` (codes on Issue Part lines that are not in the Locations file, first-seen order, no duplicates); data `schema_version` 2; upcaster v1→v2 adds `virtual_locations: []`; fixture `tests/domain/fixtures/data_v1.json` in the same change.
- Retro 22: `plan_for_update` reads only `id, version, state` (row-locked `select`, not the import or analysis); `run_command` loads the plan's import once *before* the loop through a new store read (imports and a plan's `import_id` never change). A SQLite busy/locked error (or Postgres `55P03`) inside `plan_for_update` becomes store `PlanBusy`; `run_command` maps it to `DomainError("unavailable", "The plan is busy. Try again.")`, and `swp/api/errors.py` maps `unavailable` → 503 (the client already retries 503). Add the `unavailable | 503` row to AD-11 in the architecture spine.
- New domain slices `swp.domain.moves` (handler) and `swp.domain.views.move_preview` are added to the `domain-slices` independence contract; both import only the kernel. Tests name their FR/NFR/AD.

**Never:** No frontend UI, dialog, toast or copy (Story 4.3); no change to views other than the new preview (Story 4.4). No undo/reset. No new dependency. No edits to `data/sample/`, `data/answer-key/`. No retry loop on busy errors inside the server (map only). The frontend change is only the regenerated `frontend/lib/api/schema.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New move, round 0 | answer key, no runs; 9300 B-01-03-02 → an empty location | step `{n=1, rule manual, round 0}`, `next_move_number` 2, event `move_made`; preview `new`, target `empty` | — |
| After 1100 left | runs `[{round:1}]`, rule_1 step 1100 C-01-01-01 → A-01-01-03; 9300 B-01-03-02 → C-01-01-01 | `move_made` round 1, number 2; 9300 current location C-01-01-01 | — |
| Occupied target (swap) | 9100 D-01-02-02 → D-01-02-03, then 9200 D-01-02-03 → D-01-02-02 | both allowed; preview of the first: target `occupied`, `target_parts` = [9200]; after the first, D-01-02-03 holds both; two separate effective moves | — |
| Adds to stock | 1200 A-01-02-01 (2) → B-01-01-02 (8) | preview `adds_to_stock`; B holds 10; event `move_made` | — |
| Leaves other locations | 1200 B-01-01-02 → an empty location | A-01-02-01 still holds 2 | — |
| Combine (0100) | 0100 A-01-01-01 → C-01-03-02 (n), then C-01-03-02 → B-01-03-02 | second preview `combines_with(n)`; event `moves_combined {move_number n, from A-01-01-01, to B-01-03-02}`; one effective manual move | — |
| Move back | p L1 → L2 (n), then L2 → L1 | preview `removes_move(n)`; event `move_removed {move_number n, location L1}`; `next_move_number` still increments | — |
| Refused | to == from; `FLSKRS`; `ZZ-99`; `""`; 1008614-00 from A-01-01-03 (stock 0); unknown part | command 409 `command_rejected` with the exact message, version unchanged; preview 200 `allowed:false`, `effect:null` | as listed |
| Busy DB | SQLite write lock held by another connection | command 503 `unavailable`, version unchanged | client retries |

</intent-contract>

## Code Map

- `backend/swp/domain/commands.py` -- closed `Command`/`Event` unions; add `ManualMove`, `MoveMade`, `MovesCombined`, `MoveRemoved`.
- `backend/swp/domain/apply.py` -- `apply(state, command, ctx)`; becomes `apply(state, command, ctx, data: ImportData)`; dispatch `ManualMove` to `moves.manual_move`. Callers: `app/commands.py:44`, `tests/domain/test_mark_commands.py` (6 calls), `tests/domain/test_replay.py:402`.
- `backend/swp/domain/planning.py` -- `replay`, `EffectiveMove`, `append_step`, `current_round`, `stock_at`, `is_empty`; add the check (`check_manual_move(data, state, part, from_location, to_location)`) returning allowed/message/effect plus the resulting and removed `EffectiveMove`, and the pydantic `MoveEffect` union (wire models already live here, e.g. `LocationRef`).
- `backend/swp/domain/marks.py` -- pattern for a slice handler.
- `backend/swp/domain/views/parts.py` -- pattern for a view builder (`planning_copy`, analysis lookups, `kept_in_place` = part in `state.keep_marks`); `domain/ordering.py:part_order`.
- `backend/swp/domain/import_data.py`, `backend/swp/domain/import_.py:normalize_import` (~line 478; transactions loop, `kind == "issue_part"`, `row.values["Location"]`) -- add `virtual_locations`.
- `backend/swp/domain/state_migrations.py` -- `CURRENT_VERSIONS`, `UPCASTERS["data"]`; `backend/tests/domain/fixtures/state_v1.json` + `tests/domain/test_plan_state.py:78` show the fixture test pattern; `tests/domain/test_import_normalize.py:362-377` asserts data keys and `schema_version == 1` (update).
- `backend/swp/store/plans.py` -- `PlanWriter`, `plan_for_update`, `_stored`; add `LockedPlan(id, version, state)`, `get_plan_import(plan_id) -> ImportData | None`, `PlanBusy`. `store/db.py:write_transaction` issues `BEGIN IMMEDIATE` on SQLite.
- `backend/swp/app/commands.py` -- `run_command`; `app/plans.py:require` for the preview service; `app/parts.py` pattern.
- `backend/swp/api/routers/commands.py` (responses list lacks 409/503), `api/routers/parts.py` (GET pattern), `api/app.py` (router mount), `api/errors.py:STATUS_BY_CODE`.
- `backend/.importlinter` -- `domain-slices` contract.
- Tests that touch `writer.plan`: `tests/app/test_commands.py:253-255` (`dataclasses.replace(writer.plan, version=...)` keeps working), `tests/app/test_planning_copy_api.py:28-31` (uses `writer.plan.imported.data` → read the import via `get_plan`/`get_plan_import`).
- Helpers: `tests/domain/answer_key.py` (`answer_key_import`, `expected`), `tests/app/test_parts_api.py:_sample_plan`, `tests/app/test_plan_summary.py:_create`, `tests/app/test_create_plan.py:SAME_ORIGIN`, `tests/app/conftest.py:empty_tables`.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` AD-11 table (~line 207).
- `frontend/lib/commands/client.ts:30` -- 502/503/504 already transient; `CommandBody` is a distributive omit, so a new union member typechecks.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/import_data.py`, `import_.py`, `state_migrations.py`, `tests/domain/fixtures/data_v1.json` (new) -- `virtual_locations`, data v2 upcaster and fixture.
- `backend/swp/domain/planning.py` -- `MoveEffect` union and `check_manual_move` per Always (two `replay` calls at most).
- `backend/swp/domain/commands.py` -- `ManualMove` command and three events in the unions.
- `backend/swp/domain/moves.py` (new) -- `manual_move(state, command, ctx, data) -> Applied`: refuse via `DomainError`, else `append_step` and the one event from the check.
- `backend/swp/domain/apply.py` -- `data` parameter; dispatch.
- `backend/swp/domain/views/move_preview.py` (new) -- `MovePreview`, `TargetPart`, `build_move_preview(data, analysis, state, version, part, from_location, to_location)`.
- `backend/.importlinter` -- add both new slices.
- `backend/swp/store/plans.py` -- `LockedPlan`, narrowed `plan_for_update`, `get_plan_import`, `PlanBusy` (detect `sqlite_errorcode & 0xff in (5, 6)` or "database is locked"/"database is busy" text, or pg `sqlstate == "55P03"` on `OperationalError.orig`).
- `backend/swp/app/commands.py` -- load import before the loop (`plan_not_found` when None), pass `data` to `apply`, map `PlanBusy`.
- `backend/swp/app/moves.py` (new), `backend/swp/api/routers/moves.py` (new), `api/app.py` -- `GET /plans/{plan_id}/moves/preview` with required query `part`, `from` (alias), `to` (alias); `responses=error_responses(404, 422)`.
- `backend/swp/api/routers/commands.py`, `api/errors.py` -- document 409 and 503; `unavailable` → 503.
- `ARCHITECTURE-SPINE.md` -- AD-11 row `unavailable | 503 | the database is busy; the client retries (AD-12)`.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `backend/tests/domain/test_manual_move.py` (new) -- every matrix row through `apply(...)` and through `build_move_preview` (`test_fr33_*`, `test_fr34_*`, `test_ad3_preview_*`), incl. the three answer-key scenarios and preview/command agreement on each refusal.
- `backend/tests/domain/test_import_normalize.py`, `test_plan_state.py` -- `test_fr5_virtual_locations_stored` (answer key gives `["FLSKRS"]`), `test_nfr12_data_v1_fixture_upcasts` (v1 doc validates with `virtual_locations == []`), updated keys/version.
- `backend/tests/app/test_manual_move_api.py` (new) -- on the sample plan over HTTP: accepted move (200 `{version: 2, events:[move_made]}`, summary `last_edited_by/at` updated, part detail shows the new current location); refused move (409 envelope, exact message, version 1); preview allowed + refused (200), missing param 422, unknown plan 404, preview leaves version and `last_edited_at` unchanged; `test_ad6_busy_database_is_503` (SQLite only, skip otherwise: dispose the engine, add a `connect` listener setting `PRAGMA busy_timeout=50`, hold `BEGIN IMMEDIATE` on a raw `sqlite3` connection to the same file, POST → 503 `unavailable`; release; version unchanged).
- Existing tests updated for the new `apply` signature and `writer.plan` shape.
- `.docs/implementation-artifacts/sprint-status.yaml` -- set `epic-3-retro-item-22-...` to `done`.

**Acceptance Criteria:**
- Given a sample plan, when `manual_move` is POSTed, then the response is `{version, events}` with one move event, the step has rule manual, the current round and the next move number, and `last_edited_by/at` are updated.
- Given any refused move, when it is POSTed, then it answers 409 `command_rejected` with the same sentence the preview returns, and the plan version is unchanged.
- Given the preview endpoint, when it is called any number of times, then the plan's version, state and `last_edited_at` are unchanged.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm test`, `npm run lint`, `npm run typecheck` and `npm run e2e -- --project=chromium` run, then all pass, and `npm run gen:api` leaves no diff after the regenerated `schema.ts` is committed.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 19, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` (edge) busy error at `save_state` or commit is not mapped to 503 — with `BEGIN IMMEDIATE` the writer already holds the SQLite write lock, so the UPDATE and commit do not wait for another writer; reaching it needs a rare checkpoint collision, and mapping it means wrapping the body too.
  - `[low]` `[reject]` (edge) `get_plan_import` busy before the lock gives 500 — in WAL mode (set on every connection, `store/db.py`) readers never wait for a writer; not met in everyday use.
  - `[low]` `[reject]` (edge) Postgres `FOR UPDATE` has no NOWAIT/lock_timeout, so the `55P03` branch never fires — real, but Postgres behaves as before (it waits for the row lock, which is short); the branch is harmless and becomes live if a lock timeout is ever set. Retro item 22 is about SQLite.
  - `[low]` `[reject]` (edge) plans imported as data v1 refuse FLSKRS as "not in the Locations file" — accepted in Design Notes; the move is still refused, only the sentence differs.
  - `[false]` `[reject]` (edge) a non-str Issue Part Location cell is skipped — `Location` is an `identifier` column (`import_.py:50`), always normalized to `str`; `_text` asserts the same for the stored codes.
  - `[low]` `[reject]` (edge) padded or blank `from`/`part` give odd sentences — the dialog (4.3) picks `from` from the part's locations and `to` from an autocomplete over Locations codes; a guard adds branches for input the UI never sends.
  - `[low]` `[reject]` (edge) Postgres deadlock/serialization codes not mapped — one row lock per command and READ COMMITTED: neither occurs.
  - `[low]` `[reject]` (edge, claim) retro 22 marked done while some busy paths still 500 — same paths as the first two rows; the item's two parts (map busy on the lock, narrow the locked read) are done.
  - `[medium]` `[patch]` (verification-gap) precedence combines_with > adds_to_stock was not pinned — added `test_fr34_combine_into_location_holding_part_is_combines_with` (1200 A-01-02-01 → empty → B-01-01-02, which holds 8): preview `CombinesWith(n)`, one `MovesCombined`, B holds 10.
  - `[low]` `[reject]` (verification-gap other) Postgres `55P03` branch dead — same as the third edge row.
  - `[low]` `[reject]` (blind) Postgres busy detection never fires — same as the third edge row.
  - `[false]` `[reject]` (blind) busy test leaves pooled connections with `busy_timeout=50` — `app_database` disposes the engine and clears the caches at teardown (`tests/app/conftest.py`), so no later test reuses those connections.
  - `[low]` `[reject]` (blind) every command loads the import before the lock — it is read outside the lock (the retro's concern was lock scope); GET views read the whole plan per request already, inside the 1 s budget; lazy loading adds a branch per command type.
  - `[low]` `[reject]` (blind) two busy paths unmapped — same as the first two edge rows.
  - `[low]` `[reject]` (blind) `import_id` immutability is not enforced — no code path updates `PlanRow.import_id` (only `insert_plan_with_import` writes it); a guard for a feature that does not exist.
  - `[low]` `[reject]` (blind) blank `part`/`from` sentence — same as the edge padded/blank row.
  - `[low]` `[reject]` (blind) padded `to` handled inconsistently — same as the edge padded/blank row.
  - `[low]` `[reject]` (blind) preview does not echo `part/from/to` — the 4.3 client keys its query by the inputs, so a response is matched to its request without echoing; adding fields now is speculative.
  - `[false]` `[reject]` (blind) `MovesCombined` lacks `rule` and `round` is the step's — FR-34 makes every combined move Manual, and the fold combines only within one round, so the step's round is the move's round.
  - `[low]` `[reject]` (blind) fold edge cases untested through the command (move back after adds_to_stock, later round, combine into rule_1) — the fold is `replay`, covered by `test_replay.py` (other round, held part, latest-by-time); the check only compares two replays.
  - `[false]` `[reject]` (blind) `assert`s and `next()` without default on the command path — the app never runs with `-O`; `holding` always exists when nothing was removed, because the appended step is either a new move or inside the move it combined with.
  - `[low]` `[reject]` (blind) preview documents no 500 and HTTP tests cover only `new` and one refusal — the other GET routes document `(404, 422)` the same way; the other effects are pinned in the domain tests and the schema is generated from the same models.
  - `[false]` `[reject]` (blind) sprint-status still `in-progress`, triage log empty — the orchestrating session moves the story to done after the run; the log is written in this pass.
  - `[low]` `[reject]` (blind) old imports and numeric codes — same as the edge v1 and non-str rows (the latter false).
  - `[low]` `[reject]` (intent) swap and 0100 combine run in round 0, not in the answer key's rounds 1 and 2 — runs, apply and undo do not exist until Epics 5/7; rounds and numbers are checked in the 9300 test and the full scenario is folded in `test_replay.py`.
  - `[false]` `[reject]` (intent) "version unchanged" over HTTP only for one refusal — every refusal raises in `check_manual_move` before `run_command` saves; the HTTP test proves the path, the domain test proves each sentence.
  - `[false]` `[reject]` (intent) `moves_combined`/`move_removed` never go through the endpoint — the endpoint serializes the closed `Event` union generically; the shape is pinned in the domain tests and the generated schema.
  - `[false]` `[reject]` (intent) scope beyond the story text (data v2, AD-11 code, `apply` signature) — each is required by the intent: the virtual refusal needs stored codes, the retro item needs a 503 code, the move needs the import.

## Design Notes

**Virtual locations need stored data.** `TransactionLine` keeps no location, so without a stored list the domain cannot tell `FLSKRS` from a typo. Storing the Issue Part codes outside the Locations file at import time is the smallest faithful fix. Plans imported before this change upcast to `[]`, so their virtual codes get the "not in the Locations file" refusal: still refused, only a different sentence.

**Effect by replay, not by re-implementing FR-34.** `before = replay(data, steps)`, `after = replay(data, steps + [candidate])`; compare `moves` by move number. The fold stays the only FR-34 implementation (AD-5).

**Retro item 22.** The 4.1 note said "read only id/version/state" conflicts with `manual_move` needing the import inside the lock. It does not: the import is immutable and a plan never changes its `import_id`, so reading it before taking the lock is safe and keeps the lock short. Busy errors are mapped, not retried, so a request never waits 5 s several times; the client's AD-12 backoff retries the 503 with the same `command_id`.

## Verification

**Commands:**
- `npm run lint:py`, `npm run lint:imports`, `npm run test:py` -- expected: pass
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://...` against a local `postgres:17` container -- expected: pass (busy test skipped)
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- expected: pass
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after commit
- `npm run e2e -- --project=chromium` -- expected: all existing tests pass (no user-visible change, no new e2e test)

## Auto Run Result

Status: done

**Summary:** The planner's manual move now exists on the server. `manual_move {part, from, to}` goes through the existing command endpoint and adds one Manual step in the current round under the next move number, answering `move_made`, `moves_combined` or `move_removed`. `GET /api/plans/{id}/moves/preview` returns `{version, allowed, refusal_message, effect, target, target_parts}` and writes nothing. One kernel check (`planning.check_manual_move`) gives both the refusals (blank, from-location, virtual, not in the Locations file, no stock) and the effect, by replaying the step log with and without the new step. Virtual locations are now stored in the import (data v2 with an upcaster and fixture). Retro item 22 is closed: the write lock reads only id/version/state, the import is read before the lock, and a SQLite busy/locked error answers 503 `unavailable` (new AD-11 code).

**Files changed:**
- `backend/swp/domain/planning.py` -- `MoveEffect` union, `ManualMoveCheck`, `check_manual_move`; `_next_step` shared with `append_step`.
- `backend/swp/domain/commands.py` -- `ManualMove` command; `MoveMade`, `MovesCombined`, `MoveRemoved` events.
- `backend/swp/domain/moves.py` (new) -- `manual_move` handler.
- `backend/swp/domain/apply.py` -- `data` parameter and dispatch.
- `backend/swp/domain/views/move_preview.py` (new) -- `MovePreview`, `TargetPart`, `build_move_preview`.
- `backend/swp/domain/import_data.py`, `import_.py`, `state_migrations.py` -- `virtual_locations`, data v2 and upcaster.
- `backend/swp/store/plans.py` -- `LockedPlan`, narrowed `plan_for_update`, `get_plan_import`, `PlanBusy`.
- `backend/swp/app/commands.py`, `app/moves.py` (new), `api/routers/moves.py` (new), `api/app.py`, `api/routers/commands.py`, `api/errors.py` -- service, preview route, 409/503 docs, `unavailable` → 503.
- `backend/.importlinter` -- two new slices.
- `frontend/lib/api/schema.ts` -- regenerated.
- Tests: `tests/domain/test_manual_move.py` (new, 23), `tests/app/test_manual_move_api.py` (new, 6), `tests/domain/fixtures/data_v1.json` (new), updates in `test_import_normalize.py`, `test_plan_state.py`, `test_mark_commands.py`, `test_replay.py`, `test_planning_copy_api.py`.
- `ARCHITECTURE-SPINE.md` -- AD-11 `unavailable | 503`; `sprint-status.yaml` -- retro item 22 `done`.

**Review findings:** 28 findings; 1 entry patched (medium: combine-over-adds-to-stock precedence test); 0 deferred; 27 rejected with reasons in the triage log (19 low, 8 false).

**Follow-up review:** not recommended (one medium entry patched, a test only).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept; `npm run test:py` 399 passed; `tests/app` on Postgres 17 (`--database-url`) 92 passed, 1 skipped (SQLite-only busy test); `npm run lint`, `npm run typecheck` clean; `npm run test:web` 183 passed; `npm run gen:api` reproduces the committed `schema.ts`; `npm run e2e -- --project=chromium` 35 passed (one earlier run after the patch exited non-zero without captured output; the next two runs passed 35/35).

**Residual risks:** on Postgres a competing writer waits for the row lock instead of getting 503 (no lock timeout set); busy errors after the lock is taken still answer 500; plans imported before this change refuse FLSKRS with "not in the Locations file"; one unexplained e2e run failure (likely flake).
