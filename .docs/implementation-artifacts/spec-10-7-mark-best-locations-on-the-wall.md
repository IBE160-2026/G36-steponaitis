---
title: 'Story 10.7: Mark best locations on the wall'
type: 'feature'
created: '2026-11-23'
baseline_revision: '054dbdec2547f023584ce3d6571c47a9c3285ed3'
status: 'done'
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

**Problem:** Best locations are marked only from a table and filter controls. The planner cannot mark an aisle, a level or a single location where they see them, on the bin wall.

**Approach:** The Best locations step opens as a marking wall by default. It has the aisle tabs, the open aisle's wall with its Key, the mode controls, a preview, and the marks list with live counts. A hover, focus, click or `Enter` on the wall previews and then sends `set_best_mark` or `remove_best_mark` through `lib/commands`. The milestone 1 table stays one click away as **Open as list** (`?mode=list`).

## Boundaries & Constraints

**Always:**
- **Server (AD-3, AD-14).** `WallView` gains `marks: list[BestMark]`: the plan's marks in `ordering.mark_order(state.best_marks, copy.locations)`. This is the same order as `LocationsView.marks`. Nothing else changes in `/wall`. Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- **Data on the marking wall.** It uses `usePlanSummary` (for `import_id`), `useImportLayout`, and `usePlanWall(planId, aisle)` only. The marks list, the counts (`warehouse.best` and `warehouse.empty_best`), `rail_levels`, the frames and the tab BEST tags all come from that one wall view, so one version holds everything. The frontend never computes best status or counts.
- **Route and URL.**
  - `/plans/{id}/best-locations` reads `parseLocationParams`.
  - `?mode=list` shows the existing table view `BestLocationsView`, with the step's own `summary` + `locations` consistency logic left unchanged. It gains an **Open as wall** button that keeps `aisle`. Its aisle filter starts at `?aisle=` when that is a known aisle.
  - Otherwise the step shows the wall at `?aisle=` when that aisle is in the layout, else at the first layout aisle. A tab change replaces the URL with `planStepHref(planId, "best-locations", {aisle})`. **Open as list** replaces it with `{aisle, mode: "list"}`.
  - The Locations header's existing **Edit best-location marks** link (`?aisle=<open aisle>`) therefore opens this wall on the same aisle.
- **Controls.**
  - `SegmentedControl` "Marking mode": Whole aisle | Level | Single location. It is remembered with `bestLocationsModeKey`, as today.
  - In Level mode, a second `SegmentedControl` "Level scope": in this aisle | in all aisles.
- **Mark per mode, for a location in aisle X at level L.**
  - Whole aisle: `{kind:"aisle", aisle:X}`.
  - Level: `{kind:"level", level:L, aisle: scope==="all" ? null : X}`.
  - Single location: `{kind:"location", location:code}`.

  When an exact equal mark exists (`sameMark` against `view.marks`), the action is `remove_best_mark` and the preview reads "Unmark …". Otherwise the action is `set_best_mark` and the preview reads "Mark aisle A", "Mark level 1 in aisle A", "Mark level 1 in all aisles" or "Mark A-07-01-02". The strings live in `lib/copy`. Keep the mode-to-mark logic pure in `modules/best-locations/marks.ts`.
- **Wall interaction (marking replaces pinning).**
  - `WallGrid` gets an optional `marking` prop `{ preview(location) => string; onMark(location) => void; disabledReason?: string }`. When it is set:
    - a click or `Enter` on a cell calls `onMark` and never pins the dialog or selects a move;
    - the hover or focus tooltip shows the preview as its first line (`data-tip-mark-preview`);
    - the cell's description starts with the preview line.
  - While `disabledReason` is set ("Saving the last change…"), a click or `Enter` sends nothing.
  - Moves are not drawn on the marking wall: `AisleWall` gets `showMoves={false}`.
  - The grid stays one tab stop with Story 10.3's keyboard navigation.
