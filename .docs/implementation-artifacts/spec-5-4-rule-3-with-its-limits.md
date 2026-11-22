---
title: 'Story 5.4: Rule 3 with its limits'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'd2d3e8d42e7829cc50d3a02eab651f73c9b4f760'
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

**Problem:** A run (Stories 5.1, 5.3) computes rules 1 and 2 only, so parts used on the same jobs (pick groups) stay split across aisles, and nothing stops rule 3 from undoing rule 2 or itself between rounds (FR-26, FR-27).

**Approach:** Add rule 3 to the `rules` slice and run it after rules 1 and 2 in the same run, on the same shared allocation, with every FR-26 limit; a blocked group or a silently skipped group gives no outcome.

## Boundaries & Constraints

**Always:**
- `swp/domain/rules.py` gets `rule_3(data, copy, analysis, state, earlier_moves, earlier_no_space) -> tuple[list[RuleMove], list[NoSpace]]` (pure, same shape as `rule_2`). For each group in `pick_group_order(analysis.pick_groups)`:
  1. **Silent skip:** either part is already handled in this run (a move or "no space" from rules 1–2, or from an earlier group under rule 3). This covers the AC "its pick groups are skipped silently" for both parts and the "partner already has a recommendation" block (same outcome: nothing).
  2. Mover = the part with fewer picks (`analysis.parts`), on a tie the later in `str` order; partner = the other one. The partner is never moved. A group with a part missing from `listed_parts` gives nothing.
  3. **Block (nothing):** either part has `current_location is None`; the mover is in `state.keep_marks`; the mover's current location is best; the two current aisles are equal (not a rule 3 case); the mover's current aisle equals the current aisle of another partner (another group in `analysis.pick_groups` containing the mover) whose `shared_jobs` ≥ this group's.
  4. **Pool:** empty, non-virtual locations of `copy` whose aisle is the partner's current aisle, in `location_code_order`, minus every `to_location` taken in this run (rules 1–2 and earlier rule 3 moves); for a `slow`/`dead` mover, best locations are excluded. First code → `RuleMove(rule="rule_3", …)`; none → one `NoSpace(mover, "rule_3")`.
- Aisles and locations come from the run's planning copy (`aisle_of`/`current_aisle`, `current_location`), never from this run's recommendations.
- Reuse `_empty_pool` (extend it rather than duplicate the empty/virtual/best filter) and `ordering.pick_group_order`; any new order helper lives in `ordering.py` (AD-14). `rules` keeps importing only the kernel (`analysis.PickGroup` is a kernel type); no import-linter change.
- `run`: rule 1, then rule 2 with rule 1's outcome, then rule 3 with rules 1+2's outcome; recommendations numbered 1.. in rule order then processing order; `no_space` rule 1, rule 2, rule 3 entries.
- Tests name their FR (`test_fr26_*`, `test_fr27_*`). Update tests that filtered out rule 3 or now see rule 3 outcomes; answer-key steps 7–9 become real applies of rule 3 recommendations.
- Retro items: no open item concerns `rules.py`/`ordering.py`/`run`; item 37's shared `tests/domain/conftest.py` fixtures are reused. Name this in the Auto Run Result; leave statuses to the retro.

**Never:** No reasons, `revalidate`, `partner_aisle` cause, stored outdated status, `apply_all`, keep command, recommendations endpoint or UI (5.5–5.7, Epic 7). No change to `replay`, `outdated_cause`, `apply_recommendation`, `manual_move` or any stored shape. No new Playwright spec (no user-visible change). Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, or action-item statuses in `sprint-status.yaml`.

## I/O & Edge-Case Matrix

