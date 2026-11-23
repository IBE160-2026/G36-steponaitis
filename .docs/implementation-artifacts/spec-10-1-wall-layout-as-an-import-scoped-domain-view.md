---
title: 'Story 10.1: Wall layout as an import-scoped domain view'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'ff6987a2be7e254edb59f4613411337714219542'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-10-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The wall (Epic 10) needs every location of an import placed on its aisle wall as it sits on the shelf, and the frontend must never parse codes or derive cells (AD-15, FR-42). No layout view or `GET /api/imports/{import_id}/layout` exists yet, and the client has no import-scoped, never-refetched query for it (AD-3).

**Approach:** A new pure domain slice `swp/domain/layout.py` builds, per aisle, flat logical cells `(run, row, column, gap, location: LocationRef | None)` from the Section/Position columns, else the code pattern, else one run per level in Walk Path order; an app service and router serve it per stored import with an immutable `Cache-Control`; `frontend/lib/api/imports.ts` exposes it under `['import', importId, 'layout']` with `staleTime`/`gcTime` `Infinity`.

## Boundaries & Constraints

**Always:**
- Layout source is decided **per aisle**: `columns` when every location of the aisle has `section` and `position` and no two share (section, level, position); else `code` when every code splits on `-` into exactly 4 non-empty parts, part 0 equals the Aisle value, and (part 1, Level, part 3) is unique in the aisle (section = part 1, position = part 3; level always from the Level column); else `walk_path`.
- `columns`/`code`: sections in `identifier_key` order; first ⌈n/2⌉ sections are run 0 (top), the rest run 1 (an aisle with one section has only run 0). Within a run, sections sit left to right; each section is as wide as its distinct positions across all the aisle's levels (in `identifier_key` order), and every (section, level, position) with no location is a gap cell (`gap: true, location: null`).
- `walk_path`: one run (0), no sections; each level row holds that level's locations by Walk Path (numeric), ties by code (`str`), columns 0..k-1, no gap padding.
- Rows: every run has one row per distinct level of the aisle, highest level at row 0 and L1 last, by `level_key` over the whole import. Section and Position values sort numerically when all values of that kind in the import are all-digit (`identifier_key` over the import), else `str` order. Aisles in `aisle_order`. Cells sorted by (run, row, column).
- Each aisle carries `walk_path_first` and `walk_path_last` (min/max Walk Path, decimal strings; the end cap uses the last) and per run its `levels` (top to bottom), `columns` (width) and `sections` (`{section, first_column, columns}`, label text as in the data or code).
- `location` is the existing `LocationRef` from `swp/domain/planning.py` built from `LocationData` (section/position as stored, so `null` in a code-derived layout); `is_best` is always `false` here because an import has no marks — the plan wall (Story 10.2) carries best.
- Virtual locations (not in the Locations file) are never on the wall; every location of the file is exactly one non-gap cell.
- Tests are named `test_fr42_layout_*` (SM-7); add `swp.domain.layout` to the `domain-slices` independence contract.

**Never:** No plan state, marks, occupancy or version in this view; no new write endpoint; no UI rendering (Story 10.2); no change to `data/sample/`, `data/answer-key/` or planning artifacts; no frontend code-parsing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Demo data | sample import, aisle A: 19 sections × levels 1–4 × positions 1–3, section 19 has L1–L2 full, L3 pos 1 only | source `columns`; run 0 sections 1–10, run 1 sections 11–19; rows `["4","3","2","1"]`; section 19 L4 = 3 gaps, L3 pos 2–3 gaps; `walk_path_last` `"2220"` | — |
| Answer-key codes | answer-key data with section/position set to `None` | source `code`; aisle A one run, section label `"01"`, rows `["3","2","1"]` | — |
| Other pattern | codes like `X100`, no columns | source `walk_path`; one row per level in Walk Path order, `sections: []` | — |
| Numeric sort | levels `1,2,10`; sections `2,10` | rows `10,2,1`; section `2` before `10` | — |
| Duplicate cell | two locations same (section, level, position) | that aisle falls to the next source | — |
| GET unknown / non-UUID import | random UUID or `abc` | 404 `not_found` "This import no longer exists. Choose another saved plan." | error envelope |
| GET ok | stored import | 200, `Cache-Control: private, max-age=31536000, immutable`; the import row is unchanged | — |
| Max size | 25,000 locations (10 aisles × 25 sections × 5 levels × 20 positions) | response body < 4,000,000 bytes | — |

</intent-contract>

## Code Map