- **Level mode hit area.**
  - Each run's level row gets one `<button>` with the accessible name of its preview (for example "Mark level 1 in aisle A"), marked `data-level-mark="<level>"`. It covers the row from the level label to the run's right edge: the label column plus the whole row, at least ROW_HEIGHT × scale tall (38px or more). It sits under the grid cells, so a cell click (which also marks that level in Level mode) and a click on the label or the gaps do the same thing.
  - These buttons exist only in Level mode. They follow the graphite focus ring.
  - `AisleWall` takes an `overlay?: (scale: number) => ReactNode`, rendered inside its scaled box before the grid. Use the existing wall geometry exports (`runTops`, `runHeight`, `runWidth` and the `PAD`/`LABEL_WIDTH`/`SECTION_HEADER`/`ROW_HEIGHT` constants, exported from `components/common/wall` where they are not exported yet).
- **Visible preview.** Under the controls, a `<p data-mark-preview>` shows the preview of the hovered or focused cell or level button. It is empty when nothing is hovered or focused. It is not a live region.
- **Marks panel.** Extract the existing marks section (heading "Marks", `data-testid="best-counts"` "174 best · 7 empty" with `aria-live="polite"`, list "Best-location marks", remove buttons "Remove mark Level 1 in aisle A" of at least 24 × 24px, and the `NO_MARKS` text) into one component in `modules/best-locations`. Both views use it: the wall beside the wall at `lg:grid-cols-[minmax(0,1fr)_320px]`, and the table view as before.
- **Commands and toast.** Every change goes through `sendMarkChange(sendWithEvents, …, showToast, onViewOutdated)`. This keeps the Epic 3 toast rules: the toast shows only for a confirmed change with events; when recommendations became outdated it reads "Best-location marks changed · N recommendations are now outdated" with **View** (`recommendationsTabHref(planId, "outdated")`); there is never an Undo. The rails, frames, BEST tags, list and counts redraw only from the refetched wall view.
- **Sharing (vertical slices).** `AisleTabs` (with `aisleTabId`) and `AisleWall` move from `modules/locations` to `components/common/wall/`. They are exported from its `index.ts`, and `modules/locations` and the tests import them from there. No module imports another module.
- Tests are named for FR-21/FR-29/FR-42 (`fr21_…`, `test_fr42_wall_view_marks…`), with UX-DR14/47. New e2e specs import `test` and `expect` from `frontend/e2e/support/test.ts` and set up plans with `createSamplePlan` and `postCommand` from `e2e/support` (retro epic-7 #64 and epic-8 #75).

**Never:** No drag; a click always means mark. No new endpoint or command type. No frontend best or count computation and no code parsing. No moves drawer, move markers or pinned tooltip dialog on the marking wall. No Key buttons (Epic 11). No change to the Locations wall's behaviour apart from the moved imports. No edits to `data/sample/`, `data/answer-key/` or `.docs/planning-artifacts/`. No session logs or `.logs/`. No deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mark aisle | Whole aisle, click a cell in A, no marks | `set_best_mark {aisle A}`; rails on every level of A, BEST tag on tab A, list "Aisle A" | — |
| Unmark exact | Whole aisle, A already marked | preview "Unmark aisle A"; `remove_best_mark` | — |
| Level in all aisles | Level + in all aisles, the L1 button | `set_best_mark {level 1, aisle null}`; tab B shows a rail on L1 | — |
| Single toggle | Single location, `Enter` twice on one cell | set, then remove `{location code}`; frame and "BEST 1" tag, then gone | — |
| Covered but not exact | Single location on a cell under an aisle mark | `set_best_mark {location}` (no remove) | — |
| Saving | a command unconfirmed | click or `Enter` sends nothing | disabledReason |
| Unknown `?aisle=` | `?aisle=ZZ` | wall opens on the first aisle | — |
| `?mode=list&aisle=A` | list mode | table with aisle filter A, Open as wall | — |
| Outdating change | aisle A mark + run, then unmark A | toast "… N recommendations are now outdated", View → `?tab=outdated`, no Undo | — |
| Wall or layout read fails | 5xx/404 | `PlanLoadError` | existing pattern |

</intent-contract>

## Code Map

- `backend/swp/domain/views/wall.py:105` `WallView`, `build_wall_view` (marks at :354) -- add `marks`; `swp/domain/ordering.py:73` `mark_order`; `views/locations.py:99` is the same pattern.
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` -- test patterns.
- `frontend/modules/best-locations/best-locations-page.tsx` -- `BestLocationsView` (table, marks section at :190-225), `sendMarkChange`, `readMode`, `MODES`, `SCOPES`, `BestLocationsPage` (to branch on `mode`); `marks.ts` `sameMark`, `bestCountsLine`.
- `frontend/app/plans/[planId]/best-locations/page.tsx` -- route (unchanged unless params are needed; the page reads `useSearchParams`).
- `frontend/modules/locations/locations-page.tsx` -- reference for `WallMode`/`AisleMode` (layout + wall hooks, tab `select` with `replaceState`, `LocationsWall` header with `aisleHeading`, `wallAisleLine`, `OPEN_AS_LIST`, `EDIT_BEST_MARKS` link at :262).
- `frontend/modules/locations/aisle-tabs.tsx`, `aisle-wall.tsx` -- move to `components/common/wall/`; `aisle-wall.tsx` gets `showMoves` and `overlay`.
- `frontend/components/common/wall/wall-grid.tsx` -- `onCellKeyDown` Enter (:~330), cell `onClick`, description block, `WallTooltip` usage; add `marking`. `wall-tooltip.tsx:103` `WallTooltip` (add an optional `preview` line). `model.ts` geometry constants; `wall-panel.tsx` rails and BEST tags (already drawn from `rail_levels` and frames).
- `frontend/lib/copy/index.ts:167` `marksChangedText`, `:552` `markLabel`, `BEST_TAG`, `OPEN_AS_LIST`/`OPEN_AS_WALL`; add the preview strings.
- `frontend/lib/view-state/urls.ts` `planStepHref`, `parseLocationParams`, `recommendationsTabHref`; `storage.ts` `bestLocationsModeKey`.
- `frontend/lib/commands` `usePlanCommands` (`sendWithEvents`, `disabledReason`), `useConsistentPlanQueries`.
- Tests: `frontend/tests/best-locations.test.tsx` (table tests stay), `wall.test.tsx` and `warehouse.test.tsx` (import paths), `wall-tooltip.test.tsx` patterns.
- E2E that open `/best-locations` and drive the table must switch to `?mode=list` (or click Open as list): `best-locations.spec.ts`, `m1-flow.spec.ts:50`, `session-expiry.spec.ts:88,125`, `views-follow-planning-copy.spec.ts:175,199`. `recommendations-outdated.spec.ts:33` uses only "Remove mark Aisle A" and works on either view. `locations-wall.spec.ts:110` checks the Edit link.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/wall.py` -- add `WallView.marks`, filled by `mark_order`.
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` -- `test_fr42_wall_view_marks_in_mark_order` (aisle, level and location marks, same as the locations view) and an API check that `marks` is present.
- `frontend/lib/api/schema.ts` -- regenerate.
- `frontend/components/common/wall/{aisle-tabs,aisle-wall}.tsx`, `index.ts` -- move them; add `showMoves` and `overlay`; export the geometry the overlay needs.
- `frontend/components/common/wall/wall-grid.tsx`, `wall-tooltip.tsx` -- the `marking` prop and the preview line.
- `frontend/modules/locations/*` and `frontend/tests/{wall,warehouse}.test.tsx` -- import from `components/common/wall`.
- `frontend/lib/copy/index.ts` -- preview strings ("Mark …" / "Unmark …").
- `frontend/modules/best-locations/marks.ts` -- `markFor(mode, scope, location)` and `markPreview(mark, marks)` returning `{mark, remove, text}`.
- `frontend/modules/best-locations/marks-panel.tsx` (new), `marking-wall.tsx` (new), `best-locations-page.tsx` -- the shared panel, the wall step and the `mode` branch with Open as list / Open as wall.
- `frontend/tests/best-locations-wall.test.tsx` (new) -- matrix rows: mark per mode and scope, exact-mark remove, covered-but-not-exact, preview texts, Enter and click send the right body, no send while saving, Level buttons only in Level mode with their names, no pin dialog in marking, the unknown-aisle fallback, `?mode=list` rendering the table.
- `frontend/e2e/best-locations-wall.spec.ts` (new) and the e2e files listed in the Code Map -- the journeys below; existing specs move to `?mode=list` where they drive the table.

**Acceptance Criteria:**
- Given a sample plan, when the planner opens Locations aisle A and follows **Edit best-location marks**, then the Best locations wall opens on aisle A with Whole aisle | Level | Single location, the marks list, the counts and **Open as list**.
- Given UJ-1 step 4 in Playwright, when the planner hovers a cell in aisle A (the preview reads "Mark aisle A"), clicks it, then chooses Level and in all aisles and activates the level 1 button with the keyboard, then every level of A shows `data-rail`, tab A shows BEST, tab B's wall has a rail on L1 with a BEST tag, the list shows "Aisle A" and "Level 1 in all aisles", the counts equal the server's `warehouse.best`/`empty_best`, and every "Remove mark …" button is at least 24 × 24px. This spec passes in Chromium, Firefox and Edge (`--project=chromium --project=firefox --project=msedge`).
- Given an aisle A mark and a round 1 run, when the planner clicks a cell of A in Whole aisle mode, then the toast reads "Best-location marks changed · N recommendations are now outdated" with View and no Undo, and View opens `?tab=outdated`.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 2, low 13, false 10, maybe-false 0
- findings:
  - `[low]` `[patch]` (intent) A pointer click on a level row's label area was never exercised (only focus + `Enter`) — the UJ-1 e2e now clicks the L2 button at `{x: 10}` (label column), asserts "Level 2 in aisle A" in the list, then removes it.
  - `[false]` `[reject]` (intent) Real click/`Enter` dispatch is checked in unit tests only by calling `onMark` — the real handlers run in the e2e spec (cell click, cell `Enter`, level `Enter`) in three browsers.
  - `[low]` `[patch]` (intent) "Counts match the server" compared the UI with the same `/wall` it renders from — `expectCounts` now also asserts the wall counts equal `/api/plans/{id}` `best_locations`/`empty_best_locations`.
  - `[false]` `[reject]` (intent) Not shown that the spec ran in Chromium, Firefox and Edge — it did: `--project=firefox --project=msedge best-locations-wall` passed (see Verification).
  - `[false]` `[reject]` (intent) No milestone-2 gating — the app has no milestone switch; the epic context treats "from milestone 2" as the phase in which the wall becomes the marking tool, and Epic 10 already made the wall the default Locations view.
  - `[false]` `[reject]` (intent) "No drag" is not asserted — no drag exists in the code base (Epic 12); a click is always a mark and the e2e checks no dialog opens.
  - `[false]` `[reject]` (intent) The no-outdated toast is not tested — `expectSaved` in the UJ-1 e2e asserts the plain "Best-location marks changed." toast.
  - `[false]` `[reject]` (intent) Retro decision not recorded — it is in this spec's Design Notes.
  - `[low]` `[reject]` (edge) An import with zero aisles leaves the wall on PlanOpening — an import needs locations and the Locations wall (`AisleMode`) has the same pattern; unlikely in use and a new empty state adds copy and a branch.
  - `[medium]` `[patch]` (edge) While a new tab loads (`keepPreviousData`), a click marks the previous aisle — `MarkingWall` passes `disabledReason ?? (aisle !== selected ? OPENING_AISLE_REASON : undefined)` to the grid and the level buttons; unit test `fr21_no_marking_while_the_chosen_aisle_loads`.
  - `[low]` `[patch]` (verification-gap) The layout-load-error branch had no test — e2e "uj1 the marking wall shows a load error when the layout fails" routes the layout to 500 and asserts the alert and no grid.
  - `[low]` `[patch]` (verification-gap) The wall's write of the remembered marking mode was never asserted — the UJ-1 e2e reloads after Level mode and asserts the Level radio is checked.
  - `[false]` `[reject]` (blind) The level buttons' focus ring is hidden under the cells and only the label strip is reachable — the grid cells are transparent, the buttons sit in a `data-surface="graphite"` layer whose `:focus-visible` ring (globals.css:311) draws on the button; cells over bins mark the same level, so the whole row marks.
  - `[false]` `[reject]` (blind) The level hit area shrinks below 24px on narrow screens — `wallScale` clamps the scale to at least 1, so the height is at least ROW_HEIGHT = 38px; the panel scrolls instead.
  - `[medium]` `[patch]` (blind) Clicks while the next aisle loads mark the previous aisle — same root cause and fix as the edge row above.
  - `[low]` `[reject]` (blind) A click during "Saving the last change…" fails silently on the wall — the toolbar save status shows saving, the command lasts a moment, and an in-wall message adds UI the spec did not ask for.
  - `[low]` `[reject]` (blind) Zero-aisle import loads forever — same as the edge row above.
  - `[low]` `[reject]` (blind) `?aisle=ZZ` keeps the bad value in the URL — the Locations wall behaves the same way; a hand-typed bad aisle is rare and harmless.
  - `[low]` `[reject]` (blind) Three `replaceState(planStepHref(...))` calls are duplicated — each is one call with different arguments, the same idiom as `locations-page.tsx`; a helper adds indirection for no named harm.
  - `[low]` `[reject]` (blind) The preview precedence and hover/focus bookkeeping have no direct unit tests — the e2e covers the cell hover, cell focus and level focus previews; a refactor into a pure function adds structure for little gain.
  - `[low]` `[reject]` (blind) Session expiry and saving are not e2e-tested on the wall — both go through the shared `lib/commands` client, which the list-mode specs and the unit tests cover.
  - `[false]` `[reject]` (blind) The diff leaves out `schema.ts` and the spec — both were left out of the review diff on purpose; `npm run gen:api` reproduces `schema.ts` with no diff.
  - `[low]` `[reject]` (blind) Level scope is not remembered — neither the spec nor the Story 3.4 table remembers it; a convenience change, not a defect.
  - `[low]` `[reject]` (blind) Single location preview does not say a covered cell is already best — the spec says a covered-but-not-exact cell sets a location mark; changing it means editing the spec.
  - `[false]` `[reject]` (blind) The marking tooltip renders unreachable interactive content — `WallTooltip` renders part buttons and actions only when `pinned`, which marking never does; unpinned it is `aria-hidden` text.

## Design Notes

Adding `marks` to the wall view keeps the marking step on one version-carrying read. The alternative was pairing `/wall` with `/locations` and `/summary`, which means three reads that must agree, and a 2,000-row table that the wall does not need. A level row is one button under the cells. The label, the beam gaps and the bins then all mark the level, which meets "the rail's hit area is the whole level row" without taking pointer events from the grid. The retro items checked: epic-3 #25 (a product decision, owner Justas) is untouched; epic-2 #15 (DataTable Enter) is not changed here; epic-8 #73 (three browsers) is met for this story's spec by running Firefox and Edge locally; epic-7 #64 and epic-8 #75 are met by using the `e2e/support` setup helpers.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean
- `uv run --directory backend --locked ruff format --check .` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm run gen:api` -- expected: no further schema diff
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass
- `npm run e2e -- --project=firefox --project=msedge best-locations-wall` -- expected: all pass

## Auto Run Result

**Summary.** The Best locations step now opens as a marking wall (FR-21, FR-29, FR-42, UX-DR14/47).
- **Layout.** Aisle tabs, the open aisle's wall and its Key, the Marking mode control (Whole aisle | Level | Single location, plus "in this aisle | in all aisles" in Level mode), a visible preview line, and the marks list with the live "N best · M empty" counts beside the wall.
- **Marking.** Hovering or focusing a cell previews the mark ("Mark aisle A", "Mark level 1 in all aisles", "Mark A-07-01-02", or "Unmark …" when that exact mark exists). A click or `Enter` sends `set_best_mark` or `remove_best_mark` through `lib/commands`. In Level mode, each level row is a button covering the label and the whole row.
- **What changes and what does not.** A marking click never pins the tooltip dialog, and the marking wall draws no moves. Rails, frames, BEST tags, the list and the counts all redraw from the server's wall view, which now carries `marks`. The Epic 3 toast is reused: "… N recommendations are now outdated" with View and no Undo.
- **Other entry points.** **Open as list** (`?mode=list`) shows the milestone 1 table, which gains **Open as wall**. **Edit best-location marks** on the Locations header opens the wall on the same aisle.

**Files changed**
- `backend/swp/domain/views/wall.py` -- `WallView.marks` in `mark_order`.
- `backend/tests/domain/test_wall_view.py`, `backend/tests/app/test_wall_api.py` -- tests for the marks' order and that they equal `/locations`.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/components/common/wall/aisle-tabs.tsx`, `aisle-wall.tsx` (moved from `modules/locations`), `index.ts` -- shared; `AisleWall` gains `showMoves` and `overlay`; geometry exports.
- `frontend/components/common/wall/wall-grid.tsx`, `wall-tooltip.tsx` -- the `marking` prop (click/`Enter` marks, preview in the tooltip and the description, `onPreview`).
- `frontend/lib/copy/index.ts` -- `markPreviewText`, `OPENING_AISLE_REASON`.
- `frontend/modules/best-locations/marks.ts`, `marking.ts` (new), `marks-panel.tsx` (new), `marking-wall.tsx` (new), `best-locations-page.tsx` -- mode-to-mark logic, shared controls and toast, the shared marks panel, the wall step, and the `?mode=list` branch.
- `frontend/modules/locations/locations-page.tsx` -- imports from `components/common/wall`.
- `frontend/tests/best-locations-wall.test.tsx` (new, 17 tests); `wall`, `wall-crop`, `wall-moves` and `warehouse` tests -- `marks: []` fixtures.
- `frontend/e2e/best-locations-wall.spec.ts` (new, 5 tests).
- `best-locations`, `m1-flow`, `session-expiry` and `views-follow-planning-copy` specs -- open the table via `?mode=list` / Open as list.

**Review findings.** 25 findings: high 0, medium 2, low 13, false 10.
- **Patched (1 medium entry, 5 low).**
  - Medium (edge and blind rows): no marking while a new tab's view is still loading.
  - Low: an e2e pointer click on the level label area; counts checked against the plan summary; an e2e for the layout load error; an e2e for the remembered mode after a reload.
  - Also added: an e2e for the wall load error (matrix audit).
- **Deferred.** None.
- **Rejected, with reasons in the Review Triage Log.**
  - Low (8 rows): zero-aisle import (edge and blind rows), silent click while saving, `?aisle=ZZ` kept in the URL, duplicated `replaceState`, preview precedence without a unit test, session expiry not e2e-tested on the wall, scope not remembered, covered-cell preview.
  - False (10 rows): the click path is covered by e2e; the three browsers did run; there is no milestone switch; there is no drag; the no-outdated toast is tested; the retro decision is recorded; the focus ring is visible; the hit area is at least 38px; schema and spec were left out of the diff on purpose; the tooltip has no unpinned actions.

**Follow-up review recommendation:** `false`. One medium entry was patched (patched counts: high 0, medium 1 entry made of 2 rows, low 5). There is no high patch and fewer than two medium entries.

**Verification** (after the patches, against baseline `054dbdec2547f023584ce3d6571c47a9c3285ed3`)
- `npm run lint:py && npm run lint:imports` -- clean (5 contracts kept).
- `uv run --directory backend --locked ruff format --check .` -- clean.
- `npm run lint && npm run typecheck` -- exit 0.
- `npm run gen:api` -- no further diff (same hash before and after).
- `npm test` -- pytest 956 passed, 2 skipped; Vitest 577 passed (35 files).
- `npm run e2e -- --project=chromium` -- 123 passed.
- `npm run e2e -- --project=firefox --project=msedge best-locations-wall` -- 10 passed.
- Matrix audit: every row has a passing test.
  - Mark aisle, Level in all aisles, Single toggle, and Outdating change: e2e.
  - Unmark exact: unit `fr21_exact_mark_removes_else_sets` and e2e.
  - Covered but not exact: `fr21_covered_but_not_exact_sets_the_location_mark`.
  - Saving: `fr10_no_send_while_saving` and `fr10_saving_disables_remove_and_level_buttons`.
  - Unknown aisle: unit and e2e.
  - List mode: unit and e2e.
  - Read fails: e2e for both the wall and the layout.

**Residual risks**
- After a click, the focused cell's tooltip (the existing Story 10.3 placement) can cover the mode controls until the pointer leaves or `Esc` is pressed.
- In Level mode every level row is its own tab stop, in addition to the grid's single tab stop.
- Real screen readers were not tried.
