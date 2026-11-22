---
title: "Story 6.3: Start a New Plan from an existing plan's import"
type: 'feature'
created: '2026-11-22'
baseline_revision: 'a6792a4f725cc3c58817667cc440392b2aa88709'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The New Plan page's refetch of the saved-plans list after a reuse answered not_found is not exercised by any test.
    evidence: |-
      onError in frontend/modules/new-plan/new-plan-page.tsx calls plans.refetch() for a reuse not_found; no test mounts NewPlanPage and no UI path can delete an import until Story 6.4. Add a uj3 e2e step (delete the chosen plan, then submit the reuse) in Story 6.4.
    location: >-
      frontend/modules/new-plan/new-plan-page.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** A planner can only start a plan from three uploaded files. To try a different set of best locations on the same data they must upload again (FR-2). The New Plan page, the saved-plans row menu and the plan plate menu offer no way to reuse a saved plan's import, and the plate menu has no recent plans or "All saved plans" (UX-DR5).

**Approach:** Backend: `POST /api/plans` (still multipart) accepts `name` + `import_id` instead of the three files. A new `app.plans.create_from_import` reads the stored import, recomputes `analysis` with the current `analysis.toml`, and inserts a fresh plan while it holds a lock on the import row. Frontend: New Plan gets "Or reuse the import of a saved plan", which swaps the three file tiles for a shared Listbox of saved plans. `/plans/new?from=<planId>` opens it with that plan chosen. The saved-plans row menu gets "New Plan from this import". The plan plate menu lists up to five recent plans, "All saved plans" and "New Plan from this import".

## Boundaries & Constraints

**Always:**
- `create_from_import` never reads or copies another plan's `analysis` or `state`. The new plan has `state = PlanState.new()` (no best marks, no keep marks, no steps, no runs, round 0) and `version` 1. Its `analysis` comes from the same code path as `create` (one shared helper that takes the import data, `data_as_of` and settings: DRY), with `settings` defaulting to `load_analysis_settings()`.
- The plan row is inserted in one write transaction that first locks the import row (`write_transaction()` + `SELECT … FOR UPDATE` on `imports`, the same pattern as `plan_for_update`). If the import is gone at that point, nothing is inserted and the request fails with `not_found`. A busy lock raises `PlanBusy`, which the app maps to `unavailable` (503), as `app/commands.py` does.
- Request rules for `POST /api/plans`. The name is checked first, as today.
  - `import_id` with no files: reuse.
  - `import_id` plus any file: `validation_failed` with detail field `import_id`.
  - No `import_id`: the three files are required as before. A missing file gives `validation_failed` with one detail `{field: <role>, message: "Field required"}` per missing role. The message is the detail's message when there is one detail, else "The request is not valid.". This keeps today's envelope.
  - An `import_id` that is not a UUID, or names no import: 404 `not_found` with message "This import no longer exists. Choose another saved plan.". Nothing is created.
- `GET /api/plans` rows (`SavedPlanRow`, `PlanListItem`) gain `import_id`, read from the plan column. They still never load `data`, `analysis` or `state`.
- Run `npm run gen:api` after the backend change and commit `frontend/lib/api/schema.ts`.
- URLs are built only in `frontend/lib/view-state/urls.ts`. Add `newPlanFromHref(planId)` → `/plans/new?from=<id>` and a reader for `from`. A frontend module imports only `components/*` and `lib/*`, never another module. The shared Listbox lives in `frontend/components/common/` and follows UX-DR17: rows `h-control-md`, the selected row has `bg-selected-tint` and an ink left bar, it is one tab stop, `↑`/`↓`/`Home`/`End` move the selection, a click selects, and it uses `role="listbox"`/`option` with `aria-selected`.
- New Plan reuse mode:
  - The listbox is labelled "Saved plans". Each option shows the plan name and "Data as of YYYY-MM-DD".
  - With `?from=` naming a listed plan, the page opens in reuse mode with that plan selected.
  - A link-style button "Upload three files instead" returns to the tiles.
  - Submitting without a chosen plan shows "Choose a saved plan." and sends nothing.
  - Success invalidates `PLANS_KEY`, shows `createdToast(name, data_as_of)` ("<name> created. Data as of <date>.") and opens the overview, the same as the file path.
  - A `not_found` reply shows its message in the existing message panel and refetches the plans list.
  - No upload progress and no size pre-check apply in reuse mode.
