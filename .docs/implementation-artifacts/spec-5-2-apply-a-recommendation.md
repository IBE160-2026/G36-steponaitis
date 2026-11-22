---
title: 'Story 5.2: Apply a recommendation'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'a17f06eb1604004af5e4d71611e6ff0a3994f20c'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A run (Story 5.1) stores recommendations, but the planner cannot apply one: there is no `apply` command, so a recommendation never becomes a move in the planning copy (FR-30, AD-6, AD-7).

**Approach:** Add the `apply {recommendation_id}` command in a new pure domain slice `swp/domain/recommendations.py`. It appends one step with the recommendation's part, from, to, rule, its run's round and its id, answers `move_made`, and rejects with `command_rejected` (plan unchanged) a recommendation outside the latest run, already applied, kept in place, or outdated. "Applied" is derived from the step log, never stored.

## Boundaries & Constraints

**Always:**
- `swp/domain/commands.py`: `ApplyRecommendation {type: "apply", command_id, base_version, recommendation_id: str (min_length 1, max_length CODE_MAX_LENGTH)}` in the closed `Command` union. No new event: the response is one `MoveMade` with `rule` = the recommendation's rule and `round` = its run's round.
- New slice `swp/domain/recommendations.py` (add to the `domain-slices` contract in `backend/.importlinter`), importing only kernel modules (`planning`, `state`, `commands`, `errors`, `import_data`, `analysis`):
  - `applied_step(state, recommendation_id) -> Step | None`: the step whose `recommendation_id` equals it (the one place "applied" is derived, AD-7).
  - `outdated_cause(data, analysis, state, run, rec) -> Literal["moved", "filled", "marks"] | None`: AD-7's first true cause, in order: `moved` = a step with `part == rec.part`, `round == run.round` and `recommendation_id != rec.id`; `filled` = `rec.to_location` not empty in `planning.replay(data, state.steps).copy`; `marks` = rule_1: to is not best or from is best; rule_2: from is not best or to is best; rule_3: from is best, or the part's class (analysis) is slow/dead and to is best. `partner_aisle` and storing outdated status are Story 5.4/5.5.
  - `apply_recommendation(state, command, ctx, data, analysis) -> Applied`. Rejections, checked in this order, each `DomainError("command_rejected", <final English sentence>)`:
    1. no run, or `recommendation_id` not among the latest run's (`max round`) recommendations → "This recommendation is not in the latest run.";
    2. `applied_step` is not None → "Recommendation #<n> is already applied.";
    3. stored `status != "open"` or `outdated_cause` is not None → "Recommendation #<n> is outdated." with `details=[{"cause": <cause or stored status>}]`;
    4. `rec.part in state.keep_marks` → "<part> is kept in place."
  - Otherwise `planning.append_step(state, part, from_location, to_location, rule=rec.rule, recommendation_id=rec.id)` and return `MoveMade(move_number, part, from_location, to_location, rule, round)` from that step. The step's round equals `run.round` (assert).
