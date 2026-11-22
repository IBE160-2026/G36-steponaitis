---
title: 'Story 7.5: Answer-key scenario through run 3'
type: 'feature'
created: '2026-11-22'
baseline_revision: '50e62bdb0c73f8a7941f13347f65737dc7312bd4'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The answer-key gate stops at step 16. Steps 17-20 (0100's two manual moves, run 3, Apply all), the final current locations, the final before/after and the settled check are skipped, and no test drives the whole scenario through `POST /api/plans/{id}/commands`. Milestone 2 is therefore not proven against the hand-worked answer key (SM-1, FR-29 to FR-37, AD-6, AD-13).

**Approach:** Tests only. A probe on the baseline shows the domain already produces every expected value. Add one shared scenario helper that turns each `expected.json` step into a command with a fixed `command_id` (part phrases mapped to recommendation ids inside the test helpers, AD-13) and plays it through `apply` + `revalidate`. Use it for `test_sm1_answer_key_scenario`, the un-skipped tests, and a new HTTP test that replays the same commands and compares events and versions with the domain run.

## Boundaries & Constraints

**Always:**
- Helper in `backend/tests/domain/answer_key.py`:
  - `step_command(step, state) -> Command` maps an `expected.json` step to a command: `run` → `RunRecommendations`, `apply` → `apply_command(rec.id)` for the latest run's recommendation of `step["part"]`, `manual_move` → `manual_command(...)`, `keep_in_place` → `SetKeep`, `undo` → `undo_command(state.steps[-1].move_number)`, `apply_all` → `ApplyAll`. `command_id` = `uuid.uuid5(SCENARIO_NS, f"step:{n}")`, so recommendation ids (derived from the run's `command_id`) are the same in every replay.
  - `scenario(data, analysis) -> list[ScenarioStep]` plays all 20 steps from `PlanState(best_marks=MARKS)` with `command(...)` (apply then revalidate). `ScenarioStep` holds the step dict, the command, the state before and the `Applied`.
  - `play_steps` is re-implemented on top of `scenario` (same signature; it returns the state after step `through` and that step's events). No other helper duplicates the step mapping (retro epic-5 #46).
- `backend/tests/domain/test_answer_key.py`:
  - `test_sm1_answer_key_scenario` walks every step and asserts:
    - The exact event list per step, compared to expected `Event` objects (retro epic-5 #43): run → `RunDone(round, recommendations, no_space)` with counts from `expected.json`; apply/manual → `MoveMade` with the expected part, from, to, rule, round and move number; step 18 → `MovesCombined(move_number=12, A-01-01-01 → B-01-03-02, round 2, step_move_number=13)`; keep → `KeepSet("0500")`; step 15 → `StepUndone` for move 11 then `RecommendationsOutdated(count=4, cause="undo")`; step 16 → only `StepUndone` for move 10; step 20 → `ApplyAllDone(applied=[1,2,3,4], skipped=[])`.
    - Run steps: `run_outcome(run) == expected_run_outcome(step)` and `run.round == step["round"]`.
    - Stored statuses of the latest run: all `open` after steps 1-14 and 19-20; all `outdated(undo)` after steps 15-18; after step 16, run 1's 0100 recommendation is `outdated(undo)`.
    - Move numbers: 1-11 on steps 2-14 (step 6 takes none), 12 on step 17, 14-17 on step 20; `next_move_number` never decreases across all 20 steps (retro epic-4 #36); `current_round` 1 → 2 → 3 at the run steps and 2 during steps 15-18.
  - Un-skip `steps_15_to_20` params 17-20 (17/18: the move and the combined effective move; 19: run 3 outcome; 20: four round-3 moves 14-17), `test_fr33_answer_key_final_current_locations` (every part in `final_current_locations` equals `replay(...).current_locations`), `test_fr37_answer_key_final_before_after` (per aisle and total: `fast_in_best`, `pick_groups_together` before/after, `moved_in`, `moved_out`, and occupied/empty after from `occupancy_after`) and `test_fr23_answer_key_settled_check` (one more run: no recommendations, only 6600 rule 3 no space).
  - New `test_fr34_answer_key_final_effective_moves`: the multiset of `(part, from, to, rule, round)` of `replay(...).moves` equals `move_list.lines_in_order` (rule "1"/"2"/"3"/"Manual" mapped with `RULES`); 14 moves; 0100 appears once (round 2, A-01-01-01 → B-01-03-02, Manual). The order is not checked (Epic 8).
  - New `test_fr36_answer_key_import_unchanged`: `data` and `analysis` equal deep copies taken before the scenario.
  - `test_fr38_answer_key_move_list` stays skipped with the Story 8.1 reason. Update the module docstring.
- New `backend/tests/app/test_answer_key_api.py` (`tests/app` holds every HTTP command test and the `empty_tables` fixture), on SQLite locally and Postgres in CI:
  - `test_ad6_answer_key_scenario_over_http`: create the answer-key plan and set the aisle A mark over HTTP (version 2), snapshot `get_plan_inputs`, then POST each scenario command (`model_dump(mode="json", by_alias=True)`, `base_version` = current version). Each response is 200, `version` is +1, and `TypeAdapter(list[Event])` of its `events` equals the domain step's events. At the end `get_plan_inputs` equals the snapshot (FR-36) and `GET /before-after` totals give fast in best 1 → 5 and pick groups together 1 → 6 (FR-37).
  - Re-posting step 20's body returns the same JSON with the same version, and the stored state has the same number of steps (AD-6).
- Every test name carries its FR/NFR/SM/AD id (SM-7).

**Never:**
- No production code change: the probe shows the domain already matches. If a test fails, stop and report the mismatch rather than changing the expected values.
- No edits under `data/`, `.docs/planning-artifacts/` or `.logs/`; no session logs; no push. No action-item status changes in `sprint-status.yaml`.
- No part-based command anywhere outside the test helpers (AD-13). No new Playwright test: nothing user-visible changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Combined manual move | step 18 after 17 | one effective move 12, A-01-01-01 → B-01-03-02; raw step 13 | — |
| Undo of a step before a later run | step 16 | run 1's 0100 rec outdated(undo); no second outdated event | — |
| Repeated command_id | step 20 re-posted | stored result, version unchanged, no second apply | — |
| Settled | extra run on final state | `[]` recommendations, `[6600 rule 3]` no space | — |

</intent-contract>

## Code Map

- `backend/tests/domain/answer_key.py` -- `command` (apply + revalidate, :103), `apply_command`/`manual_command`/`undo_command`, `play_steps` (:162), `run_outcome`/`expected_run_outcome`. Add `SCENARIO_NS`, `ScenarioStep`, `step_command`, `scenario`; rebase `play_steps`.
- `backend/tests/domain/test_answer_key.py` -- skips at :235-238 and :262-279; `_step_15`/`_step_16` patterns; `RULES` map; `test_fr23_fr30_answer_key_steps_1_to_14` move-assert pattern.
- `backend/tests/domain/conftest.py` -- module-scoped `data`/`analysis` fixtures.
- `backend/swp/domain/commands.py` -- `ApplyAll`, `SetKeep`, events `RunDone`, `MoveMade`, `MovesCombined`, `StepUndone`, `RecommendationsOutdated`, `ApplyAllDone`, union `Event`. Read-only.
- `backend/swp/domain/rules.py:256` -- run id is `uuid5(command_id, f"run:{round}")`, rec id `"{run_id}:{n}"`: fixed command ids give identical rec ids in domain and API.
- `backend/swp/domain/planning.py` -- `replay(...).moves`, `.current_locations`, `.copy`; `current_round`.
- `backend/swp/domain/before_after.py:94` -- `build_before_after(data, copy, analysis, marks)`; `AisleBeforeAfter.moved_in/moved_out/occupied/empty`.
- `backend/swp/app/commands.py:49-80` -- HTTP path: stored result on repeated `command_id`, `version+1` only with events.
- `backend/tests/app/test_apply_command.py` -- `_command`, `_state`, `_answer_key_after_run` (plan creation + mark pattern; build the new test's setup the same way without the run); `backend/swp/store/plans.py:219` `get_plan_inputs`.
- `backend/tests/app/test_before_after_api.py` -- `GET /before-after` body shape (`body["total"][field]["before"/"after"]`).
- `data/answer-key/expected.json` -- `steps`, `move_list`, `final_current_locations`, `before_after`, `settled_check`. Read-only.

## Tasks & Acceptance

**Execution:**
- `backend/tests/domain/answer_key.py` -- scenario helpers as above -- one mapping from answer-key phrases to commands for domain and HTTP.
- `backend/tests/domain/test_answer_key.py` -- `test_sm1_answer_key_scenario`, un-skipped tests, `test_fr34_*`, `test_fr36_*`, docstring.
- `backend/tests/app/test_answer_key_api.py` (new) -- the HTTP replay and idempotency test.

**Acceptance Criteria:**
- Given `data/answer-key/` and every step of `expected.json`, when `test_sm1_answer_key_scenario` replays them through `apply` + `revalidate`, then after each step the events, recommendations, no-space entries, outdated causes, rounds and move numbers equal the expected values above.
- Given the final state, when `replay` builds the effective moves, then they are exactly the 14 answer-key moves, current locations equal `final_current_locations`, before/after equals `before_after`, and the import and analysis are unchanged.
- Given the same commands posted to `POST /api/plans/{id}/commands` on SQLite, when each returns, then its events equal the domain step's events and `version` bumps by 1; a repeated `command_id` returns the stored result without applying twice.
- Given the final state, when one more run is made, then it has no recommendations and only 6600 (rule 3) as no space.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 26 findings — high 0, medium 0, low 20, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `test_fr23_fr30_answer_key_steps_1_to_14` kept its own step-to-command loop with random ids. It now reads `played[:14]`, so `step_command` is the only mapping. Unused imports removed.
  - `[low]` `[patch]` (blind) `test_fr35_undo_after_later_run` replayed 18 steps again. It now reads `played[17]`.
  - `[low]` `[patch]` (blind) The settled check asserted the fixture and hard-coded `[]`. It now compares `run_outcome` with an outcome built from `settled_check.recommendations` and `no_space`.
  - `[low]` `[reject]` (blind) `_expected_events` hard-codes move numbers, undo previews and `ApplyAllDone([1,2,3,4])`. `expected.json` has no move numbers or structured undo data, and it is read-only, so there is nothing to derive them from; the values are the spec's pinned reading.
  - `[low]` `[patch]` (blind) The HTTP test compared only events, versions and a step count. It now compares the stored `steps`, marks, `next_move_number` and runs (without `created_at`/`created_by`) with the domain final state.
  - `[low]` `[patch]` (blind) Matching recommendation ids between domain and HTTP was only inferred. Grouped with the row above: the runs comparison includes every recommendation id.
  - `[low]` `[reject]` (blind) Idempotency is tested for one repeated command only. `_stored_result` is looked up by `command_id` before any command-specific code runs, and other repeat tests exist per command (`test_ad6_repeated_apply_command_returns_stored_result`, reset, undo).
  - `[low]` `[reject]` (blind) The HTTP test imports private helpers from other test modules and `_answer_key_marked` repeats part of `_answer_key_after_run`. Every `tests/app` command test does the same; moving them into a shared module is the open retro epic-5 #46 refactor, more than a direct correction.
  - `[low]` `[patch]` (blind) `ScenarioStep.before` was unused. `_step_15`/`_step_16` now use it.
  - `[low]` `[patch]` (blind) An unused `key` fixture and a two-step dispatcher dict. Removed and merged into one dict.
  - `[false]` `[reject]` (blind) The total row's `moved_in`/`moved_out` is not checked. `BeforeAfterTotal` has no such fields (`before_after.py:46`); before occupancy is pinned by `test_fr14`.
  - `[low]` `[patch]` (blind) `test_fr36_*` built its own import, so it never proved the shared fixtures stay unmutated. It now asserts the module `data`/`analysis` fixtures equal a fresh import and analysis after `played`.
  - `[low]` `[reject]` (edge) `play_steps` with `through` > 20 returns step 20. Every caller passes a literal within range; a guard adds code for a case no test reaches.
  - `[low]` `[reject]` (edge) `play_steps(through=0)` raises an opaque `IndexError`. Same: no caller passes 0, and it fails loudly.
  - `[false]` `[reject]` (edge) An apply before any run gives a bare `IndexError`. A loud failure on input the scenario never produces is correct behaviour.
  - `[false]` `[reject]` (edge) An undo with no steps gives a bare `IndexError`. Same reason.
  - `[low]` `[patch]` (edge) The server state could drift from the domain state without changing events. Grouped with the HTTP-state row above.
  - `[low]` `[patch]` (edge) The server's start marks were not checked against `MARKS`. Covered by the new `best_marks` equality.
  - `[low]` `[patch]` (edge) Two phrase-to-command mappings. Grouped with the first row.
  - `[low]` `[patch]` (edge) The docstring claimed every step is played by `scenario`. True after the first row's patch.
  - `[low]` `[reject]` (intent) The HTTP test is in `tests/app`, while the story AC and the spine name `tests/api`. Every HTTP command test of Epics 3-7 lives in `tests/app`, which holds the `empty_tables` fixture and is the folder CI runs on Postgres. Moving it would drop Postgres coverage and needs fixture and CI changes.
  - `[low]` `[patch]` (intent) Over HTTP, only events, versions and two totals were checked. Grouped with the HTTP-state row: stored recommendations and statuses now equal the domain run, and the views derive from them.
  - `[low]` `[patch]` (intent) "The import is identical to what was uploaded" compared stored with stored. The HTTP test now also asserts the stored import equals `answer_key_import().data`.
  - `[false]` `[reject]` (intent) Outdated causes and move numbers are not taken from `expected.json`. The file has none in structured form; same as the hard-coded-events row.
  - `[false]` `[reject]` (intent) Retro epic-4 #36 is only asserted in a test. This story changes no production code, so the "in apply" half concerns code it does not change.
  - `[false]` `[reject]` (intent) The settled check's redundant fixture assert. Removed by the settled-check patch; no separate defect.

## Design Notes

**Fixed command ids.** Recommendation ids come from the run command's id, so `uuid5(SCENARIO_NS, "step:n")` makes the domain run and the HTTP run produce the same ids and identical events. The HTTP test can then post the domain's commands verbatim and compare events by value.

**Retro items taken into account:** epic-5 #43 (exact per-step events, including `recommendations_outdated`, through apply + revalidate), epic-4 #36 (`next_move_number` never decreases across the scenario), epic-5 #46 (one step mapping, no duplicated helpers). Others (#39, #40, #44) concern rule/decision code this story does not change.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && uv run --directory backend --locked ruff format --check .` -- expected: pass.
- `npm run test:py` -- expected: pass; only `test_fr38_answer_key_move_list` (Story 8.1) and other pre-existing non-7.5 skips remain skipped.
- `SWP_EXPECT_DIALECT=postgresql uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test` against a local `postgres:17` container (as `ci.yml` does) -- expected: pass.
- `npm run test:web` and `npm run e2e -- --project=chromium` -- expected: still pass (no frontend change).

## Auto Run Result

Status: done

**Summary.** The whole answer-key scenario (steps 1-20, through run 3 and Apply all) is now proven in the domain and over HTTP (SM-1, FR-23 to FR-37, AD-6, AD-13). Tests only: a baseline probe showed the domain already matched every expected value, and no production code changed.
- One helper (`scenario`/`step_command`) maps each `expected.json` step to a command with a fixed `command_id`, so recommendation ids are the same in the domain and the HTTP run.
- `test_sm1_answer_key_scenario` checks the exact events, run outcomes, statuses, rounds and move numbers of every step, and that `next_move_number` never decreases.
- Un-skipped: steps 17-20, final current locations, final before/after and the settled check. New: the 14 effective moves and the unchanged import. `test_fr38_answer_key_move_list` stays skipped for Story 8.1.
- `test_ad6_answer_key_scenario_over_http` posts the same commands, compares events, versions and the stored state with the domain run, and checks a repeated `command_id`.

**Retro items.** Taken into account: epic-5 #43 (exact per-step events through apply + revalidate), epic-4 #36 (never-decreasing `next_move_number` asserted over the scenario), epic-5 #46 (one step mapping). No action-item statuses were changed.

**Files changed**

| File | Change |
|---|---|
| `backend/tests/domain/answer_key.py` | `SCENARIO_NS`, `ScenarioStep`, `step_command`, `scenario`; `play_steps` built on them; optional `command_id` on command helpers. |
| `backend/tests/domain/test_answer_key.py` | `test_sm1_answer_key_scenario`, un-skipped Story 7.5 tests, `test_fr34_*`, `test_fr36_*`; all step tests read one played scenario. |
| `backend/tests/app/test_answer_key_api.py` (new) | The HTTP replay, state comparison and idempotency test. |

**Review findings.** 26 findings: high 0, medium 0, low 20, false 6.
- Patched: 14 low rows (grouped into 7 fixes: one step mapping, fixture reuse, settled check, `.before`, unused params, shared-fixture mutation check, HTTP stored-state and uploaded-import comparison).
- Deferred: none.
- Rejected: 12 rows. Reasons are in the Review Triage Log (hard-coded values with no structured source, single idempotency case, private test helper imports, `play_steps` range guards, loud failures on unreachable input, `tests/app` vs `tests/api`, retro #36 production half, false claims).

**Follow-up review: not recommended (false).** Patched entries were 0 high and 0 medium.

**Verification.** All passed on the final tree:
- `npm run lint:py`, `npm run lint:imports` (5 contracts kept), `ruff format --check`.
- `npm run test:py`: 673 passed, 3 skipped (`test_fr38_answer_key_move_list` and two "Postgres row locks only").
- `tests/app` on a local `postgres:17` with `SWP_EXPECT_DIALECT=postgresql`: 160 passed, 3 skipped ("SQLite write lock only").
- `npm run test:web`: 373 passed. `npm run e2e -- --project=chromium`: 79 passed (run before the test-only review patches; no frontend change).

**Residual risks**
- The move list order is not checked until Story 8.1.
- The expected move numbers, undo previews and outdated windows are the spec's reading; `expected.json` states them only in prose.
- Firefox and Edge e2e were not run.