- Plan plate menu (UX-DR5), in this order:
  - Up to five other plans from `GET /api/plans` in server order, never the open one. Each links to `planOpenHref(id)`.
  - "All saved plans" → `/plans`.
  - "New Plan from this import" → `newPlanFromHref(openPlanId)`.
  - `Esc` closes the menu and returns focus to the plate. This closes the plan-plate part of epic-1 retro item 6.
  - The toolbar supplies the list. The plate stays a presentational component.
- Saved-plans row menu: Open, then "New Plan from this import" → `newPlanFromHref(row.id)`.
- Every test names its FR/NFR/UX-DR (SM-7). New e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts`. The Playwright test names UJ-3 (`uj3 …`).
- Name epic-1 retro item 6 (plan-plate Escape) in the commit message. Do not change any `action_items` status in `sprint-status.yaml`.

**Never:**
- No delete (Story 6.4), no launcher (Story 6.5), and no starting from another plan's planning copy. No DB migration and no new dependency.
- No edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/` or `data/private/`.
- Do not write session logs (`sesjonslogg`) or anything under `.logs/`. Do not commit and do not push. The orchestrator does that.
- Do not change the file-upload path's behaviour or its error envelope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reuse | `name=B`, `import_id` of plan A (A has marks, runs, moves) | 201 `CreatedPlan` with A's `import_id`, `data_as_of`, `uploaded_at`. Import count unchanged. B's state is empty with round 0. A is unchanged (state, version, `last_edited_*`). | — |
| Same results | Unchanged settings; B gets A's best marks; run on both | Same `analysis.parts` classes and pick groups. First run gives the same recommendations in the same order. | — |
| Changed setting | `load_analysis_settings` patched before creating B | B's analysis uses the new setting; A keeps its stored settings/classes | — |
| Deleted import | `import_id` unknown (or deleted meanwhile) | 404 `not_found`; no rows added | — |
| Import removed before the insert | store insert called for an import id that no longer exists | returns false / nothing inserted; app raises `not_found` | — |
| Bad id | `import_id=abc` | 404 `not_found` | — |
| Both given | `import_id` + files | 422 `validation_failed` (field `import_id`); nothing created | — |
| Neither | name only | 422 `validation_failed`, one detail per missing role | — |
| Blank name | `name=" "`, valid `import_id` | 422 `validation_failed` field `name` | — |
| Preselected | `/plans/new?from=<A>` | reuse mode, A selected | unknown id → reuse mode, nothing selected |

</intent-contract>

## Code Map

- `backend/swp/app/plans.py`: `create` (the analysis block at :67–74 becomes the shared helper), `created`, `plan_name`, `list_saved`. Add `create_from_import(name, import_id, *, now, user=DEFAULT_USER, settings=None)` and `IMPORT_NOT_FOUND`. Map `PlanBusy` → `DomainError("unavailable", …)` as `app/commands.py:45` does.
- `backend/swp/store/plans.py`:
  - `insert_plan_with_import` stays.
  - Add `get_import(import_id) -> StoredImport | None` (upcast `data` like `_stored`).
  - Add `insert_plan_on_import(plan) -> bool`. It runs in `write_transaction()`, locks with `select(ImportRow.id).where(...).with_for_update()`, handles busy errors the same way as `plan_for_update` (`_is_busy` → `PlanBusy`), and inserts the `PlanRow`.
  - `PlanListItem` and `list_plans` gain `import_id`.
- `backend/swp/store/db.py`: `write_transaction` (BEGIN IMMEDIATE on SQLite). Read-only.
- `backend/swp/api/routers/plans.py` `create_plan`: make the three `UploadFile`s optional (`UploadFile | None = File(None)`) and add `import_id: Annotated[str | None, Form()] = None`. Branch per the request rules. Use `DomainError` for the errors, never `HTTPException`. `list_plans` copies `import_id`.
- `backend/swp/api/schemas/plans.py` `SavedPlanRow`: add `import_id: uuid.UUID`.
- `backend/swp/api/errors.py`: `not_found` is already 404. Read-only.
- Tests:
  - `backend/tests/app/test_create_plan.py`: helpers `SAME_ORIGIN`, `_multipart`, `_small_files`, `_counts`, `NOW`. `test_fr18_reopen_keeps_classes_after_settings_change` at :237 shows the monkeypatch-settings pattern.
  - `tests/app/test_import_readers._data_files("sample"|"answer-key", "csv"|"xlsx")`.
  - `backend/tests/app/test_reopen.py` and `test_apply_all_command.py`: command bodies (`set_best_mark`, `run_recommendations`) over HTTP.
  - `backend/tests/app/conftest.py`: `empty_tables` and `--database-url` (Postgres).
