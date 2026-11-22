---
title: 'Story 6.4: Delete a plan'
type: 'feature'
created: '2026-11-22'
baseline_revision: '1932a4f08ae4d29ef093d1ef9815171c315453e5'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A planner cannot remove a plan, so the saved-plans list only grows (FR-12). Story 6.3 also left two points for this story: the delete must take the same import-row lock as a reuse, and the New Plan page's refetch after a reuse answered `not_found` has no test.

**Approach:** Backend: `DELETE /api/plans/{id}` (204) deletes the plan and, when it was the import's last plan, the import, in one write transaction that holds the import-row lock that `insert_plan_on_import` takes. Frontend: the saved-plans row menu gets "Delete…", which opens the shared ConfirmDialog. After a confirmed delete the list refetches and focus moves to the next row, or to New Plan when the list is empty.

## Boundaries & Constraints

**Always:**
- Store `delete_plan(plan_id) -> bool` in `backend/swp/store/plans.py`. In one `write_transaction()`:
  1. Read the plan's `import_id`. No plan means return False.
  2. Lock the import row with `select(ImportRow.id).where(...).with_for_update()`, the same lock as `insert_plan_on_import`.
  3. Delete the plan row. Zero rows means False (a concurrent delete won).
  4. Count the remaining plans on that import. At 0, delete the import row.
  An `OperationalError` that `_is_busy` matches anywhere in the transaction (lock, delete or commit) raises `PlanBusy`. Nothing is half-deleted.
- Concurrent deletes of two plans sharing one import serialize on the import lock, so the import is deleted only by the delete that removes its last plan.
- App `plans.delete(plan_id)`: False → `DomainError("plan_not_found", PLAN_NOT_FOUND)`; `PlanBusy` → `DomainError("unavailable", IMPORT_BUSY)`.
- Router: `DELETE /plans/{plan_id}` takes a string id and parses it with `parse_plan_id`, so a non-UUID is `plan_not_found`. It returns 204 with no body and declares `responses=error_responses(403, 404, 503)`. The same-origin guard already covers DELETE (`CHECKED_METHODS`).
- Epic-4 retro item 29: on Postgres, `write_transaction()` runs `SET LOCAL lock_timeout` (a module constant, e.g. `'3s'`) before it yields. A held row lock then fails with 55P03, which `_is_busy` already maps to `PlanBusy` → 503, for commands, reuse and delete alike. SQLite is unchanged.
- Run `npm run gen:api` and commit `frontend/lib/api/schema.ts`.
- Frontend `deletePlan(planId)` lives in `frontend/lib/api/plans.ts`. It sends a plain `fetch` DELETE (same origin) and resolves on 204. Any other status throws `parseErrorBody`; a network failure throws `internalError()`.
- Saved-plans page:
  - The row menu order is Open, New Plan from this import, then "Delete…". RowMenu takes an `onDelete(plan)` prop; the columns come from a builder, `planColumns(onDelete)`.
  - The menu button gets a stable id from `planActionsId(planId)`.
  - Delete… opens `ConfirmDialog` with title "Delete plan", the description `Delete “<name>”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.` (from a `deletePlanQuestion(name)` helper in `lib/copy`) and the confirm label "Delete plan". Cancel comes first and has default focus.
  - Cancel or `Esc` closes the dialog without a request, and focus returns to that row's menu button.
  - Confirm sends the delete, then awaits a refetch of `PLANS_KEY`. Focus then moves to the row that followed the deleted one in the list as it was before the delete; when the deleted row was last, the new last row; when the list is now empty, the New Plan link in the empty state. Row focus uses DataTable `focusKey`, cleared to `undefined` when a dialog opens so the same key can focus again.
  - A `plan_not_found` reply counts as already deleted: the same refetch and focus apply, with no toast.
  - Any other error shows its message as a toast, keeps the row, and returns focus to the row's menu button.
  - While a delete is in flight, a second Delete… is ignored.
