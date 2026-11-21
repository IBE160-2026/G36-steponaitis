---
title: 'Story 2.3: Parts roster'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_revision: '3e09b1fdb8574b7a6f05ecf14d92d685a07806ac'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Parts step (`/plans/{id}/parts`) still says "This step is not built yet". The planner cannot see each part's class, picks, stock and locations, and the shared facts (current location, occupancy, aisle) the later views and rules need have no implementation.

**Approach:** Add the kernel module `domain/planning.py` (the only home of the shared facts), the part order in `domain/ordering.py`, a pure `domain/views/parts.py` view served by `GET /api/plans/{id}/parts`, and the `modules/parts` roster page built on new shared `BinSwatch` and `DataTable` components in `components/common/`.

## Boundaries & Constraints

**Always:**
- `domain/planning.py` holds the only implementations of `planning_copy(data, state)` (returns a planning copy built from the import as-is in this epic; `state` is accepted and unused), `stock_at`, `is_empty`/`is_occupied`, `current_location`, `other_locations` and `aisle_of`, plus the `LocationRef` wire model and a `location_ref(copy, code)` builder (`is_best` always `false` until Epic 3).
- Current location: the location with the most stock; equal stock → first in `str` location-code order; `None` when no stock is above zero. Other locations: the part's other locations with stock above zero, in location-code order (zero-stock rows are not "stored there"). Total stock: sum of the part's quantities (`Dec`).
- A location is empty when it has no inventory rows or all its rows have stock 0.
- The parts view lists every part in `ImportData.parts` that has an `analysis.parts` entry (Inventory parts only), in `ordering.part_order`: most picks first, ties by part number in `str` order. Each row: `rank` (1-based position in that order), `part`, `description`, `total_stock` (Dec string), `total_stock_sort_rank` (dense rank of total stock ascending, 0-based, equal stock → equal rank), `current_location: LocationRef | null`, `other_locations: LocationRef[]`, `movement_class`, `picks`, `pick_group_count` (number of `analysis.pick_groups` containing the part), `kept_in_place` (always `false`). The response is `{version, parts}`; it never writes the plan.
- The view runs one `planning_copy` per request and builds all rows from it; build per-part/per-location indexes once (no per-part scan of the whole inventory), so the sample view stays under 1 s (NFR).
- Frontend: fetched client-side with TanStack Query under `['plan', planId, 'parts']`. Rows render in server order; the frontend never computes current/other locations. User sorts: numbers numerically, text with `<`/`>` (never `localeCompare`), decimals by `total_stock_sort_rank`, ties keep server order (stable sort).
- `DataTable` and `BinSwatch` live in `components/common/`; `modules/parts` imports only `components/*` and `lib/*`.
- Copy: glossary class names ("Fast-moving", "Medium-moving", "Slow-moving", "Dead stock"), thousands separators, glyphs as SVG (no Unicode ▲◆▼). Every test name carries its FR/NFR/UJ.

