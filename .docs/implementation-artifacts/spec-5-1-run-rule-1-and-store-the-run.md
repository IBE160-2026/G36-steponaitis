---
title: 'Story 5.1: Run rule 1 and store the run'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'ee1b2777914f6b7c8d2af54049b0f04a76cf94e4'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Best-mark commands accept aisle, level and location codes of any length.
    evidence: |-
      AisleMark.aisle, LevelMark.level/aisle and LocationMark.location in swp/domain/state.py have no max_length; retro item 36 limited only the move inputs. Pre-existing since Epic 3.
    location: >-
      backend/swp/domain/state.py
    severity: low
---

<intent-contract>

## Intent

**Problem:** The planner cannot yet ask the tool for recommendations: there is no `run` command, `state.runs` is an untyped placeholder, and no rule exists (FR-23, FR-24, FR-27). Every later Epic 5 story (apply, rules 2 and 3, reasons, outdated, the page) builds on a stored run.

**Approach:** Type the run in the state kernel, add the `run` command and the `run_done` event, and a new pure slice `domain/rules.py` that computes rule 1 on the planning copy and stores the run (round, id, created at/by, numbered recommendations, "no space" entries), pruning earlier unreferenced recommendations. The command service passes the plan's analysis to `domain.apply`. Also close retro action item 36 (epic 4), because this story changes `apply.py` and `commands.py`.

## Boundaries & Constraints

**Always:**
- Kernel models in `swp/domain/state.py`: `RecommendationRule = Literal["rule_1", "rule_2", "rule_3"]`; `Recommendation {id: str, number: int ≥ 1, rule, part, from_location, to_location, status: Literal["open"] = "open"}` (5.5 widens `status`); `NoSpace {part, rule}` (keyed by run id + part, no number); `Run {id: str, round: int ≥ 1, created_at: AwareDatetime, created_by: str, recommendations: list[Recommendation], no_space: list[NoSpace]}`; `PlanState.runs: list[Run]`. All frozen. `state` stays schema_version 1: no stored v1 document can hold a run (no command made one), and `tests/domain/fixtures/state_v1.json` must still validate.
- `swp/domain/commands.py`: `Run` command `{type: "run", command_id, base_version}` and `RunDone` event `{type: "run_done", round, recommendations: int, no_space: int}` (counts), both added to the closed unions.
- `domain.apply.apply(state, command, ctx, data, analysis)` takes the plan's `Analysis`; every caller passes it. The run never reads `analysis.toml`, a clock or `uuid4`.
- New slice `swp/domain/rules.py` (listed in the `domain-slices` independence contract in `backend/.importlinter`), importing only kernel modules (`planning`, `ordering`, `state`, `commands`, `analysis`, `import_data`):
  - `rule_1(data, copy, analysis, state) -> tuple[list[RuleMove], list[NoSpace]]` (pure; `RuleMove` is a small frozen model `{rule, part, from_location, to_location}` local to the slice) and `run(state, command, ctx, data, analysis) -> Applied`, the command handler.
  - Planning copy = `planning.replay(data, state.steps).copy` (once per run).
  - Candidates: `planning.listed_parts(data, analysis)` with `movement_class == "fast"`, in `ordering.part_order` (most picks, ties `str`); skip a part whose `current_location` is None, a part in `state.keep_marks`, and a part whose current location `is_best`.
  - Pool: codes in `copy.locations` that are best (`planning.is_best` with `state.best_marks`), empty (`planning.is_empty`) and not in `data.virtual_locations`, in location-code order = plain `str` order of the code (new `ordering.location_code_order(codes) -> list[str]`, distinct, AD-14). Each part takes the first code no earlier recommendation of this run took; no code left → one `NoSpace(part, "rule_1")`. A part gets at most one outcome.
  - Round = `planning.current_round(state) + 1`; run id = `str(uuid.uuid5(command.command_id, f"run:{round}"))`; created_at/by = `ctx.now`/`ctx.user`; recommendation `id = f"{run_id}:{n}"`, `number = n`, n = 1.. in order made.
  - Before appending the new run: every earlier run keeps id, round, created_at/by; its `recommendations` keep only those whose id is some `step.recommendation_id`; its `no_space` becomes `[]`.
  - Event `RunDone(round, len(recommendations), len(no_space))`; a run is never a no-op.
