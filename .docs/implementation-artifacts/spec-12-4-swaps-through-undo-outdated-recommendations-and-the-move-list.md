---
title: 'Story 12.4: Swaps through undo, outdated recommendations and the move list'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'cbab6dd2bc594a77f8fcfaebd1689981ec0b0985'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-12-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A swap made by drag (Stories 12.1–12.3) already undoes step by step and outdates recommendations, but two gaps remain. (1) Epic-8 retro item 72: the step log stores no swap size, so a swap with three or more steps where only some steps were undone still prints as an intact swap on the move list (`move_list._intact_swaps` only compares the steps still in the log with the effective moves). (2) Story 12.1 deferral: `swap_made.move_numbers` lists every step number, also a step that FR-34 merged into an earlier move or that removed a move, so the swap toast's "N manual moves" counts moves that do not exist. Story 12.4's ACs (undo, outdated, move-list marks, the answer-key app test and the drag e2e) are not yet pinned end to end.

**Approach:** Store the swap's size on each of its steps (`Step.swap_size`, set by `drag.swap`) and make `_intact_swaps` require exactly that many logged steps. Make `swap_made.move_numbers` list only the swap steps that stand as their own effective move. Add the app-level answer-key test `tests/app/test_fr51_swap_move_list.py` and extend `e2e/drag.spec.ts` with the swap → undo → move list journey.

## Boundaries & Constraints

**Always:**
- `Step.swap_size: int | None = None` (ge=2 when set). Every step of one `swap` command carries `swap_size = len(parts) + len(back_parts)` and the same `swap_id`. Manual moves, `move_parts`, `put_together` and recommendation steps keep `swap_id = None`, `swap_size = None`.
- A stored step without `swap_size` (state saved before this story) still validates and is judged by today's rule (≥2 logged steps). No state `schema_version` bump: the field defaults, like `swap_id` (state.py docstring: "every field has a default").
- `_intact_swaps` (AD-17): a swap is intact only when the logged steps with its `swap_id` number exactly `swap_size` (when known), each is its own effective move, all in one round, both ways between one pair of locations. Everything else about the move list (order, `MoveListSwap` shape, footnote, endpoint) is unchanged.
- `swap_made.move_numbers` = move numbers of the swap's steps whose event is `move_made` (own effective move), in step order. A step that gave `moves_combined` or `move_removed` is left out; those events still follow `swap_made` unchanged. `swap_made` is always emitted for a confirmed swap, even with an empty list. The frontend toast keeps reading `move_numbers.length` (no frontend code change needed for this).
- Undo stays as is: undo deletes the last step only, so a swap's back-part step is undone first; each undo outdates every unapplied recommendation of the latest run (existing `undo` command, FR-29/FR-35).
- Tests name their FR (`test_fr51_*`, `test_fr38_*`, `test_fr29_*`, `test_fr35_*`); e2e names its journey (`uj1 …`).
- Retro items: epic-8 item 72 is closed by this story. Epic-10 item 92: run this story's e2e spec in firefox and msedge too. No other open item concerns this code; the FR-34/FR-38 same-part order (epic-8 item 68, Justas's decision) must not change.

**Never:**
- No change to `replay`/`_fold_move`, the FR-34 rule, `check_manual_move`, undo/reset handlers, `revalidate`, or the move-list ordering.
- No new endpoint or command; no frontend production code change unless a test proves a defect.
- No edits to `data/sample/`, `data/answer-key/`, or `.docs/planning-artifacts/`. No session logs, nothing under `.logs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| intact 2-step swap | swap A F→T, back C T→F | both steps `swap_size=2`; move list lines "Swap 1/2", "2/2" | — |
| 3-step swap, last step undone | swap parts [A,B] F→T, back [C]; undo once | 2 logged steps < size 3 → no swap marks; both remaining lines plain Manual | — |
| 2-step swap, one undo | swap then undo | one plain Manual line (already true; keep pinned) | — |
| leg folded by FR-34 | existing test `test_fr51_fr34_swap_leg_folded…` (move 1 removed, 9100 combined into move 2) | `swap_made.move_numbers == []`; events otherwise unchanged; no swap mark | — |
| one leg own move, other combined | swap where only the back-step combines | `move_numbers == [own step]` | — |
| legacy step | stored step with `swap_id`, no `swap_size` | validates; old ≥2 rule applies | — |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py:39` `Step` -- add `swap_size: int | None = Field(default=None, ge=2)` after `swap_id`, with a one-line docstring note.
- `backend/swp/domain/planning.py:395-440` `_next_step` / `append_step` -- add `swap_size: int | None = None` keyword, pass through to `Step`.
- `backend/swp/domain/manual_steps.py` `append_manual_step` -- add `swap_size` keyword, pass to `append_step`.
- `backend/swp/domain/drag.py` `_expand` (line ~107) and `swap` (line ~145) -- pass `swap_size=len(steps)` for a swap; build `move_numbers` from the returned events (`MoveMade.move_number` of the per-step events). Update the `SwapMade` docstring in `backend/swp/domain/commands.py:248` to the new meaning.
- `backend/swp/domain/move_list.py:105-140` `_intact_swaps` -- collect each swap's logged numbers and its stored size (first non-None `swap_size` of its steps); when a size is known require `len(numbers) == size`; drop the "store no swap size" sentence from the docstring and the module docstring's wording if needed.
- `backend/tests/domain/test_move_list.py:359` `test_fr38_swap_mark_only_when_intact` (helper `_swap_step` at :324) -- add the partly undone 3-step case (steps with `swap_size=3`, last step removed → no mark) and a legacy no-size case; keep existing cases passing (give existing helper steps a size where they model drag swaps).
- `backend/tests/domain/test_drag.py` -- `test_fr51_swap_expands_with_one_swap_id` (:215) asserts `swap_size` on both steps; `test_fr51_fr34_swap_leg_folded_keeps_step_numbers_and_events` (:388) now expects `move_numbers=[]` (rename to `…_folded_leg_is_not_listed…`); add a case where only one leg folds; `test_fr51_move_parts_and_put_together_steps_have_no_swap_id` (:241) also checks `swap_size is None`. Helpers `_two_parts`, `_drag`, `_do`, `after_run_1` exist there.
- `backend/tests/domain/test_plan_state.py` / `test_replay.py` -- a stored step dict without `swap_size` validates (legacy) — add one assertion where `swap_id` round-trip is already tested (`test_plan_state.py:247`).
- New `backend/tests/app/test_fr51_swap_move_list.py` -- through `POST /api/plans/{id}/commands` and `GET /api/plans/{id}/move-list`. Reuse fixtures/helpers from `tests/app/test_drag_api.py` and `tests/app/test_move_list_api.py` by import (epic-7 item 64: do not duplicate). Setup as `test_drag.py:258` answer-key case: `put_together` 8300 D-01-01-01 → D-01-02-03, then `swap` from D-01-02-03 parts [9200] to D-01-02-02 back [9100]. Assert the move list has exactly two lines for the swap, `swap` = {index 1/2 and 2/2, size 2, same locations}, the put_together line unmarked; `undo` once → that swap leaves one line with `swap: null`, rule `manual`. Plus: a 3-step swap partly undone loses its marks over HTTP; after a run, a drag that moves a recommended part outdates it (`moved`) and a drag into a recommended target outdates it (`filled`) in `GET …/recommendations`; after each undo of a swap made in round 1 every unapplied recommendation is outdated with cause `undo`. Use the same answer-key data source the existing app tests use (check `tests/app/conftest.py`).
- `frontend/e2e/drag.spec.ts` -- helpers `wallOf`, `cellOf`, `nearestInView`, `onePartLocations`, `partsAt`, `dropOnOccupied`, `grid`, `AISLE` (local; epic-10 item 89 stays open). `e2e/undo.spec.ts` shows the "Undo last move" button (Recommendations header) with accessible description `Undo move N: <part> <from> → <to>` and the undone toast; `e2e/move-list.spec.ts` shows how the move list page is opened and lines read; `e2e/recommendations-outdated.spec.ts` shows set_best_mark + run by API and reading the Outdated tab. Imports `test`/`expect`/`toasts` from `./support/test`.
- `frontend/modules/move-list/move-list-page.tsx`, `frontend/lib/copy/index.ts:384-425` (`SWAP_FOOTNOTE`, `ruleCellText`, `swapLocationsText`) -- read-only: already render "Manual · Swap 1/2", "A ↔ B" and the footnote.
- `frontend/lib/api/schema.ts` -- `Step` is not in the API schema today; run `npm run gen:api` anyway and commit any diff (CI fails on diff).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/state.py`, `planning.py`, `manual_steps.py`, `drag.py`, `commands.py` -- store `swap_size` on swap steps; `swap_made.move_numbers` = own effective moves only.
- `backend/swp/domain/move_list.py` -- `_intact_swaps` uses the stored size.
- `backend/tests/domain/test_drag.py`, `test_move_list.py`, `test_plan_state.py` -- the matrix rows above.
- `backend/tests/app/test_fr51_swap_move_list.py` -- the answer-key swap/undo move-list test and the outdated checks over HTTP.
- `frontend/e2e/drag.spec.ts` -- new `uj1 swaps by drag, undoes once and prints the move list`: fresh sample plan, 1440×900; by API `set_best_mark` on an aisle other than `AISLE` (or a level/location mark, whichever yields it) + `run`, so the swap is round 1 and some open recommendation moves a part out of a one-part location in `AISLE` (assert one exists; pick it by API). Its from-location is F; the target T is the nearest one-part occupied location in view (`nearestInView`). Drag F onto T, choose Swap; assert the toast "Swapped F ↔ T · 2 manual moves, round 1." and the wall (parts swapped, via `wallOf`). Open the Recommendations Outdated tab: that recommendation's row is outdated with the moved reason (read the exact sentence from `lib/copy`). Open the move list: two adjacent lines with rule cell "Manual · Swap 1/2" / "Manual · Swap 2/2", the "F ↔ T" text under each, the swap footnote. Then the "Undo last move" control: its description is `Undo move N: <back-part> <to> → <from>` (N = the second move), click it, the undone toast, then the move list shows one plain "Manual" line for the first move, no swap text and no swap footnote.

**Acceptance Criteria:**
- Given a two-part swap, when Undo last move is used, then the first undo reverses only the back-part's move with "Undo move N: …" and a second undo reverses the other; after each undo every unapplied recommendation of the latest run is outdated.
- Given an open recommendation whose part or target a drag touched, when the drag is applied, then it is outdated with `moved` or `filled` and the Recommendations list shows it outdated.
- Given an intact swap, when the move list opens, then its lines are adjacent and read "Manual · Swap 1/2"/"2/2" with "A ↔ B" under them and the swap footnote shows; after one of its moves is undone or combined, the rest prints as plain Manual lines, also for a swap of three or more steps where only some are undone.
- Given a confirmed swap, then `swap_made.move_numbers` lists only the swap's moves that stand as their own move, and the toast counts those.
- Given the full suites, then backend, web unit and e2e (chromium; `drag.spec.ts` also firefox and msedge) pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 19 findings — high 0, medium 0, low 14, false 5, maybe-false 0
- findings:
  - `[false]` `[reject]` (edge) a swap whose legs all fold shows "0 manual moves" — this is the chosen, documented outcome (Design Notes): the plan holds no move for it; the folded legs' own events report what happened. A Vitest case now pins the wording.
  - `[low]` `[patch]` (edge) the new e2e could pick a target holding the dragged part itself, which the server refuses — the target is now chosen only among one-part locations whose part differs from the dragged part.
  - `[low]` `[patch]` (blind) the `move_list.py` module docstring still defined "intact" without the stored size — reworded: every step still logged (its `swap_size`), each its own effective move.
  - `[low]` `[reject]` (blind) `Step` does not validate that `swap_size` goes with `swap_id` or is the same on every step of a swap — only `drag.swap` writes the field, always both together and equal; a validator adds a guard for a state no code path produces.
  - `[low]` `[patch]` (blind) the `swapToast` JSDoc still said N is the swap's move numbers, and no Vitest covered 1 or 0 moves — JSDoc reworded; `fr51_fr34_swap_toast_counts_only_legs_that_are_their_own_move` added.
  - `[low]` `[reject]` (blind) the 12.3 e2e computes the expected toast count from which parts were set up — the sample data is fixed synthetic data, and the fold rule itself is pinned by the domain tests (`test_fr51_fr34_*`); reading the count from the API would test the same server value.
  - `[low]` `[reject]` (blind) the new e2e skips the second undo, sorts numbers as text, uses a fixed column index and declares unused type fields — the e2e AC says "undoes once"; the second undo is pinned over HTTP (`test_fr51_fr35_fr29_each_undo_of_a_round_1_swap_outdates_every_open_recommendation`, previews moves 2 then 1); move numbers 1 and 2 sort the same as text; the rest is cosmetic.
  - `[low]` `[reject]` (blind) no HTTP test for folded-leg `move_numbers` — the API serializes the same `SwapMade` model the domain tests pin; nothing between them changes the list.
  - `[low]` `[reject]` (blind) the app test imports private helpers from sibling test modules — the spec asked for reuse by import; moving them to a shared module is epic-7 item 64, still open with its own owner.
  - `[low]` `[reject]` (blind) the app tests assert an unexplained count of 8 and skip move 1 in the three-step test — the count is fixed by the answer key; move 1's line is not what the test is about.
  - `[false]` `[reject]` (blind) no test of a swap with all steps logged where one is combined later — `test_fr38_swap_mark_only_when_intact` already has the `combined` and `moved_back` cases (all steps logged, one folded) and asserts no marks.
  - `[low]` `[reject]` (verification-gap, other) the 12.3 e2e's `ownMoves` mirrors the fold rule — same as the blind row above.
  - `[low]` `[reject]` (intent) the `move_numbers` change alters the toast count, and the 12.3 e2e follows it — the intent names `move_numbers` listing folded steps as the defect; the toast reading the corrected list is the intended consequence.
  - `[low]` `[reject]` (intent) no move-list test for a swap folded at expansion through drag — replay clears `swap_id` on a combined move (`test_replay.py`) and a removed move has no line; the move-list combined case covers the mark.
  - `[low]` `[reject]` (intent) item 72's case is in a new test, not inside `test_fr38_swap_mark_only_when_intact` — the case exists and runs (`test_fr38_fr35_partly_undone_swap_of_three_loses_its_marks`, plus HTTP); the function name is cosmetic.
  - `[false]` `[reject]` (intent) steps stored before this story keep the old rule, so a partly undone legacy swap stays marked — the app was never deployed and drag swaps exist only since Story 12.1 today; no stored legacy multi-part swap exists, and the fallback keeps old documents valid (NFR-12).
  - `[low]` `[reject]` (intent) the wall's outdated marking and the `filled` cause are not shown in the UI test — the wall and list read the stored status that the app test pins for `moved` and `filled`; the e2e shows the list's moved row; the display itself is earlier epics' tested code.
  - `[false]` `[reject]` (intent) no firefox/msedge run — `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge` ran and passed (see Auto Run Result).
  - `[false]` `[reject]` (intent) the answer-key test is "exactly two marked lines" only loosely — the answer key has no two-part location, so a set-up `put_together` adds one unmarked line; the swap gives exactly its two marked lines and one undo leaves one unmarked line of it.

## Design Notes

**Why size, not members.** The move numbers of a swap are consecutive and known at expansion time, but undo deletes steps and never rewrites earlier ones, so a size on each step is enough: fewer logged steps than the size means part of the swap was undone. Members would duplicate the log.

**Why own moves only in `move_numbers`.** The toast says "N manual moves" and the move list marks only own moves as swap lines. A folded leg is reported by its own `moves_combined`/`move_removed` event, so nothing is lost. A swap whose both legs fold (dragging a swap straight back) gives an empty list and "0 manual moves", which is true: the plan now holds no move for it.

## Verification

**Commands:**
- `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck` -- expected: clean.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff (or the diff committed).
- `npm test` -- expected: backend and web green.
- `npm run e2e -- --project=chromium` -- expected: all pass.
- `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge` -- expected: pass.

## Auto Run Result

**Summary:** Each step of a drag swap now stores the swap's size (`Step.swap_size`, FR-51, AD-17). The move list marks a swap only while all of its steps are still logged, each is its own effective move, they are in one round, and they go both ways between the pair. A swap of three or more steps where only some steps were undone now prints as plain Manual lines. This closes epic-8 retro item 72. `swap_made.move_numbers` now lists only the swap's steps that stand as their own move: a leg that FR-34 combined or removed is left out, so the swap toast's "N manual moves" counts real moves (the Story 12.1 deferral). Steps stored before this story have no size and keep the old rule. There is no state schema bump. Story 12.4's ACs are pinned end to end:
- **Undo:** back-part first, with the `undo_preview` wording; each undo outdates every open recommendation.
- **Outdated recommendations:** a drag outdates them with `moved`/`filled`.
- **Move list:** marked lines and the footnote for an intact swap, plain lines after an undo or a combine.
- **Tests:** an answer-key app test and a UJ-1 Playwright journey.

The FR-34/FR-38 same-part order (epic-8 item 68) is unchanged.

**Files changed:**
- `backend/swp/domain/state.py`: `Step.swap_size` (optional, ge=2).
- `backend/swp/domain/planning.py`, `backend/swp/domain/manual_steps.py`: pass `swap_size` through to the step.
- `backend/swp/domain/drag.py`: swap steps carry the size; `move_numbers` lists only the steps that stand as their own move.
- `backend/swp/domain/commands.py`: the `SwapMade` docstring.
- `backend/swp/domain/move_list.py`: `_intact_swaps` uses the stored size; the docstrings are updated.
- `frontend/lib/api/schema.ts`: regenerated (the `SwapMade` description).
- `frontend/modules/locations/drag/drag.ts`: the `swapToast` JSDoc.
- `backend/tests/domain/test_drag.py`, `test_move_list.py`, `test_plan_state.py`, `fixtures/state_v2.json`: the matrix rows (size stored, partly undone 3-step swap, legacy rule, folded legs).
- `backend/tests/app/test_fr51_swap_move_list.py` (new): the answer-key swap/undo move list, a partly undone 3-step swap, drag outdating with `moved`/`filled`, and each undo outdating with `undo`, all over HTTP.
- `frontend/tests/drag.test.tsx`: the toast with 1 and 0 moves.
- `frontend/e2e/drag.spec.ts`: new `uj1 swaps by drag, undoes once and prints the move list`. The 12.3 journey's toast count now follows the folded leg.

**Review:** 19 findings: 0 high, 0 medium, 14 low, 5 false.
- **Patched (3 entries, all low):**
  - the e2e target can no longer hold the dragged part
  - the `move_list.py` module docstring
  - the `swapToast` JSDoc, plus Vitest cases for 1 and 0 moves
- **Deferred:** none.
- **Rejected:** 16, each with its reason in the triage log:
  - "0 manual moves" (intended)
  - no `swap_size`/`swap_id` validator
  - the 12.3 e2e count follows the fold rule (×2)
  - e2e cosmetics and the single undo
  - no HTTP folded-leg test
  - private helper imports (epic-7 item 64)
  - the count of 8 in the app test
  - the combined case already tested
  - the toast count change is intended
  - no drag-path folded move-list test
  - item 72's test name
  - the legacy fallback
  - the wall's outdated display
  - the firefox/msedge evidence
  - the answer-key "exactly"

**Follow-up review:** not recommended (`false`). This pass patched 0 high, 0 medium and 3 low.

**Verification (after the patches):**
- `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck`: clean.
- `npm run gen:api`: `schema.ts` matches the committed diff.
- `npm test`: backend 1004 passed and 2 skipped; web 39 files, 713 tests passed.
- `npm run e2e -- --project=chromium`: 130 passed.
- `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge`: 10 passed.

**Residual risks:**
- A partly undone multi-part swap stored before this story would still show its mark. No such swap exists, because the app was never deployed.
- The 12.3 journey's expected toast count depends on the fixed sample data.
- `sprint-status.yaml` still lists epic-8 item 72 as `open`. The orchestrator updates sprint status.
