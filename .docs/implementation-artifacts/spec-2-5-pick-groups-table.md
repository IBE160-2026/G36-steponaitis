---
title: 'Story 2.5: Pick groups table'
type: 'feature'
created: '2026-11-21'
baseline_revision: 'd2a40579638dfd5ac2a954b981d7aea7edb7f6d8'
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

**Problem:** The Pick groups step (`/plans/{id}/pick-groups`) still says "This step is not built yet". The planner cannot see which parts are used together on jobs, nor whether the two parts of a pick group sit in the same aisle.

**Approach:** Add a pure `domain/views/pick_groups.py` view (the stored `analysis.pick_groups` in `ordering.pick_group_order`, each part's description and current-location aisle from the shared facts in `domain/planning.py`, and a same-aisle flag) served by `GET /api/plans/{id}/pick-groups`, and a `modules/pick-groups` page that shows it in the common `DataTable` in server order, with the empty-state copy.

## Boundaries & Constraints

**Always:**
- Each row: `part_a: {part, description, aisle}`, `part_b: {part, description, aisle}`, `shared_jobs: int`, `same_aisle: bool`. `part_a`/`part_b` are the stored `PickGroup.part_a`/`part_b` (`part_a < part_b` in `str` order). `description` from `data.parts` (`""` when missing). `aisle` = `planning.aisle_of(copy, planning.current_location(copy, part))`, or `null` when the part has no current location. `same_aisle` is true only when both aisles are non-null and equal.
- Rows come from `analysis.pick_groups` (computed at plan creation, AD-4), ordered by `ordering.pick_group_order` — never recomputed from transactions; the view never loads or reads `transactions`.
- One `planning_copy` per request. Response `{version, pick_groups}`; read-only, never writes the plan (FR-9). JSON snake_case.
- `views/pick_groups.py` imports only the kernel (`analysis`, `import_data`, `ordering`, `planning`, `state`), never `swp.domain.pick_groups` or another slice; register it in the `domain-slices` contract.
- Frontend: TanStack Query under `['plan', planId, 'pick-groups']`; `DataTable` label "Pick groups", rows in server order, no user sorts. Columns: Part A and Part B (part number in `type-code-table` over the description), Shared jobs (end-aligned, `formatNumber`), Aisle of part A, Aisle of part B (aisle text, or "No current location" in ink-secondary when null), Same aisle ("Same aisle" in ink with the `link` icon, or "Different aisles" in ink-secondary). A count line above the table: "10 pick groups" (singular "1 pick group").
- With no pick groups the page shows exactly "No pick groups: no two parts share 5 or more jobs in the period." and no table.
- `modules/pick-groups` imports only `components/*` and `lib/*`. Every test name carries its FR/NFR/UJ.

**Never:**
- No part panel or row opening (Story 2.6), no filters or user sorts, no moves or before/after counts (Epics 4, 9).
- No stored-shape change (no `schema_version` bump); no edits to `data/sample/` or `data/answer-key/`.
- The frontend never computes aisles or same-aisle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer-key order | answer key, no moves | 10 rows equal `pick_groups_in_order` (parts and shared jobs, same order) | No error expected |
| Same aisle | answer key | exactly one row `same_aisle` true: `9100`–`9200`, both aisle "D" | No error expected |
| No current location | answer key `1008614-00`–`2300` | `part_a.aisle` null, `same_aisle` false | No error expected |
| No groups | analysis with `pick_groups: []` | `pick_groups: []`; page shows the empty-state sentence | No error expected |
| Unknown plan / bad id | random UUID / `abc` | 404 `plan_not_found` / 422 `validation_failed` | existing error handler |

</intent-contract>

## Code Map

- `backend/swp/domain/analysis.py` -- `PickGroup(part_a, part_b, shared_jobs)`, `Analysis.pick_groups` (stored at creation).
- `backend/swp/domain/ordering.py:11` -- `pick_group_order(groups)`; reuse as is.
- `backend/swp/domain/planning.py` -- `planning_copy`, `current_location`, `aisle_of`; reuse, never re-derive.
- `backend/swp/domain/views/parts.py` -- view slice pattern (pydantic wire models + pure `build_*_view(data, analysis, state, version)`).
- `backend/swp/app/parts.py`, `backend/swp/api/routers/parts.py`, `backend/swp/api/app.py:30-34` -- service via `app.plans.require` (`plan.imported.data`, `plan.analysis`, `plan.state`, `plan.version`), router with `responses=error_responses(404, 422)`, mount under `/api`.
- `backend/.importlinter` `domain-slices` -- add `swp.domain.views.pick_groups`. `backend/tests/rules/test_layer_rules.py:128` `SLICE_IMPORTS` -- add `"views.pick_groups imports pick_groups"`.
- `backend/tests/domain/test_parts_view.py:14` -- `_view()` builds the answer-key analysis with `classify_parts` + `find_pick_groups` (tests may import slices); copy this pattern.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()["pick_groups_in_order"]`.
- `backend/tests/app/test_locations_api.py` -- endpoint test pattern; `_sample_plan` from `tests.app.test_parts_api`, `_row` from `tests.app.test_plan_summary`, `empty_tables` fixture, NFR-8 timing.
- `frontend/components/common/data-table.tsx` -- reuse unchanged.
- `frontend/components/common/icons.tsx` -- `Icon name="link"` exists.
- `frontend/components/common/plan-status.tsx` -- `PlanLoadError`, `PlanOpening`, `showsLoadError` (see `modules/locations/locations-page.tsx` `LocationsPage`).
- `frontend/lib/api/plans.ts` -- add `PickGroupsView`/`PickGroupRow`/`PickGroupPart` types, `planPickGroupsKey`, `fetchPlanPickGroups`, `usePlanPickGroups`; regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- `frontend/app/plans/[planId]/parts/page.tsx` -- static route pattern; a static `pick-groups/page.tsx` takes precedence over `[step]`.
- `frontend/tests/locations.test.tsx` -- unit test pattern (`renderToStaticMarkup`, no DOM).
- `frontend/e2e/support/sample-plan.ts` -- `createSamplePlan`. `frontend/e2e/plan-overview.spec.ts:197` "uj1 opens a step that is not built yet" clicks **Pick groups** and must switch to **Best locations** (`/best-locations$`).
- UJ-6 ("Justas checks which parts are picked together") in `EXPERIENCE.md` is this story's journey.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/pick_groups.py` NEW slice -- `PickGroupPart`, `PickGroupRow`, `PickGroupsView`, `build_pick_groups_view(data, analysis, state, version)`. -- FR-20, AD-3, AD-14.
- `backend/swp/app/pick_groups.py` NEW, `backend/swp/api/routers/pick_groups.py` NEW (`GET /plans/{plan_id}/pick-groups`), mount in `backend/swp/api/app.py`. -- FR-20.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- register the slice and its BROKEN case. -- NFR-1.
- `backend/tests/domain/test_pick_groups_view.py` NEW -- `test_fr20_pick_groups_view_order_and_fields` (rows equal `pick_groups_in_order`, descriptions, version echoed), `test_fr20_same_aisle_from_planning_copy` (only `9100`–`9200` same aisle "D"; `1008614-00` aisle null), `test_fr20_no_pick_groups_gives_empty_list`, `test_fr20_view_reorders_stored_groups` (stored list reversed → still AD-14 order).
- `backend/tests/app/test_pick_groups_api.py` NEW -- `test_fr20_pick_groups_endpoint_on_sample` (200, keys, `same_aisle` equals both aisles non-null and equal, order by AD-14 key, plan row unchanged), `test_fr20_pick_groups_unknown_plan_404`, `test_nfr8_pick_groups_view_under_one_second`.
- `frontend/lib/api/schema.ts` (regenerate), `frontend/lib/api/plans.ts` -- pick-groups types and query.
- `frontend/modules/pick-groups/pick-groups-page.tsx` NEW -- `PickGroupsPage({planId})` and pure `PickGroupsView({view})`; exported `COLUMNS`, `EMPTY_MESSAGE`, `groupCountLine(n)`. -- FR-20, UX-DR29.
- `frontend/app/plans/[planId]/pick-groups/page.tsx` NEW -- renders `PickGroupsPage`.
- `frontend/tests/pick-groups.test.tsx` NEW -- `fr20_group_count_line`, `uxdr29_pick_groups_table_markup` (both parts, shared jobs, aisles, "Same aisle" with the link icon svg, "Different aisles", "No current location", server order kept), `uxdr29_empty_state` (exact sentence, no table).
- `frontend/e2e/pick-groups.spec.ts` NEW -- `uj6 checks which parts are picked together on the pick groups table`: open via flow bar **Pick groups**; heading; row count equals the API's; first row shows the API's first group's parts, shared jobs and its same-aisle text; every row's same-aisle cell text matches the API flag; the count line. `frontend/e2e/plan-overview.spec.ts` -- not-built test uses **Best locations**.

**Acceptance Criteria:**
- Given a sample plan, when `GET /api/plans/{id}/pick-groups` is called, then it returns 200 in under 1 s with every stored pick group once in AD-14 order, each with both parts (number, description, aisle or null) and `same_aisle`; the plan's `version` is unchanged.
- Given the Pick groups step in the browser, when it renders, then it shows the UX-DR29 `DataTable` in server order with "Same aisle" (ink, link icon) or "Different aisles".
- Given `views/pick_groups.py` importing `swp.domain.pick_groups`, when `lint-imports` runs, then `domain-slices` is BROKEN; on the real tree all contracts are kept.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 11 findings — high 0, medium 0, low 7, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) The empty-state sentence hard-codes "5" while `pick_group_min_shared_jobs` is a per-plan setting — real only if a developer edits `backend/settings/analysis.toml` (the app cannot change it; the file says "change them here, not in the app") and a plan then has no groups; the epic AC and UX copy give the literal sentence, and the fix adds a wire field.
  - `[low]` `[patch]` (blind) No unit test shows the page uses the server `same_aisle` flag rather than computing it — added a fixture with aisles "A"/"A" and `same_aisle: false` that must render "Different aisles".
  - `[low]` `[patch]` (blind) The sample endpoint test would pass with every aisle null — it now asserts at least one non-null aisle.
  - `[false]` `[reject]` (blind) Nothing tests that aisles follow plan state after moves — in Epic 2 `planning_copy` ignores `state` (`del state`) and no moves exist; Epic 4 brings moves and their tests.
  - `[false]` `[reject]` (blind) Ties in `shared_jobs` are not tested — the answer key has ties at 6 (8100–8300, 8400–8500, 9100–9200) and at 5 (0600–2300, 30400–3050, 6600–7000), and `test_fr20_view_reorders_stored_groups` feeds them reversed and asserts the expected order.
  - `[low]` `[reject]` (blind) A part without a description renders a blank line — pick-group parts are Inventory parts with descriptions; `""` is the spec's fallback, same as Story 2.4; a placeholder adds a branch for a case not met in use.
  - `[low]` `[reject]` (blind) The unit test does not check which cell holds "No current location" or the end alignment — `AisleCell` is the only place that writes it and `DataTable` aligns `align: "end"` columns by construction; tightening adds no defect detection worth the churn.
  - `[low]` `[patch]` (blind) The e2e test never checks the aisle columns — it now compares every row's "Aisle of part A/B" cell with the API aisle or "No current location".
  - `[false]` `[reject]` (blind) The link icon may be announced to screen readers — `Icon` without `label` sets `aria-hidden` (`frontend/components/common/icons.tsx:47`).
  - `[false]` `[reject]` (blind) `aisle_of` raises `KeyError` for a stock row at a location missing from the Locations file — the import rejects such rows ("is not in the Locations file.", `backend/swp/domain/import_.py:401`).
  - `[low]` `[reject]` (edge) Empty state states a wrong threshold when the setting is not 5 — same as the first blind row; same reason.