- Frontend:
  - `frontend/modules/new-plan/new-plan-page.tsx`, `selection.ts` (`createdToast`, `validateForm`, `errorView`, `NAME_REQUIRED`), `upload.ts` (XHR upload for files). Reuse can use a plain `fetch` POST of `FormData` (`name`, `import_id`) with `parseErrorBody`/`internalError` from `lib/api/errors`.
  - `frontend/app/plans/new/page.tsx`: wrap in `<Suspense>` if the page reads `useSearchParams` (read `frontend/AGENTS.md` and the bundled Next 16 docs).
  - `frontend/modules/plans/saved-plans-page.tsx` `RowMenu`: add the item. `frontend/e2e/saved-plans.spec.ts:88` expects exactly one menuitem, so update it to two.
  - `frontend/components/common/app-shell/plan-plate.tsx`: `PLAN_MENU` → a pure builder, e.g. `planMenuItems(planId, plans)`. `toolbar.tsx` `PlanToolbarParts` adds `usePlans()` and passes the rows and `planId`.
  - `frontend/tests/plan-views.test.tsx:248` `ux_dr5_plan_plate_menu_holds_only_new_plan`: replace it with tests of the builder.
  - `frontend/lib/api/plans.ts`: `usePlans`, `PLANS_KEY`, `SavedPlanRow`.
  - `frontend/lib/view-state/urls.ts`: `NEW_PLAN_HREF`, `SAVED_PLANS_HREF`, `planOpenHref`.
  - `frontend/components/common/menu-styles.ts`: the menu classes.
  - `frontend/components/common/data-table.tsx`: already ignores `Enter` from the menu button (`enterOpensRow`).
  - Existing inline listboxes (`recommendations-page.tsx:377`, `manual-move-dialog.tsx:195`) stay as they are.
- `frontend/e2e/support/sample-plan.ts` `createSamplePlan`, `frontend/e2e/support/test.ts` (`toasts`), `frontend/e2e/reopen-plan.spec.ts`: the patterns for a new spec.

## Tasks & Acceptance

**Execution:**
- `backend/swp/store/plans.py`: `get_import`, `insert_plan_on_import` (import row lock), and `import_id` on list rows.
- `backend/swp/app/plans.py`: a shared analysis helper, `create_from_import` and `IMPORT_NOT_FOUND`. `PlanBusy` maps to `unavailable`.
- `backend/swp/api/routers/plans.py`, `api/schemas/plans.py`: the multipart branch per the request rules, and `import_id` in `SavedPlanRow`.
- `backend/tests/app/test_reuse_import.py` (new), one test per matrix row:
  - `test_fr2_reuse_import_creates_empty_plan_on_same_import`
  - `test_fr2_reuse_import_same_results`
  - `test_fr18_reuse_import_uses_current_settings`
  - `test_fr2_reuse_deleted_import_not_found`
  - `test_fr2_insert_on_missing_import_inserts_nothing`
  - `test_fr2_reuse_bad_import_id_not_found`
  - `test_fr2_files_and_import_id_rejected`
  - `test_fr1_missing_files_validation_failed`
  - `test_fr2_reuse_blank_name_rejected`
  - `test_fr8_list_rows_carry_import_id`
- `npm run gen:api` → `frontend/lib/api/schema.ts`.
- `frontend/lib/view-state/urls.ts`: `newPlanFromHref` and a parser for the `from` param.
- `frontend/components/common/listbox.tsx` (new): the shared single-select Listbox.
- `frontend/modules/new-plan/*`, `frontend/app/plans/new/page.tsx`: reuse mode with pure helpers in `selection.ts` (e.g. `validateReuse`, `REUSE_OPTION_TEXT`, `CHOOSE_PLAN`).
- `frontend/modules/plans/saved-plans-page.tsx`: the row menu item.
- `frontend/components/common/app-shell/plan-plate.tsx`, `toolbar.tsx`: the menu builder and the recent plans.
- Vitest (`frontend/tests/new-plan-reuse.test.tsx` new, plus updates to `plan-views.test.tsx` and `saved-plans.test.tsx`):
  - URL helpers.
  - Reuse validation and the reuse `FormData`.
  - The menu builder: at most five, the open plan excluded, order kept, and the last two items.
  - Listbox markup: roles, `aria-selected`, one tab stop.
  - Row menu markup.