- `ConfirmDialog` gains an optional `onCloseAutoFocus` prop that is passed to `AlertDialog.Content`, so the page can place focus itself. Without the prop, the behaviour is unchanged.
- A plan deleted while open in another tab: the next GET or command gets `plan_not_found`, and the existing shared hook shows "This plan was deleted." and opens `/plans`. Add no new code for this; an e2e test proves it.
- Every test names its FR/UX-DR (SM-7). New e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts` and name UJ-3 (`uj3 …`).
- Name epic-4 retro item 29 in the commit message. Do not change any `action_items` status in `sprint-status.yaml`.

**Never:**
- No archive, soft delete or undo. No DB migration and no new dependency. No change to the FK (`ON DELETE RESTRICT` stays).
- No launcher (Story 6.5). No Delete in the plan plate menu.
- No edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/` or `data/private/`. Do not write session logs or anything under `.logs/`. Do not commit or push; the orchestrator does that.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete one of two on an import | A and B share import I; A has marks, a run, moves | 204. A is gone. B (state, version, `last_edited_*`, analysis) and I are unchanged. | — |
| Delete the last plan | B is the only plan on I | 204. B and I are both gone (counts 0, 0). | — |
| Unknown id | random UUID | 404 `plan_not_found` | nothing changes |
| Bad id | `abc` | 404 `plan_not_found` | — |
| Cross-site | no same-origin header | 403 `forbidden_origin` | plan kept |
| Busy (SQLite) | another connection holds `BEGIN IMMEDIATE` | 503 `unavailable` | plan kept |
| Busy (Postgres) | another transaction holds the import row `FOR UPDATE` | 503 `unavailable` within the lock timeout | plan kept |
| Command busy (Postgres) | another transaction holds the plan row `FOR UPDATE` | the command returns 503 `unavailable` | — |
| Reuse after delete | the import's last plan is deleted, then a reuse names I | 404 `not_found` | — |
| Store race | `delete_plan` on an id deleted a moment ago | False | — |

</intent-contract>

## Code Map

- `backend/swp/store/plans.py`: `insert_plan_on_import` (:107) holds the import lock pattern. Use `_is_busy` and `PlanBusy`; `ExitStack` is already imported. Add `delete_plan`. Use `sqlalchemy.delete` and `func.count`.
- `backend/swp/store/db.py` `write_transaction`: add the Postgres `SET LOCAL lock_timeout` branch next to the SQLite `BEGIN IMMEDIATE` branch.
- `backend/swp/app/plans.py`: `PLAN_NOT_FOUND`, `IMPORT_BUSY`, `parse_plan_id` and `create_from_import` (busy mapping pattern). Add `delete(plan_id)`.
- `backend/swp/api/routers/plans.py`: add the route next to `get_plan_summary`. Use `status.HTTP_204_NO_CONTENT` and return `Response(status_code=204)` (or `None` with `response_class=Response`).
- `backend/swp/app/commands.py`: `run_command` maps `PlanBusy` to `unavailable`. Read-only; the Postgres command busy test goes through it.
- Tests:
  - `backend/tests/app/test_reuse_import.py`: helpers `_reuse`, `_row`, `_send`, and `test_fr2_reuse_import_busy_unavailable` (the SQLite busy pattern).
  - `backend/tests/app/test_create_plan.py`: `NOW`, `SAME_ORIGIN`, `_counts`, `_small_files`.
  - `backend/tests/app/test_apply_command.py` `_answer_key_after_run`: a plan with a run.
  - `backend/tests/app/conftest.py`: `empty_tables`, `--database-url`.
  - For Postgres busy tests, hold the lock on a separate `get_engine().connect()` connection with `.begin()` and `SELECT … FOR UPDATE`, skipping on SQLite.
- Frontend:
  - `frontend/modules/plans/saved-plans-page.tsx`: `RowMenu`, `COLUMNS` (becomes `planColumns`), `SavedPlansView`, `SavedPlansPage`, `EmptyPlans`/`NewPlanLink` (New Plan needs a ref or id to be focused).
  - `frontend/components/common/confirm-dialog.tsx`: currently unused anywhere. Add `onCloseAutoFocus`.
  - `frontend/components/common/data-table.tsx`: `focusKey` (:56, :166) runs once per value and resets when it is `undefined`.
  - `frontend/components/common/toast.tsx` `showToast`.
  - `frontend/lib/api/plans.ts`: `PLANS_KEY`, `getJson` (error pattern), `usePlans`.
  - `frontend/lib/api/errors.ts`: `ApiError`, `parseErrorBody`, `internalError`.
  - `frontend/lib/api/query-errors.ts`: `PLAN_DELETED`, the shared hook. Read-only.
  - `frontend/lib/copy/index.ts`: the shared strings.
- `frontend/tests/saved-plans.test.tsx` uses `COLUMNS` and `RowMenu({plan, isActive})`; update it for the builder and the new prop.
- `frontend/modules/new-plan/new-plan-page.tsx` `onError` (~:187) refetches plans on a reuse `not_found`. Read-only; the deferred test covers it.
- e2e:
  - `frontend/e2e/saved-plans.spec.ts:88` expects 2 menu items; it becomes 3.
  - `frontend/e2e/reuse-import.spec.ts`: `savedPlans(page)` listbox helper and the reuse flow.
  - `frontend/e2e/support/sample-plan.ts` `createSamplePlan`; each call makes its own import.

