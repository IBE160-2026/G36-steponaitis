---
title: 'Story 2.6: Part panel and search'
type: 'feature'
created: '2026-11-21'
baseline_revision: '9cdf687bf7b531b16835b3ca9cb4bb034d4a0a29'
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

**Problem:** The planner can list parts, locations and pick groups, but cannot open one part to see all its facts in one place, and cannot find a part or a location by typing.

**Approach:** Add a part detail view (`GET /api/plans/{id}/parts/{part}`, in `domain/views/parts.py`) and a search view slice (`domain/views/search.py`, `GET /api/plans/{id}/search?q=`). In the frontend, add the common `PartPanel`, `LocationChip` and `SearchField` components; the panel opens from roster rows, pick-group parts and part search results, with `?part=` in the URL through `lib/view-state`; chips and location results open the Locations table at that aisle with the row focused.

## Boundaries & Constraints

**Always:**
- Part detail response `PartDetail`: `version`, `part`, `description`, `movement_class`, `picks`, `class_threshold: {min_picks: int, max_picks: int | null}` (from `analysis.settings`: fast `fast_min_picks`/null, medium `medium_min_picks`/`fast_min_picks-1`, slow `slow_min_picks`/`medium_min_picks-1`, dead `0`/`0`; never hard-coded), `total_stock: Dec`, `current_location: LocationRef | null`, `other_locations: [{location: LocationRef, stock: Dec}]` (location-code order from `planning.other_locations`), `pick_groups: [{partner: {part, description, aisle | null}, shared_jobs}]` from stored `analysis.pick_groups` containing the part, in `ordering.pick_group_order`; partner aisle = `aisle_of(current_location(partner))` or null. All facts from one `planning_copy` and the `planning.py` helpers; no re-derivation.
- A part not in `analysis.parts` (unknown, or only in Transactions) → 404 code `not_found`, message `No part {part} in this plan.`; unknown plan → 404 `plan_not_found`.
- Search: `q` is required; after `strip()`, an empty `q` returns empty lists. Matching is `q.casefold() in text.casefold()` against part number, part description (`data.parts`) and location code. Only parts with an analysis entry are searched; every location in the import is searched. Response `SearchView {version, query, parts: [{part, description, movement_class}], part_count, locations: [{location: LocationRef}], location_count}`; parts in `ordering.part_order`, locations in `ordering.location_order`, each list capped at the first 20 (`SEARCH_LIMIT = 20`), counts are the uncapped totals.
- `views/search.py` imports only the kernel; register it in the `domain-slices` contract with a BROKEN case. Read-only; plan `version` unchanged (FR-9). New router `api/routers/search.py`; part detail route in `api/routers/parts.py`.
- `lib/view-state/urls.ts` owns `?part=`: the params type gains `part?`, `planStepHref` and the parser handle it. Parts, Locations and Pick groups route pages pass the parsed params down.
- `PartPanel` (`components/common/part-panel.tsx`): a 400px right `aside` (`bg-surface`, 1px `border-border` left edge, no shadow), labelled by its heading. Shows part number (Barlow, `type-section-title`) as the `h2` heading (`tabIndex=-1`, focused on open), description, class with `ClassGlyph` and label, the picks line `"{picks} picks in the period ({threshold})"` where threshold is `"24 or more"`, `"6–23"`, `"1–5"` or `"0"` (singular `pick` when 1; thousands separators), total stock, current location as a `LocationChip` or `NO_CURRENT_LOCATION` text, other locations as chips with their stock, and pick groups (partner number + description, shared jobs, partner's aisle or "No current location"), or "No pick groups" when none. A close button (`Icon name="close"`, label "Close part panel"). `Esc` while focus is inside the panel closes it. Data via TanStack Query key `['plan', planId, 'part', part]`; loading and error states use `plan-status` helpers.
- One shared hook (in `part-panel.tsx`) handles open/close for every page: opening records the opener (an element passed in, else the focused element) and pushes the current step URL plus `part`; closing replaces the URL without `part` and returns focus to the recorded element (if still in the document).
- `LocationChip` (`components/common/location-chip.tsx`): a Next `Link` to `planStepHref(planId, "locations", {aisle, loc: code})`, code in Barlow (`type-code-table`), 24px high (`h-control-sm`), ink outline, `rounded-sm`; keyboard-activatable as a link.
- `SearchField` (`components/common/search-field.tsx`), in the Parts and Locations page headers: `type="search"`, label "Search parts and locations". With a non-blank query it shows a "Parts" list and a "Locations" list (each with "{shown} of {count}" when capped); a part result is a button that opens the part panel with the search input as the opener, and the results list then closes (the query stays); a location result is a link to the Locations table at its aisle with `loc` set. No match: exactly `No part or location matches “{query}”.` (curly quotes, trimmed query). `Ctrl+/` or `⌘/` focuses it from anywhere on the page; a plain `/` never does. `Esc` clears a non-empty field, then blurs an empty one. Query key `['plan', planId, 'search', q]`; the frontend never filters results itself.
- Roster: `DataTable` gets an optional row click that calls `onOpen` (keyboard `Enter` already does); the Parts page passes `onOpen` to open the panel. Pick groups: each part number in Part A/B cells is a button that opens that part's panel.
- Frontend modules import only `components/*` and `lib/*`. Every test name carries its FR/NFR/UX-DR/UJ.

**Never:**
- No Keep in place or Manual move… in the panel (Epics 4, 7); no wall (Epic 10); no launcher search.
- No stored-shape change (no `schema_version` bump); no edits to `data/sample/` or `data/answer-key/`; never load `transactions` in these views.
- The frontend never computes current location, aisles, thresholds' limits or search matches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fast part with groups | answer key `2400` | picks 24, class fast, threshold `{24, null}`, pick group with `5000` (8 shared jobs) | No error expected |
| No current location | answer key `1008614-00` | `current_location` null, `other_locations` [] , total stock 0 | No error expected |
| Several locations | answer key `1200` | current `B-01-01-02` (stock 8); other `A-01-02-01` stock 2 | No error expected |
| Dead / medium threshold | `4400` / `0600` | `{0, 0}` / `{6, 23}` | No error expected |
| Not classified | answer key `9999` (only in Transactions), or `nope` | 404 `not_found` | error envelope |
| Search case and partial | `q=" OIL filter"` / `q="a-01-01"` | matches description / codes `A-01-01-*` in location order | No error expected |
| Search blank / no match | `q="  "` / `q="zzzz"` | empty lists, counts 0 | No error expected |
| Search over 20 | sample `q="a"` | 20 per list, counts are totals | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/views/parts.py` -- add `ClassThreshold`, `StockedLocation`, `PartnerPart`, `PartPickGroup`, `PartDetail`, `build_part_detail(data, analysis, state, version, part)`; reuse `LocationRef`, `location_ref`, `current_location`, `other_locations`, `stock_at`, `total_stock`, `aisle_of`, `planning_copy`.
- `backend/swp/domain/views/pick_groups.py:34` -- `_part` shows the partner-aisle pattern (do not import it; slices are independent).
- `backend/swp/domain/ordering.py` -- `pick_group_order`, `part_order`, `location_order`; reuse.
- `backend/swp/domain/analysis.py` -- `AnalysisSettings` limits, `Analysis.parts`, `Analysis.pick_groups`.
- `backend/swp/domain/errors.py` -- `DomainError("not_found", ...)`; `api/errors.py` maps `not_found` to 404.
- `backend/swp/app/parts.py`, `backend/swp/api/routers/parts.py` -- add `part(plan_id, part)` and `GET /plans/{plan_id}/parts/{part}` (`responses=error_responses(404, 422)`).
- `backend/swp/app/pick_groups.py`, `backend/swp/api/routers/pick_groups.py` -- pattern for the new `app/search.py`, `api/routers/search.py` (`q: str` query param); mount in `backend/swp/api/app.py`.
- `backend/.importlinter` `domain-slices`; `backend/tests/rules/test_layer_rules.py:128` `SLICE_IMPORTS` -- add `views.search`.
- `backend/tests/domain/test_parts_view.py:14` `_view()` -- answer-key analysis pattern; `backend/tests/domain/answer_key.py` (`answer_key_import`, `expected`).
- `backend/tests/app/test_parts_api.py:14` `_sample_plan`, `empty_tables` fixture, NFR-8 timing pattern.
- `frontend/lib/api/plans.ts` -- add types, keys, fetchers and hooks for part detail and search; regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- `frontend/lib/view-state/urls.ts` -- `LocationParams`, `planStepHref`, `parseLocationParams`; extend with `part`.
- `frontend/components/common/data-table.tsx` -- `onOpen` exists for `Enter`; add row click.
- `frontend/components/common/class-glyph.tsx` (`ClassGlyph`, `CLASS_LABELS`), `icons.tsx` (`close`, `search`), `plan-status.tsx`.
- `frontend/modules/parts/parts-page.tsx` -- `NO_CURRENT_LOCATION` lives here; move it to `components/common/part-panel.tsx` (or a common file) and import it in both.
- `frontend/modules/locations/locations-page.tsx` -- header gets `SearchField`; page also renders the panel for `?part=`; existing `focusKey={params.loc}` and URL-reset logic stay.
- `frontend/modules/pick-groups/pick-groups-page.tsx` -- part cells become open buttons; renders the panel.
- `frontend/app/plans/[planId]/{parts,locations,pick-groups}/page.tsx` -- pass parsed search params.
- `frontend/tests/locations.test.tsx`, `parts.test.tsx`, `pick-groups.test.tsx`, `components.test.tsx` -- unit test pattern (`renderToStaticMarkup`).
- `frontend/e2e/support/sample-plan.ts` `createSamplePlan`; `frontend/e2e/parts-roster.spec.ts` (UJ-7) pattern.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/parts.py` -- part detail models and builder. -- FR-13, FR-20.
- `backend/swp/domain/views/search.py` NEW -- `SEARCH_LIMIT`, wire models, `build_search_view(data, analysis, state, version, query)`. -- FR-15, AD-14.
- `backend/swp/app/parts.py`, `backend/swp/app/search.py` NEW, `backend/swp/api/routers/parts.py`, `backend/swp/api/routers/search.py` NEW, `backend/swp/api/app.py` -- services, routes, mount.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- register `views.search` + BROKEN case. -- NFR-1.
- `backend/tests/domain/test_part_detail_view.py` NEW -- matrix rows for detail (`test_fr13_*`, `test_fr20_part_pick_groups_*`, thresholds from settings incl. a non-default settings case).
- `backend/tests/domain/test_search_view.py` NEW -- matrix rows for search (`test_fr15_*`).
- `backend/tests/app/test_part_detail_api.py`, `backend/tests/app/test_search_api.py` NEW -- 200 on sample, 404s, version unchanged, `test_nfr8_*` under 1 s.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts`, `frontend/lib/view-state/urls.ts` -- types, queries, `?part=`.
- `frontend/components/common/location-chip.tsx`, `part-panel.tsx`, `search-field.tsx` NEW; `data-table.tsx` row click. -- UX-DR24, UX-DR25, UX-DR8, UX-DR11.
- `frontend/modules/parts/parts-page.tsx`, `locations/locations-page.tsx`, `pick-groups/pick-groups-page.tsx`, the three route pages -- wire panel and search.
- `frontend/tests/part-panel.test.tsx`, `frontend/tests/search-field.test.tsx` NEW (+ URL helper cases) -- picks line per class, chip href, no-current-location, no-match sentence, results grouped, `?part=` round trip, shortcut predicate (Ctrl+/ and Meta+/ yes, plain `/` no).
- `frontend/e2e/part-panel-search.spec.ts` NEW -- `uj7 searches for a part, opens its panel and closes it with Esc`: on Parts, `Ctrl+/` focuses the field, type "oil filter", parts and locations lists shown, choose the first part, URL has `?part=`, panel heading focused and shows the API's picks line and current location chip, `Esc` closes it, `?part=` leaves the URL and focus returns to the search field; a roster row click opens a panel; a chip opens `/locations?aisle=&loc=` with that row focused; a location search for "a-01-01" opens the Locations table with the row focused; "zzzz" shows the no-match sentence. `uj6 opens a pick-group part's panel`: click a part in the Pick groups table, panel shows its pick groups.

**Acceptance Criteria:**
- Given a sample plan, when `GET /api/plans/{id}/parts/{part}` and `/search?q=` are called, then each returns 200 in under 1 s with the fields above and the plan's `version` is unchanged.
- Given the Parts page, when the planner presses `Ctrl+/`, types "oil filter", chooses a part and presses `Esc` in the panel, then the panel opens with focus on its heading, the URL carries `?part=`, and `Esc` closes it and returns focus to the opener.
- Given `views/search.py` importing another slice, when `lint-imports` runs, then `domain-slices` is BROKEN; on the real tree all contracts are kept.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 23 findings — high 0, medium 2, low 17, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) The search results overlay never closes when focus leaves the field and covers the table — the wrapper now closes the results on blur when `relatedTarget` is outside it; result clicks keep focus through `onMouseDown` preventDefault.
  - `[low]` `[patch]` (blind) `aria-expanded` on an `input type="search"` (searchbox role) is unsupported; results not reachable by arrow keys — removed `aria-expanded`; arrow-key navigation is not required by UX-DR25 (results are reachable with Tab), so no combobox rewrite.
  - `[low]` `[reject]` (blind) No debounce: each keystroke sends a search — each request is a sub-second read (NFR-8 test) and `keepPreviousData` keeps results steady; a debounce adds timing state for no user-visible defect.
  - `[low]` `[reject]` (blind) `q` has no max length — a local single-user tool; a guard plus test adds surface for a case not met in use.
  - `[low]` `[patch]` (blind) A part number containing "/" never matches `/parts/{part}` — route now `{part:path}`; `test_fr13_part_detail_404s` requests `a%2Fb` and gets "No part a/b in this plan.".
  - `[low]` `[patch]` (blind) The panel shows plan-opening text while one part loads — now "Loading part {part}…" (`role="status"`); a stale `?part=` shows the server message "No part X in this plan." through `PlanLoadError`.
  - `[low]` `[reject]` (blind) Open with push and close with replace leaves two equal history entries — a navigation design choice (Back from an open panel closes it); changing it alters behaviour rather than fixing a defect.
  - `[false]` `[reject]` (blind) `COLUMNS` without a handler renders do-nothing buttons — in the app `PickGroupsPage` always passes `onOpenPart`; `COLUMNS` is only rendered by static unit tests.
  - `[false]` `[reject]` (blind) Pick-group columns rebuilt each render break DataTable state — `DataTable` keys sort and focus state by column `key` strings, never by array identity.
  - `[false]` `[reject]` (blind) Pick groups has no search field — the story and UX-DR25 place it in the Parts and Locations headers only; `Ctrl+/` is for "pages with a search field" (EXPERIENCE.md).
  - `[low]` `[reject]` (blind) No narrow-screen layout for the 400px panel — below 1280px the table narrows; an overlay layout is responsive work beyond the story's ACs; noted as a residual risk.
  - `[low]` `[reject]` (blind) A deep link focuses the panel heading and closing it then leaves focus on body — a direct `?part=` URL opens the panel by intent; a focus fallback adds a branch for a rare path.
  - `[low]` `[reject]` (blind) Missing tests: row-click guard, `usePartPanel` keeping aisle/loc, API classified-only search, Locations-page panel, moves in state — the Locations-page panel and aisle/part survival are now covered by the patched uj7 e2e (see the verification-gap row); moves do not exist before Epic 4; classified-only is covered at the domain level.
  - `[low]` `[patch]` (edge) The dead class threshold is hard-coded `{0, 0}` though classify makes every part below `slow_min_picks` dead — now `{0, slow_min_picks - 1}` (unchanged `{0, 0}` with defaults); the settings test has a dead case expecting `{0, 1}` with slow_min 2. The Always rule "never hard-coded" selects this reading.
  - `[low]` `[patch]` (edge) Part numbers with "/" do not route — same root as the blind row; same fix.
  - `[medium]` `[patch]` (edge) Results dropdown stays open after blur — same root as the first blind row; same fix.
  - `[low]` `[reject]` (edge) Closing a deep-linked panel drops focus to body — same as the blind deep-link row; same reason.
  - `[low]` `[patch]` (edge) Dragging to select text in a roster row opens the panel — row click returns early when `window.getSelection()` is non-empty.
  - `[false]` `[reject]` (edge) `COLUMNS` with dead buttons — same refutation as the blind row.
  - `[low]` `[patch]` (edge) "oil" and "oil " are separate searches and cache entries — `usePlanSearch` keys, fetches and enables on `q.trim()`.
  - `[low]` `[reject]` (edge) Placeholder data shows the previous query's results or no-match text while the next loads — lasts one sub-second request; the next response replaces it.
  - `[low]` `[patch]` (edge, claim) Dead-class limits ignore settings — same root as the dead-threshold row; same fix.
  - `[low]` `[patch]` (verification-gap) No test opens the part panel on the Locations page or checks `part=` survives an aisle change — uj7 e2e now opens a part from the Locations search, changes the aisle (URL keeps `part=`, panel stays) and closes with Esc (focus back on the field).