- `frontend/e2e/reuse-import.spec.ts` (new, UJ-3 step 7):
  - Open a plan that has a best mark. Open the plate menu with `Enter`, then `Esc`: the menu closes and the plate has focus. Open it again: a recent plan is listed, plus "All saved plans" and "New Plan from this import".
  - Choose "New Plan from this import": New Plan opens in reuse mode with the plan selected and no file tiles. Type a name, then New Plan: the toast reads "<name> created. Data as of <date>.", the overview opens, and the plate shows round 0. The new plan has no best marks (the Best locations count, or the API).
  - From `/plans`: the row menu "New Plan from this import" opens New Plan with that row's plan selected.
  - On New Plan: "Or reuse the import of a saved plan" shows the listbox, and `↓` changes the selection.
  - Update the `saved-plans.spec.ts` menu-item count.

**Acceptance Criteria:**
- Given a saved plan with marks, moves and runs, when a new plan is created from its import through the UI, then the new plan opens on its overview with the toast, uses the same import and data-as-of date, and has no marks, moves or runs (round 0). The chosen plan is unchanged.
- Given unchanged settings, when both plans get the same best marks and run once, then classes, pick groups and recommendations (same order) are identical. With a changed setting, the new plan uses it and the old plan keeps its own.
- Given an open plan, when the plate menu opens by click or `Enter`, then it lists up to five other recent plans, "All saved plans" and "New Plan from this import", and `Esc` closes it with focus back on the plate.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 37 findings — high 0, medium 1, low 30, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) Blank name plus missing files on the file path returns only the name detail, a change to the file path's envelope. Fixed: the router checks missing files before the name when there is no `import_id`, and a test pins it.
  - `[low]` `[reject]` (edge) An empty `import_id` falls through to the file path's "Field required" errors. The app never sends an empty value (submit needs a chosen listed plan), and a sentinel default adds a branch for a hand-made request only.
  - `[low]` `[reject]` (edge) A busy error raised at commit would be a 500. With SQLite `BEGIN IMMEDIATE` the write lock is taken up front, and this is the same pattern as `plan_for_update`. It is unlikely in use, and a fix means restructuring a shared pattern.
  - `[false]` `[reject]` (edge) `get_import` could hit a busy error and return 500. It is a plain read: in SQLite WAL mode and on Postgres a reader does not wait on a writer's lock.
  - `[low]` `[reject]` (edge) Submitting on `?from=` before the list has loaded says "Choose a saved plan.". The list loads within one request, and the next submit works. A guard adds a branch for a sub-second window.
  - `[low]` `[reject]` (edge) After a list load error, submit says "Choose a saved plan." under the load message. This is rare, and the page already shows the load error.
  - `[low]` `[reject]` (edge) A disabled Listbox stays focusable. It is disabled only while a request is in flight (`aria-disabled` is set), for under a second.
  - `[low]` `[patch]` (edge) The `insert_plan_on_import` docstring claims an import delete takes the lock. Fixed: reworded as a requirement on Story 6.4's delete.
  - `[false]` `[reject]` (intent) The analysis is computed before the lock instead of under it. The import never changes (AD-4), and the existence check and the insert are atomic under the lock, so the outcome the AC asks for is the same. This is recorded in Design Notes.
  - `[low]` `[patch]` (intent) The `PlanBusy` → 503 path is untested. Same root cause as the verification-gap busy row; fixed there.
  - `[low]` `[reject]` (intent) The FR-18 changed-setting test calls the app service rather than HTTP. The route calls the same `create_from_import`, and the HTTP reuse path is covered by the other tests.
  - `[low]` `[defer]` (intent) The page's stateful reuse flow, including the refetch on `not_found`, is covered only by e2e on the success path. Deferred with the verification-gap refetch row.
  - `[low]` `[reject]` (intent) No test clicks a recent plan in the plate menu. The item is a plain `Link` to `planOpenHref`, whose href is asserted, and the same link opening is covered by the saved-plans specs.
  - `[low]` `[reject]` (intent) Plain "New Plan" left the plate menu. UX-DR5's M2 menu and EXPERIENCE's navigation model list only the recent plans, "All saved plans" and "New Plan from this import". New Plan stays on the saved-plans list, and the launcher's NEW arrives in Story 6.5.
  - `[low]` `[reject]` (intent) Epic-1 item 3 (size rule) and epic-4 item 29 (Postgres fail-fast) are untouched. The story does not change the size check or the existing plan lock; the new import lock reuses the existing busy mapping. Those items stay with their own work.
  - `[false]` `[reject]` (intent) `schema.ts` is not in the reviewed diff. It was left out of the review diff on purpose as generated output; `npm run gen:api` was run and is stable.
  - `[low]` `[patch]` (verification-gap) No test for the reuse busy → 503 path. Fixed: `test_fr2_reuse_import_busy_unavailable`.
  - `[low]` `[defer]` (verification-gap) The refetch after a `not_found` reuse is untested. It cannot be reached in the UI until Story 6.4's delete exists; deferred to 6.4 (frontmatter `deferred`).
  - `[low]` `[patch]` (verification-gap) "No size pre-check in reuse mode" is untested. Fixed: an e2e step chooses files over the limit, switches to reuse and creates the plan.
  - `[low]` `[patch]` (verification-gap) Click selection in the shared Listbox is untested. Fixed: the e2e clicks an option and asserts `aria-selected`.
  - `[low]` `[reject]` (verification-gap other) The both-given test does not assert the message. The field and code are the contract the UI uses, and the message is a constant.
  - `[low]` `[patch]` (blind) A blank name with missing files changes the envelope. Same as the first edge row; patched there.
  - `[low]` `[patch]` (blind) The busy path is untested. Same as the verification-gap row; patched.
  - `[low]` `[patch]` (blind) Repeated UI strings ("New Plan from this import" twice, "Saved plans", "Loading saved plans…"). Fixed: moved to `lib/copy` and imported by every user, so the labels cannot diverge.
  - `[medium]` `[patch]` (blind) Switching between files and reuse unmounts the focused button, and keyboard focus is lost. Fixed: after a switch, focus moves to the other mode's toggle button.
  - `[low]` `[reject]` (blind) The reuse picker has no retry after a load error. This is rare, and the planner can reload or use "Upload three files instead"; a retry adds a control.
  - `[low]` `[reject]` (blind) An unknown `?from=` gives no message. The matrix row asks for reuse mode with nothing selected, and submit then says "Choose a saved plan.".
  - `[low]` `[reject]` (blind) Submit before the list loads. Duplicate of the edge row; same reason.
  - `[low]` `[reject]` (blind) Plain "New Plan" is gone from the plate menu. Duplicate of the intent row; same reason.
  - `[low]` `[reject]` (blind) Recent plans in the plate menu show only names. UX-DR5 asks for the plans; showing a date in a menu row adds layout for a rare name clash.
  - `[low]` `[reject]` (blind) The visible "Saved plans" heading is not linked with `aria-labelledby`. The listbox has the same accessible name through `aria-label`.
  - `[low]` `[reject]` (blind) No typeahead or PageUp/PageDown in the Listbox. UX-DR17 asks for ↑/↓/Home/End, and the list holds a handful of plans.
  - `[low]` `[patch]` (blind) The docstring describes a delete that does not exist yet. Same as the edge row; patched.
  - `[low]` `[reject]` (blind) An empty `import_id` falls into the upload path. Duplicate of the edge row; same reason.
  - `[false]` `[reject]` (blind) `assert upload is not None` could vanish under `-O`. Every value was checked non-None just above, so the code is correct with or without the assert.
  - `[false]` `[reject]` (blind) The OpenAPI contract and the generated types cannot be checked. `schema.ts` was regenerated and is stable on a second `gen:api` run; it was only excluded from the review diff.
  - `[false]` `[reject]` (blind) The page flow is tested in pieces, and `chosen.version` 2 is brittle. The refetch part is deferred above. A fresh plan plus one command is always version 2, by the AD-6 rule that each change bumps the version once.

