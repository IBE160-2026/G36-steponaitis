---
title: 'Story 5.3: Rule 2 and rounds'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'b2fc9ca76967597505975d772d124485f2f249e7'
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

**Problem:** A run (Story 5.1) only computes rule 1, so slow-moving and dead-stock parts keep occupying best locations, and the "run baseline" of AD-5 (the planning copy as it was when run *k* was made) has no implementation (FR-25, FR-27, AD-5).

**Approach:** Add rule 2 to the `rules` slice and run it after rule 1 in the same run, sharing one per-run allocation (each empty location once, each part one outcome, later rules skip parts an earlier rule handled). Add `planning.run_baseline` to the kernel and compute the run's planning copy with it.

## Boundaries & Constraints

**Always:**
- `swp/domain/ordering.py`: new `fewest_picks_order(parts: Mapping[str, PartAnalysis]) -> list[str]` — fewest picks first, ties in part-number `str` order (AD-14 home of rule orders).
- `swp/domain/planning.py`: new `run_baseline(data, steps, k) -> Replay` = `replay(data, [s for s in steps if s.round < k])` (AD-5, the one implementation).
- `swp/domain/rules.py`:
  - `rule_2(data, copy, analysis, state, earlier_moves, earlier_no_space) -> tuple[list[RuleMove], list[NoSpace]]` (pure). Candidates: `listed_parts` with `movement_class in {"slow", "dead"}`, in `fewest_picks_order`; skip a part in `state.keep_marks`, a part with `current_location is None`, a part whose current location is **not** best, and a part that appears in `earlier_moves` or `earlier_no_space` (silently: no "no space"). Pool: codes in `copy.locations` that are **not** best, empty and not virtual, in `location_code_order`, minus every `to_location` in `earlier_moves`. Each part takes the first code not taken in this run, else one `NoSpace(part, "rule_2")`.
  - The non-best pool and rule 1's best pool share one helper (parameterised by best/not best); rule 1's behaviour and signature stay as they are.
  - `run` computes the copy once as `run_baseline(data, state.steps, round_).copy` (equal to the replay of all steps, since every step has round < the new round), then rule 1, then rule 2 with rule 1's outcome; recommendations are numbered 1.. in rule order then processing order; `no_space` is rule 1's entries then rule 2's. A best location freed by a rule 2 recommendation is never offered to rule 1 in the same run (the pool comes from the unchanged copy).
- Tests name their FR/AD. Update tests whose run outcome now includes rule 2 (event count 5 recommendations / 3 no space for answer-key run 1).
- Retro items: none of the open items targets `rules.py`, `ordering.py` or `run_baseline`; item 37's shared `tests/domain/conftest.py` fixtures are reused. Name this in the Auto Run Result; leave statuses to the retro.

**Never:** No rule 3, reasons, `revalidate`, stored outdated status, `apply_all`, keep command, recommendations endpoint or UI (5.4–5.7, Epic 7). No change to `replay`, the FR-34 fold, `apply_recommendation`, `outdated_cause` or `manual_move`. No stored-shape change. No new Playwright spec (no user-visible change). Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, or action-item statuses in `sprint-status.yaml`.

## I/O & Edge-Case Matrix

