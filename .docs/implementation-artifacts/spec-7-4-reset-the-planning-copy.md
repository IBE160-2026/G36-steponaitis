---
title: 'Story 7.4: Reset the planning copy'
type: 'feature'
created: '2026-11-22'
baseline_revision: '9145a661f251c1113d554f753472d204324a4805'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Document LAUNCHER_ACTIONS as the launcher extension point in AGENTS.md (retro epic-6 #56, second half).
    evidence: |-
      Reset and Undo were added by appending to LAUNCHER_ACTIONS without drawer changes, but AGENTS.md does not mention the extension point; the fix edits an agent-context file and the item is owned by Justas.
    location: >-
      AGENTS.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** A planner who wants to start the rounds again must undo every move one at a time, and can never get rid of runs or restart move numbering. Rebuilding the plan would lose the best-location and keep-in-place marks (FR-35, AD-5, UX-DR38, UX-DR16, UX-DR35, UX-DR51).

**Approach:** Add a `reset` command in the `domain/history.py` slice. It deletes every step and run, sets `next_move_number` to 1, keeps all marks, and emits `plan_reset{moves_removed}`. Add **Reset…** to a new "⋯" menu in the Recommendations header and to the launcher. Both open a destructive confirm dialog with the exact UX copy, then toast the result.

## Boundaries & Constraints

**Always:**
- Command (kernel `domain/commands.py`): `Reset {type:"reset", command_id, base_version}`, added to the `Command` union. Event: `PlanReset {type:"plan_reset", moves_removed: int}`, added to the `Event` union. Dispatch it in `domain/apply.py` to `history.reset(state, command, ctx, data, analysis)`.
- `reset`:
  - The new state has `steps=[]`, `runs=[]` and `next_move_number=1`. `best_marks`, `keep_marks`, `recent_commands` and `schema_version` stay unchanged. Keeping `recent_commands` keeps idempotency working.
  - `moves_removed` is the number of **effective moves** before the reset: `len(replay(data, state.steps).moves)`. A combined move counts once, and a removed move counts zero.
  - When there are no steps, no runs and `next_move_number == 1`, the command is a no-op: `Applied(state=state)` with no events. The app then does not bump `version` (AD-6).
  - Otherwise it emits exactly `[PlanReset(moves_removed=n)]`. `revalidate` adds nothing, because there are no runs left.
  - `check_step_invariants` already allows the reset shape (`_is_reset`). Keep that, and keep the "never decreases" assertion for every other command (retro epic-4 #36).
- Summary: `PlanSummary` gains `move_count: int`, the effective moves of the replay `app/plans.summary` already does (`len(replayed.moves)`). `build_summary` takes it as a parameter. The dialog's "18" comes from this. The client never counts moves (AD-3).
- After a reset, `current_round` is 0, the next run is round 1, the next move is move 1, and the import (`ImportData`) and the analysis (classes, pick groups) are unchanged (FR-36).
- Retro items, as far as this story touches their code. Do not change `action_items` statuses in `sprint-status.yaml`.
  - epic-4 #36: add a test that reset passes `check_step_invariants`, and a test that a non-reset decrease of `next_move_number` still raises.
  - epic-5 #43: add a `reset_step(state, data, analysis)` helper in `tests/domain/answer_key.py` that goes through the existing `command(...)` (apply, then revalidate).
  - epic-6 #56: `LauncherContext` and `LauncherAction.confirm` are wide enough for Reset. Do not change the launcher drawer (`modules/launcher`).
  - epic-6 #54: all new Reset copy goes into `lib/copy`.
  - epic-5 #46: do not split `recommendations-page.tsx` further. The new menu and dialog live in a new file `modules/recommendations/reset-plan.tsx`. Keep the page diff to wiring.
  - epic-4 #31: after a reset, before/after shows "No moves yet: before and after are the same." (`has_moves` false). The e2e pins it.
- Frontend:
  - Run `npm run gen:api` and commit `schema.ts`. Export a `PlanResetEvent` type from `lib/api/plans.ts`.
  - `lib/copy` adds:
    - `RESET_ITEM = "Reset…"`, `RESET_TITLE = "Reset plan"`, `RESET_CONFIRM = "Reset plan"`, `MORE_ACTIONS = "More actions"` (the aria-label of the "⋯" button).
    - `resetQuestion(moveCount)`. For n ≠ 1 it is "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1." For n = 1 it is "Reset removes 1 move, the recommendations…". For n = 0 it is "Reset removes the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1."
    - `resetToast(movesRemoved)`: "Plan reset. 18 moves removed; marks kept. The next run is round 1.", with "1 move removed" for n = 1.
  - New `lib/commands/reset.ts`: `sendReset(send, notify)`. It sends `{type:"reset"}`. On `confirmed` it notifies `resetToast(event?.moves_removed ?? 0)`; a no-op has no event, so it gives 0. The page and the launcher share it. A reset toast never offers Undo.
  - New `modules/recommendations/reset-plan.tsx`: `ResetPlanMenu({moveCount, savingReason, onConfirm})`.
    - A radix `DropdownMenu` "⋯" trigger with `aria-label="More actions"`, styled with `menu-styles.ts`. It holds one item, **Reset…**, which is disabled while saving.
    - Choosing it opens the shared `ConfirmDialog` (`destructive`, Cancel first with default focus) with title "Reset plan", description `resetQuestion(moveCount)` and confirm "Reset plan".
    - Focus returns to the "⋯" trigger after Cancel, `Esc` or confirm (prevent the default `onCloseAutoFocus` and focus it).
  - Place it last in the Recommendations header button group. On confirm the page calls `sendReset`, then resets its selection, expanded bands and tab the same way `run()` does.
  - The launcher: append `RESET_ACTION` (id `reset`, column `recommendations`, label "Reset…", keywords `["reset plan"]`, `disabledReason: savingReason`, `confirm` with the same title, question and label and `destructive: true`). Its `run` navigates to the Recommendations step and calls `sendReset(ctx.send, ctx.notify)`.
- Every test names its FR or UX-DR (SM-7). The new e2e spec `frontend/e2e/reset.spec.ts` imports `test`/`expect` from `./support/test` and is named `uj3 resets the planning copy`.

**Never:**
- No change to undo, `revalidate`, the rules, apply, apply all, manual moves or keep. No deletion of marks.
- No DB migration: the state is JSON, and a new Literal and a new event keep old states valid.
- No client-side counting of moves or deriving of reset effects (AD-3).
- No red styling: the destructive button is the existing `destructive` variant.
- No edits under `.docs/planning-artifacts/`, `data/` or `.logs/`. No session logs, no push.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full reset | 2 runs, steps incl. a combined move and a move-back, best and keep marks | steps and runs empty, `next_move_number` 1, `current_round` 0, marks equal; `plan_reset{moves_removed = effective move count}` | — |
| Runs only | 1 run, no steps | runs gone; `plan_reset{0}`; version bumps | — |
| After undo-all | no steps, no runs, `next_move_number` 4 | `next_move_number` 1; `plan_reset{0}` | — |
| Nothing to reset | fresh state (marks may exist) | 200, no events, version unchanged | — |
| Next run/move | reset, then run, apply | run round 1, move number 1 | — |
| Import unchanged | any moves, undos, resets | `ImportData` and analysis equal to the original | — |
| Idempotent | same `command_id` twice | stored result returned, one reset | — |
| Cancel / Esc | dialog open | no command sent; focus on "⋯" | — |
| Saving | a command pending | Reset… item and launcher action disabled with the saving reason | — |

</intent-contract>

## Code Map

- `backend/swp/domain/history.py` -- the undo slice. Add `reset` here and update the module docstring.
- `backend/swp/domain/commands.py:107-130,187-240` -- `Undo`, the `Command` union, `StepUndone` and the `Event` union. Add `Reset`/`PlanReset` following the same pattern.
- `backend/swp/domain/apply.py` -- `_is_reset`, `check_step_invariants` and `_dispatch`. Add `case Reset()`.
- `backend/swp/domain/planning.py` -- `replay(...).moves` (effective moves) and `current_round`.
- `backend/swp/domain/views/summary.py` -- `PlanSummary` and `build_summary`. Add `move_count`.
- `backend/swp/app/plans.py:180-200` -- `summary()` already replays. Pass `move_count=len(replayed.moves)`. Check for other `build_summary` callers with `grep`.
- `backend/swp/app/commands.py` -- no change: a no-op (no events) skips the save, and `recent_commands` is appended after apply.
- `backend/tests/domain/answer_key.py` -- the `command`, `play_steps` and `undo_step` helpers. Add `reset_step`.
- `backend/tests/domain/test_undo.py`, `tests/app/test_undo_api.py` (`_answer_key_after_run`, `_apply_body`, `_manual_body`, `_command` and `_state` from `test_apply_command.py`) -- the patterns for the new tests.
- `backend/tests/domain/test_mark_commands.py`, `test_planning.py` -- where the existing `check_step_invariants` tests live (grep `check_step_invariants`).
- `frontend/lib/launcher/index.ts` -- `LauncherAction.confirm`, `APPLY_ALL` (the confirm pattern) and `LAUNCHER_ACTIONS`.
- `frontend/lib/commands/undo.ts` -- the pattern for `lib/commands/reset.ts`.
- `frontend/lib/copy/index.ts` -- `applyAllQuestion` (:179) and the undo copy (:271-310). Add the reset copy next to them.
- `frontend/components/common/confirm-dialog.tsx`, `menu-styles.ts`, `modules/plans/saved-plans-page.tsx:70-118,324-340` -- `RowMenu` plus `ConfirmDialog`, with focus returned in `onCloseAutoFocus`. This is the pattern to copy.
- `frontend/modules/recommendations/recommendations-page.tsx:613-634` (`run()`, which resets selection and tab), `:726-745` (header buttons), `:761` (`NO_RUN`) and the round chip (:714).
- `frontend/modules/before-after/before-after-page.tsx:19` -- `NO_MOVES`.
- `frontend/tests/` -- `launcher.test.tsx`, `copy.test.ts`, `recommendations.test.tsx` and the PlanSummary fixtures, which need `move_count`. Grep `undo_preview:` in `frontend/tests` and `frontend/e2e` to find them.
- `frontend/e2e/undo.spec.ts`, `support/{test.ts,plan-api.ts,sample-plan.ts}` -- the helpers for creating a plan, marking and running via the API.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/{commands.py,apply.py,history.py,views/summary.py}`, `backend/swp/app/plans.py` -- the command, the event, the dispatch, the slice function and `move_count`.
- `backend/tests/domain/test_reset.py` (new) -- `test_fr35_reset_keeps_marks` and one `test_fr35_*` per matrix row in the domain. Use a small fixture built with the answer-key helpers: mark, keep, run 1, apply, manual moves including a combine, run 2. The import-unchanged test compares `ImportData` and `Analysis` before and after. Also add the retro #36 invariant tests.
- `backend/tests/domain/answer_key.py` -- `reset_step`.
- `backend/tests/app/test_reset_api.py` (new):
  - POST `reset` returns 200, version +1 and `[plan_reset{moves_removed}]`.
  - The summary then has `current_round` 0, `move_count` 0, `undo_preview` null and the marks kept, and the recommendations view has no run.
  - A following `run` gives round 1, and an apply gives move 1.
  - A repeated `command_id` returns the stored result.
  - A reset of a fresh plan returns no events and the same version.
  - The summary's `move_count` equals the effective moves before the reset.
- `frontend/lib/api/schema.ts` (generated), `lib/api/plans.ts`, `lib/copy/index.ts`, `lib/commands/reset.ts` (new), `modules/recommendations/reset-plan.tsx` (new), `modules/recommendations/recommendations-page.tsx`, `lib/launcher/index.ts` -- the UI as above.
- Vitest:
  - `resetQuestion` and `resetToast` for 0, 1 and 18.
  - The menu opens the dialog with the exact text, and Cancel has focus.
  - Cancel sends nothing and focuses "⋯".
  - Confirm sends `{type:"reset"}` and toasts.
  - The launcher `RESET_ACTION` label, confirm and disabled reason, and that `run` sends `reset`.
  - Fix `PlanSummary` fixtures for `move_count`.
- `frontend/e2e/reset.spec.ts` (new), `uj3 resets the planning copy`:
  - Mark aisle A best via the API, run, and apply two recommendations via the API.
  - In the UI, open "⋯", then Reset…. The dialog reads "Reset removes all 2 moves, …", and Cancel is focused.
  - `Esc` closes it, focus is on "⋯", and nothing changes.
  - Open it again and confirm. The toast reads "Plan reset. 2 moves removed; marks kept. The next run is round 1." The round chip shows "Round 0", and the "No run yet" text shows.
  - The Before/after page shows "No moves yet: before and after are the same."
  - Best Locations still shows aisle A marked (or the summary's `best_locations` > 0 via the API).

**Acceptance Criteria:**
- Given a plan with moves and runs, when `reset` is posted to `POST /api/plans/{id}/commands`, then every step and run is gone, `next_move_number` is 1, `current_round` is 0, best and keep marks are unchanged, the import is unchanged, and the only event is `plan_reset{moves_removed}`. The next run is round 1, and the next move is move 1.
- Given the Recommendations header, when the planner opens "⋯" and chooses **Reset…**, then the confirm dialog shows the exact UX-DR38 text with the plan's move count. **Cancel** comes first and has focus, and **Reset plan** is the destructive button. Cancel or `Esc` sends nothing and returns focus to "⋯".
- Given Reset plan is confirmed, when the response arrives, then the toast reads "Plan reset. N moves removed; marks kept. The next run is round 1.", the round chip shows "Round 0", "No run yet" shows, and before/after shows "No moves yet: before and after are the same."
- Given the launcher, when it lists the Recommendations column, then **Reset…** is there, asks the same confirm, and sends `reset` only on confirm. The drawer code is unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 29 findings — high 0, medium 1, low 17, false 11, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) No test checks that a confirmed reset returns the page to the Open tab. `reset.spec.ts` now opens `?tab=applied` and asserts `?tab=open` after the confirmed reset.
  - `[low]` `[reject]` (edge) A reset sent with a stale `move_count` deletes moves the dialog never counted. `base_version` is not enforced for any command (AD-6); the stale-save warning is Epic 15 (FR-41). Not specific to reset.
  - `[low]` `[reject]` (edge) A stale Undo from before a reset could remove a new move with the same number. This needs a second tab. Every undo surface reads the current `undo_preview`, and the reset toast replaces any move toast. Same AD-6 / Epic 15 root as the row above.
  - `[low]` `[reject]` (edge) A reset from the launcher does not clear the page's selection, bands or tab. After the refetch, the page shows "No run yet" and hides the tabs unless kept parts exist. A stale chosen id only falls back. The fix would add a callback path to the launcher context (retro #56 keeps it unchanged).
  - `[false]` `[reject]` (edge) A command could start while the Reset confirm is open. The AlertDialog is modal: the page and the launcher are unreachable, and the command client serializes sends.
  - `[low]` `[reject]` (edge) A confirmed no-op reset still toasts "Plan reset. 0 moves removed". This is a deliberate choice in Design Notes: the planner gets feedback, and nothing is lost.
  - `[false]` `[reject]` (blind) The `_is_reset` exemption skips checks for a non-reset command that reaches the reset shape. No other command can produce no steps with `next_move_number` 1 from a higher number. Undo never lowers it, and the code predates this story.
  - `[low]` `[reject]` (blind) There is no stale `base_version` reset test. `base_version` is not enforced (AD-6), so such a test would pin non-behaviour. Same root as the first edge row.
  - `[low]` `[patch]` (blind) `reset()` left `failedRound` set, so an old "run failed" alert stayed next to "Round 0". `reset()` now calls `setFailedRound(null)`.
  - `[low]` `[patch]` (blind) There is no page-level test of the reset wiring. Grouped with the verification-gap row: the e2e now pins the tab reset and the focus on "⋯".
  - `[low]` `[reject]` (blind) The launcher path skips the page cleanup. Same as the third edge row.
  - `[low]` `[patch]` (blind) The launcher action order is no longer pinned. `launcher.test.tsx` now asserts the ids `run-recommendations, apply-all, undo-last-move, reset`.
  - `[low]` `[reject]` (blind) `test_fr35_reset_after_undo_all` hand-builds a state with no runs. It is the spec's matrix row. The reachable variant, with runs present, takes the same code path as "Runs only" / "Full reset", which are tested.
  - `[low]` `[reject]` (blind) The no-op dialog and toast describe nothing happening. Same as the no-op edge row (Design Notes).
  - `[low]` `[reject]` (blind) The copy tests skip thousands formatting. Both helpers use `formatNumber` (through `plural`), and counts that large are unlikely in a plan.
  - `[false]` `[reject]` (intent) "18 moves" counts effective moves. This is the spec's reading from the PRD glossary (Design Notes), and the dialog and the toast agree. It is not a defect.
  - `[low]` `[reject]` (intent) A no-op reset emits no `plan_reset`, although the AC names the event. AD-6 says a command that changes nothing returns no events and no version bump. Design Notes records this.
  - `[false]` `[reject]` (intent) The 0 and 1 wordings go beyond the AC's example. These are plural forms of the same sentence, pinned in Vitest.
  - `[low]` `[reject]` (intent) A Cancel click is tested only in Vitest. The e2e covers `Esc` and the focus return, and Cancel closes the dialog through the same `onOpenChange` path.
  - `[low]` `[reject]` (intent) There is no e2e for Reset through the launcher. The launcher's confirm flow is shared and covered by the Epic 6 e2e, and Vitest pins `RESET_ACTION`.
  - `[false]` `[reject]` (intent) The round chip, "No run yet" and before/after are asserted only through the page path. The AC names the page path.
  - `[low]` `[reject]` (intent) There is no API test that the stored import is unchanged after a real reset. Reset changes only `PlanState`, the import is a separate row, and the domain test compares `ImportData` and `Analysis`.
  - `[low]` `[reject]` (intent) `test_fr35_reset_keeps_marks` checks only the marks. The other clauses have their own named tests; this is cosmetic.
  - `[low]` `[defer]` (intent) The retro #56 half that documents `LAUNCHER_ACTIONS` in AGENTS.md is not done. The fix edits an agent-context file, and the item is owned by Justas.
  - `[false]` `[reject]` (intent) The retro #41 Apply all copy is not touched. Since Story 7.3 shipped undo, the sentence "Undo reverses them one move at a time." is true.
  - `[false]` `[reject]` (intent) #36 is satisfied only by tests. The spec asked to keep the existing exemption and pin it.
  - `[false]` `[reject]` (intent) The diff follows "respect and pin", not "close", for the retro items. The spec forbids status changes; the retro closes items.
  - `[false]` `[reject]` (intent) EXPERIENCE.md calls Reset plan "primary". The AC and the epic context say destructive, styled like primary and never red. The `destructive` variant is that style.
  - `[false]` `[reject]` (intent) Focus returns to "⋯" after a confirmed reset, which the AC does not ask for. This is extra and harmless: the dialog closes, and focus must go somewhere.

## Design Notes

**`moves_removed` counts effective moves.** The PRD glossary defines a move as a change in the planning copy, and a combined move keeps one number. So "18 moves" means the moves the planner sees in the move list, not raw steps. The summary's `move_count` and the event both use `len(replay(...).moves)`, so the dialog and the toast agree.

**A no-op reset is allowed.** AD-6 makes a command that changes nothing return 200 with no events. Reset… stays enabled, because hiding it would need extra rules (for example, numbering left at 4 after undoing every move still needs a reset). A confirmed no-op still toasts "Plan reset. 0 moves removed; …", so the planner gets feedback.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .` -- expected: all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after committing.
- `npm test` -- expected: pytest and Vitest pass.
- `npm run e2e -- --project=chromium` -- expected: all pass, including `reset.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A planner can reset the planning copy and keep every mark (FR-35, FR-36, AD-5, UX-DR38, UX-DR16).
- **The `reset` command** deletes every step and run and sets `next_move_number` to 1, so `current_round` is 0.
- **What stays:** best and keep marks, `recent_commands` and the import.
- **The event** is `plan_reset{moves_removed}`, where `moves_removed` counts effective moves.
- **Nothing to reset:** a plan with no steps, no runs and numbering at 1 gets no events and keeps its version.
- **Summary:** the plan summary gains `move_count`.
- **UI:** **Reset…** sits in a new "⋯" menu in the Recommendations header and in the launcher's Recommendations column. Both open the destructive confirm with the UX-DR38 text and then toast the result.

**Retro items.**
- Taken into account: epic-4 #36 (invariant tests), epic-5 #43 (`reset_step` through apply and revalidate), epic-6 #54 (all copy in `lib/copy`), epic-5 #46 (the new UI is its own file and the page diff is only wiring), epic-4 #31 (the e2e pins the before/after note).
- epic-6 #56: the launcher context needed no change. The AGENTS.md half is deferred.
- No action-item statuses were changed.

**Files changed**

| File | Change |
|---|---|
| `backend/swp/domain/{commands.py,apply.py,history.py}` | The command, the event, the dispatch and `history.reset`. |
| `backend/swp/domain/views/summary.py`, `backend/swp/app/plans.py` | `PlanSummary.move_count`. |
| `backend/tests/domain/test_reset.py` (new) | Domain tests. |
| `backend/tests/app/test_reset_api.py` (new) | HTTP tests. |
| `backend/tests/domain/answer_key.py` | `reset_step`. |
| `backend/tests/domain/{test_best_marks,test_mark_commands,test_plan_summary}.py` | Fixtures and union lists. |
| `frontend/lib/api/{schema.ts,plans.ts}` | The generated schema and `PlanResetEvent`. |
| `frontend/lib/copy/index.ts` | The reset copy. |
| `frontend/lib/commands/reset.ts` (new) | The shared `sendReset`. |
| `frontend/modules/recommendations/reset-plan.tsx` (new) | The "⋯" menu and the confirm dialog. |
| `frontend/modules/recommendations/recommendations-page.tsx` | Wiring and the post-reset cleanup. |
| `frontend/lib/launcher/index.ts` | `RESET_ACTION`. |
| `frontend/tests/reset-plan.test.tsx` (new) | Vitest for the menu and `sendReset`. |
| `frontend/tests/{copy,launcher,commands,plan-views,recommendations,undo-last-move}.test.ts(x)` | Vitest additions and `move_count` fixtures. |
| `frontend/e2e/reset.spec.ts` (new) | `uj3 resets the planning copy`. |

**Review findings.** 29 findings: high 0, medium 1, low 17, false 11.
- Patched: 1 medium (the e2e for the tab reset) and 3 low (`failedRound` cleared on reset, the page wiring grouped with the e2e, the launcher order pinned).
- Deferred: 1 low (document `LAUNCHER_ACTIONS` in AGENTS.md).
- Everything else was rejected. Each reason is in the Review Triage Log.

**Follow-up review: not recommended (false).** The patches were 0 high and 1 medium, so the rule's threshold (a high, or two mediums) is not met.

**Verification.** All passed on the final tree:
- `npm run lint:py`, `lint:imports`, `lint`, `typecheck`, `ruff format --check`.
- `npm test`: pytest 662 passed, 10 skipped; Vitest 373 passed.
- `npm run e2e -- --project=chromium`: 79 passed.
- `npm run gen:api`: no further change to `schema.ts`.

**Residual risks**
- Firefox and Edge were not run.
- A reset is not guarded against a stale `base_version`, like every command (AD-6; Epic 15).
- A reset from the launcher does not clear the page's local selection.
- The disabled Reset… item shows its reason as a `title`, not the `Button` tooltip.
