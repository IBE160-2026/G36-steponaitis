---
title: 'Story 8.2: Mark the lines of a swap'
type: 'feature'
created: '2026-11-23'
baseline_revision: '4e0b7b46c2dc4cc8ef407a010247abfd01eb8efa'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A swap with several back-parts where only some back-steps were undone still looks
      intact from the step log and keeps its swap mark.
    evidence: |-
      swap_id is uuid5(command_id, "swap:1") (Epic 12) and the log stores no swap size; undo
      removes the last step, so a prefix that still has both directions between a and b and
      one effective move per logged step is indistinguishable from a complete smaller swap.
      Needs a stored swap size or membership (Epic 12 / Story 12.4 owns the swap command).
    location: >-
      backend/swp/domain/move_list.py _intact_swaps
    severity: low
---

<intent-contract>

## Intent

**Problem:** The move list (Story 8.1) prints every effective move, but the lines of a swap (steps sharing a `swap_id`, FR-51/AD-16) are neither kept together nor marked, so the colleague does not know to set one bin aside first.

**Approach:** In the pure `domain/move_list.py` slice, find the intact swap groups (AD-17), keep each group's lines next to each other inside the out-before-in order, and give each of its lines `swap {index, size, locations: [a, b]}`. The endpoint and `schema.ts` carry the new field.

## Boundaries & Constraints

