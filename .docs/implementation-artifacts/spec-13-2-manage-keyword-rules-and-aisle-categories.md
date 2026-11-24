---
title: 'Story 13.2: Manage keyword rules and aisle categories'
type: 'feature'
created: '2026-11-24'
baseline_revision: 'f0b16075f3c65a434f53ca888413ab86e4cff078'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-13-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The failed-write path of the Categories tabs (503 or other error → toast, rows unchanged) has no UI-level test.
    evidence: |-
      Verification-gap review: KeywordRulesTab.run and AisleCategoriesTab.change catch errors and call showToast, but no Vitest or e2e test drives that branch; tests only show sendJson rejecting with the server message. A Playwright page.route 503 on PUT /api/keyword-rules/order or /api/aisle-categories/{aisle} in categories.spec.ts would close it.
    location: >-
      frontend/modules/categories/keyword-rules-tab.tsx, frontend/modules/categories/aisle-categories-tab.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 13.1 stores keyword rules and serves them over an API, but the planner has no screen for them, the launcher's **CAT** plate is still inert ("Coming in stage 2"), and aisles cannot be given categories at all (FR-45), so the category check (13.3) has nothing to compare against.

**Approach:** Add the global `aisle_categories` table (expand-only migration `0005`), a store repository, app service and endpoints `GET/PUT /api/aisle-categories/{aisle}` plus a plan-scoped read `GET /api/plans/{plan_id}/aisle-categories` listing the plan's import aisles with their categories. Add the Categories page (`modules/categories`, route `/plans/{id}/categories`) with tabs **Keyword rules** and **Aisle categories**, and make the CAT plate an active launcher entry that opens it.

## Boundaries & Constraints

