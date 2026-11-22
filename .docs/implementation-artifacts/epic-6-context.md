# Epic 6 Context: Keep, reopen and manage saved plans

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Milestone 2 turns the app from "always open the latest plan" into proper plan management. The planner gets one list of every saved plan, which becomes the start page. Any plan reopens exactly as it was left. A new plan can start from an existing plan's import, a plan can be deleted permanently after confirming, and a keyboard-first launcher (`Ctrl+K`) jumps to any step, action or saved plan. This lets the planner keep several plans side by side, come back to one later without redoing work, and try different best-location setups on the same data. Auth is still off in this epic, so `created_by` and `last_edited_by` stay `planner` until Epic 9.

## Stories

- Story 6.1: Saved-plans list as the start page
- Story 6.2: Reopen a plan exactly as it was left
- Story 6.3: Start a New Plan from an existing plan's import
- Story 6.4: Delete a plan
- Story 6.5: Launcher: jump to any step, action or saved plan

## Requirements & Constraints

- **Saved-plans list:** shows every plan with name, data-as-of date, upload date, created by/at and last edited by/at, most recently edited first, with New Plan. It is the start page: `/` opens it, and the milestone 1 redirect to the most recently edited plan goes away.
- **Last edited:** opening or viewing a plan is not a change. No GET ever writes or changes `version`, `last_edited_by` or `last_edited_at`. Only a plan-changing command moves a plan to the top of the list.
- **Reopen fidelity:** a reopened plan must have identical best-location and keep-in-place marks, steps (move numbers, rules, rounds, recommendation ids, `swap_id`), `next_move_number`, runs (id, round, time, user), recommendations including outdated ones and their causes, "no space" entries, current round, and the same undo preview. View choices live only in the browser. A printed plan stays editable, with no locking.
- **Reuse import:** the new plan shares the import but none of the chosen plan's marks, moves, runs or recommendations. It is recomputed with the *current* settings, and the chosen plan keeps its stored settings. Starting from another plan's planning copy is out of scope. With unchanged settings and marks, the new plan must give the same classes, the same pick groups and the same first-run recommendations.
- **Delete:** permanent, with no archive, and only after a confirm. Other plans, including ones that reuse the same import, stay unchanged. The import is deleted in the same transaction when its last plan is deleted.
- **Tests** name their FR (for example `test_fr8_saved_plans_sorted_by_last_edit`, `test_fr9_reopen_identical_state`, `test_fr2_reuse_import_same_results`, `test_fr12_delete_keeps_other_plans`). Reopen and persistence tests in `tests/app` also run on Postgres 17 in CI. Playwright covers the list order and open action, plus the launcher keyboard path. Use only synthetic fixtures.
- The milestone 2 gate needs the answer-key tests for FR-2, FR-9 and FR-12, among others.

## Technical Decisions