**Never:**
- No part panel, search, locations or pick-groups views (Stories 2.4–2.6); `Enter` on a roster row does nothing yet (no `onOpen` passed). No keep-in-place action.
- No stored-shape change (`analysis`/`state` `schema_version` unchanged). No edits to `data/sample/` or `data/answer-key/`.
- `planning.py` and `views/parts.py` never import `classify` or `pick_groups`; they read the stored `Analysis`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Larger stock wins | answer key `1200`: 2 at A-01-02-01, 8 at B-01-01-02 | current B-01-01-02; other [A-01-02-01]; total 10 | No error expected |
| Equal stock | `4400`: 5 at B-01-01-01, 5 at A-01-03-02 | current A-01-03-02; other [B-01-01-01] | No error expected |
| No stock | `1008614-00`: 0 at A-01-01-03 | current null; other []; total "0"; A-01-01-03 is empty | No error expected |
| Transactions-only part | `9999` | not in the parts view | No error expected |
| Unknown plan | random UUID | 404 `plan_not_found` envelope | existing error handler |
| Malformed id | `/api/plans/abc/parts` | 422 | existing error handler |
| No current location in UI | row for a part with no stock | "No current location (no stock above zero)" in the why-line instead of a code | No error expected |
| Class filter | Fast-moving chip pressed | only `fast` rows remain; rank numbers unchanged | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/import_data.py` -- kernel `ImportData` (`locations: dict[str, LocationData]` with `aisle/level/section/position`, `inventory: list[InventoryLine(part, location, quantity: Dec)]` merged per (part, location) incl. zero rows, `parts: dict[str, str]`).
- `backend/swp/domain/analysis.py` -- `Analysis.parts: dict[str, PartAnalysis(picks, movement_class)]`, `pick_groups: list[PickGroup(part_a, part_b, shared_jobs)]`. Read-only here.
- `backend/swp/domain/state.py` -- `PlanState` (second arg of `planning_copy`).
- `backend/swp/domain/ordering.py` -- kernel; holds `pick_group_order`. Add `part_order` beside it.
- `backend/swp/domain/values.py` -- `Dec` (serializes as normalized string in JSON).
- `backend/swp/domain/views/summary.py` -- pattern for a view slice (pydantic wire models, pure builder).
- `backend/swp/app/plans.py:109-131` -- `summary()` loads `store.get_plan` and raises `DomainError("plan_not_found", PLAN_NOT_FOUND)`; extract that into a reusable `require(plan_id) -> StoredPlan` used by `summary` and the new parts service.
- `backend/swp/api/routers/plans.py:63-65` -- GET pattern with `responses=error_responses(404, 422)`; `backend/swp/api/app.py:36-38` mounts routers under `/api`.
- `backend/.importlinter` -- `domain-slices` independence contract: add `swp.domain.views.parts`.
- `backend/tests/rules/test_layer_rules.py:128-160` -- `SLICE_IMPORTS` and `KERNEL_MODULES`; the every-module test fails until `swp.domain.planning` is kernel and `views.parts` is a slice.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()`; `expected()["parts"][p]["current_location"]` covers all 27 parts; `expected()["empty_with_zero_stock_row"] == ["A-01-01-03"]`; `occupancy_import` gives occupied/empty per aisle (usable to cross-check `is_empty`).
- `backend/tests/app/test_plan_summary.py:28-56` and `test_create_plan.py` (`SAME_ORIGIN`, `_multipart`, `_small_files`) plus `tests/app/test_import_readers._data_files` -- patterns for TestClient API tests on the `empty_tables` fixture.
- `frontend/app/plans/[planId]/[step]/page.tsx` -- placeholder for unbuilt steps; a static `app/plans/[planId]/parts/page.tsx` takes precedence (mirror `overview/page.tsx`).
- `frontend/modules/overview/overview-page.tsx` -- pattern: `usePlanSummary`, `PlanLoadError`/`PlanOpening`/`showsLoadError` from `components/common/plan-status`, `CLASS_ROWS` labels, `ClassGlyph`.
- `frontend/lib/api/plans.ts` -- `getJson`, query keys, types from `lib/api/schema.ts` (regenerate with `npm run gen:api`; CI diffs it).
- `frontend/components/common/class-glyph.tsx` -- `ClassGlyph`, `MovementClass`. `app-shell/product-mark.tsx` -- bin drawing to mirror for `BinSwatch` (body in `var(--color-class-<class>)`, lip, white `--color-label-window` window, glyph in `--color-glyph`, plus 1.2–1.5px ink outline). `icons.tsx` -- `pin` icon for kept in place.
- `frontend/app/globals.css` -- tokens: `--color-class-*`, `--color-hairline`, `--color-ink-secondary`, `--spacing-table-row`; utilities `type-rank`, `type-part-number`/`type-code`, `type-code-table`, `type-meta`, `type-column-head`.
- `frontend/lib/format/index.ts` -- `formatNumber` (numbers and decimal strings).
- `frontend/tests/components.test.tsx`, `tests/plan-views.test.tsx` -- Vitest has no DOM (`renderToStaticMarkup`); keyboard behaviour is tested as pure helpers plus Playwright.
- `frontend/e2e/plan-overview.spec.ts` -- `createPlan(request, name)` helper; test "uj1 opens a step that is not built yet" clicks **Parts** and must switch to **Locations**.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py` -- NEW kernel module: `PlanningCopy` (frozen; locations, inventory, and per-part / per-location stock indexes built once), `planning_copy(data, state)`, `stock_at(copy, part, location) -> Decimal`, `is_empty(copy, location)`, `is_occupied`, `current_location(copy, part) -> str | None`, `other_locations(copy, part) -> list[str]`, `total_stock(copy, part) -> Decimal`, `aisle_of(copy, location) -> str`, `LocationRef` model and `location_ref(copy, code)`. -- AD-1 shared facts, FR-13.
- `backend/swp/domain/ordering.py` -- add `part_order(parts: Mapping[str, PartAnalysis]) -> list[str]`, key `(-picks, part)`. -- AD-14.
- `backend/swp/domain/views/parts.py` -- NEW slice: `PartRow`, `PartsView(version, parts)`, `build_parts_view(data, analysis, state, version)`. Imports kernel only. -- FR-13, AD-3, AD-14.
- `backend/swp/app/plans.py` -- add `require(plan_id)`; `summary` uses it. `backend/swp/app/parts.py` NEW -- `parts(plan_id) -> PartsView`. -- Slice service.
- `backend/swp/api/routers/parts.py` NEW (`GET /plans/{plan_id}/parts`, `responses=error_responses(404, 422)`) and mount in `backend/swp/api/app.py`. -- FR-13.
- `backend/.importlinter` -- add `swp.domain.views.parts` to `domain-slices`.
- `backend/tests/rules/test_layer_rules.py` -- `swp.domain.planning` in `KERNEL_MODULES`; `SLICE_IMPORTS` case `"views.parts imports classify": ("domain/views/parts.py", "import swp.domain.classify\n")`. -- NFR-1.
- `backend/tests/domain/test_planning.py` NEW -- `test_fr13_current_location` (1200, 4400, 1008614-00 as in the matrix, and every `expected()["parts"]` current location), `test_fr13_other_locations_and_total_stock`, `test_fr14_zero_stock_location_is_empty` (A-01-01-03 empty; per-aisle occupied/empty counts equal `occupancy_import`), `test_fr13_aisle_of_and_location_ref`.
- `backend/tests/domain/test_parts_view.py` NEW -- answer key: every Inventory part once, `9999` absent, order by `part_order` (incl. a tie by part-number text), ranks 1..n, pick-group counts (`8100` = 2), `kept_in_place` false, `total_stock_sort_rank` dense ascending, `version` echoed; `test_fr13_part_order` on synthetic ties (`"30400" < "3050"`).
- `backend/tests/app/test_parts_api.py` NEW -- `test_fr13_parts_endpoint_on_sample` (sample xlsx plan via TestClient: 200, row count = sum of summary class counts (1,545), first row rank 1, JSON snake_case with `total_stock` as string; plan `version`/`last_edited_at` unchanged), `test_fr13_parts_unknown_plan_404`, `test_nfr8_parts_view_under_one_second` (sample plan, `perf_counter` around the GET).
- `frontend/lib/api/schema.ts` -- regenerate (`npm run gen:api`). `frontend/lib/api/plans.ts` -- `PartsView`/`PartRow`/`LocationRef` types, `planPartsKey(planId) = ['plan', planId, 'parts']`, `fetchPlanParts`, `usePlanParts`.
- `frontend/lib/sort/index.ts` NEW -- `compareText` (`<`/`>`), `compareNumber`, and a stable `sortRows(rows, key, direction)`. -- AD-14.
- `frontend/components/common/bin-swatch.tsx` NEW -- 16px miniature bin in the class colour with an ink outline and a `ClassGlyph` in the label window; decorative unless `label` given.
- `frontend/components/common/data-table.tsx` NEW -- generic table: column defs (`header`, `cell`, `align: 'start'|'end'`, optional `sortValue` + `sortKind`), heads in `type-column-head text-ink-secondary` as sort buttons with `aria-sort`, hairline row dividers, numeric cells right-aligned `tabular-nums`; rows focusable with roving tabindex (one tab stop), `ArrowUp`/`ArrowDown` move focus (clamped), `Home`/`End` optional, `Enter` calls optional `onOpen(row)`. Export the pure key helper (`nextRowIndex`) for tests.
- `frontend/modules/parts/parts-page.tsx` NEW -- `PartsPage({planId})` (loading/error like overview) and pure `PartsView`: title "Parts", count line ("1,545 parts" / "80 of 1,545 parts"), four class filter chips (toggle buttons with `aria-pressed`, ClassGlyph + glossary label; none pressed = all), `DataTable` columns: `#` rank (`type-rank`), Part (BinSwatch + part number in Barlow over description + why-line `"<Class> · <n> picks · <current code>"` or the no-current text; "1 pick" singular), Picks (sortable number), Total stock (`formatNumber`, sortable by `total_stock_sort_rank`), Other locations (codes joined ", " or "None"), Pick groups, Kept in place (pin + "kept in place" when true, else empty). Export `whyLine(row)` for tests. -- FR-13, UX-DR18/23/24.
- `frontend/app/plans/[planId]/parts/page.tsx` NEW -- renders `PartsPage`.
- `frontend/tests/parts.test.tsx` NEW -- `fr13_why_line_*` (with/without current location, singular pick, thousands), `fr13_sort_numbers_numerically_and_text_by_code_point` (`"30400"` before `"3050"`, 9 before 10, ties keep order), `fr13_class_filter`, `uxdr18_next_row_index` (clamp, Enter), `uxdr23_bin_swatch_svg` (no Unicode glyphs, ink outline, class colour var).
- `frontend/e2e/parts-roster.spec.ts` NEW -- `uj7 ...`: create sample plan via API, open via flow bar **Parts**; assert heading, "1,545 parts", first row rank 1 with the API's first part number and its why-line; press Fast-moving chip → 80 rows and every row's why-line starts "Fast-moving"; sort Picks ascending changes the first row to the API's lowest-pick part with ties in server order; focus first row, `ArrowDown` moves focus to row 2 and `Tab` leaves the table; a no-stock part row (the sample has 37; take the first from the API response with `current_location === null`) shows "No current location (no stock above zero)".
- `frontend/e2e/plan-overview.spec.ts` -- the "not built yet" test uses **Locations** instead of **Parts**.

