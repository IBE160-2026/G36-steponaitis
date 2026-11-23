---
title: 'Story 10.2: Draw one aisle as a bin wall with its Key'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '4f8730321ac4124f8446dfcd6dbb6e1333aa2240'
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

**Problem:** The Locations step is still the milestone 1 table. Milestone 2 (FR-42, UX-DR40/41/45/48) makes the open aisle a graphite bin wall with a Key, aisle tabs and an aisle header, fed by a plan-scoped wall view. Story 10.1's layout gives the cells; nothing yet gives occupancy, parts, best and counts per cell.

**Approach:** A pure domain view `swp/domain/views/wall.py` built from one `replay` serves `GET /api/plans/{id}/wall?aisle=`. The frontend joins it with the import layout (`useImportLayout`) by location code and draws SVG wall primitives in `frontend/components/common/wall/`. The Locations step shows the wall by default and the existing table under **Open as list**.

## Boundaries & Constraints

**Always:**
- Wall view (one `planning_copy`, read-only, version = plan version): `aisle`; `locations` = every location of that aisle in `location_order`, each `{location: LocationRef, walk_path, occupied, parts, top_part, covering_marks}`. `parts` holds the parts with stock > 0 as `{part, description, movement_class, picks, stock, kept_in_place}` in `part_order` (most picks first, ties by part number). `top_part` is the first of them, or null. `rail_levels` lists the levels of the aisle covered by an aisle mark or a level mark (this aisle or all aisles), in `level_key` order. `aisles` gives the counts for every aisle in `aisle_order` as `{aisle, locations, occupied, empty, occupied_percent, best, empty_best, moves, aisle_marked}`. `warehouse` = `{locations, occupied, empty, occupied_percent, best, empty_best}`. Percent comes from `occupied_percent`. `moves` = the latest run's recommendations whose `from_location` is in the aisle, or whose to-location is (the applied step's `to_location` when applied, else the recommendation's). It is 0 before any run. `aisle_marked` = an aisle mark names the aisle.
- `aisle` query param is required (max 64 chars). An aisle not in the import gives 404 `not_found` "This aisle is not in the plan." An unknown plan gives `plan_not_found` (reuse `require`).
- The frontend never computes occupancy, best or counts. It only joins layout cells to wall locations by `code`, picks rail/frame/BEST labels from server flags, and formats text in `lib/copy`.
- Wall query key `[...planRootKey(planId), "wall", aisle]` (so commands refetch it). Page data goes through `usePanelPlanData`, so the wall and the part panel render only at agreeing versions. The layout comes from `useImportLayout(summary.import_id)`.
- Wall primitives in `frontend/components/common/wall/`: `Bin`, `Slot`, `SlotNone`, `WallPanel` (louvre graphite, uprights at each section start, a 4px beam under each level, a section header row and level labels per run, two runs, end cap "End of aisle A · Walk Path 2,270 →" using layout `walk_path_last`), and `Key`. Every colour is a full `var(--color-…)` name written in source. A shared `CLASS_FILL` map (full var names) is used by `Bin`, the Key and `bin-swatch.tsx`. This fixes the Story 9.6 note: the swatch builds `var(--color-class-${…})`, which Tailwind may not emit.
- Bin: body in the top part's class colour, lip shading, white label window with the glyph. Two parts give a split window with one glyph per half. Three or more show the top part's glyph plus a "+" tick. FST/MED/SLW/DED only when drawn ≥56px wide. The front page's `LargeBin`/`EmptySlot` are replaced by the shared `Bin`/`Slot` with an unchanged picture.
- Size: natural bin pitch 30px (bin 27); scale = clamp(containerWidth / naturalWidth, 1, 35/27). The panel scrolls in 2D (`overflow:auto`, bounded height) and never shrinks bins below 27px.
- Best: a level in `rail_levels` gets a 4px `--color-best` rail and a BEST tag on its level label. A best cell with no aisle/level covering mark gets a 2px green frame, and its run's level label shows "BEST n" (n = framed cells in that level row of that run). A cell under a rail gets no frame. An aisle tab whose `aisle_marked` is true shows a BEST tag. Use `--color-best-on-light` on paper.
- Data hooks for tests on each cell `<g>`: `data-cell=<code>`, `data-occupied`, `data-best="rail|frame|none"`, `data-class` (top part), `data-parts=<count>`. Gaps carry `data-gap`. Rails carry `data-rail=<level>`.
- Locations page: h1 "Locations" + SearchField. Below it, aisle tabs (`role="tablist"`, arrow keys/Home/End, one tab stop) in server order. Each tab shows its letter plate, "86.8%" and "7 moves"/"1 move". After the tabs comes the plain text "79.2% whole warehouse · 1,584 of 2,000 · 416 empty · 174 best". The tabpanel holds an h2 "Aisle A" and the line "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270" (singular "1 location"/"1 best location"). On the right sit tertiary **Open as list** and a link **Edit best-location marks** (`planStepHref(planId,"best-locations",{aisle})`). Then the wall, `role="img"` named "Bin wall of aisle A. Open as list reads every location as text.", and then the Key.
- Key: an always-visible labelled list "Key" in this order: Fast-moving, Medium-moving, Slow-moving, Dead stock, Empty, Best location, Selected, 2 parts. Each entry is a 16×18 miniature of the real graphic plus its glossary name, as plain text with no buttons and no colour words.
- Aisle choice: valid `?aisle=` → else stored `swp:plan:<id>:wall` (JSON `{aisle}`, via `lib/view-state/storage` try/catch helpers) → else the first layout aisle. Choosing a tab stores it and writes `?aisle=` with `history.replaceState` via `planStepHref`, keeping `part`.
- List mode is on when `?mode=list` or `?loc=` is present (location links keep focusing the table row until Story 10.3). `mode` joins `VIEW_QUERY_KEYS`/`parseLocationParams`. **Open as list** writes `?aisle=<aisle>&mode=list`. The table's own aisle change writes `mode=list` too. List mode shows today's `LocationsView` (occupancy lines + table) plus a tertiary **Open as wall** that drops `mode` and `loc`.
- Tests are named for FR-42/FR-14/FR-22 (`test_fr42_wall_*`); the e2e test is named after UJ-1 (`uj1 …`) and imports `test`/`expect` from `frontend/e2e/support/test.ts`.