Answer-key import + analysis, marks `[aisle A]` unless stated.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer key run 1 | empty state | recs #1 1100 C-01-01-01 → A-01-01-03 rule_1; #2 4400 A-01-03-02 → B-01-03-03, #3 9000 A-01-01-02 → B-01-04-01, #4 0100 A-01-01-01 → B-01-04-02, #5 0500 A-01-03-01 → B-01-04-03 rule_2; no_space 1200, 10240, 2400 rule_1; `RunDone(1, 5, 3)` | No error expected |
| Freed best not reused | same run | 1200 is "no space" although 4400/9000/0100/0500 would free A locations | No error expected |
| Rounds (answer key steps 1–13) | run 1; apply rec 1100; manual 9300, 9100, 9200 moves; keep_marks `["0500"]` set in the state; 8100/8500/3050 moved to C-01-03-01/D-01-03-01/D-01-03-02 in round 1 (manual moves, since rule 3 is Story 5.4); apply 4400, 9000, 0100; run 2 | run 2 round 2: rule 1 1200 → A-01-01-01, 10240 → A-01-01-02, 2400 → A-01-03-02 (#1–#3); no rule 2 recommendation; 0500 has no outcome; no_space `[]` | No error expected |
| No non-best space | marks aisles A, B, C, D | no rule 1 outcome; no_space rule_2: 4400, 9000, 9300, 0100, 0500, 6600 | No error expected |
| Kept slow part | keep_marks `["4400"]` | 4400 no outcome; 9000 → B-01-03-03, 0100 → B-01-04-01, 0500 → B-01-04-02 | No error expected |
| Earlier rule handled part | `rule_2` called with an earlier move of 9000 into B-01-03-03 | 9000 skipped; B-01-03-03 not offered; 4400 → B-01-04-01 | No error expected |
| Virtual never offered | B-01-03-03 made virtual | 4400 → B-01-04-01, 9000 → B-01-04-02, 0100 → B-01-04-03, 0500 → C-01-03-01 | No error expected |
| Run baseline | steps of rounds 1 and 2 | `run_baseline(data, steps, 2)` == `replay(data, round-1 steps)`; `k=1` == import copy | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/rules.py` -- `RuleMove`, `_best_empty_pool` (generalise), `rule_1`, `_pruned`, `run` (copy via `replay` today, numbering via `enumerate`).
- `backend/swp/domain/ordering.py` -- `part_order` (pattern for `fewest_picks_order`), `location_code_order`.
- `backend/swp/domain/planning.py` -- `replay` (line ~189, returns `Replay`), `current_round`, `listed_parts`, `is_best`, `is_empty`, `current_location`; add `run_baseline` next to `replay`.
- `backend/swp/domain/analysis.py` -- `MovementClass = Literal["fast", "medium", "slow", "dead"]`.
- `backend/swp/domain/recommendations.py` -- read-only: `outdated_cause` already handles rule_2 marks; `apply_recommendation` applies rule_2 recs unchanged.
- `data/answer-key/expected.json` -- `steps[0]` (run 1, filter rules 1–2), `steps[1..11]` (steps 2–12), `steps[12]` (run 2, filter rule 1–2). Empty non-best codes in import: B-01-03-03, B-01-04-01, B-01-04-02, B-01-04-03, C-01-03-01..03, D-01-03-01..03.
- Tests: `backend/tests/domain/test_rules.py` (`_run`, `_outcome`, `CTX`, `MARKS`; `test_fr24_answer_key_round1` and `test_fr23_run_identity_and_metadata` assert rule-1-only outcomes and must be updated); `backend/tests/domain/conftest.py` (`data`, `analysis` fixtures); `backend/tests/domain/test_apply_recommendation.py` (patterns for applying via `apply`); `backend/tests/app/test_run_command.py:~87` (`run_done` counts 1/3 → 5/3, stored run list).
- Retro items: no open item names code changed here (30/31/32/27 are manual-move/before-after; 29 Postgres lock; 37 conftest reused).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `fewest_picks_order`.
- `backend/swp/domain/planning.py` -- add `run_baseline`.
- `backend/swp/domain/rules.py` -- shared pool helper, `rule_2`, `run` uses `run_baseline` and rule 1 + rule 2.
- `backend/tests/domain/test_rules.py` -- update rule-1-only assertions; add `test_fr25_answer_key_round1_rule_2`, `test_fr25_freed_best_not_offered_in_same_run`, `test_fr25_answer_key_rounds`, `test_fr25_no_space_under_rule_2`, `test_fr27_rule_2_kept_part_skipped`, `test_fr27_rule_2_skips_parts_earlier_rules_handled`, `test_fr27_rule_2_never_virtual`, `test_ad5_run_baseline_is_replay_of_earlier_rounds`, `test_ad14_fewest_picks_order`.
- `backend/tests/app/test_run_command.py` -- answer-key HTTP run: event 5/3 and stored rule 2 recommendations.

**Acceptance Criteria:**
- Given an answer-key plan with aisle A marked, when `POST /api/plans/{id}/commands {type:"run"}` is sent, then the event is `run_done{round:1, recommendations:5, no_space:3}` and the stored run lists 1100 (rule_1) then 4400, 9000, 0100, 0500 (rule_2) into B-01-03-03, B-01-04-01, B-01-04-02, B-01-04-03.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 18 findings — high 0, medium 0, low 6, false 12, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `test_ad14_fewest_picks_order` asserts the order against the implementation's own sort key — the mirrored assertion was deleted; the explicit answer-key order and the `"30400" < "3050"` tie case remain.
  - `[false]` `[reject]` (blind) rule 2's class, outside-best and no-location skips are untested — a mutation dropping the outside-best skip fails 10 tests; admitting medium parts would move 0600/7000 out of aisle A and break the answer-key equality; the `None` guard is enforced by the type checker (`is_best` takes `str`).
  - `[false]` `[reject]` (blind) the freed-best test is weak — `NoSpace("1200", "rule_1") in run.no_space` would fail if rule 1's pool saw the locations rule 2 frees; the trivially true last line does not weaken that.
  - `[low]` `[patch]` (blind) the rounds test hard-codes run 2's no_space `[]` — now derived from `expected.json` step 13 filtered to rules 1–2, like the recommendations.
  - `[false]` `[reject]` (blind) helpers hard-code `base_version=1` — AD-6 records but does not enforce `base_version`; every existing domain test does the same.
  - `[false]` `[reject]` (blind) rule helpers bypass `run_baseline` and `run` is not tested to drop round ≥ k steps — at run time no step can have round ≥ the new round (round invariant asserted in `domain.apply`), so the two copies are equal; `run_baseline` itself is pinned for k = 1, 2, 3.
  - `[low]` `[reject]` (blind) the rule interface is asymmetric and will not scale to rule 3 — speculative design for Story 5.4, which can reshape the allocation when it has a third rule; no defect today.
  - `[low]` `[reject]` (blind) `_empty_pool(best=bool)` flag reads poorly — cosmetic; a rename adds churn for no named harm.
  - `[false]` `[reject]` (blind) `run` docstring "rules share one allocation" is inaccurate — rule 1 runs first, so its allocation is the start of the shared one; rule 2 receives it.
  - `[false]` `[reject]` (blind) no HTTP test stores a `rule_2` recommendation — `test_fr24_answer_key_round1_over_http` reads the stored run via `get_plan` and asserts the four `rule_2` rows (SQLite and Postgres).
  - `[false]` `[reject]` (blind) `fewest_picks_order` docstring omits the tie order — it says "ties in part-number (`str`) order".
  - `[false]` `[reject]` (edge) a slow part with stock in several locations is judged only by its current location — FR-25/AC1 define the candidate by "current location is best" and `current_location` is the shared kernel definition (most stock), the same as rule 1.
  - `[false]` `[reject]` (intent) `run_baseline` is used only at run time where it equals the full replay — AC3 pins the function itself; its earlier-round consumers (FR-31 empties) are Story 5.5.
  - `[false]` `[reject]` (intent) answer-key steps 7–9 are made as manual moves and rule 3 outcomes are filtered — rule 3 is Story 5.4; AC4 names only the round 1 moves and run 2's rule 1 outcome.
  - `[false]` `[reject]` (intent) the taken-location subtraction is unobservable inside `run` — descriptive; pinned by calling `rule_2` directly, needed for rule 3.
  - `[false]` `[reject]` (intent) kept, virtual and no-location skips go beyond AC1 — FR-27's shared limits apply to every rule.
  - `[false]` `[reject]` (intent) no retro item handled — no open item names `rules.py`, `ordering.py` or `run_baseline`; item 36's `apply` code is unchanged.
  - `[low]` `[reject]` (verification-gap other) the rule 1 → rule 2 hand-off in `run` is not pinned at run level — rule 1 and rule 2 candidates and pools are disjoint, so no run-level test can observe it without monkeypatching; Story 5.4's rule 3 makes it observable and will pin it.

## Design Notes

- **Shared allocation.** Rule 1 (fast) and rule 2 (slow/dead) candidates are disjoint and their pools (best vs non-best) are disjoint, so the cross-rule skip and taken-location exclusion are not observable on real data between rules 1 and 2; they are implemented now because rule 3 (5.4) draws from both and must see earlier outcomes. `rule_2` takes the earlier outcome explicitly so it stays pure and testable.
- **`run_baseline` in `run`.** At run time no step has round ≥ the new round, so the baseline equals the full replay; using it makes the AD-5 definition the single source 5.5's FR-31 check will reuse.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: every contract kept
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` -- expected: no diff
- `npm run typecheck` and `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against a local `postgres:17` container -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass (no user-visible change)

## Auto Run Result

Status: done

**Summary:** A run now computes rule 2 after rule 1: slow-moving and dead parts whose current location is best, fewest picks first (ties in part-number text order), each get the first free empty non-best, non-virtual location in location-code order, or one "no space" entry under rule 2. Kept parts, parts with no location and parts an earlier rule handled are skipped silently; locations an earlier rule took are not offered. Recommendations are numbered rule 1 then rule 2. A best location rule 2 would free is not offered to rule 1 in the same run (the pool comes from the unchanged copy). `planning.run_baseline(data, steps, k)` (AD-5) replays the steps with round < k, and `run` builds its copy with it. Answer-key run 1 now gives 1100 (rule 1) plus 4400, 9000, 0100, 0500 into aisle B (rule 2); run 2 after steps 2–12 gives 1200 → A-01-01-01, 10240 → A-01-01-02, 2400 → A-01-03-02 with 0500 left alone. Retro items: none of the open items concerns the code changed here; item 37's shared domain fixtures are reused; statuses are left to the retro. No user-visible change, so no new Playwright spec.

**Files changed:**
- `backend/swp/domain/rules.py` -- shared `_empty_pool(best=…)`, new `rule_2`, `run` uses `run_baseline` and rules 1 + 2.
- `backend/swp/domain/planning.py` -- `run_baseline`.
- `backend/swp/domain/ordering.py` -- `fewest_picks_order`.
- `backend/tests/domain/test_rules.py` -- updated run-1 outcomes; new FR-25/FR-27/AD-5/AD-14 tests incl. `test_fr25_answer_key_rounds`.
- `backend/tests/app/test_run_command.py` -- HTTP answer-key run expects 5/3 and the stored rule 2 rows.

**Review findings:** 18 findings (high 0, medium 0, low 6, false 12). Patched: 2 low (mirrored sort assertion removed; run 2 no_space derived from the answer key). Deferred: 0. Rejected: 16, each with its reason in the triage log (4 low: interface shape for rule 3, boolean flag naming, unobservable run-level hand-off; 12 false).

**Follow-up review:** not recommended (`false`): only two low test-only entries were patched.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `ruff format --check` 123 files formatted; `npm run typecheck` and `npm run lint` clean; `npm run gen:api` leaves `schema.ts` unchanged; `npm test` pytest 471 passed, Vitest 219 passed (after the patches); `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container 108 passed, 1 skipped; `npm run e2e -- --project=chromium` 49 passed (both before the test-only patches; no production code changed after).

**Residual risks:** the cross-rule skip and taken-location exclusion are only observable through direct `rule_2` calls until rule 3 (Story 5.4) shares the allocation.