- intent-alignment audit: descriptive; the diff implements the literal acceptance criteria (R1) and the in-app step (R4). Noted: planning-copy aisles are only exercised before any move (none possible in Epic 2); the "5" in the empty state is literal, not tied to the setting (R3, see rejected rows); the empty state and link icon are unit-tested, not e2e. No divergence routed.

## Design Notes

A pick group with a part that has no stock above zero has no aisle for that part, so it is never "Same aisle" (FR-20 is binary: same aisle or not). The table writes "No current location" in that part's aisle cell, so "Different aisles" is never read as two known aisles.

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: all contracts kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after the committed regeneration
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new uj6 spec

## Auto Run Result

Status: done

**Summary:** New slice `domain/views/pick_groups.py` lists the pick groups stored in the plan's analysis in `ordering.pick_group_order`, with each part's number, description and aisle of its current location in the planning copy (null when no stock above zero), and `same_aisle` true only when both aisles are known and equal. It is served by `GET /api/plans/{id}/pick-groups`. The Pick groups step (`modules/pick-groups`) shows it in the common `DataTable` in server order: Part A, Part B, Shared jobs, Aisle of part A, Aisle of part B, and "Same aisle" (ink, link icon) or "Different aisles", a count line, and the empty-state sentence.

**Files changed:**
- `backend/swp/domain/views/pick_groups.py` -- new slice: wire models and build_pick_groups_view.
- `backend/swp/app/pick_groups.py`, `backend/swp/api/routers/pick_groups.py`, `backend/swp/api/app.py` -- service, router, mount.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- slice registered and its BROKEN case.
- `backend/tests/domain/test_pick_groups_view.py`, `backend/tests/app/test_pick_groups_api.py` -- FR-20/NFR-8 tests.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerated types; pick-groups query.
- `frontend/modules/pick-groups/pick-groups-page.tsx`, `frontend/app/plans/[planId]/pick-groups/page.tsx` -- the Pick groups page.
- `frontend/tests/pick-groups.test.tsx` -- unit tests.
- `frontend/e2e/pick-groups.spec.ts` (uj6), `frontend/e2e/plan-overview.spec.ts` (not-built step now Best locations).

**Review:** 11 findings. Patches applied: 3 (all low): server same-aisle flag fixture, non-null aisle on the sample endpoint, e2e aisle columns. Deferred: 0. Rejected: 8 (4 false: state-following aisles before Epic 4, tie order already covered, icon is aria-hidden, unknown locations rejected at import; 4 low: hard-coded "5" in the empty state (twice), blank description line, cell-level unit assertions — reasons in the triage log).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 3).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 263 passed (SQLite; Postgres runs in CI); `npm run gen:api` reproduces the committed `schema.ts`; `npm run lint` and `npm run typecheck` pass; `npm run test:web` 124 passed; `npm run e2e -- --project=chromium` 32 passed (incl. the new uj6 spec).

**Residual risks:** the empty-state sentence says "5" even if a plan's `pick_group_min_shared_jobs` differs; aisles following moves are untested until Epic 4; the look was not checked by eye against the mocks; Postgres-backed app tests run only in CI.
