---
title: 'Story 10.6: Whole warehouse view'
type: 'feature'
created: '2026-11-23'
baseline_revision: '52af81b8918ba7c15ad6d718e002d2edf23ad15f'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-10-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Locations wall shows one aisle at a time. The planner cannot see all nine aisles together, and cannot see a cross-aisle move as one route.

**Approach:** Add a **One aisle | Whole warehouse** segmented control to the Locations wall header. Whole warehouse reads a new plan view, `GET /api/plans/{id}/warehouse`, and draws four figures, nine aisle cards with decorative mini-walls, and the selected move as one route across the cards.

## Boundaries & Constraints

**Always:**
- **Server view (AD-3, AD-14, AD-15).** `build_warehouse_view(data, analysis, state, version)` goes in `swp/domain/views/wall.py`. It is the same slice, so it reuses `_move_entries`, `_wall_move`, `_counts` and `_Fact` and makes one `replay`. It returns `WarehouseView {version, round, run: WarehouseRun | None, locations: list[WarehouseLocation], moves: list[WallMove], aisles: list[AisleCounts], warehouse: WarehouseCounts}`.
  - `WarehouseLocation {code, occupied, movement_class: MovementClass | None}`. The class is the top part's class (`part_order` first); it is None when the location is empty. Locations come in `location_order`.
  - `moves` holds every wall move entry: all aisles, in wall order.
  - `WarehouseRun {round, recommendations}` describes the latest run (`latest_run`): its round and its number of recommendations. It is None before any run.
  - `aisles` and `warehouse` are computed exactly as in `build_wall_view`. Pull them into one shared private helper rather than copying the code.