- `planning.current_round` reads the typed `run.round`.
- `swp/store/plans.py`: replace `get_plan_import` with `get_plan_inputs(plan_id) -> PlanInputs | None` (frozen dataclass `data: ImportData`, `analysis: Analysis`, both upcast and validated; read before the lock — neither ever changes); `swp/app/commands.py` passes both to `apply`. Update `tests/app/test_planning_copy_api.py`.
- Retro item 36: `check_step_invariants` always asserts `after.next_move_number >= before.next_move_number`, except a reset shape (`after.steps == []` and `after.next_move_number == 1`, AD-5); steps in `after` whose move number is not in `before` are checked (round, increasing, ≥ `before.next_move_number`, below `after.next_move_number`) even when `before.steps` is not a prefix. Add `CODE_MAX_LENGTH = 200` in `swp/domain/values.py` and use it as `max_length` on `ManualMove.part/from/to` and on the preview query params `part`/`from`/`to` in `swp/api/routers/moves.py`.
- Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`. Tests name their FR/NFR.

**Never:** No `apply` of a recommendation, no rules 2/3, reasons, `revalidate`, `run_baseline`, recommendations endpoint or UI (5.2–5.7). No change to `replay` or the FR-34 fold. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, or action-item statuses in `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer key run 1 | answer-key import + analysis, marks `[aisle A]` | recommendations `[#1 1100 C-01-01-01 → A-01-01-03 rule_1]`; no_space `[1200, 10240, 2400]` (rule_1) in that order; round 1 | No error expected |
| Deterministic | same state, two runs with different command ids | same (number, rule, part, from, to) and no_space lists | No error expected |
| Kept part | answer key, `keep_marks=["1100"]` | 1100 absent; 1200 → A-01-01-03; no_space 10240, 2400 | No error expected |
| No best marks | marks `[]` | each fast part outside best (none is best) → no_space rule_1 | No error expected |
| No current location | 1008614-00 (fast, stock 0) | neither recommendation nor no_space | No error expected |
| Second run | state with run 1 and a step referencing `run1:1` | run 2 round 2; run 1 keeps metadata + rec 1, no_space `[]`; a later manual step has round 2 | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py` -- `PlanState.runs` (untyped today, line ~66), `Rule`, `Step.recommendation_id`.
- `backend/swp/domain/commands.py` -- `Command`/`Event` unions, `ManualMove` fields, `CommandContext`.
- `backend/swp/domain/apply.py` -- `apply`, `_dispatch`, `check_step_invariants` (prefix early return lines ~28-32).
- `backend/swp/domain/planning.py` -- `replay`, `current_round` (reads `run.get("round")`), `listed_parts`, `is_best`, `is_empty`, `current_location`, `append_step`.
- `backend/swp/domain/ordering.py` -- `part_order`; add `location_code_order`.
- `backend/swp/domain/values.py` -- add `CODE_MAX_LENGTH`.
- `backend/swp/store/plans.py` -- `get_plan_import` (line ~132) → `get_plan_inputs`; `PlanRow.analysis` column, `upcast("analysis", …)`.
- `backend/swp/app/commands.py` -- `run_command` reads inputs, `_run` calls `apply`.
- `backend/swp/api/routers/moves.py` -- preview query params.
- `backend/.importlinter` -- `domain-slices` list; `backend/tests/rules/test_layer_rules.py` fails until `swp.domain.rules` is listed.
- Tests calling `apply`: `tests/domain/test_mark_commands.py`, `test_manual_move.py`, `test_replay.py:~402`. Answer-key helpers: `tests/domain/answer_key.py`; the analysis is built as in `test_manual_move.py` fixtures (`build_analysis` + `classify_parts` + `find_pick_groups`). App helpers: `tests/app/test_plan_summary.py:_create`, `_data_files("sample", "xlsx")`, `_multipart`; `tests/app/test_commands.py` patterns.
- `data/answer-key/expected.json` -- `steps[0]` (run 1; this story checks its rule 1 part only).
- Retro items: 36 handled here (named, status left to the retro). 29, 30, 31, 37 do not touch code changed here.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/values.py`, `state.py`, `commands.py`, `ordering.py`, `planning.py` -- kernel additions above.
- `backend/swp/domain/rules.py` (new) -- rule 1 and the `run` handler.
- `backend/swp/domain/apply.py` -- `analysis` param, dispatch `Run`, item 36 invariant checks.
- `backend/.importlinter` -- add `swp.domain.rules`.
- `backend/swp/store/plans.py`, `backend/swp/app/commands.py`, `backend/swp/api/routers/moves.py` -- inputs and max lengths.
- `frontend/lib/api/schema.ts` -- regenerate.
- `backend/tests/domain/test_rules.py` (new) -- `test_fr24_answer_key_round1`, `test_fr23_run_is_deterministic`, `test_fr27_kept_part_skipped`, `test_fr27_no_current_location_skipped`, `test_fr24_no_best_marks_gives_no_space`, `test_fr27_each_location_once_and_never_virtual`, `test_fr23_run_identity_and_metadata` (uuid5 id, `<run_id>:<n>`, created at/by, round), `test_fr23_new_run_prunes_unreferenced_and_bumps_round`, `test_ad5_step_after_run_gets_its_round`.
- `backend/tests/domain/test_replay.py` or `test_manual_move.py` -- item 36 tests: rewritten log with a reused move number raises; a decreasing `next_move_number` raises; the reset shape passes. `test_plan_state.py`: v1 fixture validates with typed runs.
- `backend/tests/app/test_run_command.py` (new) -- `test_fr23_run_over_http` (200, `run_done`, version +1, summary `current_round` 1, stored run), `test_fr23_repeated_run_command_returns_stored_result`, `test_nfr8_run_on_sample_within_budget` (sample import, one aisle mark, run < 5 s).
- `backend/tests/app/test_manual_move_api.py` -- 422 for a `part`/`to` over 200 chars on the command and the preview.