- `backend/swp/domain/import_data.py` -- `LocationData{walk_path, aisle, level, section?, position?}`, `ImportData.locations` (virtual codes are only in `virtual_locations`).
- `backend/swp/domain/ordering.py:31` -- `level_key`; add `identifier_key(values)` with the same all-`isdecimal` rule and make `level_key` delegate to it; `aisle_order` reused.
- `backend/swp/domain/planning.py:512` -- `LocationRef` (reuse, do not move).
- `backend/swp/store/plans.py:100` -- `get_import(import_id) -> StoredImport | None` (reads whole ImportData; retro item epic-2-16 about not loading transactions is a Justas decision, not taken here).
- `backend/swp/app/plans.py` -- `IMPORT_NOT_FOUND`, `parse_import_id` (non-UUID → `not_found`; same lesson as retro item epic-1-4) — reuse.
- `backend/swp/app/locations.py`, `backend/swp/api/routers/locations.py` -- pattern for a thin service + router; `backend/swp/api/app.py` guarded router list.
- `backend/.importlinter` -- `domain-slices` contract.
- `backend/tests/domain/conftest.py` -- `data` fixture (answer-key ImportData, retro item 37); `backend/tests/app/test_parts_api.py:_sample_plan`, `tests/app/test_plan_summary.py:_row`, `tests/app/conftest.py:empty_tables`.
- `frontend/lib/api/plans.ts:141` -- private `getJson`; export it for reuse. `planRootKey` is the only plan prefix.
- `frontend/lib/commands/client.ts:229` -- refetch after a command invalidates `planRootKey(planId)` only.
- `frontend/tests/commands.test.tsx:95` -- setup pattern (QueryClient + QueryObserver + CommandClient + mocked fetch).
- `package.json` `gen:api` -- regenerates `frontend/lib/api/schema.ts`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `identifier_key`; `level_key` delegates -- AD-14 home of orders.
- `backend/swp/domain/layout.py` -- new: `LayoutSource`, `LayoutCell`, `SectionSpan`, `LayoutRun`, `AisleLayout`, `LayoutView{aisles}`, `build_layout(data: ImportData) -> LayoutView` per the Always rules -- AD-15.
- `backend/.importlinter` -- add `swp.domain.layout` to `domain-slices`.
- `backend/swp/app/layout.py` -- new: `layout(import_id) -> LayoutView`; `not_found` when missing.
- `backend/swp/api/routers/layout.py` + `backend/swp/api/app.py` -- `GET /api/imports/{import_id}/layout` (`import_id: str` → `parse_import_id`), sets the immutable `Cache-Control`, `error_responses(404)`; mount with the guarded routers.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `frontend/lib/api/plans.ts` -- export `getJson`.
- `frontend/lib/api/imports.ts` -- new: `importRootKey`, `importLayoutKey`, `fetchImportLayout`, `importLayoutQueryOptions` (`staleTime: Infinity`, `gcTime: Infinity`), `useImportLayout`, types `LayoutView`, `AisleLayout`, `LayoutRun`, `LayoutCell`, `SectionSpan`.
- `backend/tests/domain/test_layout.py` -- domain tests for every matrix row except the API/size rows, plus virtual locations off the wall, one cell per location, and the 2-run split for n = 1, 4, 5.
- `backend/tests/app/test_layout_api.py` -- demo-data API test (matrix row 1), 404s, Cache-Control, read-only, and the 25,000-location size test (store a plan via `swp.app.plans.create` with a generated `NormalizedImport`).
- `frontend/tests/layout.test.ts` -- key shape outside `['plan', …]`, query options, fetch URL, and a confirmed command through `CommandClient` that does not call the layout query function.