## Design Notes

- **`?from=<planId>`, not `?import=`.** The listbox lists plans, and two plans may share one import. The page selects the option by plan id and sends that row's `import_id`, which is why `SavedPlanRow` gains `import_id`.
- **Compute outside the lock.** The import never changes (AD-4). The analysis is computed first, from a plain read. Only the insert runs under the import row lock, which re-checks that the import still exists. Story 6.4's delete takes the same lock, so a delete cannot race a reuse, and the lock is held only for the insert.
- **The missing-file envelope.** Optional `File(None)` parameters stop FastAPI from reporting missing files. The router rebuilds the same `validation_failed` details by hand, so the file path's errors stay as they were.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .`: expected all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` (after staging the regenerated file): expected no further diff.
- `npm test`: expected pytest and Vitest pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test` against a local `postgres:17` container: expected pass.
- `npm run e2e -- --project=chromium`: expected all pass, including `reuse-import.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A new plan can start from a saved plan's import (FR-2).
- **Backend:**
  - `POST /api/plans` stays multipart and accepts `name` + `import_id` instead of the three files.
  - `app.plans.create_from_import` reads the stored import and recomputes `analysis` with the current `analysis.toml`, through the same helper `create` uses. It inserts an empty plan (round 0, version 1) while it holds a `FOR UPDATE` lock on the import row.
  - If the import is gone, the reply is `not_found` and nothing is created. A busy lock gives `unavailable` (503). Files plus `import_id` gives `validation_failed`.
  - The file path's missing-file envelope is unchanged.
  - Saved-plans rows carry `import_id`.