**Acceptance Criteria:**
- Given a plan, when `POST /api/plans/{id}/commands {type:"run"}` is sent, then the response is `{version: n+1, events:[{type:"run_done", round:1, recommendations, no_space}]}` and `GET /api/plans/{id}` shows `current_round` 1.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 29 findings — high 0, medium 2, low 18, false 9, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) no HTTP test asserts what a run recommends; a run that lost the stored analysis would return 0/0 and stay green — added `test_fr24_answer_key_round1_over_http` (answer-key CSVs over HTTP, aisle A mark, run: event 1/3 and stored 1100 → A-01-01-03, no space 1200, 10240, 2400) and `recommendations + no_space > 0` in the NFR-8 sample test.
  - `[low]` `[patch]` (verification-gap) the 422 test never sends an over-long `from` on the command — added the `("X", long, "B")` case.
  - `[low]` `[patch]` (edge) an appended step that reuses a move number already in `before.steps` passes `check_step_invariants` — now asserts unique move numbers in `after.steps`; test `test_ad5_item36_appended_step_reusing_a_move_number_raises`.
  - `[low]` `[reject]` (edge) an existing step rewritten in place with the same number is not checked — no command rewrites steps (FR-34 combines in `replay`, undo/reset delete); adding a per-step diff guard is complexity for an unreachable case.
  - `[low]` `[reject]` (edge) the reset-shape exception accepts any command — no reset command exists yet and no command empties the log; narrowing to the reset command belongs to Epic 7 when it lands.
  - `[false]` `[reject]` (edge) stored states with legacy untyped runs fail to load — no command ever wrote a run before this story, so every stored `runs` is `[]`; `state_v1.json` still validates (`test_plan_state.py`).
  - `[false]` `[reject]` (edge) a fast Inventory part missing from `data.parts` is silently skipped — `data.parts` is built from the Inventory file, so every Inventory part is in it (`listed_parts` docstring, AD-4).
  - `[false]` `[reject]` (edge) a fast part's current location may be virtual — Inventory locations are checked against the Locations file at import, and manual moves refuse virtual targets, so no stock sits at a virtual code.
  - `[low]` `[reject]` (edge) a `command_id` resent after leaving the 50-entry window makes a second run — the AD-6 idempotency window is pre-existing design for every command, not caused here.
  - `[low]` `[defer]` (edge) mark codes (aisle/level/location) have no length limit — pre-existing in the mark commands from Epic 3; item 36 named only the move inputs.
  - `[low]` `[patch]` (blind) `test_fr24_answer_key_round1` hard-codes number 1 for every expected rule-1 recommendation — numbers now come from `enumerate(..., start=1)`.
  - `[medium]` `[patch]` (blind) the command class `Run` shares its name with the stored `state.Run`; the OpenAPI component `Run` meant the command and 5.7 will expose the stored run — command class renamed `RunRecommendations` (wire `type` still `run`), `schema.ts` regenerated.
  - `[low]` `[patch]` (blind) only new steps are checked, duplicates pass — same root cause and fix as the edge duplicate-number row.
  - `[low]` `[reject]` (blind) `_is_reset` early return from any command — same reasoning as the edge reset row.
  - `[low]` `[patch]` (blind) item-36 `pytest.raises` without `match=` — each now matches its message.
  - `[low]` `[patch]` (blind) the NFR-8 sample test never checks the run did work — same group as the verification-gap HTTP row.
  - `[false]` `[reject]` (blind) `test_fr23_run_over_http` should check a stale `base_version` is rejected — AD-6 records `base_version` but does not enforce it (FR-41 later adds a warning); the content part is covered by the new answer-key HTTP test.
  - `[low]` `[reject]` (blind) rule-1 edge cases without tests (kept part with no space left, no fast parts) — the keep skip runs before the pool lookup and is pinned by `test_fr27_kept_part_skipped`; the zero-outcome run is covered by the second-run prune test (`RunDone(round=2, recommendations=0, …)`).
  - `[low]` `[reject]` (blind) the stored run shape has no frozen fixture file — no stored shape changed version (see Design Notes); `test_nfr12_runs_are_typed` pins the shape, and 5.5 adds the fixture with its upcaster if it changes the shape.
  - `[low]` `[patch]` (blind) over-long `from` command case missing — same as the verification-gap row.
  - `[low]` `[patch]` (blind) the test analysis is built in four modules (DRY, retro item 37) — `answer_key_analysis()` and `empty_analysis()` added to `tests/domain/answer_key.py` and used by the touched modules.
  - `[low]` `[reject]` (blind) every command now validates the full analysis — one pydantic validation of a few thousand parts per command; the e2e suite and the NFR-8 run test stay well inside budget; making it lazy adds branches for no measured cost.
  - `[low]` `[patch]` (blind) the epic context is unclear about when 0500's keep mark applies — `epic-5-context.md` now says it is set after run 1 (step 6) and run 1 still recommends 0500 under rule 2.
  - `[low]` `[reject]` (blind) `Recommendation` stores no reason data — rule 1/2 reasons (class, picks, threshold) derive from the plan's analysis, which never changes; whether rule 3 stores its partner is Story 5.4/5.5's decision.
  - `[false]` `[reject]` (intent) the answer-key AC is exercised only in the domain — no longer true: `test_fr24_answer_key_round1_over_http` walks the stored analysis path.
  - `[false]` `[reject]` (intent) no read surface for the planner's suggestions — the epic gives the recommendations endpoint and page to Story 5.7; 5.1's ACs are the stored run.
  - `[false]` `[reject]` (intent) shared limits live inside `rule_1` only — only rule 1 exists in this story; the "any rule" limits are met by it and Story 5.3 shares the pool across rules.
  - `[false]` `[reject]` (intent) pruning is tested with a hand-built referencing step — the apply command arrives in 5.2; the domain behaviour is what this story owns.
  - `[false]` `[reject]` (intent) retro item 37's conftest not added — now addressed in part by the shared helpers in `answer_key.py` (the e2e-flakiness half is unrelated code).