**Acceptance Criteria:**
- Given the backend, when `npm run lint:py`, `npm run lint:imports` and `npm run test:py` run, then all pass including the new `test_fr42_layout_*` tests.
- Given the frontend, when `npm run lint`, `npm run typecheck` and `npm run test:web` run, then all pass and `schema.ts` contains `/api/imports/{import_id}/layout`.
- Given no UI change, when `npm run e2e -- --project=chromium` runs, then the existing specs stay green.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 14, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind) Immutable cache outlives a deleted import — the import row is deleted only with its last plan (`store.delete_plan`), so no plan remains whose `import_id` leads the client to that layout; a reused import must still exist (`create_from_import`).
  - `[low]` `[reject]` (blind) The year-long `private` response stays in the browser HTTP cache after logout — imports carry only location codes and are readable by every logged-in user; the AC asks for an immutable cache, and changing it to revalidation adds ETag machinery for a rare shared-profile case.
  - `[low]` `[patch]` (blind) `error_responses(404)` documented FastAPI's default 422 and added `HTTPValidationError` to schema.ts — switched to `error_responses(404, 422)`, regenerated schema.ts (HTTPValidationError gone).
  - `[low]` `[patch]` (blind) Import-wide `identifier_key` untested across aisles — grouped with the verification-gap sort finding; added `test_fr42_layout_section_order_is_import_wide`.
  - `[low]` `[reject]` (blind) Virtual-location test is vacuous — `build_layout` reads only `data.locations`, which never holds virtual codes (FR-33 import model), so the rule holds by construction; strengthening adds nothing a reader would meet.
  - `[low]` `[patch]` (blind) Source-fallback branches untested — added `test_fr42_layout_malformed_code_falls_to_walk_path` (3 parts, 5 parts, empty part), `test_fr42_layout_partial_columns_fall_to_code`, `test_fr42_layout_code_rows_come_from_the_level_column`.
  - `[low]` `[patch]` (blind) Import-wide level order untested — added `test_fr42_layout_level_order_is_import_wide`.
  - `[false]` `[reject]` (blind) Walk Path scale/serialization unpinned — `Dec` serializes through `dec_text` (normalized, no trailing zeros) and sorting compares Decimal values, so `10` and `10.0` behave identically.
  - `[low]` `[reject]` (blind) 4 MB test has no time budget and cells repeat LocationRef fields — the AC mandates a LocationRef per cell; no NFR sets a layout time budget, and the size test passes (≈3.66 MB).
  - `[low]` `[patch]` (blind) `SortKey` duplicated the ordering return type — defined once in `ordering.py`, imported by `layout.py`.
  - `[low]` `[reject]` (blind) Frontend: URL encoding untested, no `enabled` guard for an empty id — no caller exists yet (Story 10.2 adds it); speculative.
  - `[false]` `[reject]` (blind) Command test would pass if the client invalidated everything — with an active observer an invalidation of the layout key refetches it and calls `importFn`, which the test asserts is not called.
  - `[medium]` `[patch]` (edge) Sparse columns/code grid can grow sections × levels × positions gap cells (crafted or position-per-level files → millions of cells, memory and >4 MB) — a sectioned source is now unusable when levels × columns exceeds 2 × the aisle's locations (`MAX_GRID_PER_LOCATION`), so the aisle falls to the next source; tests `test_fr42_layout_sparse_grid_falls_to_next_source`, `test_fr42_layout_sparse_code_grid_falls_to_walk_path`.
  - `[low]` `[reject]` (edge) Immutable 200 served after logout or import deletion — same as the blind cache findings above (deletion unreachable; logout case rejected as low).
  - `[false]` `[reject]` (edge) `gcTime: Infinity` keeps layouts across users — Log out's `clearCache` removes every query except the session (`modules/auth/user-menu.tsx:51`), and imports are not user-scoped.
  - `[low]` `[patch]` (verification-gap) Login guard not tested on the layout route — added `/api/imports/{id}/layout` to `test_fr40_guard_covers_every_data_router` (401).
  - `[low]` `[patch]` (verification-gap) Import-wide Section/Position order not tested across aisles — same group as the blind sort finding; test added.
  - `[false]` `[reject]` (intent a) Code source reached only by stripping columns from the answer-key model — the AC names "the answer-key codes" as a layout source; the test lays out exactly those codes without columns.
  - `[false]` `[reject]` (intent b) Other-pattern fixture is in memory — the AC asks for "a fixture with other code patterns".
  - `[low]` `[reject]` (intent c) Max-size import bypasses upload parsing — the AC asks for a generated import within `MAX_ROWS_PER_FILE` (25,000 rows), which the test builds; the row limit itself is covered by `test_nfr_row_limit_rejected`.
  - `[false]` `[reject]` (intent d) No component consumes `useImportLayout` — the wall is drawn in Story 10.2; the no-refetch rule is proven at the query-client level where it lives (key prefix outside `['plan', …]`).
  - `[false]` `[reject]` (intent e) End-cap label text not produced — the domain supplies `walk_path_last`; the label is the frontend's (AD-15, Story 10.2).
  - `[false]` `[reject]` (intent f) `LocationRef.section/position` null in code layouts, `is_best` always false — stated in the spec's Always rules (one reference per location across views; an import has no marks).
  - `[low]` `[patch]` (intent g) Level from the column vs the code part untested — covered by `test_fr42_layout_code_rows_come_from_the_level_column` (grouped with the fallback tests).
  - `[false]` `[reject]` (intent h) `L10` sorts between `L1` and `L2` — AD-14: non-digit identifiers use `str` order.

## Design Notes