**Always:**
- New model `MoveListSwap {index: int, size: int, locations: tuple[str, str]}`; `MoveListLine` gains `swap: MoveListSwap | None = None`. Rule stays `manual`.
- A `swap_id` group is **intact** only when all hold: the log (`state.steps`) has at least two steps with that `swap_id`; there is exactly one effective move with that `swap_id` per such step, each with `steps == (move_number,)`; all are in one round; and the moves go between one pair of locations {a, b} with at least one a→b and at least one b→a. Otherwise its remaining lines get `swap = None` (ordinary Manual lines).
- `build_move_list_rounds(data, moves, *, steps)` takes the step log as a required keyword; `build_move_list_view` passes `state.steps`. Still one `replay` per request.
- Order: an intact swap's lines are one strongly connected component member set (both directions between a and b), so they stay in one component. Inside a component, the swap's lines sort together at the position of the group's lowest base key, then by base key among themselves; non-swap lines keep their base key. The component's ready key (its lowest base key) and every other order rule from 8.1 are unchanged.
- `index` is the 1-based position among the group's printed lines, `size` the group's line count, `locations` = (first printed line's from_location, its to_location); every line of the group carries the same `locations` and `size`.
- Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- Tests name their FR (`test_fr38_*`); swaps are built as fixture states (no swap command until Epic 12).

**Never:**
- No change to `replay`, `Step`, `PlanState` schema, commands or other views; no new stored field (no swap size). No frontend page or print route (8.3/8.4), no new Playwright spec (no user-visible change yet).
- A cycle of plain manual moves (no `swap_id`, e.g. answer key 9100 ↔ 9200) never gets a swap mark.
- Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`. No new third-party dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Intact 2-step swap | steps 9100 D-01-02-02→D-01-02-03, 9200 D-01-02-03→D-01-02-02, both `swap_id` "s1", round 0 | lines 9100 then 9200; swap (1,2,[D-01-02-02,D-01-02-03]) and (2,2,same) | No error expected |
| Last swap step undone | only the first step of "s1" left in the log | one Manual line, `swap` None | No error expected |
| Swap step combined | "s1" intact, then 9200 moved D-01-02-02→X in the same round (combines with 9200's swap move) | combined line and 9100's line both `swap` None | No error expected |
| Swap step removed by move-back | "s1" intact, then 9200 moved D-01-02-02→D-01-02-03 back | 9100's line `swap` None | No error expected |
| 3-step swap, back step undone | p1, p2 a→b and q b→a share "s2"; q undone | two a→b Manual lines, `swap` None (one direction only) | No error expected |
| Swap inside a bigger cycle | swap a↔b plus manual lines whose base keys fall between the swap lines' keys, all in one component | the swap's lines are adjacent at the group's lowest key | No error expected |
| Manual cycle | answer key final state (9100 ↔ 9200, no `swap_id`) | 14 lines as in 8.1, all `swap` None | No error expected |
| Over HTTP | sample plan with a stored intact swap (fixture state) | GET move-list lines carry `swap`; after `undo` of the last swap step, the remaining line has `swap: null` | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/move_list.py` -- 8.1 slice: `MoveListLine`, `_order_round(moves, key)` (Tarjan components sorted by `key`, then Kahn with min-heap on `key(moves[component[0]])`), `build_move_list_rounds(data, moves)`, `build_move_list_view` (one `replay`). All changes land here.
- `backend/swp/domain/planning.py:82-99` -- `EffectiveMove` (`swap_id`, `steps`); `_fold_move` (line ~198) sets `swap_id=None` and appends to `steps` on combine, deletes the move on move-back, so a combined/removed swap step leaves fewer effective moves with that `swap_id` than log steps. Read-only.
- `backend/swp/domain/state.py:38-55` -- `Step.swap_id`; read-only.
- `backend/tests/domain/test_move_list.py` -- `_move`, `_data`, `_lines`, `_parts` helpers; ~12 calls of `build_move_list_rounds(data, moves)` need `steps=...` (empty list where moves have no `swap_id`).
- `backend/tests/domain/test_answer_key.py:489` -- `test_fr38_answer_key_move_list` calls `build_move_list_rounds(data, replay(...).moves)`; pass `steps=final.steps` and assert every line's `swap is None`.
- `backend/tests/domain/conftest.py` -- shared `data` fixture (answer-key import: 9100 at D-01-02-02, 9200 at D-01-02-03, Walk Paths in `data/answer-key/Locations.csv`).
- `backend/tests/app/test_move_list_api.py` -- endpoint tests; `backend/tests/app/test_reopen.py:40-90` -- `_raw_state`, `_write_state`, `_ok`, `_version`, `_send`, `_single_location_parts` (fixture-state pattern for swap steps); `backend/tests/app/test_undo_api.py:19` `_undo_body(move_number, base_version)`.
- `frontend/lib/api/schema.ts` -- regenerated; no frontend code reads `swap` yet.
- Retro items: epic-1 #11 (read earlier deferred items naming this story) — 8.1's deferred same-part ordering item lives in `_order_round` but is a product decision, not this story; left deferred. epic-7 #64 (shared backend test helpers) — reuse the existing helpers by import, do not duplicate; the cleanup stays with #64. No other open item touches this code.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/move_list.py` -- add `MoveListSwap`, `MoveListLine.swap`, an intact-group finder (per Always), swap-aware ordering inside components, the `steps` keyword, and pass `state.steps` from `build_move_list_view`; update the module docstring.
- `frontend/lib/api/schema.ts` -- regenerate (`npm run gen:api`).
- `backend/tests/domain/test_move_list.py` -- update call sites; add `test_fr38_intact_swap_lines_are_marked`, `test_fr38_swap_mark_only_when_intact` (undone, combined, moved back, 3-step one-direction, steps in different rounds), `test_fr38_swap_lines_follow_each_other` (inside a bigger component; same moves without `swap_id` interleave), `test_fr38_manual_cycle_has_no_swap_mark`; extend the seeded property test so random `swap_id` groups never break out-before-in outside components and lines stay exactly the moves.
- `backend/tests/domain/test_answer_key.py` -- pass `steps`; assert no swap marks.
- `backend/tests/app/test_move_list_api.py` -- `test_fr38_move_list_marks_an_intact_swap_over_http`: sample plan, two single-location parts, write two `swap_id` steps as stored state, GET shows both marked lines; `undo` the last step, GET shows one line with `swap: null`.

**Acceptance Criteria:**
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.
- Given a plan with no swap steps, when GET move-list runs, then every line has `swap: null` and order and line count equal Story 8.1's output.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 19 findings — high 0, medium 0, low 13, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) the property test never asserts which groups get marked — fixed tests now pin intact and broken groups (incl. the new 3-step cases); tracking intactness inside the random generator adds complexity for a case the fixed tests already cover.
  - `[low]` `[patch]` (blind) `_random_moves` comment says "a swap step undone" but any step may be popped — comment reworded to what the code does.
  - `[low]` `[patch]` (blind) no fixed test of an intact swap with more than two lines — added `test_fr38_three_line_swap_is_marked` (size 3, indexes 1..3, locations from the first printed line).
  - `[low]` `[patch]` (blind) `m.steps != (m.move_number,)` check is unreachable on replay output — kept as an AD-17 safeguard with a comment saying so.
  - `[low]` `[reject]` (blind) `group.index(move)` is quadratic — a swap group has two or three lines; no measurable cost, fix is a refactor.
  - `[low]` `[reject]` (blind) HTTP test reads `locations` from the output — the domain tests pin the exact pair and order; the HTTP test checks the pair set, consistency over both lines and the undo path, which is its purpose.
  - `[low]` `[reject]` (blind) HTTP test imports underscore helpers from four modules — existing pattern; open retro item epic-7 #64 owns the shared test helpers.
  - `[false]` `[reject]` (blind) the answer-key `swap is None` assertion is always true — it is a regression guard on the real answer-key state; the comment accurately says 9100 ↔ 9200 is a manual cycle, and `test_fr38_manual_cycle_has_no_swap_mark` covers the same with a replay.
  - `[low]` `[patch]` (blind) `schema.ts` makes `swap` optional though the API always sends it — default removed (`swap: MoveListSwap | None`), schema regenerated to `swap: ... | null`.
  - `[low]` `[defer]` (blind) the multi-back-part partial-undo limit is recorded only in the spec's Design Notes — added to `deferred` (Epic 12 / Story 12.4) and to the `_intact_swaps` docstring.
  - `[low]` `[patch]` (blind) `MoveListSwap` docstring does not say what the `locations` order means — docstring now says (from, to) of the group's first printed line.
  - `[low]` `[patch]` (verification-gap) the step-log comparison in `_intact_swaps` is never exercised — added a replayed 3-step swap with p2 moved back; both remaining lines unmarked; the subagent confirmed the case fails with the comparison removed.
  - `[low]` `[patch]` (verification-gap, other) unreachable `steps` check — same root cause as the blind row; same comment fix.
  - `[false]` `[reject]` (intent) the AC's "prints as" lives on the printed list, not the JSON — Epic 8 assigns rendering to Story 8.3 (UX-DR52) and AD-17 puts the swap marks in `domain/move_list.py`; 8.2 supplies the data the print renders.
  - `[false]` `[reject]` (intent) "intact" is narrower than the AC (round, ≥2 steps, both directions) — these are how AD-17's "every step exists and is its own effective move" is detected from a log without a stored size (AD-16 expansion); no intact swap is wrongly unmarked.
  - `[low]` `[reject]` (intent) `locations` direction is not set by the AC — deterministic, documented in the model docstring and tested; changing it needs a product choice with no named harm.
  - `[false]` `[reject]` (intent) "where the FR-38 order allows" applied only inside a component — out-before-in fixes the order between components, so inside the component is exactly where the order allows grouping.
  - `[false]` `[reject]` (intent) swaps built only from fixture states — the AC requires fixture states until Epic 12; combine and move-back run through the real `replay`.
  - `[false]` `[reject]` (intent) `build_move_list_rounds` now requires `steps=` — internal domain function; every caller updated; the requirement prevents a silent "no marks" call.

## Design Notes

**Why the direction check.** `swap_id` is `uuid5(command_id, "swap:1")` (Epic 12) and stores no size, and undo removes the last step. A partly undone 2-step swap leaves one direction only, so "both directions present" plus "one effective move per log step" detects every undo, combine and move-back of a 2-part swap. A swap with several back-parts where only some back-steps were undone still looks complete from the log; Epic 12 (Story 12.4) owns that case if it needs it (e.g. a stored size). Recorded as a residual risk, not handled here.

**Grouping key inside a component:** `(min base key of the group, base key)` for swap lines, `(base key, base key)` for others; the component's first element still has the lowest base key, so the Kahn ready key is unchanged.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: all contracts kept
- `npm run typecheck` -- expected: no errors (schema regenerated)
- `npm test` -- expected: pytest and Vitest pass
- `npm run e2e -- --project=chromium` -- expected: all pass (no user-visible change)

## Auto Run Result

Status: done

**Summary:** The move list now marks swaps (FR-38, FR-51, AD-16/AD-17). `domain/move_list.py` finds the intact swap groups: at least two logged steps share the `swap_id`, each is its own effective move (none undone, combined or moved back), all are in one round, and they go both ways between one pair of locations. Each line of an intact group carries `swap {index, size, locations}`. Inside an out-before-in component the group's lines sit together at the group's lowest Walk Path key, so they follow each other wherever FR-38 allows. Any other line, including the answer key's 9100 ↔ 9200 manual cycle, has `swap: null`. `build_move_list_rounds` takes the step log as a required `steps` keyword; `build_move_list_view` still does one `replay`. Retro items: epic-1 #11 was checked (8.1's deferred same-part ordering item stays deferred, as a product decision); epic-7 #64 owns the shared test helpers, so the new API test imports the existing ones. No other open item touches this code.