**Never:** No wall grid keyboard navigation, tooltips, move markers, Whole warehouse view, One aisle | Whole warehouse switch, marking on the wall or Key buttons (Stories 10.3–10.7, Epic 11). No new write endpoint. No code parsing or cell derivation in the frontend. No edits to `data/sample/`, `data/answer-key/` or `.docs/planning-artifacts/`. No session logs, nothing under `.logs/`, no commits, no deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sample plan, no marks | `GET …/wall?aisle=A` | 223 locations in `location_order`; `aisles` A–I with counts matching `/locations`; warehouse 1,584 of 2,000, 79.2%; `rail_levels` []; `moves` all 0 | — |
| Parts and top part | location holding 2 parts with picks 3 and 9 | `parts` ordered 9 then 3; `top_part` the 9-pick part; `occupied` true; zero-stock rows left out | — |
| Marks | aisle mark A + level mark L1 in all aisles + location mark B-x | A: `rail_levels` all levels, `aisle_marked` true; B: `rail_levels` ["1"], the B-x cell best with one location `covering_marks`; best/empty_best match `best_counts` | — |
| Run touching aisle | after a run with recs from A to B | A and B `moves` count those recs; applied-to-other-location counts the applied target aisle | — |
| After a move | manual move A→empty slot | `version` increases; source cell empty/target occupied | — |
| Unknown aisle | `?aisle=Z` | 404 `not_found` | error envelope |
| Missing aisle / unknown plan | no `aisle` / random UUID | 422 / 404 `plan_not_found` | error envelope |

</intent-contract>

## Code Map