- `swp/domain/apply.py` dispatches `ApplyRecommendation` to the new handler; `check_step_invariants` stays as is.
- The stored `Recommendation.status` stays `"open"` after apply (applied is never stored).
- Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`. Tests name their FR/AD.
- Retro item 28 (epic 4): the HTTP test checks the summary's `empty_best_locations` drops by 1 after the apply into a best location and equals the count of empty best rows in `/locations`. Name item 28 in the Auto Run Result; leave its status to the retro.

**Never:** No `revalidate`, no stored `outdated` status, no reasons, no `apply_all`, no `apply_other_location`, no recommendations endpoint, no UI or new Playwright spec (the Apply button is Story 5.7; the planner cannot apply from the UI yet). No change to `replay`, the FR-34 fold, `manual_move` or the rules. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, or action-item statuses in `sprint-status.yaml`.

## I/O & Edge-Case Matrix

State for every row: answer-key import + analysis, marks `[aisle A]`, run 1 done (rec #1 = 1100 C-01-01-01 → A-01-01-03, rule_1).

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Apply (answer-key step 2) | apply `<run1>:1` | step {move 1, 1100, C-01-01-01 → A-01-01-03, rule_1, round 1, rec id}; event `move_made` rule_1 round 1; stored status still open | No error expected |
| Manual move after (step 3) | then manual 9300 B-01-03-02 → C-01-01-01 | `move_made` rule manual, round 1 | No error expected |
| Unknown id | apply `"nope"` | plan unchanged | command_rejected "not in the latest run" |
| Earlier run | run 2 made, apply a run-1 id | plan unchanged | command_rejected "not in the latest run" |
| Already applied | apply `<run1>:1` twice (new command id) | plan unchanged | command_rejected "already applied" |
| Moved | manual move of 1100 in round 1, then apply | plan unchanged | command_rejected "outdated", cause `moved` |
| Filled | manual move of another part into A-01-01-03, then apply | plan unchanged | command_rejected, cause `filled` |
| Marks | remove the aisle A mark, then apply | plan unchanged | command_rejected, cause `marks` |
| Kept | `keep_marks=["1100"]` set after the run | plan unchanged | command_rejected "kept in place" |

</intent-contract>

## Code Map

- `backend/swp/domain/commands.py` -- `Command` union, `MoveMade`, `RunRecommendations` pattern; `CODE_MAX_LENGTH` from `values.py`.
- `backend/swp/domain/apply.py` -- `_dispatch` match; add the `ApplyRecommendation` case.
- `backend/swp/domain/rules.py` -- reference for a slice handler (`run`); recommendation ids `<run_id>:<n>`.
- `backend/swp/domain/moves.py` -- reference for `append_step` + `MoveMade` construction.
- `backend/swp/domain/planning.py` -- `replay`, `append_step` (round = `current_round`), `is_best`, `is_empty`, `current_round`.
- `backend/swp/domain/state.py` -- `Recommendation` (status `Literal["open"]`), `Run`, `Step.recommendation_id`, `keep_marks`.
- `backend/swp/domain/analysis.py` -- `analysis.parts[part].movement_class` for the rule-3 marks condition.
- `backend/.importlinter` -- `domain-slices` list (`tests/rules/test_layer_rules.py` fails until the slice is listed).
- `backend/swp/app/commands.py` -- unchanged; already passes `data` and `analysis` to `apply`; `DomainError("command_rejected")` maps to 409 in `swp/api`.
- Tests: `tests/domain/test_rules.py` (fixtures `data`, `analysis`, `CTX`, `MARKS`, `_run`); `tests/domain/answer_key.py` (`answer_key_import`, `answer_key_analysis`, `expected()` — `steps[1]` is the apply, `steps[2]` the manual move after it); `tests/app/test_run_command.py` (`test_fr24_answer_key_round1_over_http`: answer-key plan over HTTP, mark, run, `get_plan` for the stored run); `tests/app/test_before_after_api.py` (before/after JSON shape: `total.fast_in_best.{before,after}`); `tests/app/test_plan_summary.py:_row` (version check).
- Retro items: 28 handled here (test only). 30, 31, 32, 27 touch manual-move/before-after code this story does not change; 37's shared helpers are reused.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/commands.py` -- add `ApplyRecommendation` to the union.
- `backend/swp/domain/recommendations.py` (new) -- `applied_step`, `outdated_cause`, `apply_recommendation`.
- `backend/swp/domain/apply.py` -- dispatch.
- `backend/.importlinter` -- add `swp.domain.recommendations`.
- `frontend/lib/api/schema.ts` -- regenerate.
- `backend/tests/domain/test_apply_recommendation.py` (new) -- one test per I/O row: `test_fr30_apply_answer_key_step2`, `test_ad5_manual_move_after_apply_gets_run_round`, `test_ad7_apply_unknown_rejected`, `test_ad7_apply_earlier_run_rejected`, `test_ad7_apply_twice_rejected`, `test_fr29_apply_moved_rejected`, `test_fr29_apply_filled_rejected`, `test_fr29_apply_marks_rejected`, `test_fr32_apply_kept_rejected`, plus `test_ad7_applied_is_derived_not_stored`; rejected cases assert the error code, message and (outdated) cause.
- `backend/tests/app/test_apply_command.py` (new) -- `test_fr30_apply_over_http_views_follow` (answer-key plan over HTTP, mark aisle A, run, apply: 200 `move_made`, version +1; parts and part detail show 1100 at A-01-01-03; `/locations` shows A-01-01-03 holding 1100 and C-01-01-01 empty; before/after `total.fast_in_best.after == before + 1`; summary `empty_best_locations` −1 and equal to the empty best rows of `/locations`), `test_ad7_apply_rejected_over_http_leaves_plan_unchanged` (applied twice and outdated by a manual move: 409 `command_rejected`, version unchanged), `test_ad6_repeated_apply_command_returns_stored_result`, `test_fr33_manual_move_after_run_gets_round_over_http`.