Answer-key import + analysis, marks `[aisle A]` unless stated.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer key run 1 | empty state | `expected.json` step 1 in full: #1 1100 rule_1, #2–#5 rule_2, #6 8100 B-01-02-01 → C-01-03-01, #7 8500 B-01-02-02 → D-01-03-01, #8 3050 B-01-02-03 → D-01-03-02 rule_3; no_space 1200, 10240, 2400 rule_1 then 6600 rule_3; `RunDone(1, 8, 4)` | No error expected |
| Blocks and skips run 1 | same | 0600 (best), 1008614-00/2300 (no location), 8400 (partner 8500 has a rec) get nothing; 8100–8300 and 2400–5000 skipped; 3050 moves on the picks tie ("30400" < "3050") | No error expected |
| Answer key run 2 | steps 1–12 with 8100/8500/3050 applied from run 1's rule 3 recs, keep `["0500"]` in state | `expected.json` step 13 in full: 1200, 10240, 2400 rule_1, #4 8400 C-01-02-02 → D-01-03-03 rule_3; no_space 6600 rule_3; 8100–8300 blocked by the loop limit | No error expected |
| Slow mover, only best free | 6600 (slow) partner 7000 in aisle A | "no space" rule_3, never an A location | No error expected |
| Medium mover may take best | direct `rule_3` call, marks `[aisle C]`, no earlier outcome | 8100 (medium) → C-01-03-01, a best location | No error expected |
| Kept mover | run 1, keep_marks `["8100"]` | no outcome for 8100 (both its groups blocked); 8500 → D-01-03-01, 3050 → D-01-03-02 | No error expected |
| Partner has "no space" | direct `rule_3` call, earlier `[NoSpace("8200", "rule_1")]` | group 8100–8200 gives nothing; 8100 then moves via 8100–8300 to D-01-03-02 (8500 took D-01-03-01) | No error expected |
| Never virtual | C-01-03-01 made virtual | 8100 → C-01-03-02 | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/rules.py` -- `RuleMove`, `_empty_pool(data, copy, state, *, best)` (extend for "any" + aisle filter or filter its result), `rule_1`, `rule_2` (pattern: `handled`, `taken`, `free` iterator), `run` (add rule 3 call and concatenation). Module docstring lists FRs: add FR-26.
- `backend/swp/domain/ordering.py` -- `pick_group_order` (rule 3 order), `part_order` (most picks first, ties `str`: its last element of a pair is the mover).
- `backend/swp/domain/planning.py` -- read-only: `aisle_of`, `current_aisle`, `current_location`, `is_best`, `is_empty`, `listed_parts`.
- `backend/swp/domain/analysis.py` -- `PickGroup(part_a, part_b, shared_jobs)`, `Analysis.pick_groups` (already AD-14 ordered), `PartAnalysis.movement_class`.
- `backend/swp/domain/recommendations.py` -- read-only: `_marks_fail` already handles `rule_3`; `apply_recommendation` applies rule 3 recs unchanged.
- `data/answer-key/expected.json` -- `steps[0]` (run 1), `steps[6..8]` (apply 8100/8500/3050), `steps[12]` (run 2), `pick_groups_in_order`, `parts`. Empty C/D codes: C-01-03-01..03, D-01-03-01..03.
- `backend/tests/domain/test_rules.py` -- `_run`, `_rule_2`, `_outcome`, `_apply_rec`, `_manual`, `MARKS`; tests that filter `rule in (1, 2)` (`test_fr24_answer_key_round1`, `test_fr25_answer_key_rounds`) and fixed run outcomes (`test_fr23_run_identity_and_metadata`, `test_fr24_no_best_marks_gives_no_space`, others) must follow rule 3.
- `backend/tests/app/test_run_command.py:~88` -- HTTP answer-key run: event 5/3 → 8/4, stored rows add rule_3 entries.
- `backend/tests/domain/conftest.py` -- shared `data`/`analysis` fixtures (retro item 37).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/rules.py` -- add `rule_3` with the limits above; `run` calls it after rule 2 -- FR-26, FR-27.
- `backend/swp/domain/ordering.py` -- only if a new order helper is needed (e.g. mover choice) -- AD-14.
- `backend/tests/domain/test_rules.py` -- drop the rule 1–2 filters and compare runs 1 and 2 to `expected.json` in full (steps 7–9 via `_apply_rec`); add `test_fr26_answer_key_round1_rule_3`, `test_fr26_blocks_and_silent_skips`, `test_fr26_loop_limit_round2`, `test_fr26_slow_mover_never_offered_best`, `test_fr26_medium_mover_may_take_best`, `test_fr26_tie_moves_later_part_number`, `test_fr26_kept_mover_blocked`, `test_fr27_rule_3_skips_groups_of_handled_parts`, `test_fr27_rule_3_never_virtual_and_location_once`; fix other tests whose outcome now includes rule 3.
- `backend/tests/app/test_run_command.py` -- answer-key HTTP run: `run_done{1, 8, 4}` and the stored rule 3 rows.