- intent-alignment audit: descriptive; the diff implements both the API ACs and the browser journey (R3). Noted: search is capped at 20 per list with totals, searches classified parts only, blank query returns empty lists; "pick-group part" read as the Pick groups table cells; row click added in the shared `DataTable`; `Enter` row open, keyboard chip activation and `⌘/` in a browser are not e2e-tested (the predicate is unit-tested). No divergence routed.

## Design Notes

Thresholds go over the wire as numbers (`min_picks`, `max_picks`) so the server owns the limits and the frontend only formats them: `max_picks` null → "{min} or more"; `min == max` → "{min}"; else "{min}–{max}" (en dash). Search is capped server-side so typing one letter never sends 2,000 locations; the counts let the list say how many more exist.

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: all contracts kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after the committed regeneration
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new spec

## Auto Run Result

Status: done

**Summary:** `GET /api/plans/{id}/parts/{part}` returns one part's facts (class, picks, class threshold from the settings snapshot, total stock, current and other locations with stock, pick groups with partner, shared jobs and partner aisle); `GET /api/plans/{id}/search?q=` (new slice `domain/views/search.py`) matches part numbers, descriptions and location codes with `casefold`, in AD-14 order, capped at 20 per list with totals. The frontend adds the common `PartPanel` (400px, focus to heading, `Esc` closes and returns focus, `?part=` through `lib/view-state`), `LocationChip` and `SearchField` (`Ctrl+/`/`⌘/`, `Esc` clear then blur, no-match sentence); the panel opens from roster rows (click or `Enter`), pick-group part cells and part search results; chips and location results open the Locations table at the aisle with the row focused.