**Acceptance Criteria:**
- Given a plan with an open recommendation of the latest run, when `POST /api/plans/{id}/commands {type:"apply", recommendation_id}` is sent, then the response is `{version: n+1, events:[{type:"move_made", rule:"rule_1", round:1, …}]}` and the parts, locations and before/after views show the part in the suggested location.
- Given a rejected apply, when the plan is re-read, then its version and state are unchanged and the response is 409 `command_rejected`.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass, and `npm run gen:api` leaves `schema.ts` unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 23 findings — high 0, medium 1, low 15, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) "shown as applied" has no client surface — the epic gives `GET /recommendations` and the Applied tab to Story 5.7; 5.2 derives applied (`applied_step`) and never stores it, which is what AD-7 asks here.
  - `[false]` `[reject]` (intent) views refetch only exercised server-side — no UI can apply until 5.7; the refetch path is handed over in Design Notes.
  - `[false]` `[reject]` (intent) the planner cannot apply from the UI — the Apply button is Story 5.7 by the epic's own split.
  - `[false]` `[reject]` (intent) `partner_aisle` missing, only `moved` over HTTP — no rule-3 recommendation can exist until 5.4 (nothing stores a partner); the three causes are tested in the domain and the 409 mapping is generic.
  - `[false]` `[reject]` (intent) kept-in-place rejection goes beyond AC2 — AD-7: open recommendations whose part is kept in place cannot be applied.
  - `[low]` `[patch]` (intent) the HTTP "manual move after a run" test applies first — renamed to `test_fr33_manual_move_after_apply_gets_run_round_over_http`; a manual move straight after a run is pinned by 5.1's `test_ad5_step_after_run_gets_its_round`.
  - `[low]` `[patch]` (intent) retro items 28 (out of best), 31, 37 only partly taken into account — item 37: fixtures `data`/`analysis` moved to new `tests/domain/conftest.py`; item 28 "out of" and item 31 concern manual-move/before-after code this story does not change.
  - `[low]` `[patch]` (blind) `_marks_fail` has no default arm — added `case _: assert_never(rec.rule)`.
  - `[low]` `[patch]` (blind) rule_2/rule_3 mark branches untested — added `test_fr29_outdated_cause_marks_rule_2` and `_rule_3` on hand-built recommendations.
  - `[low]` `[reject]` (blind) `rec.status != "open"` branch unreachable — kept on purpose for 5.5, which widens `status`; it is one comparison, not a guard of undemonstrated state.
  - `[low]` `[patch]` (blind) HTTP outdated rejection compared only metadata — both rejected applies now compare the whole stored `PlanState`.
  - `[false]` `[reject]` (blind) apply skips `check_manual_move`'s stock checks — any step of the part after run k has round k and trips `moved`; steps of other parts cannot remove its stock; targets come from the Locations file and are never virtual.
  - `[low]` `[reject]` (blind) `assert` for the round invariant — the project uses assertions for programming errors (`check_step_invariants`, `moves.py`) and never runs with `-O`.
  - `[low]` `[reject]` (blind) latest-run lookup repeats `current_round` — one line; a new kernel helper adds public surface for no named divergence.
  - `[low]` `[reject]` (blind) "not in the latest run" carries no details — speculative UI need; adds wire surface 5.7 can add if its design asks.
  - `[low]` `[patch]` (blind) HTTP rejection cases missing — added `test_ad7_apply_unknown_or_invalid_id_over_http` (unknown 409, empty and 201-char id 422, plan unchanged); `base_version` is not enforced (AD-6), so no stale-version case.
  - `[low]` `[patch]` (blind) test name does not match — same fix as the intent row above.
  - `[medium]` `[patch]` (verification-gap) no test that an earlier-round move of the part still allows apply — added `test_fr29_apply_after_earlier_round_move_allowed`.
  - `[low]` `[patch]` (verification-gap) rule_1 "from became best" untested — added `test_fr29_apply_marks_from_best_rejected`.
  - `[low]` `[patch]` (verification-gap) cause and rejection order untested — added `test_fr29_apply_cause_order_moved_before_filled` and `test_fr29_apply_outdated_wins_over_kept`.
  - `[false]` `[reject]` (edge) rule_3 part missing from the analysis counts as not slow — rule movers come from `listed_parts`, which only lists parts with an analysis entry.
  - `[low]` `[patch]` (edge) `_marks_fail` falls through — same fix as the blind row.
  - `[low]` `[reject]` (edge) assert stripped by `-O` — same reasoning as the blind row.