## Tasks & Acceptance

**Execution:**
- `backend/swp/store/db.py`: the Postgres `lock_timeout` in `write_transaction`.
- `backend/swp/store/plans.py`: `delete_plan` with the import-row lock. Update the `insert_plan_on_import` docstring: delete now takes the same lock.
- `backend/swp/app/plans.py`: `delete`.
- `backend/swp/api/routers/plans.py`: the `DELETE` route.
- `backend/tests/app/test_delete_plan.py` (new), one test per matrix row:
  - `test_fr12_delete_keeps_other_plans`
  - `test_fr12_delete_last_plan_deletes_import`
  - `test_fr12_delete_unknown_plan_not_found`
  - `test_fr12_delete_bad_id_not_found`
  - `test_nfr6_delete_cross_site_forbidden`
  - `test_fr12_delete_busy_unavailable` (SQLite)
  - `test_fr12_delete_waits_for_import_lock_postgres` (busy → 503; skip on SQLite)
  - `test_fr12_command_lock_fails_fast_postgres` (skip on SQLite)
  - `test_fr2_reuse_after_last_plan_deleted_not_found`
  - `test_fr12_store_delete_twice_false`
- `npm run gen:api` → `frontend/lib/api/schema.ts`.
- `frontend/lib/api/plans.ts`: `deletePlan`.
- `frontend/lib/copy/index.ts`: `DELETE_PLAN_ITEM` ("Delete…"), `DELETE_PLAN_TITLE` ("Delete plan"), `DELETE_PLAN_CONFIRM` ("Delete plan") and `deletePlanQuestion(name)`.
- `frontend/components/common/confirm-dialog.tsx`: `onCloseAutoFocus`.
- `frontend/modules/plans/saved-plans-page.tsx`: the menu item, the dialog, the delete flow and focus.
- `frontend/tests/saved-plans.test.tsx`: Vitest tests:
  - the menu order Open / New Plan from this import / Delete…;
  - `deletePlanQuestion`;
  - `planActionsId`;
  - a pure helper `focusAfterDelete(rows, deletedId)` that returns the next row's id, the previous row's id when the deleted row was last, or `null` when no row is left.
- `frontend/e2e/delete-plan.spec.ts` (new, UJ-3):
  1. Create plans A and B. On `/plans`, open A's row menu with the keyboard and choose Delete…. The dialog shows the exact question, and Cancel has focus. `Esc` closes it: A is still listed and A's menu button has focus.
  2. Open it again and click Cancel. Same result.
  3. Open it again and click Delete plan. A's row disappears, focus is on the row that followed A, and `GET /api/plans/{A}` is 404.
  4. Empty list: with `page.route`, `/api/plans` first returns one row, then `[]` after the routed DELETE (204). After the confirm, New Plan has focus.
  5. Another tab: open plan C's overview in a second page and delete C through the API. A navigation in that page (for example to its Parts step) shows the toast "This plan was deleted." and lands on `/plans`.
  6. Deferred from 6.3: open `/plans/new?from=<D>` (D alone on its import), delete D through the API, then submit the reuse with a name. The message "This import no longer exists. Choose another saved plan." shows, and the listbox no longer lists D (refetched).
- `frontend/e2e/saved-plans.spec.ts`: the menu item count becomes 3.