**Acceptance Criteria:**
- Given an answer-key plan with aisle A marked, when `POST /api/plans/{id}/commands {type:"run"}` is sent, then the event is `run_done{round:1, recommendations:8, no_space:4}` and the stored run equals `expected.json` step 1.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 24 findings — high 0, medium 1, low 11, false 12, maybe-false 0
- findings:
  - `[low]` `[reject]` (edge) a part that was the partner of an earlier rule 3 move can be the mover of a later, weaker group in the same run — real, but FR-26 enumerates its limits and this is not one of them; adding a block (or marking partners handled) changes rule semantics beyond FR-26, which is a requirements decision; the next round re-pairs the parts, so the plan still settles. Named under residual risks.
  - `[low]` `[reject]` (edge) the loop limit reads the other partner's aisle from the run baseline, not this run's planned moves — same root cause as the row above; FR-26 defines the limit on current locations ("is already in the aisle").
  - `[medium]` `[patch]` (blind) no test checks that a slow/dead mover is never offered a best location — confirmed by mutation (`best = None` kept 28/28 green); `test_fr26_slow_mover_never_offered_best` rewritten so 2400 is handled and A-01-01-03 is the only free best location; the mutant now fails.
  - `[low]` `[patch]` (blind) no test with a dead mover — added to the same test via an `analysis.model_copy` with 6600 dead (and medium for contrast).
  - `[low]` `[reject]` (blind) a partner can be moved away in the same run — same root cause and reason as the first edge row.
  - `[low]` `[patch]` (blind) loop-limit `>=` boundary untested — grouped with the verification-gap tie row; `test_fr26_loop_limit_tie_blocks` added; `>` mutant now fails.
  - `[false]` `[reject]` (blind) several `_blocked` branches have no own test — the verification-gap layer mutated each limit (partner no location, kept, best, same aisle, loop limit, taken, handled) and each fails a test; a `None` mover source cannot reach `_blocked` (type-checked guard); the `listed_parts` guard is unreachable on real data (pick groups are Inventory parts and `classify_parts` covers every Inventory part).
  - `[low]` `[reject]` (blind) `test_fr26_blocks_and_silent_skips` cannot tell why a part got nothing — no cause is stored by design (reasons are Story 5.5); each limit is pinned by its own isolated test.
  - `[false]` `[reject]` (blind) `other != group` compares by value — pick groups come from `count_shared_jobs`, keyed by a unique `(a, b)` pair with `a < b`, so no two groups are equal by value.
  - `[low]` `[reject]` (blind) rule 3 work grows quadratically — pick groups need ≥ 5 shared jobs and are few; the whole suite incl. timing tests passes; indexing adds complexity with no measured harm.
  - `[low]` `[reject]` (blind) bare `"slow"`/`"dead"` strings — the same pattern as `rule_2` and `recommendations._marks_fail`; `movement_class` is a `Literal`; cosmetic.
  - `[low]` `[reject]` (blind) no HTTP check of a second run with rule 3 — the HTTP layer only forwards to `run`; round 2 is pinned in full by `test_fr25_answer_key_rounds`; the round-1 HTTP test covers the wire and storage.
  - `[false]` `[reject]` (intent) R1 implemented — descriptive.
  - `[false]` `[reject]` (intent) R2 settling run not tested — the AC does not ask for it, and reaching the final state needs undo (answer-key steps 15–16, Epic 7).
  - `[false]` `[reject]` (intent) blocked vs skipped is not observable — by design: no cause is stored until Story 5.5.
  - `[false]` `[reject]` (intent) 1008614-00–2300 might stop at the `listed_parts` check — both parts are listed (1008614-00 has an analysis entry and inventory rows with stock 0); it stops at the partner-no-location block.
  - `[false]` `[reject]` (intent) 8400–8500 stopped by the handled skip, not a separate block — the spec merges them on purpose (Design Notes); same outcome.
  - `[false]` `[reject]` (intent) R4: a part with rule 3 "no space" is final for later groups — FR-27: "listed once as 'no space' … later rules skip it"; a part with both an entry and a recommendation would break "at most one outcome".
  - `[false]` `[reject]` (intent) R3: broad loop limit — matches FR-26 as written.
  - `[false]` `[reject]` (intent) no retro item applies — confirmed: no open item concerns `rules.py`/`ordering.py`/`run`.
  - `[false]` `[reject]` (intent) no frontend/view change — excluded by the AC (Story 5.5–5.7).
  - `[low]` `[patch]` (verification-gap) a weaker partner in the mover's aisle could wrongly block a stronger group, untested — `test_fr26_loop_limit_weaker_partner_does_not_block` added; deleting the comparison now fails it.
  - `[low]` `[patch]` (verification-gap) the `>=` tie case is untested — `test_fr26_loop_limit_tie_blocks` added (grouped with the blind boundary row).
  - `[false]` `[reject]` (verification-gap other) the `listed_parts` guard can be removed with no test failing — unreachable on real imports (see above); a defensive guard, not a behaviour.

