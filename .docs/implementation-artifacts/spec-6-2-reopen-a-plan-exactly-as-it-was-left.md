---
title: 'Story 6.2: Reopen a plan exactly as it was left'
type: 'feature'
created: '2026-11-22'
baseline_revision: '452d798ebe28df89f00e4b1849e6f76b20037544'
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

**Problem:** A saved plan must reopen exactly as it was left (FR-9, NFR-12, AD-4, AD-5, AD-20). Nothing proves today that the stored state and everything built from it survive a backend restart. The plan summary has no `undo_preview`. Each `state_v<n>` fixture is not checked to open. The saved-plans list always opens the overview instead of the planner's last view.

**Approach:** Backend: add a pure `undo_preview` to the plan summary, built inside the single replay. Add a v2 state fixture and a check that every fixture opens. Add `test_fr9_reopen_identical_state`, which stores a rich plan, restarts the engine and app, and compares the state and every view. Also close epic-1 retro item 4: a non-UUID id on `GET /api/plans/{id}` gives `plan_not_found`. Frontend: add a bare route `/plans/<id>` that `lib/view-state` fills from `localStorage` key `swp:plan:<id>:view`. The app shell records the last flow step and its query there. `planOpenHref` returns the bare URL.

## Boundaries & Constraints

**Always:**
- No GET writes. `version`, `last_edited_by` and `last_edited_at` never change on a read. Upcasting happens on read without writing, and the next command saves `schema_version` = current (2).
- `undo_preview` is `null` with no steps. Otherwise it is `{move_number, part, from_location, to_location, effect: {kind, move_number}}`, built from the LAST step. `move_number`, `part`, `from_location` and `to_location` are that step's. `kind` comes from how `_fold_move` folded that step:
  - `reverts_move`: the step was appended as its own effective move, and `effect.move_number` = the step's number.
  - `splits_combined_move`: the step combined into effective move *n*, and `effect.move_number` = *n*.
  - `restores_removed_move`: the step removed effective move *n*, and `effect.move_number` = *n*.
- `undo_preview` is computed in the same replay the summary already does (one replay per request, AD-3). `StepFold`/`Replay` records the fold outcome of the last step. No second replay.
- View state: the URL is the source of truth. `lib/view-state` alone builds and reads URLs and the stored view. The stored value is JSON `{step, query}`. `step` is a `FLOW_STEPS` key, and `query` holds only the view keys `aisle`, `loc`, `part`, `tab`, `rec`, `move`. Every read and write goes through the existing try/catch helpers in `lib/view-state/storage.ts`. An invalid or unknown stored value is ignored. It is never sent to the server.
- Only flow-step paths `/plans/<id>/<step>` are recorded. `/plans/<id>/settings`, `/plans`, `/plans/new` and the bare route are not.
- Every new test names its FR/NFR/AD (SM-7). The Playwright spec names UJ-3 (`uj3 …`) and imports `test`/`expect` from `frontend/e2e/support/test.ts`. Run the OpenAPI codegen (`npm run gen:api`) after the backend change.
- Name epic-1 retro item 4 in the commit message. Do not change any `action_items` status in `sprint-status.yaml`.

**Never:**
- No undo command, Undo button, launcher, delete or reuse-import UI (Epic 7, Stories 6.3–6.5). No print view (Epic 8). No locking of any kind.
- No DB migration, no new dependency, and no stored server-side view state. No edits under `.docs/planning-artifacts/`, `data/sample/` or `data/answer-key/`.
- Do not add a `state` schema version. The v2 fixture is the current version as stored.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reopen | Rich plan stored, engine disposed, caches cleared, new app | Same `state` (marks, keep marks, steps incl. `swap_id`, `next_move_number`, runs with id/round/created_at/created_by, recs with status+cause, no-space), same summary (incl. `current_round`, `undo_preview`), locations, parts, before-after and recommendations bodies | — |
| No steps | New plan | `undo_preview: null` | — |
| Old state | Row `state` = v1 doc | GET works, row still v1; after a command the row's `schema_version` is 2 | — |
| Bare URL, stored view | `swp:plan:<id>:view` = `{"step":"locations","query":{"aisle":"B","part":"X"}}` | `/plans/<id>` replaces to `/plans/<id>/locations?aisle=B&part=X` | — |
| Bare URL, nothing stored or invalid JSON or unknown step | — | replaces to `/plans/<id>/overview` | no error |
| Storage blocked | `localStorage` throws | opens overview; nothing breaks | try/catch |
| Non-UUID id | `GET /api/plans/abc` | 404 `plan_not_found` (retro item 4) | shared hook toasts and opens `/plans` |
| After reopen | Command on reopened plan | accepted, version + 1 (no lock) | — |