**Files changed:**
- `backend/swp/domain/move_list.py` -- `MoveListSwap`, `MoveListLine.swap`, `_intact_swaps`, swap-aware ordering inside components, `_lines`, the required `steps` keyword.
- `frontend/lib/api/schema.ts` -- regenerated (`MoveListSwap`, `swap: MoveListSwap | null`).
- `backend/tests/domain/test_move_list.py` -- swap tests (marked, only when intact, 3-line swap, follow each other, manual cycle) and the property test extended with swaps.
- `backend/tests/domain/test_answer_key.py` -- passes `steps`; the answer-key lines carry no swap mark.
- `backend/tests/app/test_move_list_api.py` -- intact swap over HTTP, then `undo` leaves one unmarked line.

**Review findings:** 19 findings (high 0, medium 0, low 13, false 6). Patched: 6 entries, all low (comment fix, 3-line swap test, safeguard comment, required `swap` field in the schema, `locations` docstring, a test for the step-log comparison). Deferred: 1 low (partial undo of a swap with several back-parts still looks intact; Epic 12 / Story 12.4). Rejected: 12, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): patched entries were 0 high, 0 medium and 6 low.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm run typecheck` clean; `npm run lint` clean; `npm test` pytest 694 passed, 2 skipped (Postgres-only), Vitest 373 passed; `npm run e2e -- --project=chromium` 79 passed. The first e2e run before review exited non-zero, with the output not captured. Two later runs (before and after the patches) both passed 79/79, which suggests a flake (see open e2e flakiness retro item).

**Residual risks:** the deferred partial-undo case above. No frontend reads `swap` yet; Story 8.3 renders it as "Manual · Swap 1/2" with "A ↔ B" under it.