## Design Notes

- **Outdated checked at apply time.** Story 5.5's `revalidate` will store `outdated(cause)`; until then nothing stores it, so apply computes AD-7's causes itself. `outdated_cause` is the one implementation 5.5's `revalidate` reuses (and extends with `partner_aisle` and the `filled` details), so the two never disagree.
- **Always `move_made`.** A rule step cannot combine (FR-34): combining needs an earlier step of the same part in the same round, which is exactly the `moved` cause, so such an apply is rejected first.
- **No Playwright spec.** The UI has no Apply control until Story 5.7. Handed over to 5.7 (retro item 26): the Apply button's success toast, the 409 `command_rejected` path (already applied / outdated with its cause) and the views refetch after apply.

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

**Summary:** The planner's tool can now apply a recommendation: the `apply {recommendation_id}` command (`ApplyRecommendation`) appends one step with the recommendation's part, from, to, rule, its run's round and its id, and answers `move_made`. It is rejected with 409 `command_rejected` (plan unchanged) when the recommendation is not in the latest run, already applied, outdated (AD-7 causes `moved`, `filled`, `marks`, computed at apply time by `outdated_cause`, which 5.5's `revalidate` will reuse; the cause is in `details`), or kept in place. "Applied" is derived from the step log (`applied_step`); the stored status stays `open`. The parts, locations, before/after and summary views follow the applied move. Retro item 28 (epic 4) is covered by the HTTP test (summary `empty_best_locations` after a move into a best location matches `/locations`); item 37 in part (shared `tests/domain/conftest.py`). Item statuses are left to the retro. No UI: the Apply button, toast, 409 path and refetch are handed to Story 5.7.

**Files changed:**
- `backend/swp/domain/recommendations.py` -- new slice: `applied_step`, `outdated_cause`, `apply_recommendation`.
- `backend/swp/domain/commands.py` -- `ApplyRecommendation` in the `Command` union.
- `backend/swp/domain/apply.py` -- dispatch.
- `backend/.importlinter` -- `swp.domain.recommendations` in `domain-slices`.
- `frontend/lib/api/schema.ts` -- regenerated.
- Tests: new `tests/domain/test_apply_recommendation.py`, `tests/app/test_apply_command.py`, `tests/domain/conftest.py`; updated `tests/domain/test_rules.py` (fixtures moved), `tests/domain/test_mark_commands.py` (closed union includes `apply`).

**Review findings:** 23 findings (high 0, medium 1, low 15, false 7). Patched: 12 rows (1 medium: earlier-round move test; low: `assert_never`, rule 2/3 and from-best marks tests, cause order, state comparison, HTTP unknown/invalid id, test rename, shared conftest). Deferred: 0. Rejected: 11, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): one medium entry was patched, and it only added a test.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `ruff format --check` clean; `npm run typecheck` and `npm run lint` clean; `npm run gen:api` leaves `schema.ts` unchanged; `npm test` pytest 462 passed, Vitest 219 passed; `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container 108 passed, 1 skipped; `npm run e2e -- --project=chromium` 49 passed (before the patches one run had the known flaky `ad12 retries a command after a proxy 500` fail; the rerun and a 3x repeat passed).

**Residual risks:** outdated status is computed at apply time only until 5.5 stores it; `partner_aisle` waits for rule 3 (5.4/5.5).