</intent-contract>

## Code Map

- `backend/swp/domain/planning.py:139` `_fold_move`: three outcomes (append, combine into `moves[latest]`, `del moves[latest]`). Make it return the outcome. `StepFold.add` at :228 keeps the last one. `Replay` at :95 gains the last step's preview data. `planning_copy` at :264 returns only the copy.
- `backend/swp/domain/views/summary.py`: `PlanSummary` and `build_summary`. Add an `UndoPreview` model and an `undo_preview` field.
- `backend/swp/app/plans.py:121` `summary`: currently calls `planning_copy(...)`. Switch it to one `replay(...)` and pass both the copy and the preview.
- `backend/swp/api/routers/plans.py:65` `get_plan_summary(plan_id: uuid.UUID)`: for retro item 4, accept `str`, parse it, and raise `DomainError("plan_not_found", PLAN_NOT_FOUND)` on a bad id. See `app/plans.py:113` `require` and `swp/domain/errors.py`. Keep the OpenAPI path param a string.
- `backend/swp/domain/state.py`, `state_migrations.py`: state v2 model and upcasters. Read-only.
- `backend/swp/store/plans.py`: `_stored`/`get_plan`/`plan_for_update` upcast on read. `save_state` dumps the current version. Read-only unless a test proves otherwise.
- `backend/tests/domain/test_plan_state.py`, `fixtures/state_v1*.json`: add `fixtures/state_v2.json` (a non-trivial v2 doc: marks, keep mark, a run with an outdated rec and a no-space entry, steps with a `swap_id`) and a parametrized test over `fixtures/state_v*.json`.
- `backend/tests/app/conftest.py` (`empty_tables`, `--database-url`), `tests/conftest.py:_clear_caches`: a "restart" is `get_engine().dispose()` + `_clear_caches()` + a new `create_app()`.
- `backend/tests/app/test_plan_summary.py`: helpers `_create`, `_row`, `NOW`. `test_fr9_bad_id_validation_failed` at :148 must change to expect 404 `plan_not_found`.
- `backend/tests/app/test_create_plan.py` (`SAME_ORIGIN`, `_multipart`, `_small_files`), `test_import_readers._data_files`, and `test_apply_command.py`/`test_apply_all_command.py`/`test_manual_move_api.py`: command bodies for `set_best_mark`, `run_recommendations`, `apply_recommendation` and `manual_move`.
- `backend/tests/domain/test_planning.py`/`test_replay.py`: domain replay tests, where the `undo_preview` unit tests go.
- `frontend/lib/view-state/urls.ts`: `planOpenHref` (now the bare `/plans/<id>`), `planStepHref`, `parsePlanPath`, `LocationParams`. `storage.ts`: `readStored`/`writeStored`.
- `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx`: the root-layout shell, the place to mount a client recorder. It uses `useSearchParams`, so wrap it in `<Suspense>` (read `frontend/AGENTS.md` and the bundled Next 16 docs).
- `frontend/app/plans/[planId]/overview/page.tsx`: thin route pattern. The new `frontend/app/plans/[planId]/page.tsx` is the bare route. `[step]/page.tsx` stays the catch-all for unbuilt steps.
- `frontend/modules/plans/saved-plans-page.tsx`: already uses `planOpenHref`, so no change is expected.
- `frontend/lib/api/schema.ts`: generated by `npm run gen:api`.
- `frontend/tests/saved-plans.test.tsx`: asserts `planOpenHref`, so update it. `frontend/e2e/saved-plans.spec.ts`, `plan-overview.spec.ts`: they expect the list to open `/overview`, so update them to the new behaviour (an empty storage still ends on overview).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py`: fold outcome per step, and `Replay.undo` (or similarly named) = the last step's preview data. Covers AD-5.
- `backend/swp/domain/views/summary.py`, `backend/swp/app/plans.py`: `undo_preview` in the summary, built from one replay.
- `backend/swp/api/routers/plans.py`: non-UUID id → `plan_not_found` (retro item 4).
- `backend/tests/domain/test_replay.py` (or `test_plan_summary.py`): `test_ad5_undo_preview_*`, one test per kind plus null.
- `backend/tests/domain/fixtures/state_v2.json` + `test_plan_state.py`: `test_nfr12_every_state_fixture_opens` (glob, upcast, validate, round-trip).
- `backend/tests/app/test_reopen.py` (new):
  - `test_fr9_reopen_identical_state`. Build the plan from sample files through the API: best marks, run, apply, a manual move of an open rec's part (→ outdated), a second run, and a combined move. Then write `keep_marks` and two `swap_id` steps into the row's `state` directly (they must replay, and set `next_move_number`). Capture the state plus every GET view, restart, and assert equality. Also assert the row's `version`/`last_edited_*` are unchanged by the GETs.
  - `test_nfr12_old_state_upcast_on_read_saved_current_on_command`.
  - `test_fr9_reopened_plan_stays_editable`.
  - Update `test_fr9_bad_id_validation_failed` → `test_fr9_bad_id_plan_not_found`.
- `frontend/lib/view-state/urls.ts`, `storage.ts`: `planViewKey(id)`, `rememberPlanView(pathname, search)`, `storedPlanViewHref(id)` (→ step href or overview). `planOpenHref` → `/plans/<id>`.
- `frontend/components/common/app-shell/*` (new small client component, e.g. `remember-plan-view.tsx`, mounted in Suspense): writes on every flow-step URL change. Covers AD-20.
- `frontend/app/plans/[planId]/page.tsx`: client bare route. Shows the text "Opening plan…" and `router.replace(storedPlanViewHref(id))` in an effect.
- `npm run gen:api` → `frontend/lib/api/schema.ts`.
- `frontend/tests/view-state.test.ts` (new): key, round-trip, filtering of disallowed keys and unknown steps, invalid JSON, a throwing `localStorage`, and settings not recorded. Update `saved-plans.test.tsx`.
- `frontend/e2e/reopen-plan.spec.ts` (new, UJ-3):
  - Open the plan, go to Locations with an aisle and an open part, go to `/plans`, and open the row. The URL and the visible aisle and part panel are restored.
  - Switch to the Recommendations tab Outdated, reopen, and the tab is restored.
  - With `localStorage` blocked through `addInitScript`, opening the plan lands on Overview with no error.
  - A command after reopening succeeds.
  - Adjust `saved-plans.spec.ts` and `plan-overview.spec.ts` URL expectations.

**Acceptance Criteria:**
- Given the rich plan, when it is restarted and read again, then the state, the derived round and every view (planning copy via locations/parts, effective moves via before-after, recommendations, summary incl. `undo_preview`) are identical, on SQLite locally and on Postgres 17 (`--database-url`).
- Given a stored v1 state, when it is read, then it upcasts without a write, and the next command saves v2. Every `state_v<n>.json` fixture opens.
- Given a planner's last flow-step URL, when they open the plan from the saved-plans list, then that step and its query values are restored. With storage blocked, the overview opens without an error.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 24 findings — high 0, medium 0, low 15, false 9, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) Retro item 4 is fixed only on `GET /api/plans/{id}`; other plan routes still return 422 for a non-UUID id. The item names only that route. In the UI, every plan path loads the summary through the toolbar, so `/plans/abc/<step>` already ends in the `plan_not_found` toast and `/plans`. Changing nine routes plus their pinned 422 tests is wider than the item.
  - `[low]` `[reject]` (blind) Stored last view is written for unknown/deleted ids and never cleaned up. Growth is one small key per mistyped or deleted plan, and the page works anyway. Clearing keys belongs with Story 6.4 delete, and adding it here adds branches to the shared error hook.
  - `[low]` `[reject]` (blind) Restored `rec`/`move`/`part` values may point at stale state. Plan URLs are already shareable with any query value, and the views handle unknown values the same way for a typed or bookmarked URL. No new failure path is added.
  - `[low]` `[reject]` (blind) `rec`/`move` have no consumers and `planStepHref` was widened to `ViewQuery`. AD-20 lists `rec` and `move` as view keys. Per-step query types would add surface for no current caller.
  - `[false]` `[reject]` (blind) `undo_preview` should describe both halves of a swap. Story 7.3's AC says steps that share a `swap_id` "are undone one at a time, latest first, like any other moves", so `reverts_move` of the last half is correct.
  - `[low]` `[reject]` (blind) Bare route and recorder lack unit tests and a Back-history check. Both are exercised end to end in `reopen-plan.spec.ts` (restore, tab, blocked storage). The history check is cosmetic.
  - `[low]` `[reject]` (blind) `test_reopen.py` imports private helpers from other test modules. This is the existing pattern (`test_plan_summary.py` imports from `test_create_plan.py`), and merging test helpers is tracked by epic-5 retro item 46.
  - `[low]` `[patch]` (blind) `state_v2.json` said recommendation 3 was `filled` by move 3, but step 3 is a swap half of another part. Fixed: `move_number` is now `null`.
  - `[low]` `[reject]` (blind) `test_fr9_reopen_identical_state` compares before-after twice and checks effective moves weakly. The redundancy is harmless. Equality before and after is what FR-9 asks for, and the state equality plus a deterministic replay cover the moves.
  - `[low]` `[reject]` (edge) Non-UUID route ids on other plan routes. Duplicate of the first blind row; same reason.
  - `[low]` `[reject]` (edge) Non-canonical UUID forms (braces, `urn:`, upper case) alias the same plan. FastAPI's `uuid.UUID` parsing accepted the same forms before this change, and the app only ever links canonical ids.
  - `[false]` `[reject]` (edge) Swap undo preview. Duplicate of the blind swap row; same refutation.
  - `[low]` `[reject]` (edge) Orphan stored-view keys. Duplicate of the blind row; same reason.
  - `[low]` `[reject]` (edge) `useParams` may return an encoded id. Plan ids are UUIDs, which never need encoding.
  - `[low]` `[reject]` (edge) Stale `rec`/`move` in the stored query. Duplicate of the blind row; same reason.
  - `[false]` `[reject]` (edge) Part codes with `?`/`#`/`%` break test URLs. The test takes part codes from the sample data, which are plain digits, so the bad URL never occurs.
  - `[low]` `[reject]` (verification-gap other) Malformed id gets 422 on other endpoints. Duplicate of the first blind row; same reason.
  - `[false]` `[reject]` (intent) `undo_preview` uses `from_location`/`to_location` and an `effect` object instead of AD-5's `from`/`to`/`reverts_move(n)`. AD-5's notation is shorthand. The wire names match `Step` and every other view, the shape carries the same data, and the spec's Design Notes record it.
  - `[false]` `[reject]` (intent) Effective moves are compared only indirectly. They are not stored (AD-5): `replay` is deterministic over the identical stored steps, and the before-after view built from them is compared before and after the restart.
  - `[low]` `[reject]` (intent) The restart is in-process. AD-3 forbids any cross-request cache, so a disposed engine plus cleared caches leaves nothing in memory. A process restart adds a harness for no new coverage.
  - `[false]` `[reject]` (intent) A bare step URL (`/plans/<id>/locations`) is not filled. The AC is about opening "from the saved-plans list with a bare URL", and the list links to `/plans/<id>`. Filling step URLs would override an explicit URL, against "the URL is the source of truth".
  - `[low]` `[reject]` (intent) No test asserts that nothing is sent to the server. This holds by construction: the code only reads and writes `localStorage`, and no request carries it.
  - `[false]` `[reject]` (intent) AC5 "printed" is not exercised. Printing arrives in Epic 8. "No locking" is asserted by commands on a reopened plan (API and e2e).
  - `[false]` `[reject]` (intent) Retro item 4 changes malformed-URL behaviour. That is the item's purpose, taken in under the intent's retro clause.

## Design Notes

- **`undo_preview` now, not in 7.3.** The 6.2 AC compares the summary's `undo_preview` before and after a restart, so it must exist. Its shape is AD-5's. `effect` is an object `{kind, move_number}`, and the step's own move is the top-level `move_number`. With that, 7.3's wordings follow from it alone. Examples: "Undo move 3: P A → B" uses top-level fields. "Undo splits move 3: P returns to <from_location>" uses `effect.move_number` and `from_location`. "Undo restores move 4: P <to_location> → <from_location>" uses `effect.move_number`.
- **Bare route over rewriting links.** "Open with a bare URL" means `/plans/<id>`. The server cannot see `localStorage`, so a small client route replaces itself with the stored view. Back skips it because it uses `replace`.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .`: expected all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` after committing the regenerated file: expected no diff.
- `npm test`: expected pytest and Vitest pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test` against a local `postgres:17` container: expected pass.
- `npm run e2e -- --project=chromium`: expected all pass, including `reopen-plan.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A saved plan now reopens exactly as it was left.
- **Backend:**
  - The plan summary has `undo_preview` (AD-5), built inside the summary's single replay from how the fold took the last step (`reverts_move`, `splits_combined_move` or `restores_removed_move`).
  - `test_fr9_reopen_identical_state` stores a rich plan (two kinds of best mark, a keep mark, two runs, applied and outdated recommendations, "no space" entries, manual and combined moves, a `swap_id` pair), restarts the engine and app, and finds the stored state, the row metadata and every GET view identical.
  - A v1 state upcasts on read without a write, and the next command saves v2.
  - Every `state_v<n>.json` fixture opens; `state_v2.json` is new.
  - A reopened plan stays editable.
  - Epic-1 retro item 4: a non-UUID id on `GET /api/plans/{id}` is now 404 `plan_not_found`.
- **Frontend:**
  - The app shell records the last flow-step view per plan in `localStorage` (`swp:plan:<id>:view`, `{step, query}`).
  - The saved-plans list opens the bare `/plans/<id>`, which replaces itself with that view, or with the overview when nothing is stored or storage is blocked.

**Files changed**
- `backend/swp/domain/planning.py`: `StepOutcome`/`UndoKind`; the fold returns the outcome; `Replay.last`.
- `backend/swp/domain/views/summary.py`: `UndoEffect`, `UndoPreview`, `undo_preview()`, and the summary field.
- `backend/swp/app/plans.py`: one replay for the summary; `parse_plan_id`.
- `backend/swp/api/routers/plans.py`: the summary route takes a string id (retro item 4).
- `backend/tests/app/test_reopen.py` (new), `test_plan_summary.py`: reopen, upcast-then-save, editable, and bad-id tests.
- `backend/tests/domain/fixtures/state_v2.json` (new), `test_plan_state.py`, `test_replay.py`, `test_plan_summary.py`, `test_best_marks.py`: fixture and `undo_preview` tests.
- `frontend/lib/view-state/urls.ts`, `storage.ts`: `planViewKey`, `VIEW_QUERY_KEYS`, `rememberPlanView`, `storedPlanViewHref`; `planOpenHref` is now bare.
- `frontend/components/common/app-shell/remember-plan-view.tsx` (new), `index.tsx`: the recorder, in Suspense.
- `frontend/app/plans/[planId]/page.tsx` (new): the bare route.
- `frontend/lib/api/schema.ts`: regenerated.
- `frontend/tests/view-state.test.ts` (new), `saved-plans.test.tsx`, `commands.test.tsx`, `plan-views.test.tsx`: unit tests.
- `frontend/e2e/reopen-plan.spec.ts` (new, UJ-3), `saved-plans.spec.ts`, `plan-overview.spec.ts`: e2e tests.

**Review findings.** 24 findings: 15 low and 9 false.
- **Patched:** 1 low, the inconsistent `filled` cause in `state_v2.json`.
- **Deferred:** none.
- **Rejected:** 14 low and 9 false. Each reason is in the Review Triage Log above.

**Follow-up review recommended: false.** Only one low entry was patched.

**Verification** (after the patch)
- `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck` and `ruff format --check`: pass.
- `npm run gen:api`: `schema.ts` is unchanged after a second run.
- `npm test`: pytest 558 passed, 10 skipped. Vitest 274 passed.
- `pytest tests/app --database-url postgresql://…/swp_test` against a local `postgres:17` container: 125 passed, 1 skipped.
- `npm run e2e -- --project=chromium`: 56 passed.

**Residual risks**
- Firefox and Edge e2e were not run.
- Other plan routes still answer 422 for a non-UUID id. In the UI the toolbar's summary request redirects first.
- Stored-view keys for deleted plans are not cleared. Story 6.4 (delete) is the natural place to do it.
- `undo_preview`'s wire shape (`from_location`/`to_location`, `effect: {kind, move_number}`) is fixed here, so Story 7.3 builds its wording on it.
