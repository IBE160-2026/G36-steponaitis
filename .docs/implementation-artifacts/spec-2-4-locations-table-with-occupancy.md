---
title: 'Story 2.4: Locations table with occupancy'
type: 'feature'
created: '2026-11-21'
baseline_revision: '3369e462ef9b274e64d580c092659d78d9199fd1'
status: 'done'
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

**Problem:** The Locations step (`/plans/{id}/locations`) still says "This step is not built yet". The planner cannot see what is in each location or how full each aisle and the whole warehouse are.

**Approach:** Add the location order to `domain/ordering.py`, a pure `domain/views/locations.py` view (rows plus per-aisle and whole-warehouse occupancy, all from the shared facts in `domain/planning.py`) served by `GET /api/plans/{id}/locations`, and a `modules/locations` page built on the common `DataTable`, with aisle / occupied-empty / best filters, the occupancy lines, and `?aisle=&loc=` read through `lib/view-state`.

## Boundaries & Constraints

**Always:**
- The view lists every location in `ImportData.locations` exactly once (virtual or not), each row: `location: LocationRef` (from `planning.location_ref`, `is_best` false until Epic 3), `walk_path` (Dec), `occupied: bool` (from `planning.is_occupied`), `contents: [{part, description, stock: Dec}]` — only the parts with stock above zero there, in part-number `str` order (a zero-stock row is not "stored there", as in Story 2.3). The description comes from `data.parts`; a part missing there gets `""`.
- Occupancy: `aisles: [{aisle, locations, occupied, empty, occupied_percent}]` in aisle order, plus `warehouse` with the same fields minus `aisle`. `occupied_percent` is a string with exactly one decimal, `occupied / locations * 100` rounded half-up with `Decimal` ("88.9", "100.0", "0.0"). Counts come from the same rows, never re-derived on the client. Response `{version, locations, aisles, warehouse}`; it never writes the plan.
- Order (AD-14) from new functions in `domain/ordering.py`: aisles in `str` order; locations by (aisle `str`, level, Walk Path numeric, code `str`), where level sorts numerically when every Level value in the import is all digits (`str.isdigit()`), else by `str`. One `level_key` helper serves both.
- One `planning_copy` per request; per-location lookups use `PlanningCopy.contents_of` (no per-location scan of the inventory) so the sample view stays under 1 s (NFR-8).
- Frontend: TanStack Query under `['plan', planId, 'locations']`; rows in server order, no user sorts. Filters: aisle (`select`, "All aisles" + server `aisles`), occupancy (All / Occupied / Empty, `aria-pressed` toggle buttons), best (All / Best / Not best). Filtering only reads server flags. Occupancy shown as words "Occupied"/"Empty" and counts, never colour alone.
- Occupancy lines: always "Whole warehouse · 79.2% occupied · 1,584 of 2,000 locations · 416 empty", then one line per aisle "Aisle A · 88.9% occupied · 8 of 9 locations · 1 empty" (singular "1 location" when the total is 1). Above the table a count line "2,000 locations" / "223 of 2,000 locations".
- `lib/view-state/urls.ts` owns the `?aisle=&loc=` URL: `planStepHref(planId, step, params?)` appends only the non-empty params; `parseLocationParams(searchParams)` takes the first value of each and returns `{aisle?, loc?}`. On open, an `aisle` that is one of the server aisles sets the aisle filter (unknown → All aisles); a `loc` whose row is shown is focused (becomes the table's tab stop) and scrolled into view (`block: "center"`); an unknown `loc` focuses nothing. Changing the aisle filter replaces the URL (`router.replace`, `?aisle=` only, `loc` dropped).
- `DataTable` gains an optional `focusKey?: string`: when it names a shown row, that row becomes active, gets focus and is scrolled into view once per `focusKey` value.
- `modules/locations` imports only `components/*` and `lib/*`. Every test name carries its FR/NFR/UJ.

**Never:**
- No marking of best locations, no best counts (Epic 3), no wall / One aisle switch (Epic 10), no search or part panel (Story 2.6), no localStorage restore of the last view.
- No stored-shape change; no edits to `data/sample/` or `data/answer-key/`.
- `views/locations.py` never imports another domain slice; the frontend never computes occupancy or percentages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zero-stock row | answer key `A-01-01-03` (1008614-00 with 0) | `occupied` false, `contents` [] | No error expected |
| Per-aisle counts | answer key | A 8/1 "88.9", B 8/4 "66.7", C 6/3 "66.7", D 6/3 "66.7"; warehouse 28/11 of 39 "71.8" | No error expected |
| Sample totals | `data/sample/` | warehouse 1,584 occupied, 416 empty, 2,000 locations, "79.2" | No error expected |
| Numeric levels | levels "2" and "10" in one aisle | level 2 rows before level 10 | No error expected |
| Non-digit level | levels "10" and "B" in the import | `str` order: "10" before "B", "2" after "10" | No error expected |
| Unknown plan / bad id | random UUID / `abc` | 404 `plan_not_found` / 422 | existing error handler |
| URL `?aisle=B&loc=<code>` | code in aisle B | aisle filter B, that row focused and in view | No error expected |
| URL with unknown aisle or loc | `?aisle=Z&loc=nope` | All aisles, no row focused | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/planning.py` -- kernel facts to reuse: `planning_copy`, `PlanningCopy.contents_of(location)` (stock per part incl. zero rows), `is_occupied`, `location_ref`, `LocationRef`. Do not re-derive emptiness.
- `backend/swp/domain/ordering.py` -- kernel home of orders (`pick_group_order`, `part_order`); add `level_key`, `aisle_order`, `location_order` here.
- `backend/swp/domain/import_data.py` -- `LocationData(walk_path: Dec, aisle, level, section, position)`; `ImportData.locations: dict[str, LocationData]`, `parts: dict[str, str]`.
- `backend/swp/domain/views/parts.py` -- pattern for a view slice (pydantic wire models + pure builder, `version` echoed).
- `backend/swp/app/parts.py`, `backend/swp/api/routers/parts.py`, `backend/swp/api/app.py:28-33` -- service via `app.plans.require`, router with `responses=error_responses(404, 422)`, mount under `/api`.
- `backend/.importlinter` `domain-slices` -- add `swp.domain.views.locations`. `backend/tests/rules/test_layer_rules.py:128-133` `SLICE_IMPORTS` -- add the locations case.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()["occupancy_import"]` (per aisle `locations/occupied/empty` + `total`), `expected()["empty_with_zero_stock_row"]`.
- `backend/tests/domain/test_planning.py` -- already has `test_fr14_zero_stock_location_is_empty` for `is_empty`; the view tests check the row.
- `backend/tests/app/test_parts_api.py` -- `_sample_plan(client)`, `_row`, `empty_tables` fixture, NFR-8 timing pattern; reuse `_sample_plan` by import.
- `frontend/components/common/data-table.tsx` -- add `focusKey`; keep roving tabindex (`activeIndex`, `focusRow`).
- `frontend/modules/parts/parts-page.tsx` -- page pattern (`PartsPage`/`PartsView`, `PlanLoadError`/`PlanOpening`/`showsLoadError`, chip buttons with `aria-pressed`, count line).
- `frontend/lib/api/plans.ts` -- add `LocationsView`/`LocationRow`/`AisleOccupancy` types, `planLocationsKey`, `fetchPlanLocations`, `usePlanLocations`; regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- `frontend/lib/view-state/urls.ts` -- `planStepHref`; extend with params and `parseLocationParams`.
- `frontend/app/plans/[planId]/parts/page.tsx` -- static route pattern; the locations page also awaits `searchParams`.
- `frontend/lib/format/index.ts` -- `formatNumber` for counts and Walk Path.
- `frontend/e2e/parts-roster.spec.ts:26`, `frontend/e2e/plan-overview.spec.ts:19` -- duplicated `createPlan`; move to a shared `e2e/support/sample-plan.ts`. `plan-overview.spec.ts:210` "not built yet" test clicks **Locations** and must switch to **Pick groups**.
- Sample data: 2,000 locations, aisles A–I (223/223/222…), levels "1"–"4"; 1,584 occupied.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `level_key(levels) -> Callable[[str], tuple]` (numeric when all digits), `aisle_order(aisles) -> list[str]`, `location_order(locations: Mapping[str, LocationData]) -> list[str]`. -- AD-14.
- `backend/swp/domain/views/locations.py` NEW slice -- `LocationContent`, `LocationRow`, `Occupancy`, `AisleOccupancy`, `LocationsView`, `build_locations_view(data, state, version)`. -- FR-14, AD-3, AD-15.
- `backend/swp/app/locations.py` NEW, `backend/swp/api/routers/locations.py` NEW (`GET /plans/{plan_id}/locations`), mount in `backend/swp/api/app.py`. -- FR-14.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- register the slice; add `"views.locations imports classify"`. -- NFR-1.
- `backend/tests/domain/test_locations_view.py` NEW -- `test_fr14_locations_view_lists_every_location` (39 rows once, LocationRef fields, walk_path, `is_best` false, contents for a multi-part or known location, version echoed), `test_fr14_zero_stock_location_shows_empty`, `test_fr14_occupancy_per_aisle` (matrix values against `occupancy_import`), `test_fr14_location_order_numeric_levels` and `test_fr14_location_order_text_levels` (synthetic `LocationData`), `test_fr14_occupied_percent_rounding` (e.g. 2/3 → "66.7", 1/8 → "12.5", 0 → "0.0", all → "100.0").
- `backend/tests/app/test_locations_api.py` NEW -- `test_fr14_locations_endpoint_on_sample` (200, 2,000 rows, warehouse 1,584/416 "79.2", per-aisle sums equal warehouse, snake_case keys, `walk_path` a string, plan row unchanged), `test_fr14_locations_unknown_plan_404`, `test_nfr8_locations_view_under_one_second`.
- `frontend/lib/api/schema.ts` (regenerate), `frontend/lib/api/plans.ts` -- locations types and query.
- `frontend/lib/view-state/urls.ts` -- `planStepHref(planId, step, params?)`, `LocationParams`, `parseLocationParams`. -- AD-20, UX-DR9.
- `frontend/components/common/data-table.tsx` -- `focusKey` prop (focus + `scrollIntoView({ block: "center" })`).
- `frontend/modules/locations/locations-page.tsx` NEW -- `LocationsPage({planId, params})` and pure `LocationsView`; exported pure helpers `occupancyLine(label, occupancy)`, `countLine`, `filterLocations(rows, {aisle, occupancy, best})`; columns Location (`type-code-table`), Aisle, Level, Walk Path (end, `formatNumber`), Occupancy ("Occupied"/"Empty"), Best ("Best" or empty), Parts (one line per content: part number in `type-code-table`, description, "stock N"; "None" in ink-secondary when empty). -- FR-14, UX-DR27, UX-DR57.
- `frontend/app/plans/[planId]/locations/page.tsx` NEW -- awaits `params` and `searchParams`, renders `LocationsPage`.
- `frontend/tests/locations.test.tsx` NEW -- `fr14_occupancy_line` (example text, thousands, singular), `fr14_filter_locations` (each filter and combined; order kept), `uxdr9_location_params` (href building/encoding, parse first value, empty dropped), `uxdr57_occupancy_in_words` (rendered row markup holds "Occupied"/"Empty").
- `frontend/e2e/support/sample-plan.ts` NEW -- shared `createSamplePlan(request, name)` returning the created plan JSON; `parts-roster.spec.ts` and `plan-overview.spec.ts` use it; the not-built test uses **Pick groups**.
- `frontend/e2e/locations-table.spec.ts` NEW -- `uj1 reads the locations table with occupancy, filters it and opens a location from the URL`: open via flow bar **Locations**; heading; whole-warehouse line text; 2,000 rows; aisle A → URL `?aisle=A`, 223 rows, the API's aisle A line visible; Empty → rows equal API's aisle A empty count and each shows "Empty"; a zero-stock-row location from the API (occupied false with an inventory part — else any empty) shows "Empty" and "None"; `goto ?aisle=B&loc=<API code mid-aisle B>` → that row focused and in viewport.

**Acceptance Criteria:**
- Given a sample plan, when `GET /api/plans/{id}/locations` is called, then it returns 200 in under 1 s with every location once in AD-14 order, each a `LocationRef` plus walk path, occupied flag and contents, and warehouse 1,584 occupied / 416 empty; the plan's `version` is unchanged.
- Given the Locations step in the browser, when it renders, then it shows the FR-14 table on `DataTable` with aisle, occupied/empty and best filters and the whole-warehouse and per-aisle occupancy lines, with occupancy in words and counts.
- Given `/plans/{id}/locations?aisle=B&loc=<code>`, when it opens, then the aisle filter is B and that row is focused and scrolled into view.
- Given `views/locations.py` importing `classify`, when `lint-imports` runs, then `domain-slices` is BROKEN; on the real tree all contracts are kept.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 8, maybe-false 2
- findings:
  - `[low]` `[patch]` (blind) `level_key` uses `isdigit()`, so a Unicode digit Level such as "²" makes `int()` raise and the endpoint 500 — now `isdecimal()`; added `test_fr14_location_order_unicode_digit_levels_sort_as_text`.
  - `[low]` `[patch]` (blind) A new `?aisle=&loc=` URL reset only the aisle filter, so an occupancy/best filter could hide the linked row — the resync now resets to `{ ...NO_FILTERS, aisle }`.
  - `[low]` `[reject]` (blind) An unknown or hidden `loc` shows no message, and a bare `loc` does not set its aisle — the spec says an unknown `loc` focuses nothing and the aisle comes from `?aisle=`; a message or aisle lookup adds branches for a hand-typed URL (no in-app link makes one before Story 2.6).
  - `[low]` `[patch]` (blind) The focusKey row hidden at first render later steals focus when a filter shows it (e.g. picking its aisle before `router.replace` drops `loc`) — the effect now marks the key handled on its first run for that value.
  - `[false]` `[reject]` (blind) Changing the aisle drops `loc`, and occupancy/best are not in the URL — this is the specified behaviour (`?aisle=` only, `loc` dropped); AD-20 lists only `aisle`/`loc` for this view.
  - `[low]` `[patch]` (blind) Row order never asserted through the view — `test_fr14_locations_view_lists_every_location` now asserts `codes == location_order(data.locations)`.
  - `[false]` `[reject]` (blind) "As it is now" only tested on an untouched plan, `is_best` always false — no moves or marks exist before Epics 3 and 4; `planning_copy` is the import in this epic and `is_best` is false by spec.
  - `[false]` `[reject]` (blind) `occupied` and `contents` could disagree (e.g. negative stock) — `is_occupied` is "any row non-zero" and contents are rows above zero; negative quantities are rejected at import (`NON_NEGATIVE_COLUMNS`), so the two cannot differ.
  - `[low]` `[reject]` (blind) `test_locations_api.py` imports private helpers from other test modules — same pattern as Story 2.3's tests; moving fixtures is a refactor, not a direct correction, and no caller diverges.
  - `[low]` `[reject]` (blind) Per-aisle occupancy rescans the rows once per aisle — 9 × 2,000 comparisons on the sample; NFR-8 test passes well under 1 s; grouping is cosmetic.
  - `[maybe-false]` `[reject]` (blind) 2,000 rows rendered without virtualization might be slow — e2e renders, filters and focuses the full table within normal timeouts; if real it would be low; settle by profiling in a slow browser.
  - `[false]` `[reject]` (blind) The table cannot be sorted — FR-14 and the spec ask for filters only, with server order (no user sorts).
  - `[low]` `[reject]` (blind) The Best column is blank for "not best" — the spec says "Best" or empty; best is always false until Epic 3, and the filter and words cover NFR-10.
  - `[false]` `[reject]` (blind) Walk Path with thousands separators may lose precision — `formatNumber` on a decimal string groups the integer digits as text (no float conversion), and the UX copy itself writes "Walk Path 0–2,270".
  - `[low]` `[patch]` (blind) Over-long rewritten header comment line in `frontend/lib/api/plans.ts` — rewrapped.
  - `[false]` `[reject]` (blind) e2e `hasText` row filter could match a code that is a prefix of another — every location code in `data/sample/` has the fixed `X-NN-NN-NN` shape, so no code is a substring of another.
  - `[low]` `[patch]` (edge) `isdigit()` vs `int()` crash — same root cause as the first blind row; same fix.
  - `[low]` `[patch]` (edge) focusKey row shown later steals focus — same root cause as the blind focus row; same fix.
  - `[low]` `[patch]` (edge) New URL keeps old occupancy/best filters — same root cause as the blind URL-resync row; same fix.
  - `[maybe-false]` `[reject]` (edge) Two quick aisle changes: an earlier `router.replace` finishing late could reset the aisle briefly — Next coalesces replaces to the latest URL; if real it would be low and self-correcting; settle by a throttled-network e2e.
  - `[false]` `[reject]` (edge) e2e substring row match — same refutation as the blind row (fixed-shape codes).
  - `[false]` `[reject]` (edge) The e2e does not target a zero-stock-row location as claimed — the spec's task allows "else any empty", the API deliberately leaves zero rows out of `contents`, and `test_fr14_zero_stock_location_shows_empty` covers the case.
  - `[low]` `[patch]` (verification-gap) View row order not asserted — same root cause as the blind order row; same fix.
  - `[low]` `[patch]` (verification-gap) Contents order and the `""` description fallback untested — added `test_fr14_location_contents_order_and_missing_description` (synthetic location with "0500", "0100", "0900"; "0900" not in parts).
  - `[low]` `[patch]` (verification-gap) focusKey once-per-value guard untested — the uj1 e2e now clicks the occupancy "All" toggle after the `?loc=` focus and asserts the button keeps focus.
- intent-alignment audit: descriptive; the diff implements the literal full-slice reading (R1), settling Level order per column (AD-14 wording), contents without zero-stock rows (as Story 2.3), and one line per scope. Noted surface gaps: the story-named `test_fr14_zero_stock_location_is_empty` predates this change (kernel `is_empty`), the view has its own test; order was domain-only (now asserted through the view); the Best filter is only unit-tested because `is_best` is false until Epic 3. No divergence routed.

## Design Notes

Location order is aisle, then level, then Walk Path: within an aisle it reads like the wall (one level after another, left to right in walk order). Walk Path breaks ties before the code because the wall places locations by Walk Path. Percent formatting:

```python
pct = (Decimal(occupied) * 100 / Decimal(total)).quantize(Decimal("0.1"), ROUND_HALF_UP)
occupied_percent = f"{pct:.1f}"
```

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: 5 kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after the committed regeneration
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new uj1 locations spec

## Auto Run Result

Status: done

**Summary:** `domain/ordering.py` gains `level_key` (numeric when every Level is decimal digits, else text), `aisle_order` and `location_order` (aisle, level, Walk Path, code). The new slice `domain/views/locations.py` builds every location as a `LocationRef` plus Walk Path, occupied flag (shared `is_occupied`) and contents (parts with stock above zero, part-number order), with per-aisle and whole-warehouse occupancy and a one-decimal half-up percentage. It is served by `GET /api/plans/{id}/locations`. The Locations step (`modules/locations`) shows the table on the common `DataTable`, aisle / occupancy / best filters, the whole-warehouse and per-aisle occupancy lines in words and counts, and reads `?aisle=&loc=` through `lib/view-state` to set the aisle and focus and scroll to the row (new `DataTable.focusKey`).

**Files changed:**
- `backend/swp/domain/ordering.py` -- level_key, aisle_order, location_order.
- `backend/swp/domain/views/locations.py` -- new slice: wire models and build_locations_view.
- `backend/swp/app/locations.py`, `backend/swp/api/routers/locations.py`, `backend/swp/api/app.py` -- service, router, mount.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- views.locations slice registered and guarded.
- `backend/tests/domain/test_locations_view.py`, `backend/tests/app/test_locations_api.py` -- FR-14/NFR-8 tests.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerated types; locations query.
- `frontend/lib/view-state/urls.ts` -- `planStepHref` params and `parseLocationParams`.
- `frontend/components/common/data-table.tsx` -- `focusKey`.
- `frontend/modules/locations/locations-page.tsx`, `frontend/app/plans/[planId]/locations/page.tsx` -- the Locations page.
- `frontend/tests/locations.test.tsx` -- unit tests.
- `frontend/e2e/support/sample-plan.ts` (shared plan helper), `frontend/e2e/locations-table.spec.ts` (uj1), `frontend/e2e/parts-roster.spec.ts`, `frontend/e2e/plan-overview.spec.ts` (not-built step now Pick groups).

**Review:** 25 findings. Patches applied: 11 rows in 7 entries (all low): `isdecimal` level key, URL resync resets every filter, focusKey handled once per value even when hidden, view order assertion, contents order and missing-description test, focusKey e2e check, comment rewrap. Deferred: 0. Rejected: 14 (8 false, 2 maybe-false, 4 low: unknown-loc message, private test helpers, per-aisle rescans, blank not-best cell; reasons in the triage log).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 7 entries).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 255 passed (SQLite; Postgres runs in CI); `npm run gen:api` gives no further change to `schema.ts`; `npm run lint` and `npm run typecheck` pass; `npm run test:web` 121 passed; `npm run e2e -- --project=chromium` 31 passed (incl. the new uj1 locations spec).

**Residual risks:** the table renders all 2,000 rows without virtualization; the aisle filter round-trips through `router.replace` to the server (the URL updates with a short delay); the Best filter and column only matter from Epic 3; the look was not checked by eye against the mocks; Postgres-backed app tests run only in CI.