**Acceptance Criteria:**
- Given two plans on one import, when one is deleted through the saved-plans list, then its row disappears after the refetch, focus moves to the next row, and the other plan and the import are unchanged.
- Given the delete confirm, when the planner presses `Esc` or Cancel, then nothing is deleted and focus returns to the row's menu button.
- Given the last listed plan is deleted, when the response arrives, then the empty state shows and New Plan has focus.
- Given a plan open in another tab is deleted, when that tab sends a request, then it shows "This plan was deleted." and opens `/plans`.
- Given New Plan in reuse mode whose chosen plan was deleted meanwhile, when the planner submits, then the `not_found` message shows and the saved-plans list is reloaded without that plan.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 24 findings — high 0, medium 0, low 19, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` (verification-gap) The 503 `unavailable` branch of `confirmDelete` (toast, row kept, focus on the menu button) is untested. Fixed: the mocked-route e2e test "uj3 a busy delete keeps the row and returns focus to its menu button".
  - `[low]` `[patch]` (verification-gap) The `plan_not_found` "already deleted" branch is untested. Fixed: the mocked-route e2e test "uj3 a plan already deleted counts as deleted without a toast".
  - `[low]` `[patch]` (blind) The DELETE route left 422 out of `error_responses`, so OpenAPI showed FastAPI's `HTTPValidationError` for it. Fixed: 422 declared and `gen:api` re-run; `schema.ts` has no `HTTPValidationError`.
  - `[false]` `[reject]` (blind) `schema.ts` and the spec are missing from the reviewed diff. Both were left out on purpose: `schema.ts` is generated and stable on a second `gen:api` run, and the spec is the claims file.
  - `[low]` `[patch]` (blind) `SHOW lock_timeout` in the Postgres command test runs on the holder connection, so it proves nothing. Fixed: the assertion and its comment are removed.
  - `[low]` `[patch]` (blind) The `lib/api/plans.ts` header still says every function is a GET. Fixed: reworded to name `deletePlan` as the one write.
  - `[low]` `[reject]` (blind) The deleted plan's cached plan queries are not evicted. Going back to it refetches on mount (default staleTime 0), and the shared hook then redirects. A brief stale view on a rare path does not justify the extra code.
  - `[low]` `[reject]` (blind) `await closed` would block later deletes if `onCloseAutoFocus` never fired. The radix AlertDialog Action always closes the dialog, and the close always runs `onCloseAutoFocus`. The only other exit is unmounting the page, which also drops the state.
  - `[low]` `[patch]` (blind) No test covers the page's delete failure paths. Same root cause as the two verification-gap rows; fixed there.
  - `[false]` `[reject]` (blind) The Postgres `lock_timeout` affects every writer. This is intended: it closes epic-4 retro item 29 for every writer, and the `write_transaction` docstring documents it.
  - `[low]` `[reject]` (blind) No test runs a delete and a reuse truly at the same time. The Postgres test shows that delete takes the import-row lock, and the outcome follows from the lock order (Design Notes). A threaded race test adds a lot of test code for a rare case.
  - `[low]` `[reject]` (blind) A second Delete… is ignored with no feedback while a delete is in flight. The window is one request long and a disabled state adds UI state for it.
  - `[low]` `[patch]` (blind) The e2e comment claims more than it asserts. Fixed: it now reads "The other plan is still there." The `!` on the following row's id needs plan A to be the last row, which cannot happen because A is the newest plan the test creates.
  - `[false]` `[reject]` (intent) `FOR UPDATE` does nothing on SQLite. SQLite's `BEGIN IMMEDIATE` in `write_transaction` serializes all writers, which is a stronger lock than the row lock.
  - `[low]` `[reject]` (intent) No real delete-versus-reuse race test on Postgres. Duplicate of the blind row; same reason.
  - `[low]` `[patch]` (intent) The `SHOW lock_timeout` assertion proves nothing. Duplicate of the blind row; fixed there.
  - `[low]` `[reject]` (intent) The deferred 6.3 test deletes through the API, not the UI. That is the form the 6.3 deferral itself names, and the UI delete has its own e2e tests.
  - `[low]` `[patch]` (intent) The `confirmDelete` error branches are not exercised. Same root cause as the verification-gap rows; fixed there.
  - `[low]` `[reject]` (intent) The other-tab test exercises only a GET, not a command. The command client already sends `plan_not_found` to the same shared hook (`lib/commands/client.ts:208`), and that path is unchanged.
  - `[false]` `[reject]` (intent) `schema.ts` and the spec are missing from the diff. Duplicate of the blind row; same refutation.
  - `[low]` `[reject]` (edge) If the refetch after a delete fails, the stale row stays listed with no message. A refetch failing right after a successful delete is rare, and handling it adds a branch.
  - `[low]` `[reject]` (edge) `focusNewPlan` stays true and could steal focus if `EmptyPlans` remounts later. That needs the list to refill and then empty again through background refetches, which is rare. A later Delete… also resets the flag.
  - `[low]` `[reject]` (edge) If a background refetch removes the row while the confirm is open, Cancel drops focus to the body. This is a rare double-tab race, and the fix adds fallback branches.
  - `[low]` `[patch]` (edge) The `SHOW lock_timeout` check runs on the wrong connection. Duplicate of the blind row; fixed there.
  - `[low]` `[reject]` (edge) A parallel spec could change the row that follows A and make the focus assertion flaky. Only plans created between B and A could sit there, and the Chromium suite passed in full twice and 4/4 on repeat.

## Design Notes

- **Lock order.** A reuse locks the import and then inserts a plan. A delete locks the import and then deletes a plan row. A command locks only its plan row. Each path takes the import lock before any plan row, so no lock cycle can form. Taking the import lock before counting the remaining plans makes "last plan → delete the import" safe against a concurrent reuse and a concurrent delete.
- **`lock_timeout` rather than `NOWAIT`.** A short wait lets a delete queue behind a quick command instead of failing at once. A long one ends as 55P03 → 503, which the client's retry path already handles. One setting in `write_transaction` covers every writer.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .`: all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` (after staging it): no further diff.
- `npm test`: pytest and Vitest pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test` against a local `postgres:17` container: pass.
- `npm run e2e -- --project=chromium`: all pass, including `delete-plan.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A planner can delete a plan permanently from the saved-plans list after a confirm (FR-12).
- **Backend:**
  - `DELETE /api/plans/{id}` returns 204. It goes through the same-origin guard, and an unknown or non-UUID id gives `plan_not_found`.
  - The delete runs in one write transaction. It locks the import row that a reuse locks (the 6.3 deferral), deletes the plan, and deletes the import with its last plan.
  - On Postgres, `write_transaction()` sets `SET LOCAL lock_timeout = '3s'`. A held row lock then gives 503 `unavailable` for commands, reuse and delete (epic-4 retro item 29).
- **Frontend:**
  - The row menu has "Delete…", which opens the shared ConfirmDialog with the UX-DR16 copy. Cancel comes first and has focus.
  - Cancel or `Esc` returns focus to the row's menu button.
  - After a delete, the list refetches and focus moves to the next row, or to New Plan when the list is empty.
  - A `plan_not_found` reply counts as already deleted. Any other error shows a toast and keeps the row.
- **Deferred from 6.3:** an e2e test now covers New Plan reloading the saved-plans list after a reuse answered `not_found`.

**Files changed**
- `backend/swp/store/db.py`: the Postgres `lock_timeout` in `write_transaction`.
- `backend/swp/store/plans.py`: `delete_plan` with the import-row lock.
- `backend/swp/app/plans.py`: `delete`, which maps errors to `plan_not_found` or `unavailable`.
- `backend/swp/api/routers/plans.py`: the `DELETE /plans/{plan_id}` route.
- `backend/tests/app/test_delete_plan.py` (new): FR-12, FR-2 and NFR-6 tests, including SQLite and Postgres busy cases.
- `frontend/lib/api/schema.ts`: regenerated.
- `frontend/lib/api/plans.ts`: `deletePlan`.
- `frontend/lib/copy/index.ts`: the delete strings and `deletePlanQuestion`.
- `frontend/components/common/confirm-dialog.tsx`: the optional `onCloseAutoFocus`.
- `frontend/modules/plans/saved-plans-page.tsx`: the menu item, the confirm, the delete flow and focus (`planColumns`, `planActionsId`, `focusAfterDelete`).
- `frontend/tests/saved-plans.test.tsx`: unit tests.
- `frontend/e2e/delete-plan.spec.ts` (new, UJ-3, 8 tests), `frontend/e2e/saved-plans.spec.ts`: e2e tests.

**Review findings.** 24 findings: 19 low and 5 false. There are 6 patched root causes, all low:
- the untested failure branches (two new e2e tests);
- 422 in the DELETE responses;
- the misleading `SHOW lock_timeout` assertion;
- the `plans.ts` header;
- the e2e comment;
- the duplicate rows of these.

Nothing was deferred. Every rejected finding and its reason is in the Review Triage Log.

**Follow-up review recommended: false.** No high or medium findings were patched.

**Verification** (after the patches)
- `npm run lint:py`, `lint:imports`, `lint`, `typecheck` and `ruff format --check`: pass.
- `npm run gen:api`: stable on a second run.
- `npm test`: pytest 578 passed, 12 skipped. Vitest 291 passed.
- `pytest tests/app --database-url postgresql://…/swp_test` on a local `postgres:17` container: 145 passed, 3 skipped (the SQLite-only tests).
- `npm run e2e -- --project=chromium`: 65 passed.

**Residual risks**
- Firefox and Edge e2e were not run.
- No test runs a delete and a reuse truly at the same time. Correctness rests on the lock order.
- The 3 s Postgres lock timeout now applies to every writer.
- Epic-4 retro item 29 is addressed. Its status in `sprint-status.yaml` is left for the retrospective.
