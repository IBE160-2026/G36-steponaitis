---
title: 'Story 4.1: Step log, replay and the planning copy'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: '6f8e996dc49e8de88839474ba7ca9a4df091fdb4'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `PlanState.steps` is an untyped list and `planning_copy(data, state)` ignores the state, so no move can ever change the planning copy, and there is no fold that turns moves into effective moves (FR-34) while leaving the import untouched (FR-36).

**Approach:** Type the step (AD-5) in `domain/state.py`, add `domain.planning.replay(import, steps)` as the one fold that builds the planning copy, the effective moves and each part's current location, make `planning_copy` delegate to it, move `current_round` into the kernel, and make `domain.apply` assert the round and move-number invariants on any step a command adds.

## Boundaries & Constraints

**Always:** A step is `Step(move_number ≥ 1, part, from_location, to_location, rule: "rule_1"|"rule_2"|"rule_3"|"manual", round ≥ 0, recommendation_id: str|None = None, swap_id: str|None = None)`, frozen. `replay` is pure, total over its input (it trusts steps; commands validate them in 4.2) and never mutates `ImportData` (pydantic models are mutable: build new `InventoryLine`s). A step moves *all* of the part's stock at `from_location` (the `(part, from)` entry is removed) and adds it to `(part, to_location)` (created if absent). Inventory order: import order, new `(part, location)` entries appended. `planning_copy(data, state)` returns `replay(data, state.steps).copy` — the only place a `PlanningCopy` is built. `current_round(state)` (highest int run `round`, else 0; same rule as today) lives in `domain/planning.py`; `views/summary.py` imports it. `current_round` and replay results are never stored. Tests name their FR/NFR.