**Files changed:**
- `backend/swp/domain/views/parts.py` -- part detail models, `class_threshold`, `build_part_detail`.
- `backend/swp/domain/views/search.py` -- new search slice.
- `backend/swp/app/parts.py`, `backend/swp/app/search.py`, `backend/swp/api/routers/parts.py`, `backend/swp/api/routers/search.py`, `backend/swp/api/app.py` -- services, routes, mount.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- `views.search` slice and its BROKEN case.
- `backend/tests/domain/test_part_detail_view.py`, `test_search_view.py`, `backend/tests/app/test_part_detail_api.py`, `test_search_api.py` -- FR-13/FR-15/FR-20/NFR-8 tests.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts`, `frontend/lib/view-state/urls.ts` -- types, queries, `?part=`.
- `frontend/components/common/part-panel.tsx`, `location-chip.tsx`, `search-field.tsx` -- new shared components; `data-table.tsx` -- row click opens.
- `frontend/modules/{parts,locations,pick-groups}/*-page.tsx`, `frontend/app/plans/[planId]/{parts,pick-groups}/page.tsx` -- panel and search wired in.
- `frontend/tests/part-panel.test.tsx`, `frontend/tests/search-field.test.tsx`, `frontend/e2e/part-panel-search.spec.ts` (uj7, uj6) -- tests.

**Review:** 23 findings. Patches applied: 12 rows in 8 entries (medium 1 entry: results overlay closes on blur; low 7: aria-expanded removed, `{part:path}` route, part loading text, dead threshold from settings, text-selection guard, trimmed search key, Locations-page panel e2e). Deferred: 0. Rejected: 11 (4 false: unreachable `COLUMNS` buttons twice, column identity, no search on Pick groups; 7 low: no debounce, no `q` max length, history entry on close, narrow-screen layout, deep-link focus fallback twice, placeholder results while loading, plus the missing-tests row — reasons in the triage log).

**Follow-up review recommended:** false (patched entries: high 0, medium 1, low 7).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 287 passed (SQLite; Postgres runs in CI); `npm run gen:api` reproduces the committed `schema.ts`; `npm run lint` and `npm run typecheck` pass; `npm run test:web` 136 passed; `npm run e2e -- --project=chromium` 34 passed (incl. the new uj7 and uj6 journeys).

**Residual risks:** the 400px panel sits beside the page with no overlay below 1280px; opening/closing the panel waits for a server render of the route (URL change); search fires per keystroke without debounce; Firefox/Edge e2e and a visual check against the mocks were not run; Postgres-backed app tests run only in CI.