- `backend/swp/domain/views/locations.py` -- pattern to mirror. Its `occupied_percent` moves to a new kernel module `backend/swp/domain/views/common.py` (locations imports it from there): `domain-slices` in `backend/.importlinter` forbids `views.wall` importing `views.locations`.
- `backend/swp/domain/planning.py` -- `planning_copy`, `replay`, `location_ref`, `covering_marks`, `is_occupied`, `is_empty`, `best_counts`, `latest_run`, `applied_step`, `stock_at`; `LocationRef:512`.
- `backend/swp/domain/ordering.py` -- `location_order`, `aisle_order`, `level_key`, `part_order`.
- `backend/swp/domain/state.py` -- `BestMark` kinds, `Recommendation`, `Step`, `keep_marks`.
- `backend/swp/domain/views/parts.py` -- how class/picks come from `analysis.parts`, and `kept_in_place = part in state.keep_marks`. Every Inventory part has an analysis entry (`classify.classify_parts`).
- `backend/swp/app/locations.py`, `backend/swp/api/routers/locations.py`, `backend/swp/api/app.py:60` -- thin service/router pattern and the guarded router list; `backend/.importlinter` -- add `swp.domain.views.wall` to `domain-slices` (`views.common` is kernel, not listed).
- `backend/tests/app/test_parts_api.py` (`_sample_plan`), `backend/tests/app/test_login.py` (`test_fr40_guard_covers_every_data_router`), `backend/tests/domain/conftest.py` -- fixtures/patterns.
- `frontend/lib/api/plans.ts` -- add `planWallKey`, `fetchPlanWall`, `usePlanWall(planId, aisle, enabled)`, types `WallView`, `WallLocation`, `WallPart`, `AisleCounts`; `frontend/lib/api/imports.ts` -- `useImportLayout`; `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `frontend/components/common/part-panel.tsx:350` -- `usePanelPlanData` (version agreement, AD-12).
- `frontend/modules/locations/locations-page.tsx` -- current table page; it becomes list mode.
- `frontend/components/common/locations-table.tsx` -- `occupancyLine`, table; `frontend/components/common/segmented-control.tsx` -- `nextRadioIndex` for tab keys.
- `frontend/modules/front-page/bin-wall.tsx` -- existing large bin/slot/louvre drawing (`CLASS_FILLS` with full var names, explained in a comment); `frontend/modules/front-page/front-page.tsx:169` uses `LargeBin`.
- `frontend/components/common/bin-swatch.tsx:33` -- the dynamic var name to fix; `frontend/components/common/class-glyph.tsx`.
- `frontend/app/globals.css` -- tokens (`--color-wall*`, `--color-slot-*`, `--color-beam`, `--color-upright`, `--color-best*`, `--color-accent`, `--spacing-bin-*`).
- `frontend/lib/copy/index.ts` -- `CLASS_LABELS`, `plural`; add the wall strings here (retro item epic-6-54: copy lives in `lib/copy`).
- `frontend/lib/view-state/urls.ts` (`VIEW_QUERY_KEYS`, `LocationParams`, `parseLocationParams`, `planStepHref`), `frontend/lib/view-state/storage.ts` (add `planWallKey`).
- `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/mockups/warehouse-layout.svg` -- visual reference (wall, tabs, header, Key row at y≈776); DESIGN.md `components:` bin/slot/wall-panel/best-*/aisle-tab/legend.
- Existing e2e that open `/locations` and expect the table: `frontend/e2e/locations-table.spec.ts`, `reopen-plan.spec.ts`, `part-panel-search.spec.ts`, `views-follow-planning-copy.spec.ts`, `manual-move.spec.ts:234`, `best-locations.spec.ts:163`. Update them to the list mode (`&mode=list` or click Open as list) only where they need the table.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/common.py`, `backend/swp/domain/views/locations.py` -- move `occupied_percent` to the kernel.
- `backend/swp/domain/views/wall.py` -- new models + `build_wall_view(data, analysis, state, version, aisle)`; unknown aisle raises `DomainError("not_found", …)`.
- `backend/swp/app/wall.py`, `backend/swp/api/routers/wall.py`, `backend/swp/api/app.py`, `backend/.importlinter` -- service + guarded `GET /api/plans/{plan_id}/wall` (`aisle: str` query, `error_responses(404, 422)`).
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` (+ guard entry in `test_login.py`) -- every matrix row.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerate; wall key/fetch/hook/types.
- `frontend/lib/view-state/urls.ts`, `storage.ts` -- `mode` key, `planWallKey`.
- `frontend/lib/copy/index.ts` -- `wallAisleLine`, `wholeWarehouseFigure`, `aisleTabMoves`, `endCapLabel`, `bestCountTag`, Key labels, `OPEN_AS_LIST`, `OPEN_AS_WALL`, `EDIT_BEST_MARKS`.
- `frontend/components/common/wall/` (`class-fill.ts`, `bin.tsx`, `slot.tsx`, `wall-panel.tsx`, `key.tsx`, `index.ts`) and `bin-swatch.tsx` -- primitives; swatch uses `CLASS_FILL`.
- `frontend/modules/front-page/bin-wall.tsx`, `front-page.tsx` -- use shared `Bin`/`Slot`.
- `frontend/modules/locations/` (`locations-page.tsx`, new `aisle-tabs.tsx`, `aisle-wall.tsx`) -- wall default, list mode, aisle choice.
- `frontend/tests/wall.test.tsx` -- Bin variants (1/2/3+ parts, ≥56px code), Key order/names with no colour words, swatch fill is a full var name, cell flags from a fixture (rail vs frame, BEST n, gap), copy lines, aisle choice order (URL > stored > first) with blocked storage.
- `frontend/e2e/locations-wall.spec.ts` + updated existing specs -- see AC.

**Acceptance Criteria:**
- Given a sample plan with aisle A marked, when `/plans/{id}/locations` opens, then the "Aisle A" wall shows with 223 cells, a BEST tag on aisle tab A and on every level label, rails on every level, the header line from the API, the Key in order, and a fast bin whose computed fill is `rgb(216, 81, 68)` (not black).
- Given the wall, when the tab for B is chosen (click or ArrowRight), then the URL is `?aisle=B` and, after a reload and a visit to another step, the Locations step reopens on B.
- Given the wall, when **Open as list** is clicked, then the table filtered to that aisle shows (URL `?aisle=A&mode=list`), and **Open as wall** returns.
- Given the wall open on an aisle, when a manual move or undo is confirmed elsewhere on the page (part panel), then the wall refetches and the moved cells change occupancy.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 26 findings — high 0, medium 3, low 9, false 14, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) Open as list read `data.view.aisle` first, so during the keepPreviousData window it opened the previous aisle — `openList` now uses the chosen `aisle`.
  - `[low]` `[patch]` (blind) While the next aisle loads, the tabpanel labelled by the new tab shows the old aisle with no busy signal — tabpanel gets `aria-busy` while `view.aisle !== selected`.
  - `[medium]` `[patch]` (blind) Only a tab click stored the last aisle, so a deep link or Open as wall reopened a stale aisle — an effect stores whichever aisle the wall opens on; the stored aisle is read on every render.
  - `[low]` `[reject]` (blind) An import with no aisles shows the loading state forever — an import needs a Locations file with rows (FR-3/FR-6 validation), so a layout with zero aisles is not reachable in everyday use; a guard adds a new branch.
  - `[low]` `[reject]` (blind) Summary → layout → wall load in sequence, and list mode calls the summary — the summary and layout are cached (layout immutable) after the first open; changing the wall contract to carry the import id adds public surface for a one-time delay.
  - `[medium]` `[patch]` (blind) The 2D scroll box had no tab stop, so keyboard users could not scroll the wall at narrow widths; `useWidth` starts at 0 — the box gets `tabIndex=0`, `role="region"` and "Aisle A wall, scrollable"; the one-frame scale jump is rejected as cosmetic.
  - `[low]` `[patch]` (blind) `planWallKey` existed in both `lib/api/plans.ts` and `lib/view-state/storage.ts` with different meanings — the storage one is renamed `planWallStorageKey`.
  - `[low]` `[reject]` (blind) `wall.py` counts re-implement `locations._occupancy` and `best_counts` — `test_fr42_wall_counts_match_locations_view` pins both against each other; sharing needs a new kernel counter shape for two different row types, more than a direct correction.
  - `[low]` `[reject]` (blind) `is_best` computed twice per aisle location and counts re-filtered per aisle — at most 25,000 locations; no NFR budget is at risk and the fix restructures the builder.
  - `[false]` `[reject]` (blind) `_UNCLASSIFIED` silently shows a part without analysis as dead stock — `classify_parts` gives every Inventory part an entry and steps only move Inventory parts, so the fallback is unreachable.
  - `[low]` `[patch]` (blind) `?aisle=` (empty) gave 404 instead of 422 — `Query(min_length=1, max_length=64)`, 422 asserted in `test_wall_api.py`.
  - `[false]` `[reject]` (blind) Key lists Selected though nothing draws it, and has no rail entry — the Key's entries and order are fixed by the story AC and UX-DR48; selection is drawn by Story 10.4.
  - `[low]` `[patch]` (blind) Aisle tab ids carried raw aisle text (whitespace breaks `aria-labelledby`); unknown selected falls back to tab 0 — ids now use `encodeURIComponent(aisle)`; the fallback is unreachable because `chooseAisle` only returns layout aisles.
  - `[low]` `[reject]` (blind) `mode` typed as any string — any value other than `list` opens the default wall, which is the intended fallback; no caller writes another value.
  - `[false]` `[reject]` (blind) Missing tests (tab Home/End, location-mark e2e, loading window, hard-coded fast rgb) — tab keys reuse `nextRadioIndex` (tested with the segmented control), rail vs frame and BEST n are covered in `wall.test.tsx` and the API test, and the fixed rgb is the deliberate Story 9.6 "not black" check.
  - `[false]` `[reject]` (blind) `CLASS_FILL` lives under `components/common/wall/` and `MovementClass` has two import paths — `class-glyph` re-exports the `lib/copy` type (one source); the folder is within `components/common`, so no module boundary is crossed.
  - `[low]` `[patch]` (verification-gap) No test that a tab change and Open as list keep `part`, or that Open as wall from a `?loc=` URL drops `loc` — added an e2e test in `locations-wall.spec.ts` covering all three.
  - `[medium]` `[patch]` (edge) Stored aisle read once at mount, so a nav click dropping `?aisle=` while mounted jumps to a stale aisle — same root cause and fix as the blind aisle-memory finding.
  - `[medium]` `[patch]` (edge) Open as list during the loading window lists the previous aisle — same root cause and fix as the blind Open as list finding.
  - `[low]` `[patch]` (edge) Tabpanel labelled by the new tab shows the old aisle — same as the blind busy finding.
  - `[low]` `[patch]` (edge) Vertical scrollbar toggling `clientWidth` can make the scale oscillate — the scroll box has `[scrollbar-gutter:stable]`.
  - `[low]` `[reject]` (edge) Zero-aisle layout shows the loading state forever — same as the blind finding (unreachable import).
  - `[low]` `[patch]` (edge) Aisle text in DOM ids breaks `aria-labelledby` — same fix as the blind tab-id finding.
  - `[false]` `[reject]` (edge) Duplicate React keys for uprights when two sections share a `columnX` — `columnX` adds a section gap per section index and layout spans have distinct `first_column`s, so x values are distinct.
  - `[false]` `[reject]` (edge) A layout code missing from the wall view on a railed level is drawn as rail — layout and wall come from the same import, so every layout code is in the wall view.
  - `[false]` `[reject]` (intent) The milestone condition is unconditional, the response is wider than the AC list, visual values are checked structurally — descriptive audit: the diff implements the reading that milestone 2 is the current build stage (no runtime milestone flag exists), the extra fields serve the AC's tabs and figure, and the one rendered-colour check covers the Story 9.6 note; no defect.

## Auto Run Result

**Summary.** The Locations step now opens on a bin wall (FR-42, UX-DR40/41/45/48). `GET /api/plans/{id}/wall?aisle=` (pure `swp/domain/views/wall.py`, one planning copy) returns the aisle's locations with occupancy, parts (number, description, class, picks, stock, kept in place, most picks first), top part, best and covering marks, the rail levels, every aisle's counts (occupied, empty, %, best, empty best, latest-run moves, aisle mark) and the warehouse counts. The frontend joins it by code with the immutable import layout (Story 10.1) and draws shared SVG primitives from `components/common/wall/`: Bin (split label, "+" tick, class code only at 56px or wider), Slot, SlotNone, WallPanel (louvre, uprights, beams, two runs, level labels with BEST / BEST n, rails, frames, end cap) and the Key. Above the wall are aisle tabs (tablist, arrow keys) with the whole-warehouse figure, plus the aisle header line, **Open as list** and **Edit best-location marks**. The aisle opens from the URL, else the plan's stored last aisle, else the first. `?mode=list` or any `?loc=` shows the milestone 1 table with **Open as wall**. Bins scale between 27 and 35px and the panel scrolls in 2D. The wall query sits under `['plan', planId]` and renders through `usePanelPlanData`, so it refetches after commands and pairs with the part panel only at agreeing versions. The Story 9.6 note is fixed: `bin-swatch.tsx` and every bin use one `CLASS_FILL` map of full `var(--color-class-…)` names, and the e2e test checks a wall bin's computed fill is `rgb(216, 81, 68)`. The front page uses the shared Bin and Slot.

**Files changed**
- `backend/swp/domain/views/common.py` (new, `occupied_percent`), `views/locations.py` -- percent moved to the kernel.
- `backend/swp/domain/views/wall.py`, `backend/swp/app/wall.py`, `backend/swp/api/routers/wall.py`, `backend/swp/api/app.py`, `backend/.importlinter` -- wall view, service, guarded route, slice contract.
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py`, `test_login.py`, `test_locations_view.py`, `test_views_follow_planning_copy.py`, `tests/rules/test_layer_rules.py` (kernel list) -- tests.
- `frontend/components/common/wall/*` (`class-fill`, `bin`, `slot`, `wall-panel`, `key`, `model`, `index`), `bin-swatch.tsx` -- primitives and the swatch fix.
- `frontend/modules/locations/` (`locations-page.tsx`, `aisle-tabs.tsx`, `aisle-wall.tsx`, `aisle-choice.ts`) -- wall default, list mode, aisle memory.
- `frontend/modules/front-page/bin-wall.tsx`, `front-page.tsx`, `copy.ts` -- shared Bin/Slot; codes moved to `lib/copy`.
- `frontend/lib/api/plans.ts`, `schema.ts`; `lib/copy/index.ts`; `lib/view-state/urls.ts`, `storage.ts` -- wall API, copy, `mode` key, `planWallStorageKey`.
- `frontend/tests/wall.test.tsx`, `frontend/e2e/locations-wall.spec.ts` (new); `e2e/locations-table`, `reopen-plan`, `part-panel-search`, `views-follow-planning-copy`, `manual-move`, `best-locations` specs moved to list mode where they need the table.