## Design Notes

- **`run:<n>` uses the round.** A `run` command makes one run; naming it by its round keeps the id readable and unique per command (AD-1).
- **No state upcaster.** The stored shape of `runs` was `[]` in every v1 document; typing it rejects nothing that exists. 5.5 adds an upcaster only if it changes a stored run.
- **Reset exception in item 36.** AD-5 says reset sets `next_move_number` to 1 with no steps, so the "never decreases" assertion allows exactly that shape.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: every contract kept
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` -- expected: no diff after the committed regeneration
- `npm run typecheck` and `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against a local `postgres:17` container -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass (no user-visible change)

## Auto Run Result

Status: done

**Summary:** The planner can now run the recommendations: a `run` command (`RunRecommendations`, wire type `run`) makes a new round, computes rule 1 on the planning copy (fast-moving parts outside best locations, most picks first, ties in text order, each to the first free empty best location in location-code order, else one "no space" entry; parts with no current location and kept parts are skipped) and stores a typed `Run` in `state.runs` with its uuid5 id, round, created at/by, numbered recommendations (`<run_id>:<n>`) and "no space" entries. Earlier runs keep their metadata and only step-referenced recommendations. The response event is `run_done{round, recommendations, no_space}`. The command service now passes the plan's stored analysis to `domain.apply`. Retro item 36 (epic 4) is handled: `check_step_invariants` checks new and duplicate move numbers even in a rewritten log and forbids a decreasing `next_move_number` except the reset shape, and move inputs/preview params are capped at 200 characters. Item 37 is handled in part (shared answer-key analysis helpers). Item statuses are left to the retro.