Cells are flat per aisle so crops (N sections / N positions) and keyboard moves in 10.3–10.5 index them directly; the run/row/column triple is the logical grid, pixels stay in the frontend. A gap cell example: `{"run":1,"row":0,"column":24,"gap":true,"location":null}`. Choosing the source per aisle (not per file) keeps one malformed aisle from flattening the rest, and the uniqueness check guarantees "one place for every location" (FR-42).

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean
- `npm run typecheck && npm run lint` -- expected: clean
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass

## Auto Run Result

**Summary.** `GET /api/imports/{import_id}/layout` serves a pure domain view (`swp/domain/layout.py`, `build_layout`) that places every location of an import on its aisle wall as flat logical cells `(run, row, column, gap, location: LocationRef | None)`. The source is chosen per aisle: Section/Position columns, else the `<aisle>-<section>-<level>-<position>` code, else one run per level in Walk Path order. A source is used only when its cells are unique and its grid is not sparse (levels × columns ≤ 2 × locations). Sections split ⌈n/2⌉ top / rest bottom, missing positions are gap cells, levels run highest first, Section/Position/Level sort numerically only when all-digit across the import (`identifier_key`), and each aisle carries `walk_path_first`/`walk_path_last`. The response is `Cache-Control: private, max-age=31536000, immutable`; unknown or non-UUID ids give 404 `not_found` (retro item epic-1-4 applied to the new route). The frontend reads it under `['import', importId, 'layout']` with `staleTime`/`gcTime` `Infinity`, outside every `['plan', planId]` key, so a confirmed command never refetches it.

**Files changed**
- `backend/swp/domain/ordering.py` -- `SortKey` and `identifier_key`; `level_key` delegates to it.
- `backend/swp/domain/layout.py` -- new layout slice and models.
- `backend/swp/app/layout.py` -- new service (`not_found` for a missing import).
- `backend/swp/api/routers/layout.py`, `backend/swp/api/app.py` -- new guarded route with the immutable `Cache-Control`.
- `backend/.importlinter` -- `swp.domain.layout` in `domain-slices`.
- `frontend/lib/api/imports.ts` -- import keys, fetch, query options, `useImportLayout`, layout types; `frontend/lib/api/plans.ts` exports `getJson`; `frontend/lib/api/schema.ts` regenerated.
- Tests: `backend/tests/domain/test_layout.py`, `backend/tests/app/test_layout_api.py`, `backend/tests/app/test_login.py` (guard entry), `frontend/tests/layout.test.ts`.
- `.docs/implementation-artifacts/epic-10-context.md` -- compiled epic context.

**Review findings.** 25 findings: 10 patched (1 medium: sparse-grid gap explosion; 9 low: OpenAPI 422 shape, `SortKey` duplicate, guard test, import-wide sort and level tests, fallback-branch tests, level-from-column test), 0 deferred, 15 rejected (10 false, 5 low) with reasons in the Review Triage Log.

**Follow-up review recommendation:** `false` — patched by verdict: high 0, medium 1, low 9; one medium patch does not meet the two-medium threshold.

**Verification** (against baseline `ff6987a2be7e254edb59f4613411337714219542`, after the patches)
- `npm run lint:py` -- All checks passed; `npm run lint:imports` -- 5 kept, 0 broken; `uv run --directory backend --locked ruff format --check` -- 174 files already formatted.
- `npm run lint`, `npm run typecheck` -- clean.
- `npm run gen:api` -- schema.ts unchanged (stable); no `HTTPValidationError`.
- `npm test` -- pytest 915 passed, 2 skipped; Vitest 463 passed (28 files).
- Postgres: `SWP_EXPECT_DIALECT=postgresql uv run --directory backend --locked pytest tests/app tests/test_store_db.py --database-url postgresql://…@localhost:55432/swp_test` on a local `postgres:17` container -- 301 passed, 3 skipped.
- `npm run e2e -- --project=chromium` -- 102 passed.
- Matrix test audit: every I/O row is covered by a passing test (demo/API, answer-key codes, other pattern, numeric sort, duplicate cell, 404s, Cache-Control and read-only, 25,000-location size).

**Residual risks**
- The 25,000-location response is ≈3.66 MB against the 4 MB limit; much longer codes, or a max-size import whose aisles sit near the 2× gap ratio, could exceed it.
- The sparse-grid fallback (2× cells per location) is a guard added in review; it is not named in the epic AC. A real warehouse with very irregular sections would be drawn in Walk Path order instead of by section.
- Retro item epic-2-16 (plan views read the import without its transactions) stays open: `get_import` loads the whole import document.