**Review findings.** 26 findings. 10 rows patched in 8 fixes: 3 medium entries (Open as list stale aisle, aisle memory, keyboard-scrollable wall) and 5 low entries (busy tabpanel, storage key rename, empty-aisle 422, tab ids, URL-state e2e test, plus scrollbar gutter). 0 deferred. 16 rejected (14 false, 2 merged unreachable zero-aisle rows and 5 other lows), each with its reason in the Review Triage Log.

**Follow-up review recommendation:** `true` — three medium entries patched (high 0, medium 3, low 5). Unverified risk: the aisle-memory effect (stores the aisle the wall opens on, read each render) has no e2e for the deep-link and Open-as-wall paths. Also, the new tab stop on the scroll region must be reconciled with Story 10.3's single-tab-stop grid.

**Verification** (against baseline `4f8730321ac4124f8446dfcd6dbb6e1333aa2240`, after the patches)
- `npm run lint:py` -- All checks passed; `npm run lint:imports` -- 5 kept, 0 broken; `ruff format --check` -- 180 files already formatted.
- `npm run lint`, `npm run typecheck` -- clean.
- `npm run gen:api` -- `schema.ts` diff is only the wall additions (+140).
- `npm test` -- pytest 930 passed, 2 skipped; Vitest 479 passed (29 files).
- `npm run e2e -- --project=chromium` -- 106 passed.
- Matrix audit: every I/O row is covered by a passing test (`test_fr42_wall_*`/`test_fr22_wall_*` domain and API tests).

**Residual risks**
- Postgres was not run for the new API tests this story (SQLite only); the wall view is read-only and uses no new SQL.
- Firefox and Edge e2e were not run.
- Tab moves count only the latest run's recommendations; Story 10.4's drawer may also count manual moves of the round, which would change this figure.
- Retro item epic-2-16 (plan views load the whole import) stays open; the wall reads the plan through `require` like the other views.

## Design Notes

The join is by code: `layout.aisles[a].cells[i].location.code` → `wall.locations` entry. Unknown codes on either side are drawn as empty slots and never crash. Gaps come only from the layout. Rail vs frame example: a level mark L1 in A plus a location mark A-03-01-02 gives row L1 a rail and the BEST tag, and A-03-01-02 gets no frame. A location mark on A-03-02-01 alone gives that cell a frame and level 2 "BEST 1". Retro item epic-2-16 (plan views load the whole import) stays a Justas decision; the wall uses `require` like the other views.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && uv run --directory backend --locked ruff format --check` -- expected: clean
- `npm run gen:api` then `git diff --stat frontend/lib/api/schema.ts` -- expected: only the wall additions
- `npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass
