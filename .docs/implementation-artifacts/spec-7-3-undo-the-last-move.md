---
title: 'Story 7.3: Undo the last move'
type: 'feature'
created: '2026-11-22'
baseline_revision: '0e4946ba4363135d6c01886b129cdf95b7b10e90'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A planner cannot step back. A wrong apply or manual move can only be fixed with another manual move, and the plan summary's `undo_preview` (already built) has no command or control behind it (FR-35, AD-5, UX-DR38, UX-DR14).

**Approach:** Add an `undo` command that deletes the last step when its move number is `expected_move_number`, and stores `outdated(undo)` on every open recommendation of the latest run and on the undone step's recommendation. Add **Undo last move** (tertiary) to the Recommendations header and the part panel, add a launcher action, give the undone toast its exact wording, and offer **Undo** on move toasts. Un-skip answer-key steps 15 and 16.

## Boundaries & Constraints

**Always:**
- Command (kernel `domain/commands.py`): `Undo {type:"undo", command_id, base_version, expected_move_number: int (ge=1)}`. Add it to the `Command` union. Dispatch it in `domain/apply.py` to a new domain slice `domain/history.py` (Story 7.4 adds reset there). Add `swp.domain.history` to the `domain-slices` independence contract in `backend/.importlinter`. The slice imports only the kernel.
- `undo(state, command, ctx, data, analysis)`:
  - With no steps: `DomainError("command_rejected", "There is no move to undo.")`.
  - When the last step's `move_number != expected_move_number`: `DomainError("command_rejected", "Move <n> is no longer the last move. Undo the last move again.")`, with `details=[{"last_move_number": <last>}]`.
  - Otherwise it builds the event from the preview of the full log (`replay(data, state.steps).last`), then drops `state.steps[-1]`. `next_move_number`, runs metadata, `best_marks` and `keep_marks` stay unchanged. Move numbers are never reused (the existing `check_step_invariants` holds).
  - Every recommendation of the latest run with stored status `open` and no applied step (in the new state) gets `status="outdated", outdated=Outdated(cause="undo")`. Kept parts are included. The undone step's `recommendation_id`, if any, gets the same, in whichever run holds it, when it is stored `open`.
  - Events: `StepUndone`, then `RecommendationsOutdated(count, cause="undo")`, only when count > 0. Count only the latest run's recommendations.
- Kernel moves (no behaviour change): `UndoEffect`, `UndoPreview` and `undo_preview()` move from `domain/views/summary.py` into `domain/planning.py`. `summary.py` imports them from there, and the wire schema is unchanged. `StepUndone {type:"step_undone", undone: UndoPreview}` is added to the `Event` union.
- `OutdatedCause` gains `"undo"` as its **last** member, so `CAUSE_ORDER` ends with it and `revalidate`'s order is unchanged. `revalidate` never produces `undo`. The stored cause is sticky until the next run, as today.
- Undoing a move-back (`restores_removed_move`) brings the removed move back. Its recommendation is again `applied` in the view (derived; no new code expected beyond the step removal). Undoing the second step of a combined move gives the first move back (replay).
- Steps sharing a `swap_id` are undone one at a time, latest first. Test this with a hand-built fixture state (no swap command exists yet).
- Retro items, as far as this story touches their code. Do not change `action_items` statuses in `sprint-status.yaml`.
  - epic-5 #43: the answer-key helpers in `tests/domain/answer_key.py` get a `command(state, cmd, data, analysis) -> Applied` that runs `apply`, then `revalidate` on the result, and returns the combined events, the same as `app/commands.py`. `run_command`, `apply_recommendation`, `manual_step`, `keep_step` and a new `undo_step` use it. Step 15 asserts the `recommendations_outdated{count:4, cause:"undo"}` event and the stored statuses.
  - epic-5 #41: with undo shipping, the Apply all confirm ("Undo reverses them one move at a time.") becomes true. Change no copy.
  - epic-6 #56: `LauncherContext` (`summary`, `send`, `notify`) is wide enough. Do not change the launcher drawer.
  - epic-4 #36: keep the never-decreasing `next_move_number` assertion, and add a test that undo leaves it unchanged.
- Answer key: in `tests/domain/test_answer_key.py`, replace the skipped params 15 and 16 with real assertions.
  - Replay steps 1–14 through the helpers. Step 15 is `undo` of move 11 (1200's apply; the answer key's moves are numbered 1–11 because step 6 is a mark): 1200 is back in B-01-01-02, the four run-2 recommendations are stored `outdated(undo)`, and the events hold `recommendations_outdated{count:4, cause:"undo"}`.
  - Step 16 is `undo` of move 10 (0100's round-1 apply): 0100 is back in A-01-01-01, its run-1 rec is `outdated(undo)`, there is no `recommendations_outdated` event (count 0), `current_round` stays 2, and `next_move_number` stays 12.
  - Steps 17–20 keep their 7.5 skip reasons.
  - Add `test_fr35_undo_after_later_run`: steps 15–18 give one effective Manual move of 0100, A-01-01-01 → B-01-03-02, in round 2, and every run-2 recommendation stays outdated.
- Frontend:
  - Run `npm run gen:api` and commit `schema.ts`. Export `UndoPreview` and `StepUndoneEvent` types from `lib/api/plans.ts`.
  - `lib/copy` words it once. `undoLabel(preview)`:
    - `reverts_move`: "Undo move 3: 9723950 A-03-04-02 → A-05-01-03" (step from → to).
    - `splits_combined_move`: "Undo splits move 3: 9723950 returns to A-05-01-03" (effect number; the step's from).
    - `restores_removed_move`: "Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01" (effect number; the step's to → from).
  - `undoneToast(event, outdatedCount, round)`:
    - The first sentence is "Undid move N." / "Split move N." / "Restored move N." (effect number).
    - When `outdatedCount > 0`, it adds " Unapplied recommendations of round R are now outdated. Run recommendations to continue."
  - Also add `NO_MOVES_TO_UNDO = "No moves to undo"`, `UNDO_LAST_MOVE = "Undo last move"`, `UNDO_ACTION = "Undo"`, and the outdated cause text `"undo"` → "Outdated after undo.".
  - New shared `components/common/undo-last-move.tsx`:
    - `UndoLastMoveButton({planId})` is a tertiary Button labelled "Undo last move". It reads `usePlanSummary`. Its tooltip and accessible description are `undoLabel(preview)`. It is `aria-disabled` with the reason "No moves to undo" when the preview is null, and `SAVING_REASON` while saving.
    - On click it sends `{type:"undo", expected_move_number: preview.move_number}` and toasts `undoneToast`, with `round = summary.current_round`.
    - It also exports `sendUndo(send, moveNumber, round, notify)`, which the button, the toast action and the launcher share.
    - It exports `moveUndoAction(...)`, the toast `{label:"Undo", onClick}` built from a move event: `move_made.move_number`, or `step_move_number` for `moves_combined` and `move_removed`.
  - Place it in the Recommendations header (next to Apply all) and in the part panel's action row (`PartPanel`, beside Manual move…).
  - The launcher: append `UNDO_LAST_MOVE_ACTION` (column `recommendations`) to `LAUNCHER_ACTIONS` in `lib/launcher/index.ts`. Its label is `undoLabel(preview)`, or "Undo last move" when the preview is null. Keywords: "undo last move". `disabledReason` is "No moves to undo" or the saving reason. It sends `undo` and calls `notify(undoneToast(...))`.
  - Toast Undo: the apply / apply-other-location toast in `recommendations-page.tsx` and `moveToast` in `manual-move-dialog.tsx` pass `{action: moveUndoAction(...)}` to the toast. The Apply all, run, keep and mark toasts never offer Undo.
- Every test names its FR or UX-DR (SM-7). The new e2e spec `frontend/e2e/undo.spec.ts` imports `test`/`expect` from `./support/test` and is named `uj3 undoes the last move`.

**Never:**
- No reversal of runs, best marks or keep marks. No decrease of `next_move_number`. No reset (Story 7.4). No DB migration: adding a Literal member keeps old states valid.
- No client-side computation of undo effects or outdated status (AD-3). The client only words `undo_preview` and events.
- No change to `revalidate`'s causes or order, `manual_move`, `apply_all` or the rules' outputs.
- No further split of `recommendations-page.tsx` or `recommendations.py` (retro #46 stays open).
- No edits under `.docs/planning-artifacts/`, `data/` or `.logs/`. No session logs, no push.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Plain undo | answer key after step 14 (last step move 11, apply 1200, rec R) | step removed; 1200 back; R and the 3 open run-2 recs `outdated(undo)`; events `step_undone{undone:{move_number:11,…,effect:reverts_move(11)}}`, `recommendations_outdated{4, undo}` | — |
| Undo older-round step | last step is round 1, latest run is 2 | step removed; its run-1 rec `outdated(undo)` (not counted); `current_round` stays 2 | — |
| Split combined | last step combined into move 3 | effective move 3 is again the first step's move; effect `splits_combined_move(3)` | — |
| Restore removed | last step moved the part back (removed move 4, rec R applied) | move 4 back; R shows `applied` again | — |
| Swap pair | steps 7, 8 share `swap_id` | undo 8, then undo 7, each alone | — |
| No run | manual moves only, no run | step removed; only `step_undone` | — |
| Kept part rec | open rec of a kept part | becomes `outdated(undo)` | — |
| Marks and runs | any undo | `best_marks`, `keep_marks`, runs list and `next_move_number` unchanged | — |
| Wrong number | expected ≠ last | 409 `command_rejected` | state unchanged |
| Nothing to undo | no steps | 409 `command_rejected` "There is no move to undo." | state unchanged |
| Idempotent | same `command_id` twice | stored result, one undo | — |
| Disabled UI | `undo_preview` null | button `aria-disabled`, tooltip "No moves to undo"; launcher action disabled | — |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py:61` -- `OutdatedCause`: append `"undo"`.
- `backend/swp/domain/commands.py` -- add `Undo` and `StepUndone`, plus the unions. Pattern: `SetKeep`/`KeepSet`. Importing `UndoPreview` from `planning` is safe, because planning does not import commands.
- `backend/swp/domain/apply.py:_dispatch` -- `case Undo(): return history.undo(...)`. `check_step_invariants` already allows removed steps and asserts that `next_move_number` never decreases.
- `backend/swp/domain/planning.py` -- `UndoKind`, `StepOutcome`, `Replay.last`, `replay`, `latest_run`, `applied_step`, `current_round`. Add `UndoEffect`/`UndoPreview`/`undo_preview` here, moved from `views/summary.py:62-92`.
- `backend/swp/domain/views/summary.py` -- import the moved names. `PlanSummary.undo_preview` is unchanged.
- `backend/swp/domain/recommendations.py` -- `CAUSE_ORDER` (:66) is derived from the Literal, so check nothing else breaks. `ViewOutdatedCause` and `ApplyAllSkipped.cause` include `undo` automatically.
- `backend/swp/domain/keep.py` -- a small slice to model `history.py` on.
- `backend/swp/app/commands.py` -- runs `revalidate` after apply. No change expected.
- `backend/.importlinter` -- the `domain-slices` modules list.
- `backend/tests/domain/answer_key.py`, `test_answer_key.py` -- the helpers and the skipped params (:193-205). `tests/domain/conftest.py` has the `data`/`analysis` fixtures.
- `backend/tests/domain/test_keep.py`, `test_apply_recommendation.py`, `test_manual_move.py` -- the patterns for the domain tests. `tests/app/test_keep_api.py` and `test_apply_command.py` are the HTTP command patterns. `test_plan_summary.py` covers `undo_preview`.
- `frontend/lib/copy/index.ts` -- `outdatedText` (:125, add `undo`) and `appliedToast` (:164).
- `frontend/components/common/toast.tsx` -- `showToast(message, {action})` already supports one action.
- `frontend/components/common/button.tsx` -- `variant="tertiary"`, `disabledReason`. Check how the tooltip text is set (a tooltip for an enabled button may need a `title`/`Tooltip` prop; follow what exists).
- `frontend/components/common/part-panel.tsx` -- `PartMoveAction`/`PartKeepAction` (:242-265) is the action row, where the Undo button goes.
- `frontend/components/common/manual-move-dialog.tsx:98,359` -- `moveToast` and its `showToast`.
- `frontend/modules/recommendations/recommendations-page.tsx` -- `sendApply` (:635, the toast with the Undo action) and the header buttons (~:700, next to `ApplyAll`).
- `frontend/lib/launcher/index.ts` -- `LauncherAction`, `LAUNCHER_ACTIONS`, and the `findEvent` helper.
- `frontend/lib/commands/react.tsx` -- `usePlanCommands().sendWithEvents`. `frontend/lib/api/plans.ts` -- `usePlanSummary` and the type aliases.
- `frontend/tests/` -- `recommendations.test.tsx`, `copy.test.ts`, `launcher*.test.ts(x)`, the part-panel tests. Extend them, and add `undo-last-move.test.tsx`.
- `frontend/e2e/support/{test.ts,plan-api.ts,sample-plan.ts}`, `other-location.spec.ts` -- the plan-creation, mark and run-via-API helpers.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/{state.py,planning.py,views/summary.py,commands.py,apply.py,history.py}`, `backend/.importlinter` -- the cause, the kernel move, the command, the event and the slice.
- `backend/tests/domain/test_undo.py` (new) -- `test_fr35_*` for every matrix row, using the answer-key helpers. The swap case uses a hand-built `PlanState` with two steps that share a `swap_id`.
- `backend/tests/app/test_undo_api.py` (new):
  - POST `undo` returns 200, version +1, `step_undone` and `recommendations_outdated`.
  - 409 for a wrong number and for no steps.
  - A repeated `command_id` returns the stored result.
  - The recommendations view shows `outdated.cause == "undo"`, and the summary `undo_preview` moves to the previous step.
- `backend/tests/domain/answer_key.py`, `test_answer_key.py` -- the retro #43 helpers, steps 15–16 un-skipped, and `test_fr35_undo_after_later_run`.
- `frontend/lib/api/schema.ts` (generated), `lib/api/plans.ts`, `lib/copy/index.ts`, `components/common/undo-last-move.tsx` (new), `components/common/part-panel.tsx`, `components/common/manual-move-dialog.tsx`, `modules/recommendations/recommendations-page.tsx`, `lib/launcher/index.ts` -- the UI as above.
- Vitest (`frontend/tests/…`):
  - The three label wordings and the three toast first sentences, with and without outdated.
  - The button is disabled with "No moves to undo" and sends `undo` with the preview's number.
  - The launcher action's label, its disabled reason, and the command it sends.
  - The apply toast has an Undo action that sends `undo` with the move's number; the Apply all toast has none.
  - `outdatedText` for `undo`.
- `frontend/e2e/undo.spec.ts` (new), `uj3 undoes the last move`:
  - Mark aisle A best and run via the API. Apply a recommendation in the UI.
  - Hover or focus **Undo last move**: it names the move. Click it.
  - The toast reads "Undid move N. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue.".
  - The Outdated tab shows "Outdated after undo.". The button is then disabled with "No moves to undo".
  - Also apply again, use the toast's **Undo**, and check that the move is gone.

**Acceptance Criteria:**
- Given an `undo` with `expected_move_number` equal to the last step's number, when it is posted to `POST /api/plans/{id}/commands`, then the last step is deleted, the planning copy is the replay without it, and the events are `step_undone` (plus `recommendations_outdated{cause:"undo"}` when any were outdated). A wrong number or no steps gives 409 `command_rejected`, and runs, best marks and keep marks never change.
- Given any undo, when the recommendations view is read, then every previously open recommendation of the latest run and the undone step's recommendation show `outdated` with cause `undo` until the next run, and a move-back's restored recommendation shows `applied`.
- Given the answer key, when steps 1–16 are replayed, then steps 15 and 16 match `expected.json`, and steps 15–18 give one Manual move of 0100, A-01-01-01 → B-01-03-02, in round 2 (`test_fr35_undo_after_later_run`).
- Given the Recommendations header, the part panel or the launcher, when they render, then **Undo last move** shows the `undo_preview` wording, or is `aria-disabled` with "No moves to undo". After an undo the toast uses the exact UX-DR38 sentences. A move toast offers **Undo**, which sends `undo` with that move's number, and mark and Apply all toasts offer none.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 24 findings — high 0, medium 1, low 10, false 13, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) The undo toast reached from a move toast's Undo words the move event's round, not the latest run's. It differs only if a run happens while the move toast is still showing; the fix would add a live round getter to every caller.
  - `[false]` `[reject]` (blind) A stale move toast's Undo after a header undo gives a misleading rejection. Every undo surface toasts its result, and the one-at-a-time toaster replaces the move toast, so the stale action is gone.
  - `[false]` `[reject]` (blind) An apply that produces `moves_combined`/`move_removed` gets no toast. Apply can only append its own move: a same-round step of the part would already make the recommendation `outdated(moved)`, and the apply is then rejected.
  - `[false]` `[reject]` (blind) The undone step's older-run recommendation is outdated silently. Views show only the latest run, so nothing visible changes. The count rule is the spec's.
  - `[low]` `[reject]` (blind) `StepUndone` embeds `UndoPreview`. This is the spec's chosen event shape, and the harm (a future change to the preview schema) is speculative.
  - `[low]` `[patch]` (blind) `Button` copied the disabled branch for `description`, with dead `?? ""`. Merged into one wrapper path with the tip text `disabledReason ?? description`, and renamed to `tipId`/`tipDismissed`.
  - `[low]` `[patch]` (blind) The left-anchored tooltip of the last button in a right-aligned group runs off-screen. Undo last move is now first in the Recommendations header and before Manual move… in the part panel.
  - `[low]` `[patch]` (blind) `undo-last-move.tsx` pass-through wrappers and re-exports duplicate the `lib/commands/undo` API. Deleted them; callers import `@/lib/commands/undo` and pass `notify`.
  - `[low]` `[reject]` (blind) `UndoLastMoveButton` says "No moves to undo" while the summary loads or fails. This is brief or rare, and the fix adds a new state branch and copy.
  - `[low]` `[patch]` (blind) Import order in `lib/launcher/index.ts`. Moved the import below `@/lib/commands/client`.
  - `[false]` `[reject]` (blind) The "undo last move" keyword makes "mov" show the Undo action. EXPERIENCE.md UJ-8 step 2 expects exactly this: typing "mov" lists "Actions (Undo last move)".
  - `[low]` `[reject]` (blind) Missing tests: a rejected undo in the UI, part-panel and launcher e2e, a stale `base_version`, and undo after other-location or apply-all. Vitest covers the rejected undo and the part-panel and launcher surfaces. `base_version` is not enforced (AD-6). Undo removes one step whatever made it, which the domain tests pin.
  - `[false]` `[reject]` (blind) The spec is missing from the diff. This is by design: the spec goes only to the edge-case layer.
  - `[medium]` `[patch]` (verification-gap) The manual-move toast's Undo action had no test. `manual-move.spec.ts` now asserts one toast Undo button, and in another test clicks it and expects "Undid move 1.", the target gone and `undo_preview` null.
  - `[false]` `[reject]` (intent) `outdated(undo)` is stored in the command, not by `revalidate`. The observable state after the command is the same (Design Notes), and `test_fr35_undo_outdated_is_sticky_through_revalidate` pins it.
  - `[low]` `[reject]` (intent) The toast tail shows only when something was outdated, and the round comes from the client. This is the spec's wording rule; the round point is the same as the first blind row.
  - `[false]` `[reject]` (intent) The toast Undo is offered without checking that it is still the last move. The server rejects a stale number, and the toaster replaces move toasts on every later move or undo (Design Notes).
  - `[low]` `[reject]` (intent) Split and restore are tested only in the domain and Vitest, not in e2e. The domain tests pin the effects and Vitest pins the wording; the sample data gives no cheap path to them in e2e.
  - `[false]` `[reject]` (intent) Steps 17 and 18 stay skipped. Their skip reasons name Story 7.5, and the intent un-skips only the tests whose reason names 7.3. `test_fr35_undo_after_later_run` plays them.
  - `[false]` `[reject]` (intent) Only retro #43 is acted on. The spec records #41, #56 and #36 as taken into account and #46 as left open. The others concern behaviour this story does not add.
  - `[low]` `[reject]` (edge) The toast Undo round is stale after a new run. Same root cause as the first blind row.
  - `[low]` `[reject]` (edge) The button reason is wrong while the summary loads. Same as the blind row above.
  - `[false]` `[reject]` (edge) `undo_step` raises IndexError on an empty log. The test helper is never called without steps; the empty case uses `undo_command` directly.
  - `[false]` `[reject]` (edge) Several move events in a manual-move result pick the wrong one. `manual_move` emits exactly one move event; no swap command exists yet (Epic 12).

## Design Notes

**Undo outdates in the command, not in revalidate.** `revalidate` cannot tell that a step was removed. The handler stores `outdated(undo)` itself, and `revalidate` then finds no open recommendation left. This keeps AD-7's four revalidate causes as they are.

**Restored wording uses the step reversed.** A move-back step goes from the removed move's target back to its origin, so the restored move reads `step.to → step.from`. Example: step `4410281 A-02-01-01 → G-14-04-02` gives "Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01".

**Toast Undo trusts the server.** The action sends the move's step number. If another change made a later step since, the server rejects it with `command_rejected`, and the command flow shows that. The client never guesses.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .` -- expected: all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after committing.
- `npm test` -- expected: pytest and Vitest pass; answer-key steps 15 and 16 run (not skipped).
- `npm run e2e -- --project=chromium` -- expected: all pass, including `undo.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A planner can undo the last move, one at a time (FR-35, AD-5, UX-DR38, UX-DR14).
- The `undo` command takes an `expected_move_number`. It drops the last step and stores `outdated(undo)` on every open recommendation of the latest run and on the undone step's recommendation. Its events are `step_undone{undone}` and, when any were outdated, `recommendations_outdated{cause:"undo"}`.
- Runs, marks, keep marks and `next_move_number` never change.
- **Undo last move** is in the Recommendations header, in the part panel and in the launcher. It shows the server's `undo_preview` wording, or is disabled with "No moves to undo".
- Toasts for an apply, an other-location apply or a manual move offer **Undo**.
- Answer-key steps 15 and 16 now run, and `test_fr35_undo_after_later_run` is added.
- Retro epic-5 #43 is taken into account: the answer-key helpers apply, then revalidate. Items #41, #56 and #36 were taken into account with no change needed. No action-item statuses were changed.

**Files changed**
- `backend/swp/domain/history.py` (new): the undo slice.
- `commands.py`, `apply.py`, `state.py`: the command, the event, the dispatch and the `undo` cause.
- `planning.py`, `views/summary.py`: `UndoPreview` moved to the kernel.
- `backend/.importlinter`: the new slice is in the independence contract.
- `backend/tests/domain/{answer_key.py,test_answer_key.py,test_undo.py,test_mark_commands.py}`, `tests/app/test_undo_api.py`: the domain, answer-key and HTTP tests.
- `frontend/lib/api/{schema.ts,plans.ts}`: the generated schema and the types.
- `lib/copy/index.ts`: the wording.
- `lib/commands/undo.ts` (new): the undo command flow.
- `lib/launcher/index.ts`: the launcher action.
- `components/common/undo-last-move.tsx` (new): the control.
- `components/common/button.tsx`: the `description` tooltip.
- `components/common/{part-panel.tsx,manual-move-dialog.tsx}`, `modules/recommendations/recommendations-page.tsx`: placement and the toast Undo.
- `frontend/tests/{undo-last-move.test.tsx,copy.test.ts,recommendations.test.tsx,launcher.test.tsx,part-panel.test.tsx}`: Vitest.
- `frontend/e2e/undo.spec.ts` (new): `uj3 undoes the last move`.
- `frontend/e2e/manual-move.spec.ts`: the toast Undo.
- `frontend/e2e/{keep-in-place,other-location,recommendations-outdated,recommendations-page}.spec.ts`: toast-scoped, exact Undo queries.

**Review findings.** 24 findings: high 0, medium 1, low 10, false 13.
- Patched: 1 medium (the manual-move toast Undo e2e) and 4 low (the Button DRY merge, button order for the tooltip, removed pass-through wrappers, import order).
- Deferred: none. Every rejection and its reason is in the Review Triage Log.
- Also fixed before review: `lib/launcher` imported from `components/`. The undo flow moved to `lib/commands/undo.ts`.

**Follow-up review: not recommended (false).** Only one medium entry was patched, and it is a test addition.

**Verification.** All passed on the final tree:
- `npm run lint:py`, `lint:imports` (5 contracts kept), `lint`, `typecheck`, `ruff format --check`.
- `npm test`: pytest 649 passed, 10 skipped; Vitest 357 passed.
- `npm run e2e -- --project=chromium`: 78 passed.
- `npm run gen:api` gives no schema diff after the commit.

**Residual risks**
- Firefox and Edge were not run.
- A toast Undo clicked after a new run, while the toast still shows, names the move's round in its tail.
- The Undo button says "No moves to undo" while the summary loads.
- Split and restore undo are not walked in e2e.