- **Wire schemas:** saved-plans rows use an API-own schema in `swp/api/schemas`. All other views and commands use the domain models. The list endpoint must never load import `data` or plan `state`. After a backend change, regenerate the OpenAPI TypeScript schema, because CI fails on a diff.
- **Plan and import rows:** a plan row holds `import_id` (FK `ON DELETE RESTRICT`), created and last-edited by/at, `version`, and JSON `analysis` and `state`. The import row is frozen and holds `uploaded_at`, `data_as_of` and the normalized data. `app.plans.create(import, settings)` is the only way to create a plan. It always recomputes analysis from `analysis.toml` and never copies another plan's `analysis` or `state`.
- **Locking:** creating a plan from an import and deleting a plan both lock the import row, so a delete cannot race a reuse.
- **Writes:** `POST /api/plans` stays multipart even when it is called with `name` + `import_id` instead of three files, and it is not idempotent. `DELETE /api/plans/{id}` is the only other write outside the command endpoint. Both go through the same-origin guard. There is no CORS.
- **Schema versions:** every JSON doc carries `schema_version`. Pure upcasters in `domain/state_migrations.py` upgrade old docs on read without writing, and the next command saves the current version. Keep one fixture per version (`tests/domain/fixtures/state_v<n>.json`), and every fixture must still open.
- **Rebuilt, not stored:** the planning copy, effective moves and current locations always come from `domain.planning.replay(import, steps)`. Reopen therefore needs only the stored state to be identical.
- **Errors:** `plan_not_found` (404) for a missing plan, and `not_found` for a deleted `import_id`. The shared client error hook handles `plan_not_found` from any request: it shows the toast "This plan was deleted." and opens `/plans`, no longer New Plan.
- **View state:** the URL is the source of truth (`/plans/{id}/{step}?aisle=&loc=&rec=&move=&part=`), built only by `frontend/lib/view-state`. The last view per plan goes in `localStorage` key `swp:plan:<id>:view` inside try/catch and is never sent to the server. If storage is blocked, the plan opens on its overview without an error.
- **Slices:** the slice is `app/plans` (list, delete, reuse) with `modules/plans` and `modules/launcher`. A frontend module imports only `components/*` and `lib/*`, never another module. The launcher only calls existing slice entry points (navigation, Run recommendations, Apply all) through a registered action list in `lib`, so later epics (Undo, Reset in Epic 7) can add actions without touching the launcher's code.
- **Dates:** instants are stored in UTC and formatted only in the frontend, in the viewer's time zone. The upload date is the local date of `uploaded_at`, and `data_as_of` is `YYYY-MM-DD`.

## UX & Interaction Patterns

- **Saved-plans list:** uses the shared DataTable. The table is a single tab stop: `↑`/`↓` move between rows, `Enter` or a click opens the plan on its last view, and `Tab` moves into the row's menu button. The row menu has Delete… and New Plan from this import. New Plan is the one primary button. Empty state: "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions." with "Demo files: data/sample/".
- **Delete confirm:** a dialog with the text "Delete “<name>”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive." **Cancel** comes first and has default focus. **Delete plan** is destructive. Cancel or `Esc` returns focus to the row's menu button. After a delete, focus moves to the next row, or to New Plan when the list is empty.
- **New Plan, reusing an import:** the option is "Or reuse the import of a saved plan" and opens a Listbox of saved plans with name and data-as-of date. The chosen import replaces the three file tiles. Success opens the overview with the toast "<name> created. Data as of <date>."
- **Plan plate menu** (click or `Enter`): up to five recent plans, "All saved plans" and "New Plan from this import". `Esc` closes it and returns focus to the plate.
- **Launcher (flow map drawer):** opens from the grid button or `Ctrl/⌘+K`, also inside text fields. It is modal, the page behind is `inert`, and focus moves to the search field "Search features, actions and plans".
  - Eight step columns: OVR, PRT, LOC, GRP, BST, REC, B/A, MOV. Each shows its state (Done / You are here / Output), live counts from the plan summary and its actions.
  - A band below holds the open plan, other saved plans, SAV/NEW/SET, the inert stage-2 plates CAT and LBL (dashed, lock icon, "Coming in stage 2", `aria-disabled`) and the Keyboard box.
  - `Tab` moves between columns and `↑`/`↓` move within one. Typing replaces the columns with one result list grouped as Steps / Actions / Saved plans, with the first match highlighted. No match shows "No feature or saved plan matches “xyz”." `Esc` returns focus to the grid button.
- **Loading:** shows "Opening <plan>…" as text, with no spinner. There are no single-character shortcuts.

## Cross-Story Dependencies

- 6.1 provides the list endpoint and the `/plans` route. 6.3 (row menu, Listbox source, plate menu), 6.4 (row menu, refetch) and 6.5 (saved plans in the launcher) all build on it.
- 6.3 and 6.4 share the import-row locking and the rule that an import lives as long as its last plan.
- 6.2 has to build a fixture state for keep-in-place marks and `swap_id` steps, because their commands only arrive in Epics 7 and 12.
- 6.5's action registry must let Epic 7 register Undo last move and Reset… without changing the launcher.
- Epic 9 later replaces the fixed `planner` user and adds the session-expired flow on top of this list.