**Always:**
- Layers and slices (AD-1, AD-9): domain logic stays in the existing pure slice `swp/domain/categories.py` (no new slice); SQLAlchemy only in `swp.store`; `swp.api` never imports `swp.store`. Frontend `modules/categories` imports no other module; copy strings go in `lib/copy` (retro items epic-6 A2, epic-10 A4: module strings live in `lib/copy`).
- Migration `0005_aisle_categories.py` (`down_revision="0004"`) is expand-only and creates only `aisle_categories` with columns `aisle` (String, not null), `category` (String, not null), composite primary key (`aisle`, `category`) — "unique together". Global: no plan id, no import id, no user column. Portable types only. Update the spine's Deferred stage 2 bullet only to say `aisle_categories (aisle, category)` now exists (Story 13.2); no other planning-artifact edit.
- Aisle matching (FR-45): an assignment is keyed by the exact Aisle text (as in the import's locations), so it applies to every plan whose import has that aisle. Category comparisons (duplicates on one aisle, "a rule gives this category") use `keyword_key`-style casefold of the stripped text: `category_key(text) = text.strip().casefold()`.
- `PUT /api/aisle-categories/{aisle}` body `{"categories": [...]}` replaces that aisle's whole list (empty list clears it). Each category is stripped; validation as `validation_failed` 422, details `[{field, message}]`, `message` = first detail: aisle path text empty after strip → field `aisle` "Enter an aisle."; aisle or a category over 64 characters "Use at most 64 characters."; unstorable text (NUL / lone surrogate, same check as 13.1 `_storable`) "Use letters, numbers and ordinary symbols only."; empty category "Enter a category."; two categories with the same `category_key` → "That category is already on this aisle." Category fields are named `categories[i]`. Any valid category text is accepted, whether or not a rule gives it (so a stale category can be kept).
- Categories of an aisle are returned sorted by `category_key`, then text. Response of `GET` and `PUT /api/aisle-categories/{aisle}`: `{aisle, categories: [{category, has_rule}]}`; `has_rule` is true when some keyword rule's category has the same `category_key`. An aisle with no rows → `{aisle, categories: []}` (200, not 404).
- `GET /api/plans/{plan_id}/aisle-categories` → `{aisles: [{aisle, categories: [{category, has_rule}]}], rule_categories: [str]}`: every distinct aisle of the plan's import in `domain.ordering.aisle_order`, and the distinct rule categories (first spelling by rule position, deduped by `category_key`) in rule order — the picker's options. Unknown/malformed plan id → `plan_not_found` 404 like other plan reads. Read-only; never writes the plan.
- Writes run in `store.db.write_transaction()`; on Postgres first `LOCK TABLE aisle_categories IN EXCLUSIVE MODE`; a held lock → 503 `unavailable` "The aisle categories are busy. Try again." (reuse `is_busy`). Routers mounted in the `guarded` list (login when auth is on; same-origin guard on PUT, AD-19); errors via `error_responses(...)`, including 422 on every route that takes a body or path.
- UI: CAT plate in the launcher band is a link (no lock icon, no "Coming in stage 2", no `aria-disabled`) to `/plans/{id}/categories`, also found by launcher search ("CAT", "Category"), listed under Actions like band entries. LBL stays inert with "Coming in stage 2".
- Categories page: title "Categories", radix Tabs "Keyword rules" / "Aisle categories", tab kept in `?tab=keywords|aisles` (default keywords). Keyword rules tab: an add form (Keyword, Category inputs, "Add rule" button) and a `DataTable` (one tab stop, ↑/↓) with columns Position (1-based, right-aligned), Keyword, Category and per-row actions Edit, Delete…, Move up, Move down (Move up disabled on the first row, Move down on the last, with reasons). Edit opens a dialog with both fields (Cancel / Save). Delete… opens `ConfirmDialog` ("Delete the rule “oil” → Oils?", confirm "Delete rule", Cancel focused). Every change is sent to the 13.1 API and the table updates only from the server's response/refetch (no optimistic update); server field errors show under the matching input; 503/other errors show a toast.
- Aisle categories tab: one row per aisle of the open plan's import; each shows its categories as chips with a "Remove <category> from aisle <aisle>" × button, a picker (select) of `rule_categories` not already on the aisle with an "Add" button; each change sends the aisle's full new list via PUT and shows after the response. A chip with `has_rule: false` shows "no keyword rule gives this category". With no rules, the picker is replaced by "Add a keyword rule first to give aisles categories."
- Tests carry IDs: backend `test_fr45_*` (aisle categories) and `test_fr43_*` (if rule-side), Vitest `it("fr43_…")` / `it("fr45_…")` / `it("ux_dr7_…")`, e2e title starting `uj8 ` naming the journey. E2E uses unique random keywords/categories (rules are global and shared across parallel tests) and asserts only its own rows.

**Never:** no category check endpoint or page (13.3), no starter seed / TOML (13.4), no change to `keyword_rules` schema or the 13.1 endpoints' contracts, no categories in plan `state` or recommendations, no optimistic UI, no LBL activation, no edits under `data/sample/`, `data/answer-key/`, `.logs/`, no planning-artifact edits beyond the spine Deferred line, no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set list | PUT `/aisle-categories/A` `{categories:[" Oils","Filters"]}`; rule oil→Oils | 200 `{aisle:"A", categories:[{Filters,false},{Oils,true}]}` | — |
| Replace | PUT A `["Filters"]` after the above | A has only Filters | — |
| Clear | PUT A `[]` | `categories: []` | — |
| Duplicate | PUT A `["Oils","oils "]` | 422 "That category is already on this aisle." field `categories[1]` | nothing written |
| Empty / long | PUT A `[""]`; `["x"*65]` | 422 "Enter a category." / "Use at most 64 characters." | nothing written |
| Unknown aisle | GET `/aisle-categories/Z9` none stored | 200 `{aisle:"Z9", categories: []}` | — |
| Global | assign A in plan 1's import; read plan 2 with aisle A | plan 2 view shows A's categories | — |
| Stale category | aisle A has "Oils"; rule giving Oils deleted | A still has Oils, `has_rule:false`, UI shows "no keyword rule gives this category" | — |
| Plan view | GET `/plans/{id}/aisle-categories` | every import aisle in `aisle_order`, `rule_categories` deduped by key in rule order | unknown id → 404 `plan_not_found` |
| Cross-site / auth | PUT with `Sec-Fetch-Site: cross-site`; GET with auth on, no session | 403 `forbidden_origin`; 401 | — |
| Reorder in UI | Move down on row 1 of 3 | PUT `/keyword-rules/order` with rows 1,2 swapped; table shows new order after response | 503 → toast, order unchanged |

</intent-contract>

## Code Map

- `backend/swp/domain/categories.py` -- 13.1 slice: `keyword_key`, `rule_errors`, `_storable`, `TEXT_MAX`, copy constants; add `category_key`, `rule_categories(rules)`, `aisle_category_errors(aisle, categories) -> list[FieldError]`.
- `backend/swp/domain/ordering.py:46` -- `aisle_order`.
- `backend/swp/store/keyword_rules.py`, `store/db.py` (`is_busy`, `write_transaction`, `transaction`) -- pattern for new `backend/swp/store/aisle_categories.py` (`list_for(aisle)`, `list_all()`, `replace(aisle, categories)` with Postgres table lock, `AisleCategoriesBusy`).
- `backend/swp/store/models.py` -- add `AisleCategoryRow`; docstring migration range → 0005.
- `backend/swp/store/migrations/versions/0004_keyword_rules.py` -- pattern for `0005_aisle_categories.py`.
- `backend/swp/app/categories.py` -- 13.1 service (`_validation_failed`, `_write`); add aisle functions here (same slice) or `app/aisle_categories.py` if the file grows past ~250 lines.
- `backend/swp/app/plans.py` (`require`, `parse_plan_id`-style helpers) and `app/locations.py` -- how a plan read gets `plan.imported.data.locations` (each `LocationData.aisle`).
- `backend/swp/api/routers/categories.py`, `api/schemas/categories.py`, `api/app.py` (`guarded` tuple) -- add the three routes and schemas.
- `backend/tests/app/test_fr43_keyword_rules_api.py`, `tests/app/conftest.py` (`empty_tables`), `tests/app/test_create_plan.py` (table-set nfr12 test), `tests/test_cli.py:19` -- patterns and table-set assertions to extend with `aisle_categories`.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md:475` -- Deferred stage 2 bullet: "`aisle_categories` follows in Story 13.2" → states it exists with (`aisle`, `category`).
- `frontend/lib/launcher/index.ts:211-217` -- `STAGE2_PLATES`, `STAGE2_TEXT`, `BAND_ENTRIES`, `launcherResults` (band entries searched under Actions); `modules/launcher/launcher.tsx:368-393` -- `Stage2Band` renders inert buttons; `PlansBand` shows how a band Link activates.
- `frontend/lib/view-state/urls.ts:206` -- `planSettingsHref` pattern for `planCategoriesHref(planId, tab?)`.
- `frontend/app/plans/[planId]/settings/page.tsx`, `modules/settings/settings-page.tsx` -- non-step plan page pattern (summary load, `PlanOpening`/`PlanLoadError`).
- `frontend/lib/api/plans.ts:356` (`deletePlan`), `lib/api/errors.ts` (`parseErrorBody`, `internalError`) -- fetch/error pattern; new `modules/categories/api.ts` holds the query hooks and writes.
- `frontend/components/common/data-table.tsx`, `confirm-dialog.tsx`, `button.tsx` (disabled reason), `input.tsx`, `toast.tsx` -- reuse; `modules/recommendations/recommendations-page.tsx:648` -- radix Tabs usage.
- `frontend/tests/launcher.test.tsx:131,319`, `e2e/launcher.spec.ts:48-55`, `e2e/user-journeys.spec.ts:1193-1205` -- assert CAT is inert; switch them to LBL and assert CAT is a link.
- `frontend/e2e/support/test.ts`, `support/sample-plan.ts`, `support/launcher.ts` -- e2e imports and plan setup.
- `package.json` `gen:api` -- regenerates `frontend/lib/api/schema.ts`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/categories.py` -- add `category_key`, `rule_categories`, `aisle_category_errors` -- FR-45 validation.
- `backend/swp/store/models.py`, `store/migrations/versions/0005_aisle_categories.py`, `store/aisle_categories.py` -- table, migration, repository with lock -- AD-9.
- `backend/swp/app/categories.py` -- `aisle_categories(aisle)`, `set_aisle_categories(aisle, categories)`, `plan_aisle_categories(plan_id)` -- FR-45.
- `backend/swp/api/schemas/categories.py`, `api/routers/categories.py`, `api/app.py` -- routes -- FR-45, AD-11, AD-19.
- `ARCHITECTURE-SPINE.md` Deferred bullet -- record `aisle_categories` exists.
- `backend/tests/domain/test_categories.py` -- `test_fr45_*` for validation and `rule_categories`.
- `backend/tests/app/test_fr45_aisle_categories_api.py` -- matrix rows, migration columns/PK, lock 503, guards; update `conftest.py`, `test_create_plan.py`, `test_cli.py`.
- `frontend/lib/api/schema.ts` -- `npm run gen:api`.
- `frontend/lib/launcher/index.ts`, `modules/launcher/launcher.tsx` -- CAT active entry (searchable), LBL inert -- UX-DR7.
- `frontend/lib/view-state/urls.ts`, `frontend/app/plans/[planId]/categories/page.tsx`, `frontend/modules/categories/{api.ts,categories-page.tsx,keyword-rules-tab.tsx,aisle-categories-tab.tsx}`, `frontend/lib/copy/index.ts` -- page, tabs, forms -- FR-43, FR-45, UX-DR16, UX-DR18.
- `frontend/tests/categories.test.tsx` (+ update `tests/launcher.test.tsx`) -- Vitest: rows render in server order, Move up/down send the right id order, disabled first/last, delete confirm with Cancel focused, field error under input, stale chip text, picker excludes assigned categories.
- `frontend/e2e/categories.spec.ts` (+ update `launcher.spec.ts`, `user-journeys.spec.ts`) -- `uj8 opens CAT and manages keyword rules and aisle categories`: open CAT from the launcher, add two rules, edit one, move one down, delete one via confirm, assign a category to an aisle, remove it, delete its rule and see "no keyword rule gives this category".

**Acceptance Criteria:**
- Given the launcher on a plan, when CAT is activated by click, Enter or search "CAT", then `/plans/{id}/categories` opens with tabs Keyword rules and Aisle categories, and CAT shows no "Coming in stage 2" or `aria-disabled` while LBL still does (UX-DR7).
- Given the Keyword rules tab, when a rule is added, edited, deleted (after the confirm dialog with Cancel focused) or moved with Move up / Move down, then the table shows position, keyword and category in the server's order only after the server confirms, and a rejected change shows the server message (FR-43, NFR-10, UX-DR16, UX-DR18).
- Given aisle categories set in one plan, when another plan with the same aisle text opens the Aisle categories tab, then it shows the same categories (FR-45).
- Given a migrated database on SQLite or Postgres 17, when `tests/app` run, then `aisle_categories` exists with exactly `aisle` and `category` and a composite primary key, and the endpoint tests pass on both.
- Given the regenerated `schema.ts`, when `npm run gen:api` runs again, then it produces no diff and `npm run typecheck` passes.

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 33 findings — high 0, medium 2, low 25, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) whole-list PUT can lose a concurrent edit to the same aisle — real but needs two planners editing one aisle at the same moment in a demo; the fix (version or delta API) adds public surface and state.
  - `[low]` `[reject]` (blind) picker compares with `toLocaleLowerCase`, server with `casefold` — differs only for characters like "ß"; the outcome is a 422 toast, and the fix needs a new per-aisle options field.
  - `[low]` `[reject]` (blind) import aisles over 64 characters can never get a category — the 64-character limit is the spec's own rule; sample aisles are one or two characters.
  - `[low]` `[patch]` (blind) aisle text in the URL path is fragile (`.`/`..`, `%2F` untested) — `%2F` part fixed with the verification-gap row below (backend test of `PUT/GET /api/aisle-categories/1%2F2`); dot-only aisles are not realistic aisle text.
  - `[low]` `[reject]` (blind) PUT body list size is unbounded — behind login and the same-origin guard; a cap adds a new validation rule for no reachable everyday harm.
  - `[low]` `[reject]` (blind) `set_aisle_categories` reads its response in a second transaction — the response then shows the latest stored state, which is what the UI refetches anyway.
  - `[low]` `[reject]` (blind) plan view reads every aisle_categories row and the tab refetches after each write — the table holds at most a few hundred rows; no measurable cost.
  - `[low]` `[patch]` (blind) focus is lost to `<body>` after a failed delete or deleting the only rule — `confirmDelete` now focuses the row's Delete… button after a failure, or the add form's Keyword input when no row is left.
  - `[low]` `[reject]` (blind) double Enter can send two writes before the re-render — needs two submits within one frame; the server rejects the duplicate with a field error.
  - `[medium]` `[patch]` (blind) the aisle tab's writes (whole list sent on add/remove, toast path) have no Vitest — same root cause as the verification-gap whole-list row; fixed there. The toast part is deferred with the 503 row.
  - `[low]` `[reject]` (blind) e2e leaves global rows behind when it fails on a reused local server — `e2e:reset-db` resets the database on every server start and CI never reuses one; the spec uses random keywords per run.
  - `[low]` `[reject]` (blind) backend tests missing for " A" aisle, malformed PUT body, import without aisles — the malformed body goes through the shared AD-11 handler covered in `tests/api`; an import always has located aisles; exact aisle matching is tested.
  - `[false]` `[reject]` (blind) docs miss the new endpoint and `api/app.py` is untouched — the categories router was already mounted in `guarded`, so no app.py change was needed; the endpoint is recorded in the spec's Design Notes.
  - `[low]` `[reject]` (edge) picker vs server casefold — same as the blind picker row.
  - `[low]` `[reject]` (edge) aisle `.` or `..` is normalized by the URL parser — not realistic Aisle text in an export.
  - `[low]` `[reject]` (edge) aisle over 64 characters — same as the blind long-aisle row.
  - `[low]` `[reject]` (edge) lost update on concurrent aisle edits — same as the blind concurrency row.
  - `[low]` `[patch]` (edge) focus lost after a failed delete or the last rule — same root cause as the blind focus row; fixed there.
  - `[low]` `[reject]` (edge) PUT list size unbounded — same as the blind size row.
  - `[false]` `[reject]` (edge) `movedIds` with index -1 sends null ids — `onMove` receives a row of the same `rules` array the index is looked up in (the memo depends on `rules`), so the index is never -1.
  - `[low]` `[reject]` (edge) picker filter is client-side against the Design Note — same as the blind picker row.
  - `[false]` `[reject]` (edge) `epic-13-context.md` edited outside scope — it is the workflow's regenerated epic context under implementation-artifacts, not a planning artifact.
  - `[medium]` `[patch]` (verification-gap) whole list sent by Add and × never asserted — added Vitest `fr45_add_and_remove_send_the_aisle_whole_list` (Belts, Oils + Filters → ["Belts","Oils","Filters"]; remove Belts → ["Oils"]); `AisleRow` and `CategoryChip` exported for it.
  - `[low]` `[defer]` (verification-gap) 503 → toast, rows unchanged has no UI test — recorded in `deferred`.
  - `[low]` `[patch]` (verification-gap) encoded `%2F` aisle path untested — `test_fr45_aisle_text_is_matched_exactly` now also PUTs and GETs `1%2F2` and checks the stored row is `1/2`.
  - `[low]` `[reject]` (verification-gap, other) picker casefold mismatch — same as the blind picker row.
  - `[false]` `[reject]` (intent) per-aisle GET is not used by the UI — it is the story's named API contract and is tested in `tests/app`; the tab's read is the plan-scoped endpoint by design.
  - `[low]` `[reject]` (intent) FR-45 cross-plan reach tested only at the API — the tab renders exactly the plan-scoped endpoint, whose cross-plan behaviour `test_fr45_categories_are_global_across_plans` pins; a second-plan e2e would add a minute for no new code path.
  - `[low]` `[reject]` (intent) "shown only after the server confirms" has no unit test — `useCategoriesWrite` awaits the write then the refetch; the e2e waits for server-rendered rows after each change.
  - `[false]` `[reject]` (intent) reorder e2e moves down in a loop rather than one swap — rules are global and shared by parallel browsers; Vitest pins the single neighbour swap.
  - `[low]` `[reject]` (intent) CAT plate name changed to "Categories" while UX-DR7 text still says inert — the AC itself makes CAT active and open the Categories page; planning artifacts are not edited by this story.
  - `[low]` `[reject]` (intent) picker semantics in the frontend — same as the blind picker row.
  - `[false]` `[reject]` (intent) open epic-6 launcher retro items not addressed — items 51 and 56 concern launcher hand-offs and LauncherContext, which this change does not touch; new strings went to `lib/copy` (item 54's rule).

## Design Notes

The plan-scoped `GET /api/plans/{plan_id}/aisle-categories` is added beside the story's per-aisle `GET/PUT` because the tab needs every aisle of the import plus the picker options in one request; the import layout (`/imports/{id}/layout`) is up to ~4 MB and per-aisle GETs would be one request per aisle. Writes still go only through the per-aisle PUT, so assignments stay global and keyed by aisle text.

`has_rule` is computed on the server (AD-3: the frontend computes nothing) so the stale marker and the picker use one casefold rule.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://...` against a local `postgres:17` container -- expected: all pass.
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after commit; `npm run typecheck`, `npm run lint`, `npm run test:web` -- expected: pass.
- `npm run trace` -- expected: OK, FR-45 listed with tests.
- `npm run e2e -- --project=chromium` -- expected: 0 failed; `npx --workspace frontend playwright test e2e/categories.spec.ts e2e/launcher.spec.ts --project=firefox --project=msedge` -- expected: pass.

## Auto Run Result

Status: done

**Summary.** Aisles can now be given categories, and the planner has a screen for both keyword rules and aisle categories. Migration `0005` creates the global `aisle_categories` table (`aisle`, `category`, composite primary key). `GET/PUT /api/aisle-categories/{aisle}` reads or replaces one aisle's whole list, keyed by the exact Aisle text so it applies to every plan with that aisle (FR-45). `GET /api/plans/{id}/aisle-categories` lists the plan's import aisles with their categories, `has_rule` per category and the rule categories for the picker. In the launcher, CAT is now an active plate (also found by search) that opens `/plans/{id}/categories`; LBL stays inert. The Categories page has two tabs. Keyword rules: an add form, a DataTable of position/keyword/category with Edit (dialog), Delete… (confirm, Cancel focused) and Move up / Move down, all through the 13.1 API and shown only after the server confirms (FR-43, NFR-10, UX-DR16, UX-DR18). Aisle categories: one row per aisle with removable chips, a picker of rule categories, and "no keyword rule gives this category" on stale ones.

**Files changed.**
- `backend/swp/domain/categories.py` -- `category_key`, `rule_categories`, `aisle_category_errors`, aisle category view models.
- `backend/swp/store/models.py`, `store/migrations/versions/0005_aisle_categories.py`, `store/aisle_categories.py` -- table, migration, repository with the Postgres table lock.
- `backend/swp/app/categories.py`, `api/routers/categories.py`, `api/schemas/categories.py` -- service and the three routes.
- `backend/tests/app/test_fr45_aisle_categories_api.py` (new), `tests/domain/test_categories.py`, `tests/app/conftest.py`, `tests/app/test_create_plan.py`, `tests/test_cli.py` -- FR-45 tests and the new table in fixtures and table-set checks.
- `.docs/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` -- Deferred stage 2 bullet: `aisle_categories` exists.
- `.docs/implementation-artifacts/epic-13-context.md` -- recompiled (spine was newer).
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/lib/launcher/index.ts`, `modules/launcher/launcher.tsx` -- CAT active and searchable, LBL inert.
- `frontend/lib/view-state/urls.ts`, `lib/copy/index.ts` -- Categories href and tab, copy.
- `frontend/app/plans/[planId]/categories/page.tsx`, `frontend/modules/categories/*` -- the page, both tabs and their API calls.
- `frontend/tests/categories.test.tsx` (new), `tests/launcher.test.tsx` -- Vitest.
- `frontend/e2e/categories.spec.ts` (new), `e2e/launcher.spec.ts`, `e2e/user-journeys.spec.ts` -- e2e.

**Review.** 33 findings: 4 entries patched (1 medium: Vitest for the whole list sent by Add and ×; 2 low: `%2F` aisle path test, focus after a failed or last delete — the low `%2F` entry also covers the blind URL row), 1 deferred (low: no UI test of the 503 → toast path), 22 rejected low (concurrent whole-list edits, picker `toLocaleLowerCase` vs `casefold`, 64-character aisle limit, `.`/`..` aisles, unbounded PUT list, second read transaction, full-table read, double submit, e2e cleanup on a reused server, extra backend cases, cross-plan e2e, unit test of server-confirmed display, CAT name and UX-DR7 text — each reason in the triage log), 6 rejected false.

**Follow-up review recommended: false** (patched: 0 high, 1 medium, 2 low; tests and a focus fix only).

**Verification.**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports`, `npm run lint`, `npm run typecheck` -- clean.
- `npm run test:py` (SQLite) -- 1106 passed, 2 skipped.
- `pytest tests/app --database-url postgresql+psycopg://...` on local `postgres:17` -- 377 passed, 3 skipped.
- `npm run test:web` -- 733 passed.
- `npm run gen:api` -- no change to `schema.ts`.
- `npm run trace` -- OK; FR-43 39 tests, FR-45 32 tests.
- `npm run e2e -- --project=chromium` -- 140 passed, 4 skipped (existing stage-2 placeholders), 0 failed.
- `npm run e2e -- e2e/categories.spec.ts e2e/launcher.spec.ts e2e/user-journeys.spec.ts --project=firefox --project=msedge` -- 36 passed, 8 skipped (same placeholders), 0 failed.

**Residual risks.** The aisle list is replaced as a whole, so two planners editing the same aisle at the same moment can overwrite each other. The picker hides assigned categories with `toLocaleLowerCase`, the server compares with `casefold` (differs only for characters like "ß"; the result is a 422 toast). Aisle text over 64 characters cannot be given categories.