**Acceptance Criteria:**
- Given the answer-key dataset, when the domain tests run, then `current_location` gives B-01-01-02 for 1200, A-01-03-02 for 4400, none for 1008614-00, and every `expected.json` current location matches.
- Given a sample plan, when `GET /api/plans/{id}/parts` is called, then it returns 200 with `version` and one row per Inventory part in most-picks-first order with all FR-13 fields, in under 1 s, and the plan's `version` is unchanged.
- Given the Parts step in the browser, when it renders, then each row shows rank, bin swatch with glyph, part number over description, why-line and the right-hand columns; the class chips filter; Picks sorts numerically with ties in server order; the table is one tab stop with `↑`/`↓` row movement.
- Given `views/parts.py` importing `classify`, when `lint-imports` runs, then `domain-slices` is BROKEN; on the real tree all contracts are kept, and ESLint keeps `modules/parts` from importing another module.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 13, false 5, maybe-false 2
- findings:
  - `[low]` `[reject]` (edge) DataTable `toValue` turns a text `sortValue` without `sortKind` into NaN, so that sort does nothing — no caller sets a text `sortValue` without `sortKind`; a guard adds a branch for a state no code reaches.
  - `[low]` `[reject]` (edge) The roving tab stop is kept by row position, so after a sort or filter it sits on a different row — it is still exactly one tab stop on a visible row; tracking by key adds state for a cosmetic effect.
  - `[low]` `[patch]` (edge) Arrow/Home/End with Ctrl, Meta, Alt or Shift were swallowed by preventDefault — the row key handler now returns early when a modifier is held.
  - `[low]` `[reject]` (edge) No empty-state text when the filter matches no rows — every class chip on real data has rows, and a plan with zero Inventory parts cannot pass the import; adding a branch for it is not worth it now.
  - `[false]` `[reject]` (blind) Parts with a blank description drop out of the roster — `Part Description` is a required column and a blank required cell stops the import (`import_.py` `_is_blank` check), so every Inventory part has a description in `data.parts`.
  - `[false]` `[reject]` (blind) No separate "Current location" column — the story's right-hand column list does not name one; the current code is in the why-line as UX-DR23 specifies.
  - `[low]` `[reject]` (blind) Text sorting is built but no roster column uses it; Part and Pick groups are not sortable — FR-13 asks for sorting by picks only; extra sortable columns are optional scope.
  - `[low]` `[reject]` (blind) `toValue` NaN for text without `sortKind` — same root cause as the edge row; same reason.
  - `[low]` `[reject]` (blind) Focus kept by position after sort/filter — same root cause as the edge row; same reason.
  - `[false]` `[reject]` (blind) Row focus ring uses the light colour on graphite surfaces — no DataTable is rendered on a graphite surface (tables live on paper in `main`), so the low-contrast case does not occur.
  - `[maybe-false]` `[reject]` (blind) Rendering all 1,545 rows without virtualization could be slow — the e2e run renders, filters and sorts the full sample roster within normal timeouts; if real it would be low (sample size is the product's scale), so rejected; settle by profiling render time in a slow browser.
  - `[low]` `[reject]` (blind) The client ignores the view `version` — no command changes a plan before Epic 4, which brings the AD-3 version agreement and refetch; nothing can go stale yet.
  - `[low]` `[patch]` (blind) Class glossary labels defined in three places (DRY) — one `CLASS_LABELS` now lives in `components/common/class-glyph.tsx`, used by parts, overview and settings-list.
  - `[false]` `[reject]` (blind) The always-false "Kept in place" column wastes width — FR-13 and the story require the kept-in-place column.
  - `[low]` `[reject]` (blind) No tests for PartsPage loading/error branches, Enter/onOpen and an empty table — PartsPage reuses the overview's tested `PlanLoadError`/`PlanOpening`; Enter opens nothing in this story; extra tests for unlikely defects.
  - `[low]` `[patch]` (blind) Backend tests shallow; `_index` typed `tuple[dict, dict]` — `_index` now carries full generics; negative quantities are rejected at import (`NON_NEGATIVE_COLUMNS`), so no test is needed for them; pick-group counts are now checked for every part (see verification-gap row).
  - `[false]` `[reject]` (blind) The story spec is missing from the diff — withheld from this layer by design; the spec is the claims file read by the edge-case layer.
  - `[low]` `[patch]` (verification-gap) `pick_group_count` only checked on 8100 (always `part_a`) — `test_fr13_parts_view_row_fields` now derives every part's count from both parts of each `pick_groups_in_order` group.
  - `[low]` `[patch]` (verification-gap) `other_locations` order never checked with two or more other locations — added `test_fr13_other_locations_sorted_by_code` (three locations out of code order).
  - `[maybe-false]` `[patch]` (verification-gap) The Total stock column sort wiring is not exercised — `COLUMNS` is exported and `fr13_total_stock_column_sorts_by_sort_rank` sorts through the real column ("9.5" before "10").
- intent-alignment audit: descriptive; the diff implements the literal full-slice reading (R1) with the loose single-tab-stop reading (rows are one roving stop; sort buttons in the header are separate stops) and Enter-to-open as a DataTable capability, since this story names nothing to open. Its noted surface gaps (text sort not on the roster, Tab entry across header buttons, Enter untested in a browser) are covered by the rows above or are by design. No divergence routed.

## Design Notes

"Other locations" excludes zero-stock rows: FR-13 says "any other locations" where the part is stored, and FR-14 treats a location whose rows are all 0 as empty, so a 0 row is not a place the part is. `PlanningCopy` keeps the same shape when Epic 4 makes `planning_copy` replay moves, so views never change.

```python
def current_location(copy, part):
    held = [(loc, qty) for loc, qty in copy.stock_of(part).items() if qty > 0]
    return min(held, key=lambda item: (-item[1], item[0]))[0] if held else None
```

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: 5 kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after the committed regeneration
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new uj7 spec

## Auto Run Result

Status: done

**Summary:** New kernel module `domain/planning.py` holds the shared facts (planning copy built once with per-part and per-location stock indexes, `stock_at`, `is_empty`/`is_occupied`, `total_stock`, `current_location`, `other_locations`, `aisle_of`, `LocationRef`/`location_ref`). `ordering.part_order` gives most picks first, ties by part-number text. The pure view `domain/views/parts.py` is served by `GET /api/plans/{id}/parts` (new `app/parts.py`, router `api/routers/parts.py`) with every FR-13 field, `rank`, `total_stock_sort_rank` and the plan `version`. The Parts step (`/plans/{id}/parts`, `modules/parts`) renders the roster with rank, `BinSwatch`, part number over description, why-line, and right-hand columns, glyph class chips, user sorts by AD-14 rules, and a one-tab-stop `DataTable` (both new in `components/common/`).

**Files changed:**
- `backend/swp/domain/planning.py` -- new kernel: shared facts and LocationRef.
- `backend/swp/domain/ordering.py` -- part_order.
- `backend/swp/domain/views/parts.py` -- new slice: PartRow, PartsView, build_parts_view.
- `backend/swp/app/plans.py` -- `require(plan_id)` extracted; summary uses it.
- `backend/swp/app/parts.py`, `backend/swp/api/routers/parts.py`, `backend/swp/api/app.py` -- parts service, router and mount.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- views.parts slice, planning kernel.
- `backend/tests/domain/test_planning.py`, `backend/tests/domain/test_parts_view.py`, `backend/tests/app/test_parts_api.py` -- FR-13/FR-14/NFR-8 tests.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerated types; parts query.
- `frontend/lib/sort/index.ts` -- AD-14 comparators and stable sort.
- `frontend/components/common/bin-swatch.tsx`, `frontend/components/common/data-table.tsx` -- shared list components.
- `frontend/components/common/class-glyph.tsx`, `settings-list.tsx`, `frontend/modules/overview/overview-page.tsx` -- one shared CLASS_LABELS.
- `frontend/modules/parts/parts-page.tsx`, `frontend/app/plans/[planId]/parts/page.tsx` -- the roster page.
- `frontend/app/globals.css` -- focus outline for table rows.
- `frontend/tests/parts.test.tsx`, `frontend/e2e/parts-roster.spec.ts` (uj7), `frontend/e2e/plan-overview.spec.ts` (not-built step now Locations).

**Review:** 20 findings. Patches applied: 6 (all low or maybe-false: modifier keys, shared class labels, `_index` typing, pick-group-count test, other-locations order test, Total stock column sort test). Deferred: 0. Rejected: 14 (5 false, 8 low, 1 maybe-false; reasons in the triage log).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 5, maybe-false 1).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 243 passed (SQLite; Postgres runs in CI); `npm run gen:api` regenerated `schema.ts` with no further change; `npm run lint` and `npm run typecheck` pass; `npm run test:web` 114 passed; `npm run e2e -- --project=chromium` 30 passed (incl. the new uj7 roster test).

**Residual risks:** the NFR-8 parts-view timing loads the whole stored import (incl. transactions) and may be tighter on Postgres CI; the roster renders all 1,545 rows without virtualization; the look was not checked by eye against the design mocks; Postgres-backed app tests run only in CI.