## Design Notes

- **Skip before block.** FR-27 says a group containing an already-handled part is skipped silently; FR-26's "partner already has a recommendation" block is a subset of that. Neither is stored, so their order only matters for the wording of Story 5.5 reasons, which are not in this story.
- **Partner with "no space".** The AC "a part that has … a 'no space' entry … its pick groups are skipped silently" covers groups where that part is the partner, so the mover gets nothing.

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

**Summary:** A run now computes rule 3 after rules 1 and 2 on the same allocation. Pick groups are taken by most shared jobs (ties by the lower, then the higher part number); the mover is the part with fewer picks (on a tie the later part number); it gets the first free empty, non-virtual location in the partner's aisle in location-code order, never a best one when it is slow or dead, or one "no space" entry under rule 3. Groups with a part this run already handled are skipped silently; groups where either part has no location, the mover is kept or in a best location, both parts share an aisle, or the mover already shares an aisle with another partner with at least as many shared jobs (loop limit) give nothing. The partner never moves. Answer-key run 1 now equals `expected.json` step 1 (8100 → C-01-03-01, 8500 → D-01-03-01, 3050 → D-01-03-02, 6600 "no space"); run 2 after steps 2–12 (steps 7–9 now real rule 3 applies) equals step 13 (8400 → D-01-03-03, 8100–8300 blocked by the loop limit). Retro items: none of the open items concerns `rules.py`, `ordering.py` or `run`; item 37's shared `tests/domain/conftest.py` fixtures are reused; statuses are left to the retro. No user-visible change, so no new Playwright spec.

**Files changed:**
- `backend/swp/domain/rules.py` -- `_empty_pool` takes `best=None` and an `aisle` filter; new `_blocked` and `rule_3`; `run` adds rule 3.
- `backend/tests/domain/test_rules.py` -- full answer-key comparisons for runs 1 and 2; new FR-26/FR-27 rule 3 tests incl. loop-limit tie/weaker-partner and slow/dead/medium best-location cases.
- `backend/tests/app/test_run_command.py` -- HTTP answer-key run expects `run_done{1, 8, 4}` and the stored rule 3 rows.

**Review findings:** 24 findings (high 0, medium 1, low 11, false 12). Patched: 1 medium (slow/dead best filter untested) and 4 low (dead mover, loop-limit `>=` boundary ×2, weaker partner) — all test-only. Deferred: 0. Rejected: 19, each with its reason in the triage log (7 low: same-run partner moving away ×3, no-cause blocks test, quadratic work, bare class strings, no HTTP round 2; 12 false).

**Follow-up review:** not recommended (`false`): one medium and four low entries were patched, all test-only; no high.

**Verification:** `npm run lint:py` all checks passed; `ruff format --check` 123 files formatted; `npm run lint:imports` 5 contracts kept; `npm run gen:api` leaves `schema.ts` unchanged; `npm run typecheck` and `npm run lint` clean; `npm test` pytest 482 passed, Vitest 219 passed (after the patches); `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container 108 passed, 1 skipped; `npm run e2e -- --project=chromium` 49 passed (both before the test-only patches; no production code changed after). Mutation checks: the slow/dead filter, `>=` → `>` and removing the shared-jobs comparison each now fail a test.

**Residual risks:** within one run, a part that was the partner of an earlier rule 3 move can itself be moved by a later, weaker group (FR-26 has no limit for this); the next round re-pairs them. A requirements decision if it should be blocked.