**Never:** No new command, event, endpoint, view field or frontend change (Story 4.2+). No change to `app/commands.py`, `store/`, `data/sample/`, `data/answer-key/`. No new dependency (the property test uses stdlib `random` with fixed seeds, in tests only — `domain` bans `random`). No stored `schema_version` bump: steps were never written non-empty (no command produced one), so `state_v1.json` stays valid and no upcaster is needed (record this in Design Notes).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No steps | answer-key import, `[]` | copy equals today's `planning_copy`; `moves == ()`; current locations as `expected.json` parts | — |
| Single move | 9300 B-01-03-02 → C-01-01-01 after 1100 C-01-01-01 → A-01-01-03 | 9300 current C-01-01-01 with stock 5; B-01-03-02 holds no 9300; two effective moves | — |
| Into occupied | 9100 D-01-02-02 → D-01-02-03 (holds 9200), then 9200 D-01-02-03 → D-01-02-02 | both parts swap; two separate moves (different parts) | — |
| Combine | round k: p L1 → L2 (L2 held 0 of p), then p L2 → L3 | one effective move L1 → L3, rule `manual`, move number of the first step, `steps=(n1, n2)` | — |
| Move back | as above but L3 == L1 | the effective move is removed; copy equals before both steps | — |
| No combine: L2 held part | p already had stock at L2 before the first step | two moves | — |
| No combine: other round | second step in round k+1 | two moves | — |
| No combine: other from | second step leaves from a location ≠ L2 | two moves | — |
| Chain | p L1→L2→L3→L4 same round, each target empty of p | one move L1 → L4, `steps=(n1,n2,n3)` | — |
| Round invariant | apply result adds a step whose round ≠ `current_round(after)`, or whose move number < `before.next_move_number`, or `after.next_move_number` ≤ its move number | — | `AssertionError` (programming error, not a `DomainError`) |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py` -- `PlanState.steps: list[dict]` → `list[Step]`; add `Rule` literal and `Step`. `next_move_number: int = 1` already there.
- `backend/swp/domain/state_migrations.py`, `backend/tests/domain/fixtures/state_v1.json`, `backend/tests/domain/test_plan_state.py:73` -- v1 stays current; the fixture test must still pass unchanged.
- `backend/swp/domain/planning.py:55` -- `planning_copy` (ignores state today) and `_index`; `current_location`, `is_empty`, `stock_at`, `aisle_of` already take a `PlanningCopy`. Add `EffectiveMove`, `Replay`, `replay`, `current_round`, `append_step`.
- `backend/swp/domain/views/summary.py:74` -- `current_round(state)`; replace with an import from `planning` (keep `PlanSummary.current_round`).
- `backend/swp/domain/apply.py` -- the single dispatch; wrap the handler result with the step-invariant check.
- Callers of `planning_copy` (unchanged signature): `app/plans.py:137`, `domain/views/{parts,locations,pick_groups,search}.py`.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()`; `expected()["move_list"]["lines_in_order"]`, `["final_current_locations"]` and `["steps"]` hold the hand-worked scenario (README "The scenario").
- `backend/tests/domain/test_planning.py` -- existing facts tests (module fixture `copy`); `backend/tests/domain/test_plan_summary.py:128` -- current-round test.
- `backend/tests/app/test_parts_api.py` (`_sample_plan`), `tests/app/test_plan_summary.py` (`_row`), `swp/store/plans.py` (`plan_for_update`, `PlanWriter.save_state`) -- for the API-level test that writes steps directly.
- Retro item `epic-3-retro-item-22` (SQLite busy → 503, narrower lock read in `run_command`) -- considered; not touched by this story (see Design Notes).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/state.py` -- add `Rule = Literal["rule_1","rule_2","rule_3","manual"]` and frozen `Step` (fields per Always); `steps: list[Step]`.
- `backend/swp/domain/planning.py` -- add frozen pydantic `EffectiveMove` (`move_number, part, from_location, to_location, rule, round, recommendation_id, swap_id, steps: tuple[int, ...]`; a combined move has rule `manual`, the first step's `recommendation_id`, `swap_id=None`); frozen dataclass `Replay(copy, moves, current_locations: Mapping[str, str | None])` for every part in `data.parts` or the inventory; `replay(data, steps)`: fold steps over a `(part, location) → qty` dict, then FR-34: for a step of part p in round r leaving `a`, find p's latest effective move in round r with `to_location == a`; combine only if that move's target held 0 of p right before the step that set it (else append a new move); if the combined target equals its `from_location`, drop the move. `planning_copy` → `replay(data, state.steps).copy`. Move `current_round` here. Add `append_step(state, *, part, from_location, to_location, rule, recommendation_id=None, swap_id=None) -> PlanState` (move number = `next_move_number`, round = `current_round(state)`, increments `next_move_number`) for Story 4.2+.
- `backend/swp/domain/views/summary.py` -- import `current_round` from `planning`.
- `backend/swp/domain/apply.py` -- add `check_step_invariants(before, after)` and call it on every handler result: steps appended beyond `before.steps` (when it is a prefix) must have `round == current_round(after)`, increasing move numbers ≥ `before.next_move_number`, and `after.next_move_number` > the last; raise `AssertionError` otherwise.
- `backend/tests/domain/test_replay.py` (new) -- matrix rows (`test_fr34_combine_only_through_location_without_part`, `test_fr34_move_back_removes_move`, chain, other round/from); `test_fr33_replay_moves_all_stock_and_adds_together`; `test_fr34_answer_key_scenario_effective_moves`: the 15 steps left after the scenario's undos (README "The scenario", rules/rounds from `expected.json`) give exactly the `move_list` lines as a set (0100 combined keeps the first manual move's number) and `final_current_locations`; `test_fr36_import_never_changes`: ≥ 20 seeded random valid sequences (part with stock > 0 at from, to ≠ from in the Locations file, non-decreasing rounds) on the answer-key import — `data.model_dump_json()` unchanged and `classify`/`pick_groups` results equal to the stored analysis; `test_ad5_round_invariant_*` for `check_step_invariants` and `append_step` (round 0 with no run, round 2 after runs 1–2, number never reused).
- `backend/tests/domain/test_plan_state.py` -- `test_nfr12_steps_are_typed` (a v1 doc with a step validates to `Step`; a bad rule is rejected; `state_v1.json` still upcasts to `PlanState.new()`).
- `backend/tests/app/test_planning_copy_api.py` (new) -- `test_fr36_stored_steps_replay_in_views`: create a sample plan, save a state with one manual step for a part with stock through `plan_for_update(...).save_state`, then `GET /api/plans/{id}/parts/{part}` (or parts list) shows the new current location, `GET .../locations` shows the to-location occupied, and the import row's `data` JSON is unchanged.

**Acceptance Criteria:**
- Given any plan, when a view is built, then it uses `planning_copy` = `replay(...).copy`, and with no steps every existing test passes unchanged.
- Given a stored state with steps, when the plan is read through the API, then the views show the replayed locations and the stored import is unchanged.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm test`, `npm run lint`, `npm run typecheck` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `frontend/lib/api/schema.ts` unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 33 findings — high 0, medium 4, low 18, false 11, maybe-false 0
- findings:
  - `[medium]` `[patch]` (intent) the round invariant is only tested by calling `check_step_invariants` directly, never through `apply()` — added `test_ad5_apply_checks_step_invariants` (monkeypatched mark handler adds a round-1 step with no runs; `apply` raises).
  - `[low]` `[reject]` (intent) the FR-36 property test runs on the in-memory import, the stored row is checked for one step only — `replay` reads the stored import through the same `ImportData`; the API test confirms the stored row stays equal; more persisted sequences add runtime, not coverage.
  - `[low]` `[reject]` (intent) only part detail and locations are exercised with stored steps — every view gets its copy from the one `planning_copy`, which the domain tests cover; the per-view checks are Story 4.4's ACs.
  - `[false]` `[reject]` (intent) typing `steps` rejects malformed v1 docs with no version boundary — every stored `steps` is `[]` (no command wrote a step), so no stored document changes validity.
  - `[false]` `[reject]` (intent) retro items 22/26 not taken — the diff does not change `run_command` or the store (item 22's code); item 26 asks the *later* story's spec to list handed-over failure paths.
  - `[false]` `[reject]` (intent) extras beyond the AC (`append_step`, `EffectiveMove.steps`, move-number checks) — planned in the spec and needed by 4.2/7.x; no harm named.
  - `[medium]` `[patch]` (verification-gap) deleting the `check_step_invariants` call in `apply()` keeps every test green — same patch as the first intent row.
  - `[low]` `[patch]` (verification-gap other) `test_fr13_planning_copy_ignores_state_in_this_epic` is misnamed now — renamed to `test_fr13_planning_copy_without_steps_is_the_import`.
  - `[low]` `[reject]` (blind) `check_step_invariants` skips non-prefix results and never checks `next_move_number` is monotonic — reset legitimately sets it back to 1 (AD-5), and no command rewrites and appends; guarding needs new branches for an unreachable case.
  - `[false]` `[reject]` (blind) `== 0` vs `<= 0` for "held none" — the import rejects negative quantities (`import_.py:203`), so the two are equal.
  - `[false]` `[reject]` (blind) `_Stock.move` creates zero lines and merges duplicate import lines — zero moves are rejected by commands (4.2) and the import is merged per `(part, location)` (`import_.py:498`), so duplicates cannot occur.
  - `[low]` `[reject]` (blind) `planning_copy` also folds moves and current locations it discards — linear in steps and parts (≈1.5k parts on the sample), well inside the 1 s budget; laziness adds complexity.
  - `[low]` `[reject]` (blind) `Step` accepts from == to or empty strings — steps are only written by commands, which validate in 4.2; a validator would duplicate that rule.
  - `[low]` `[reject]` (blind) no fixture with a stored step — `test_nfr12_steps_are_typed` pins the field names and rule values inline; a rename breaks it.
  - `[low]` `[reject]` (blind) FR-36 property test compares classify/pick groups against the same data and lacks re-replay checks — the analysis is computed once before the replays (the "stored" analysis); the extra properties are nice-to-have.
  - `[false]` `[reject]` (blind) `totals` covers only `data.parts` — `parts` is built from every inventory row (`import_.py:501`), so the union is `data.parts`.
  - `[low]` `[reject]` (blind) the scenario test hard-codes 0100's locations and compares sets — the locations come from the answer-key README scenario; move-list order is Epic 8's.
  - `[low]` `[patch]` (blind) the invariant violation test picks `before` by a magic value and never runs two appended steps — now parametrized `(before, after)` pairs plus a "number-reused-in-one-command" case.
  - `[low]` `[reject]` (blind) combined-move `recommendation_id` and chain-then-return untested — one-line behaviour; FR-34 removal is covered by `test_fr34_move_back_removes_move`.
  - `[low]` `[reject]` (blind) API test does not cover pick groups/search and hard-codes version 2 — see the intent views row; version 2 is the deterministic result of one save.
  - `[low]` `[reject]` (blind) `_sample_plan` imported from another test module — existing pattern in three files; moving it is unrelated refactoring.
  - `[false]` `[reject]` (blind) stale comment about `recent_commands` — the original comment covered only `runs` and `steps`.
  - `[medium]` `[patch]` (edge) the latest move ending at `a` is chosen by list position, and a combined move keeps its old position — `_Open.set_at` records the step position that last set the target and the fold picks the highest; added `test_fr34_latest_move_is_by_time_not_position`.
  - `[low]` `[reject]` (edge) move-back loses a zero-stock import row of the same part at the target — needs a zero row of that part at the target plus a move back; showing it again needs extra state; rare.
  - `[false]` `[reject]` (edge) a step with no stock at the from-location writes a zero line and phantom move — commands reject it (4.2); not reachable.
  - `[false]` `[reject]` (edge) a step with from == to — commands reject it (4.2); not reachable.
  - `[low]` `[reject]` (edge) rewrite-and-append bypasses the check — same as the blind non-prefix row.
  - `[false]` `[reject]` (edge) a lowered `next_move_number` should raise — reset sets it to 1 by design (AD-5).
  - `[false]` `[reject]` (edge) stored `next_move_number` ≤ 0 or ≤ max step — only commands write the state; not reachable.
  - `[low]` `[reject]` (edge) API test fails with StopIteration on other data — fixed sample data; message clarity only.
  - `[low]` `[reject]` (edge) analysis compared against a recompute — same as the blind FR-36 row.
  - `[medium]` `[patch]` (edge) claim: FR-34 combine through a location whose stock is not only the first step's — same patch as the position row.
  - `[low]` `[reject]` (edge) claim: move-back copy equality fails with zero/duplicate rows — duplicates are impossible; zero-row case as above.

## Design Notes

**No upcaster.** AD-4 requires an upcaster when a stored shape changes. Every stored `steps` is `[]` (no command wrote a step before this story), and `[]` is valid under both shapes, so v1 documents load unchanged; bumping to v2 would add an identity upcaster with no data to transform.

**FR-34 match.** Search p's *latest* move in the round ending at `a`; if that one is not "through a location without the part", do not fall back to an older one. Example: p A→B (B empty of p), p D→B (B now holds p), p B→C → three moves, because B's stock at the third step is not only the first step's.

**Retro item 22.** It concerns `app/commands.py` and `store/plans.py`, which this story does not change; its "read only id/version/state under the lock" also conflicts with Story 4.2, whose `manual_move` must validate against the import inside the lock. Left open for a story that changes the command service.

## Verification

**Commands:**
- `npm run lint:py`, `npm run lint:imports`, `npm run test:py` -- expected: pass
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- expected: pass
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff
- `npm run e2e -- --project=chromium` -- expected: all existing tests pass (no user-visible change, no new e2e test)

## Auto Run Result

Status: done

**Summary:** The plan's steps are now typed (`Step`, AD-5) and `domain.planning.replay(import, steps)` is the one fold that builds the planning copy, the effective moves (FR-34 combine and move-back, latest move by time) and each part's current location. `planning_copy` delegates to it, so every view reads replayed facts. `current_round` moved into the kernel, `append_step` builds steps with the next move number and the current round, and `domain.apply` checks the round and move-number invariants on every command result. No stored version bump (steps were always `[]`). Retro item 22 was considered and left open: this story does not change `run_command` or the store.

**Files changed:**
- `backend/swp/domain/state.py` -- `Rule`, frozen `Step`; `steps: list[Step]`.
- `backend/swp/domain/planning.py` -- `EffectiveMove`, `Replay`, `replay`, `current_round`, `append_step`; `planning_copy` delegates to `replay`.
- `backend/swp/domain/apply.py` -- `check_step_invariants` around the dispatch.
- `backend/swp/domain/views/summary.py` -- imports `current_round` from `planning`.
- `backend/tests/domain/test_replay.py` (new) -- matrix, answer-key scenario, FR-36 property test, invariants.
- `backend/tests/domain/test_plan_state.py`, `backend/tests/domain/test_planning.py` -- typed steps; renamed test.
- `backend/tests/app/test_planning_copy_api.py` (new) -- stored step replayed in part detail and locations; import row unchanged.
- `.docs/implementation-artifacts/epic-4-context.md` (new) -- compiled epic context.

**Review findings:** 33 findings; 4 entries patched (2 medium: apply-level invariant test, FR-34 latest-by-time; 2 low: test rename, invariant test parametrization); 0 deferred; 29 rejected with reasons in the triage log.

**Follow-up review:** recommended (2 medium entries patched). Unverified risk: the FR-34 fold's "latest move" selection was changed in review and is pinned by one new repro test only.

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept; `npm run test:py` 368 passed; app tests on Postgres 17 (`--database-url`) 87 passed; `npm run lint`, `npm run typecheck` clean; `npm run test:web` 183 passed; `npm run gen:api` left `schema.ts` unchanged; `npm run e2e -- --project=chromium` 35 passed.

**Residual risks:** `replay` trusts steps (no-stock or from == to steps are rejected only by Story 4.2's command); retro item 22 stays open.