- **Endpoint.** `GET /api/plans/{plan_id}/warehouse` sits in `swp/api/routers/wall.py`, using the service `swp/app/wall.py::warehouse(plan_id)`. It is read-only and returns 404 `plan_not_found` for an unknown plan. Its response for the 25,000-location max-size import is under 4 MB.
- **Client data.** `usePlanWarehouse(planId, enabled)` uses key `[...planRootKey(planId), "warehouse"]`, so it is refetched after every command. Export the types from `lib/api/plans.ts`. The panel pairs data with it through `usePanelPlanData(planId, warehouse, part)`.
- **Choice and persistence.** The scope is `"aisle" | "warehouse"`. It is stored in the existing `planWallStorageKey` JSON as `{aisle?, scope?}`. A missing or invalid scope means `"aisle"`.
  - An explicit `?aisle=` or `?loc=` in the URL always opens One aisle and stores `scope: "aisle"`.
  - Otherwise the stored scope decides.
  - Switching to Whole warehouse stores `scope: "warehouse"`, keeps the stored aisle, and replaces the URL with `planStepHref(…, "locations", {part, ...wallMoveQuery})`, with no `aisle`.
  - Switching to One aisle, or selecting a card, stores `scope: "aisle"` (plus the card's aisle) and writes `?aisle=` while keeping `part`, `rec` and `move`.
  - Keep the aisle-choice logic pure in `aisle-choice.ts`.
- **Header.** The `SegmentedControl` (label "Locations view", options "One aisle" and "Whole warehouse") sits in the page header next to the search field in both scopes. In One aisle, the whole-warehouse figure after the tabs becomes a button with the same text and the `data-whole-warehouse` attribute. Clicking it switches to Whole warehouse.
- **Whole warehouse body.**
  - **Four figures:** "79.2% occupied", "416 empty locations", "174 best locations · 7 of them empty", and "19 recommendations in round 1". The last one reads "No recommendations yet" when `run` is null. All four strings live in `lib/copy`.
  - **Nine aisle cards** in server order, in a grid: `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3`.
  - The `Key` sits under the grid.
- **Aisle card.** Each card is one `<button>` (`data-aisle-card="<aisle>"`) holding:
  - the letter plate, with a BEST tag when `aisle_marked`;
  - the % text;
  - "194 of 228 · 34 empty";
  - `aisleTabMoves(moves)`;
  - the mini-wall.

  The mini-wall is one `aria-hidden` SVG of the aisle's layout cells, drawn with the shared geometry (`cellRect`, `runTops`, `wallNaturalSize`) scaled to the card width. An occupied cell is a small filled rect in `CLASS_FILL[movement_class]` with a light label stripe. An empty cell is a slot-coloured recess. Gaps are not drawn. It has no glyphs, text, tooltips, grid, drag or marking. Clicking the card opens that aisle in One aisle.
- **Route (AD-15).** The selected move comes from `?rec=`/`?move=` (`isSelectedWallMove`) among `view.moves`. It is drawn as one cased violet curve (reuse `arrowPath` and the moves layer's casing and accent colours) from its from-cell to its to-cell. The curve lives in an `aria-hidden` SVG overlay over the card grid (`data-warehouse-route`). Cell positions come from the layout geometry plus each mini-wall's measured offset within the grid; recompute them on resize. When either end is not in the layout, no route is drawn. A visible text line under the figures names the selected move, for example "Selected move: 4410281 · G-14-04-02 → A-02-01-01" (in `lib/copy`), so the route is never the only cue.
- Frontend code goes in `modules/locations` (`warehouse-view.tsx`, `mini-wall.tsx`) and imports only `components/*` and `lib/*`. There is no code parsing in the frontend. Tests are named `fr42`/`test_fr42_*` with UX-DR45/58. The new e2e spec imports `test` and `expect` from `frontend/e2e/support/test.ts`.

**Never:** No write endpoint or command. No glyphs, tooltips, keyboard grid, drag or marking on mini-walls. No moves drawer in Whole warehouse. No frontend-computed occupancy, counts or move membership. No marking on the wall (10.7) and no Key buttons (Epic 11). No change to `/wall` or `/layout` responses. No edits to `data/sample/`, `data/answer-key/` or `.docs/planning-artifacts/`. No session logs or `.logs/`. No deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Before any run | no runs | `run` null; figure "No recommendations yet"; no route | — |
| Cross-aisle selected move | `?rec=` G→A | one route from a G card cell to an A card cell | — |
| No selection / unknown id | no `rec`/`move` or not found | no route, no selected-move line | — |
| Stored scope warehouse, plain URL | reload `/locations` | Whole warehouse | — |
| Deep link with aisle | `?aisle=B` with stored warehouse | One aisle B; scope stored `aisle` | — |
| Bad stored JSON | `{"aisle":"A","scope":"x"}` or junk | One aisle | ignored |
| Empty location | no stock | slot drawn, class null | — |
| 1024–1279 / <1024 width | viewport 1100 / 900 | 2 columns / 1 column | — |
| Warehouse read fails | 5xx/404 | `PlanLoadError` like the wall | existing pattern |

</intent-contract>

## Code Map

- `backend/swp/domain/views/wall.py` -- `WallView`, `AisleCounts`, `WarehouseCounts`, `_move_entries` (all entries with `aisles`), `_wall_move`, `_counts`, `_Fact`, `build_wall_view` (the counts block to share); `latest_run`, `current_round` from `swp.domain.planning`; `part_order` from ordering.
- `backend/swp/app/wall.py` -- `wall()` pattern (`require(plan_id)`); add `warehouse()`.
- `backend/swp/api/routers/wall.py` -- add the GET route (`error_responses(404, 422)`).
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` -- patterns; `backend/tests/app/test_layout_api.py:95-122` `_max_size_import` + 4 MB test to mirror (import it or copy to a shared helper).
- `frontend/lib/api/plans.ts:93-210` -- wall types, `planWallKey`, `fetchPlanWall`, `usePlanWall`; schema via `npm run gen:api`.
- `frontend/modules/locations/locations-page.tsx` -- `LocationsWall` (header, tabs, `data-whole-warehouse` `<p>` → button), `WallMode` (aisle choice, `select`, `openList`, panel, `isSelectedWallMove`).
- `frontend/modules/locations/aisle-choice.ts` -- `readStoredAisle`/`storeAisle`/`chooseAisle`; extend with scope.
- `frontend/modules/locations/aisle-tabs.tsx` -- tab look (plate, BEST tag, `aisleTabMoves`) to mirror in cards.
- `frontend/components/common/segmented-control.tsx` -- `SegmentedControl` (radio group, arrows).
- `frontend/components/common/wall/model.ts` -- `cellRect`, `runTops`, `wallNaturalSize`; `moves.ts:120` `arrowPath`; `moves-layer.tsx:187-192` arrow casing/accent; `class-fill.ts` `CLASS_FILL`; `key.tsx` `Key`.
- `frontend/lib/copy/index.ts:483` `wholeWarehouseFigure`, `aisleTabMoves`, `percentText`, `BEST_TAG`; add the new strings.
- `frontend/lib/view-state/urls.ts` -- `planStepHref`, `wallMoveQuery`, `isSelectedWallMove`; `lib/view-state/storage.ts` `planWallStorageKey`.
- Tests: `frontend/tests/wall.test.tsx` (patterns, `WALL` fixture), e2e `frontend/e2e/locations-wall.spec.ts` (setup: `createSamplePlan`, `postCommand`, `getJson`).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/wall.py` -- add the models, `build_warehouse_view` and the shared counts helper.
- `backend/swp/app/wall.py`, `backend/swp/api/routers/wall.py` -- add the service and the route.
- `backend/tests/domain/test_wall_view.py` -- `test_fr42_warehouse_view_*`: counts equal the wall view's, top class or None per location, moves across all aisles, run None before a run and round/count after it, and the version.
- `backend/tests/app/test_wall_api.py` -- `test_fr42_warehouse_endpoint_*`: sample plan 200 with 2,000 locations, unknown plan 404, writes nothing, max-size import under 4 MB.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerate the schema; add the types, key, fetch and hook.
- `frontend/lib/copy/index.ts` -- figures, control label and options, card line, selected-move line.
- `frontend/modules/locations/aisle-choice.ts` -- scope read, write and choose.
- `frontend/modules/locations/mini-wall.tsx`, `warehouse-view.tsx` (new) -- the cards, mini-walls, figures, route overlay and Key.
- `frontend/modules/locations/locations-page.tsx` -- the control in the header, the figure button and the scope switching in `WallMode`.
- `frontend/tests/warehouse.test.tsx` (new) -- matrix rows: the scope choice, figures and the no-run text, card text and BEST tag, mini-wall `aria-hidden` with no text, a card click calling select, the route present only for a found move, and the selected-move line.
- `frontend/e2e/locations-warehouse.spec.ts` (new) -- `uj1` test per the ACs below.

**Acceptance Criteria:**
- Given a sample plan with aisle A marked and round 1 run, with a cross-aisle recommendation selected via `?aisle=<from>&rec=<id>` at 1440px, when the planner focuses "One aisle" and presses ArrowRight, then the page shows the four figures from the API, 9 cards in order A–I in 3 columns, card A with a BEST tag, and one `[data-warehouse-route]` path.
- Given Whole warehouse is chosen, when the page is reloaded without `?aisle=`, then Whole warehouse is still shown.
- Given Whole warehouse, when card B is clicked, then One aisle opens with tab B selected. When the whole-warehouse figure button is then clicked, Whole warehouse shows again.
- Given a 1100px viewport, the cards sit in 2 columns; at 900px they sit in 1 column, and the page does not scroll sideways.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 30 findings — high 0, medium 3, low 19, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (verification-gap) Leaving Whole warehouse through the header control is never tested — e2e now presses ArrowLeft on "Whole warehouse", asserts the One aisle grid, `aisle=` in the URL, focus on "One aisle" and a reload staying on One aisle.
  - `[low]` `[patch]` (verification-gap) A card click keeping `?rec=` is not asserted — e2e now clicks the to-aisle card of the cross-aisle move and asserts `aisle=` and `rec=` in the URL.
  - `[false]` `[reject]` (blind) The diff leaves out `schema.ts` and the spec — both were left out of the review diff on purpose; `npm run gen:api` reproduces `schema.ts` byte for byte (same hash twice).
  - `[medium]` `[patch]` (blind) Keyboard focus falls to `<body>` on a scope switch, because the focused control unmounts — the new control focuses its checked radio once on mount (`focusOnMount`, flag set by the switch handlers); e2e asserts focus after ArrowLeft and after the figure button.
  - `[medium]` `[patch]` (blind) The header (control, search) is missing while the warehouse view loads or fails, so a failed read leaves no way back to One aisle — `WarehouseMode` always renders the header; only the body switches.
  - `[low]` `[patch]` (blind) "One aisle" does nothing when no aisle is known — `toAisle` takes an optional aisle and always switches (grouped with the edge-case row below).
  - `[low]` `[reject]` (blind) Mini-walls re-render on every measurement — the sample has 2,000 cells and `measure` sets state only when a box changes; memoising adds structure for no observed cost.
  - `[false]` `[reject]` (blind) An occupied cell with no class is drawn as dead — import rejects negative quantities (`swp/domain/import_.py:203`), so `is_occupied` (any non-zero stock) and `_top_class` (stock > 0) agree.
  - `[low]` `[reject]` (blind) The figure button's name does not say it switches — its name already reads "… whole warehouse …", the story calls it the whole-warehouse figure; an extra label is copy nobody asked for.
  - `[low]` `[patch]` (blind) The deep-link and unknown-id rows have no UI test — e2e now covers `?aisle=C` over a stored Whole warehouse (then a plain load stays on One aisle) and `?rec=nope` (no route, no selected-move line).
  - `[low]` `[reject]` (blind) The 4 MB test has no moves — moves are bounded by one run's recommendations (hundreds, about 600 bytes each), far from the margin; building a run on the synthetic import adds a large fixture.
  - `[low]` `[reject]` (blind) `readStoredAisle` is used only by tests and `usePlanWarehouse(enabled)` always gets `true` — harmless; the hook mirrors `usePlanWall`.
  - `[low]` `[patch]` (blind) `WarehouseView` has no docstring — added; schema regenerated.
  - `[low]` `[patch]` (blind) An overlong comment line in `components/common/wall/index.ts` — reflowed.
  - `[low]` `[patch]` (blind) The e2e test uses `!` before asserting the move exists — the `!` is gone; the test asserts, then narrows with a guard.
  - `[medium]` `[patch]` (edge) With storage blocked, Whole warehouse is unreachable, because the scope is read back from storage only — the scope now lives in `WallMode` state seeded from storage; an explicit `?aisle=`/`?loc=` forces One aisle when the URL changes.
  - `[low]` `[patch]` (edge) One aisle is a no-op when the aisle is undefined (layout loading or failed) — same fix as the blind row above.
  - `[false]` `[reject]` (edge) `LocationsWall` without `onScopeChange` renders dead controls — the only production caller always passes it; the prop is optional only for tests.
  - `[false]` `[reject]` (edge) An occupied location with a null class paints as dead — negative stock cannot be imported (see above).
  - `[false]` `[reject]` (edge) The API can return occupied with a null class for negative stock — same refutation.
  - `[low]` `[reject]` (edge) The route can go stale if a card reflows without the grid resizing — a card height change changes the row and the grid container in practice; observing each mini-wall adds observers for a rare case.
  - `[low]` `[reject]` (edge) Search in Whole warehouse opens the panel without moving to the part's aisle — the spec's line is about URL deep links; the panel's location chip opens the wall at that location.
  - `[low]` `[reject]` (intent) The route's on-screen end points are not checked in the browser — `warehouseRoute` is unit-tested and the implementer checked screenshots; pixel e2e assertions would be brittle.
  - `[low]` `[patch]` (intent) Arrow keys are exercised in one direction only — ArrowLeft back to One aisle added (same patch as the first verification-gap row).
  - `[low]` `[reject]` (intent) Per-plan scope is not tested against a second plan — the key is `planWallStorageKey(planId)`, already tested per plan for the aisle.
  - `[low]` `[reject]` (intent) A move cannot be selected inside Whole warehouse — the story starts from "Given a selected move"; selection stays in One aisle and Recommendations.
  - `[false]` `[reject]` (intent) Mini-walls use colour without a symbol — the story says "without glyphs", and the picture is `aria-hidden` with every fact as card text.
  - `[low]` `[reject]` (intent) The breakpoints are checked at one width each — `lg`/`xl` are the 1024/1280 Tailwind defaults; one width per band shows the column count.
  - `[false]` `[reject]` (intent) Open retro items are not taken into account — none of the open items targets the Locations wall or the wall view (items 11 and 26 checked: no earlier spec defers anything to 10.6).
  - `[false]` `[reject]` (intent) Additions beyond the story — each is a recorded spec decision (size limit, no-run text, selected-move line, URL handling).

## Design Notes

A dedicated compact view beats nine `/wall?aisle=` reads. Nine reads would mean nine replays per refetch and nine full part lists, and they would give no guarantee of a single version. A mini-wall needs only occupancy and the top class per code, so 25,000 rows fit well under the 4 MB limit. The function stays in the wall slice because it shares the move entries and counts. A deep link with `?aisle=` wins over the stored scope, so that **Show on the Locations wall**, search and LocationChips always land on a real aisle.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean
- `uv run --directory backend --locked ruff format --check .` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm run gen:api` -- expected: no further schema diff
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass

## Auto Run Result

**Summary.** The Locations wall now has a **One aisle | Whole warehouse** segmented control in the page header, next to the search field (FR-42, UX-DR45/58, AD-15).
- **Server view.** Whole warehouse reads the new read-only `GET /api/plans/{id}/warehouse`. It is built from one replay and returns:
  - every location's occupancy and top-part class;
  - every wall move entry across all aisles;
  - the latest run's round and number of recommendations;
  - the same per-aisle and warehouse counts as the wall view, through one shared helper.
- **What Whole warehouse shows.**
  - Four figures: occupied %, empty locations, best locations with how many are empty, and recommendations in the round. Before the first run the last one reads "No recommendations yet".
  - Nine aisle cards in server order, 3, 2 or 1 per row by viewport width. Each card is a button with the letter plate, a BEST tag for an aisle mark, the %, "occupied of total · empty", the moves count and an `aria-hidden` mini-wall. A card opens its aisle in One aisle.
  - The Key under the cards.
- **Selected move.** A move chosen with `?rec=`/`?move=` is drawn as one cased violet route across the cards. A text line names it.
- **Switching.** In One aisle, the whole-warehouse figure is now a button that switches to Whole warehouse.
  - The scope lives in component state and is remembered per plan in `swp:plan:<id>:wall` as `{aisle, scope}`.
  - A `?aisle=` or `?loc=` link always opens One aisle.
  - After a switch, focus lands on the new control's checked option.

**Files changed**
- `backend/swp/domain/views/wall.py` -- `WarehouseLocation`, `WarehouseRun`, `WarehouseView`, `build_warehouse_view`, and the shared `_facts`/`_aisle_counts`/`_top_class`.
- `backend/swp/app/wall.py`, `backend/swp/api/routers/wall.py` -- the `warehouse()` service and its GET route.
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` -- `test_fr42_warehouse_view_*` (4) and `test_fr42_warehouse_endpoint_*` (4, including 25,000 stocked locations under 4 MB).
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerated schema; types, `planWarehouseKey`, `usePlanWarehouse`.
- `frontend/lib/copy/index.ts` -- control label and options, the four figures, the card line, the selected-move line.
- `frontend/modules/locations/aisle-choice.ts` -- `{aisle, scope}` storage, `chooseScope`.
- `frontend/modules/locations/mini-wall.tsx` (new), `warehouse-view.tsx` (new) -- mini-walls, cards, figures, route overlay, `ScopeControl`.
- `frontend/modules/locations/locations-page.tsx` -- header control, figure button, `WallMode`/`AisleMode`/`WarehouseMode`.
- `frontend/components/common/wall/moves-layer.tsx`, `index.ts` -- `MOVE_ARROW` colours exported for the route.
- `frontend/tests/warehouse.test.tsx` (new), `frontend/tests/wall.test.tsx` -- unit tests; one storage assertion updated.
- `frontend/e2e/locations-warehouse.spec.ts` (new) -- two `uj1` tests: the full journey, and the load error.

**Review findings.** 30 findings: high 0, medium 3, low 19, false 8.
- **Patched (3 medium, 10 low rows).**
  - Medium:
    - Focus is kept after a scope switch.
    - The header shows while the view loads or fails.
    - The scope is held in state so Whole warehouse works with storage blocked.
  - Low:
    - One aisle works without a known aisle.
    - The `WarehouseView` docstring.
    - The comment reflow.
    - The e2e `!`.
    - New e2e paths: ArrowLeft back, card click keeping `rec`, deep link over the stored scope, unknown `rec`.
- **Deferred.** None.
- **Rejected (9 low, 8 false).** Each has its reason in the Review Triage Log.
  - Low: mini-wall memoisation; the figure button name; the 4 MB test without moves; dead `readStoredAisle` and `enabled`; stale route on card-only reflow; search not moving to the part's aisle; route pixels in e2e; per-plan scope against a second plan; in-view move selection; breakpoint spot checks.
  - False: the schema missing from the diff; the dead-class fallback (rows by blind and edge); dead controls without `onScopeChange`; colour without a symbol; retro items; additions beyond the story.

**Follow-up review recommendation:** `true`. Three medium entries were patched (patched counts: high 0, medium 3, low 7 entries). The unverified risk is the scope state machine in `WallMode`. The chosen-scope state, the URL-change reset and the focus-on-mount flag interact across `replaceState` renders. This is covered only by Chromium e2e. Firefox and Edge were not run. One case is untested: a switch to One aisle that lands on the aisle load-error screen leaves the focus flag set until the next control mounts.

**Verification** (after the patches, against baseline `52af81b8918ba7c15ad6d718e002d2edf23ad15f`)
- `npm run lint:py` -- All checks passed.
- `npm run lint:imports` -- 5 kept, 0 broken.
- `uv run --directory backend --locked ruff format --check .` -- 180 files already formatted.
- `npm run lint`, `npm run typecheck` -- exit 0.
- `npm run gen:api` -- stable (same hash on two runs after the docstring change).
- `npm test` -- pytest 955 passed, 2 skipped; Vitest 560 passed (34 files).
- `npm run e2e -- --project=chromium` -- 118 passed.
- Matrix audit: every I/O row has a passing test.
  - Before any run: `test_fr42_warehouse_view_run`, `fr42_warehouse_figures_and_no_run_text`.
  - Cross-aisle route: e2e plus `fr42_warehouse_route_only_for_a_found_move`.
  - Unknown id: e2e `?rec=nope`.
  - Stored scope: e2e reload.
  - Deep link: e2e `?aisle=C` plus `fr42_warehouse_scope_url_wins_over_stored`.
  - Bad JSON: `fr42_warehouse_scope_bad_stored_json_is_one_aisle`.
  - Empty location: `fr42_warehouse_mini_wall_is_decorative` and the domain top-class test.
  - Widths: e2e at 1100 and 900px.
  - Read fails: e2e load-error test.

**Residual risks**
- Firefox and Edge e2e were not run, and neither were real screen readers.
- A route between far-apart cards crosses other cards, and its arrowhead is small at overview scale.
- The route's measuring code is covered only by e2e.