**Files changed:**
- `backend/swp/domain/rules.py` -- new slice: `rule_1` and the `run` handler.
- `backend/swp/domain/state.py` -- typed `Recommendation`, `NoSpace`, `Run`; `PlanState.runs: list[Run]`.
- `backend/swp/domain/commands.py` -- `RunRecommendations` command, `RunDone` event, `ManualMove` max lengths.
- `backend/swp/domain/apply.py` -- `analysis` parameter, run dispatch, item 36 invariant checks.
- `backend/swp/domain/ordering.py`, `planning.py`, `values.py` -- `location_code_order`, typed `current_round`, `CODE_MAX_LENGTH`.
- `backend/swp/store/plans.py`, `backend/swp/app/commands.py` -- `get_plan_inputs` (import + analysis) feeding `apply`.
- `backend/swp/api/routers/moves.py` -- preview query max lengths.
- `backend/.importlinter` -- `swp.domain.rules` in `domain-slices`.
- `frontend/lib/api/schema.ts` -- regenerated.
- Tests: new `tests/domain/test_rules.py`, `tests/app/test_run_command.py`; updated `test_replay.py`, `test_manual_move.py`, `test_mark_commands.py`, `test_plan_state.py`, `test_plan_summary.py`, `answer_key.py`, `tests/app/test_manual_move_api.py`, `test_planning_copy_api.py`.
- `.docs/implementation-artifacts/epic-5-context.md` -- compiled epic context (0500 keep timing clarified in review).

**Review findings:** 29 findings (high 0, medium 2, low 18, false 9; 5 of the false were descriptive intent observations). Patched: 11 rows in 8 entries (2 medium: HTTP content test, command class rename; low: duplicate move numbers, `match=`, enumerate, `from` case, shared helpers, epic context). Deferred: 1 (mark codes without a length limit, pre-existing). Rejected: 17, each with its reason in the triage log.

**Follow-up review:** recommended (`true`): two medium entries were patched. The specific unverified risk is the `Run` → `RunRecommendations` rename and the new HTTP answer-key test, which changed the public OpenAPI component name and the test surface after the review layers ran.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `ruff format --check` clean; `npm run typecheck` and `npm run lint` clean; `npm run gen:api` leaves `schema.ts` unchanged; `npm test` pytest 440 passed, Vitest 219 passed; `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container 103 passed, 1 skipped; `npm run e2e -- --project=chromium` 49 passed (all also green before the patches).

**Residual risks:** the reset-shape exception in `check_step_invariants` accepts any command until Epic 7 adds reset and can narrow it; mark codes have no length limit (deferred).