- **Frontend:**
  - New Plan has "Or reuse the import of a saved plan", which swaps the tiles for a new shared Listbox (UX-DR17). `?from=<planId>` preselects a plan.
  - The saved-plans row menu has "New Plan from this import".
  - The plan plate menu lists up to five other recent plans, "All saved plans" and "New Plan from this import". `Esc` returns focus to the plate (epic-1 retro item 6, plate part).

**Files changed**
- `backend/swp/store/plans.py`: `get_import`, `insert_plan_on_import` (import-row lock), the shared `_plan_row`, and `import_id` on list rows.
- `backend/swp/app/plans.py`: `_analysis` and `_new_plan` helpers, `create_from_import`, `parse_import_id`, and the busy → `unavailable` mapping.
- `backend/swp/api/routers/plans.py`, `api/schemas/plans.py`: the reuse branch, the hand-built missing-file errors, and `SavedPlanRow.import_id`.
- `backend/tests/app/test_reuse_import.py` (new), `test_plan_summary.py`: FR-2, FR-18 and FR-8 tests, including busy and missing-file cases.
- `frontend/lib/api/schema.ts`: regenerated.
- `frontend/lib/view-state/urls.ts`: `newPlanFromHref`, `parseNewPlanFrom`.
- `frontend/lib/copy/index.ts`: the shared saved-plans strings.
- `frontend/components/common/listbox.tsx` (new): the shared single-select Listbox.
- `frontend/modules/new-plan/*`, `frontend/app/plans/new/page.tsx`: reuse mode, `reusePlan`, focus after a mode switch.
- `frontend/modules/plans/saved-plans-page.tsx`: the row menu item.
- `frontend/components/common/app-shell/plan-plate.tsx`, `toolbar.tsx`: `planMenuItems` and the recent plans.
- `frontend/tests/new-plan-reuse.test.tsx` (new), `plan-views.test.tsx`, `saved-plans.test.tsx`, `commands.test.tsx`: unit tests.
- `frontend/e2e/reuse-import.spec.ts` (new, UJ-3), `saved-plans.spec.ts`, `plan-overview.spec.ts`: e2e tests.

**Review findings.** 37 findings: 1 medium, 30 low and 6 false.
- **Patched:** 1 medium (focus lost on a mode switch) and 5 low root causes:
  - the file-path envelope order;
  - the docstring;
  - the busy-path test;
  - the click-select and no-size-check e2e steps;
  - the duplicated strings.
- **Deferred:** 1 low. The refetch after a reuse `not_found` is untested until Story 6.4 adds delete.
- **Rejected:** every remaining finding, with its reason in the Review Triage Log above.

**Follow-up review recommended: false.** One medium entry was patched, and no high.

**Verification** (after the patches)
- `npm run lint:py`, `lint:imports`, `lint`, `typecheck` and `ruff format --check`: pass.
- `npm run gen:api`: stable on a second run.
- `npm test`: pytest 569 passed, 10 skipped. Vitest 287 passed.
- `pytest tests/app --database-url postgresql://…/swp_test` on a local `postgres:17` container: 135 passed, 2 skipped. The skips are the SQLite-only busy tests.
- `npm run e2e -- --project=chromium`: 59 passed.

**Residual risks**
- Firefox and Edge e2e were not run.
- The reuse busy path is tested on SQLite only. Postgres uses the same `_is_busy` mapping as commands, without nowait (epic-4 retro item 29 is still open).
- Plain "New Plan" left the plate menu, following UX-DR5's M2 list. New Plan stays on the saved-plans list.
- Story 6.4's delete must take the same import-row lock.
