---
title: 'Story 10.3: Navigate the wall by keyboard and read its tooltips'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '354e80050c3773b4b0bed3962710ecb9c84fcb08'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-10-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Tooltip placement (above its run, below it as fallback, clamped to the viewport) has no geometry assertion in any test.
    evidence: |-
      Verification-gap review: e2e tests only check visibility of [data-wall-tooltip]; unit tests render static markup and never run place(). Inverting the flip condition or dropping a clamp would pass every test.
    location: >-
      frontend/components/common/wall/wall-grid.tsx place()
    severity: low
  - summary: >-
      Open retro items epic-4-retro-item-27 (second half, a Playwright test for a 409 command_rejected after an allowed preview) and epic-4-retro-item-32 (manual-move dialog details) still concern manual-move-dialog.tsx.
    evidence: |-
      Intent audit: this story landed only the first half of item 27 (From choices read from the current detail on every render); the 409 e2e and item 32's details are pre-existing manual-move work, not caused by this story.
    location: >-
      frontend/components/common/manual-move-dialog.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The Story 10.2 wall is a picture (`role="img"`) with a focusable scroll box: a keyboard or screen-reader user cannot reach a location, and nobody can read which parts sit where without Open as list. Location links (`?loc=`) still fall back to the table, and the kept-in-place pin deferred from Story 7.1 has no wall tooltip to live in.

**Approach:** Frontend only (the wall view already carries every fact). Overlay the SVG wall with an HTML ARIA grid (one tab stop, roving focus, pure navigation function), add a hover/focus tooltip that `Enter`/click pins as a non-modal dialog with actions, and make `?aisle=&loc=` open the wall at that bin with its tooltip pinned.

## Boundaries & Constraints

**Always:**
- **Grid (UX-DR42).** The SVG becomes `aria-hidden` and pixels only. An HTML overlay, absolutely positioned at the same scaled geometry (`model.ts` constants × `scale`), is one `role="grid"` named `wallGridLabel(aisle)` ("Aisle A bin wall"), with `aria-rowcount` = Σ runs (1 header row + levels) and `aria-colcount` = 1 + widest run's columns. Each run is a `role="rowgroup"`; its first row holds `columnheader`s (section numbers, `aria-colspan` = section columns); each level row has a `rowheader` (visible text stays in the SVG; the overlay header text is visually hidden) then one `gridcell` per column with `aria-rowindex`/`aria-colindex`. Gap cells are `gridcell`s with no tabindex, never focusable. Exactly one location cell has `tabIndex=0` (roving); all others `-1`. The 10.2 scroll box keeps `role="region"` + its label but loses `tabIndex` (the grid is the only tab stop in the wall).
- **Keys** (pure `nextCell` in `components/common/wall/navigation.ts`, over `WallCellModel[]` + layout runs): `←/→` the next non-gap cell in the same run and level row, across section boundaries, stopping at the row end; `↑/↓` one level in the same run, and `↓` from L1 (last row) of the top run goes to the top level of the bottom run, `↑` back; `PageDown`/`PageUp` the bottom/top run at the same row index (clamped); `Home`/`End` first/last non-gap cell of the level row in that run; `Ctrl+Home`/`Ctrl+End` first/last non-gap cell in layout order (run, row, column). Whenever the target column is a gap or missing in the target row, take the nearest non-gap column (tie → left); if the row has none, keep going in the same direction; if nothing is found, stay. Handled keys `preventDefault`. A moved-to cell is focused and `scrollIntoView({block:"nearest", inline:"nearest"})`; cells carry `scroll-margin` so they stay clear of the sticky toolbar (`--spacing-toolbar-height` + 8px) and of the toast/notice area at the bottom (WCAG 2.4.11).
- **Cell name** (`lib/copy`): `"<code>, level <level>[, best location], occupied|empty[, <class>][, selected]"` with the class from the top part in lower case (`fast-moving`, `medium-moving`, `slow-moving`, `dead stock`), e.g. "A-07-01-02, level 1, best location, occupied, fast-moving". `aria-describedby` points at a visually hidden element listing one line per part: "<part> <description>, <class>, <picks> picks, stock <stock>[, kept in place]". Cells carry `aria-haspopup="dialog"` and `aria-expanded` (true while pinned) and the focus ring for graphite (`[data-surface="graphite"]` rule in `globals.css`). Data hooks: `data-grid-cell=<code>`, `data-active` on the tab-stop cell.
- **Tooltip (FR-42, UX-DR43, WCAG 1.4.13).** Shown on cell focus at once, or after 150 ms of pointer hover. Content: code; `Level N` (from the location's `level`); the BEST tag when `is_best`; "Occupied · N parts"/"Occupied · 1 part" or "Empty"; one line per covering mark "`markLabel(mark)` (best-location mark)" (e.g. "Level 1 in aisle A (best-location mark)"); "Walk Path 2,270"; one line per part (class swatch `BinSwatch`, part number, description, "Fast-moving · 33 picks · stock 4", and "kept in place" with the pin glyph `KeptInPlaceMark` when kept — closes the Story 7.1 deferral); a partner strip per rule 3 recommendation touching the cell: "Partner 4410281 · 14 shared jobs · recommendation #2". It never shows capacity or distance. It is `aria-hidden`, positioned `fixed` above the cell's run (below the run only when there is no room above in the viewport), horizontally at the cell and clamped to the viewport; it is hoverable (pointer may move cell → tooltip without closing; a short grace timer, ≤150 ms), persistent (no timeout) until focus and pointer have left both cell and tooltip, and `Esc` hides it without moving focus (the next cell focus or hover shows it again). Data hook `data-wall-tooltip=<code>`.
- **Pinned dialog.** `Enter` or a click on a cell pins its tooltip: the same box becomes a non-modal `role="dialog"` `aria-labelledby` its code (no longer `aria-hidden`, `data-pinned`), and focus moves to its first action. Actions in order: one button per part line (opens the PartPanel for that part with the cell as the opener, via `usePartPanel().open(part, cell)`); **Manual move…** opening the shared `ManualMoveDialog` for the top part with the from-location preselected to this cell (disabled with "This location is empty." when empty, and with the saving reason while a command is unconfirmed); one **Show recommendation #n** link per latest-run recommendation whose `from_location` or `to_location` is this code, in server order. `Esc` in the dialog closes it and focuses the cell; focus leaving both dialog and cell, or pinning another cell, closes it. Only one tooltip or dialog exists at a time.
- **Recommendation link.** `recommendationHref(planId, row)` in `lib/view-state/urls.ts` → `/plans/<id>/recommendations?tab=<open|applied|kept|outdated from row.status>&rec=<row.id>`. The Recommendations page reads `?rec=` and starts with that row selected (expanding its band if it would be hidden); an unknown id keeps today's first-row default.
- **Recommendation data.** The wall page reads `usePlanRecommendations(planId)` and uses its rows only when `version === wall view version` (else no rec links and no partner strip until they agree; AD-12). The frontend only matches codes; status, number and partner come from the server.
- **URLs (UX-DR25, AD-20).** List mode is now only `?mode=list` (`isListMode`); `?aisle=&loc=` opens the wall on that aisle, makes `loc` the active cell, scrolls it into view and pins its tooltip (first action focused) — once per distinct `loc` value; a `loc` not in the aisle just opens the wall. `LocationChip` and the search's location results keep `locationChipHref` and so open the wall. `?mode=list&loc=` still focuses the table row. Open as list drops `loc`.
- **Part selection.** While the part panel is open on the wall page and its detail has a `current_location`, that cell is drawn with the Key's "Selected" frame (`data-selected`), gets ", selected" in its name and becomes the active cell. Opening a part from the wall page's search field switches the wall to that location's aisle once the detail loads (URL `?aisle=` replaced, `part` kept).
- **Shared code (DRY).** `markLabel` moves from `modules/best-locations/marks.ts` to `lib/copy` (best-locations imports it from there). `ManualMoveAction` moves from `modules/recommendations/recommendations-page.tsx` to `components/common/manual-move-dialog.tsx` (exported, with optional `initialFrom`, `returnFocusRef`, `label`), used by both. `ManualMoveDialog` gains `initialFrom?: string`; its From choices are read from the current `detail` on every render (keep the chosen `from` while it is still a choice, else the first) — the first half of retro item epic-4-retro-item-27. Every new string lives in `lib/copy`.
- Tests named for FR-42 / UX-DR42 / UX-DR43 (Vitest `fr42 …`); the e2e is named after UJ-1 step 3 (`uj1 …`) and imports `test`/`expect` from `frontend/e2e/support/test.ts`.

**Never:** No backend or API change. No move markers, lifted bins, arrows, drawer (10.4), crops (10.5), Whole warehouse (10.6), marking on the wall (10.7), Key buttons (Epic 11) or drag (Epic 12). No `aria-selected` on cells. No code parsing in the frontend. No edits to `data/sample/`, `data/answer-key/` or `.docs/planning-artifacts/`. No session logs or anything under `.logs/`, no deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tab into wall | Tab from Open as list / Edit marks link | focus lands on the active cell (first non-gap cell of the top run's top level, or `loc`/selected cell); next Tab leaves the wall to the Key's next focusable | — |
| Arrow across a gap | `→` with a gap cell to the right | focus skips to the next non-gap cell in the row | stays at row end |
| Cross runs | `↓` on L1 of the top run | top level of the bottom run, same column or nearest non-gap; `↑` returns | single run: stays |
| Empty location | focus an empty slot | tooltip "Empty", no part lines; pinned Manual move… disabled "This location is empty." | — |
| Kept part | location holding a kept part | part line shows pin glyph + "kept in place"; description line ends ", kept in place" | — |
| Location link | `?aisle=B&loc=<code in B>` | wall on B, that cell's dialog pinned, first action focused | unknown `loc` → wall only |
| Versions disagree | recs version ≠ wall version | no rec links/partner strip until they agree | — |

</intent-contract>

## Code Map

- `frontend/components/common/wall/wall-panel.tsx` -- SVG wall; becomes `aria-hidden`, gains a selected frame (reuse Key "selected" `Frame` look: accent stroke + casing). Geometry: `columnX`, `runHeight`, `runTops`, `BIN_INSET`, `BIN_TOP`, `ROW_HEIGHT`, `SECTION_HEADER`, `PAD`, `LABEL_WIDTH` in `model.ts`. Extract the run-top computation into `model.ts` so the overlay uses the same numbers.
- `frontend/components/common/wall/model.ts` -- `WallCellModel` (run,row,column,level,code,occupied,parts,best); add a `wallCellRects`/`runTops` helper; `wallCells` joins layout↔view by code.
- `frontend/components/common/wall/key.tsx:12` -- `Frame` (selected look) to share.
- New `frontend/components/common/wall/navigation.ts` (`nextCell`), `wall-grid.tsx` (overlay grid + roving focus + hidden descriptions), `wall-tooltip.tsx` (tooltip/pinned dialog presentational, callbacks for actions); export from `index.ts`.
- `frontend/modules/locations/aisle-wall.tsx` -- scroll box (drop `tabIndex`), mounts SVG + grid + tooltip; `locations-page.tsx` -- `isListMode`, `WallMode` (loc pin, part selection, recommendations query, panel open), `openList` drops `loc`.
- `frontend/components/common/part-panel.tsx:69` `usePartPanel` (open with opener), `:225` `PartPanelFrame` Esc handling (scoped to the panel, no clash).
- `frontend/components/common/manual-move-dialog.tsx:241,286` -- `ManualMoveDialog`, `ManualMoveForm` (`useState(() => fromChoices(detail))`); `modules/recommendations/recommendations-page.tsx:839` `ManualMoveAction` to move; `:527` `RecommendationsView` `chosenId`/`expanded` state for `?rec=`; `:856` page reads search params.
- `frontend/components/common/keep-in-place.tsx` -- `KeptInPlaceMark` (pin); `bin-swatch.tsx` -- part swatch; `class-glyph.tsx`.
- `frontend/modules/best-locations/marks.ts:9` -- `markLabel` to move to `lib/copy`.
- `frontend/lib/copy/index.ts:46,228,455-467` -- `CLASS_LABELS`, `KEPT_IN_PLACE_STATE`, `wallImageLabel`, `wallScrollLabel`, `levelLabel`; add `wallGridLabel`, `cellName`, `cellPartLine`, `levelName`, `occupancyText`, `markSourceText`, `walkPathText`, `partStatsText`, `partnerStripText`, `showRecommendationLabel`, `EMPTY_LOCATION_REASON`.
- `frontend/lib/view-state/urls.ts` -- `parseLocationParams`, `recommendationsTabHref`; add `recommendationHref`, `parseRecommendationId`.
- `frontend/lib/api/plans.ts:232` -- `usePlanRecommendations`; `RecommendationRow` (`id`, `number`, `status`, `from_location`, `to_location`, `reason` pick_group `partner`/`shared_jobs`).
- `frontend/app/globals.css:287-312` -- scroll padding and graphite focus ring; the overlay needs `data-surface="graphite"`.
- E2E: `frontend/e2e/locations-wall.spec.ts` (extend), `e2e/support/` helpers; specs that rely on `?loc=` opening the table and must use `&mode=list` or assert the wall instead: `locations-table.spec.ts:74-140`, `part-panel-search.spec.ts:110-138`.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/copy/index.ts`, `modules/best-locations/marks.ts` (+ its importers) -- new wall strings; move `markLabel`.
- `frontend/lib/view-state/urls.ts` -- `recommendationHref`, `parseRecommendationId`.
- `frontend/components/common/wall/{model.ts,navigation.ts,wall-grid.tsx,wall-tooltip.tsx,wall-panel.tsx,key.tsx,index.ts}` -- overlay grid, navigation, tooltip/dialog, selected frame, aria-hidden SVG.
- `frontend/components/common/manual-move-dialog.tsx`, `modules/recommendations/recommendations-page.tsx` -- shared `ManualMoveAction`, `initialFrom`, from choices per render, `?rec=` initial selection.
- `frontend/modules/locations/{aisle-wall.tsx,locations-page.tsx}` -- wire grid, tooltip, pin from `loc`, part selection, rec rows, list mode only `mode=list`.
- `frontend/tests/wall-navigation.test.ts` -- every key incl. gaps, run crossing, PageUp/Down, Home/End, Ctrl+Home/End, single run, all-gap row.
- `frontend/tests/wall-tooltip.test.tsx` -- grid roles/counts and one tab stop, cell name/description (best/empty/kept/selected), tooltip content (Level N, BEST, mark sources, Walk Path, part lines with pin, partner strip, no capacity/distance), Esc hides without moving focus, Enter pins as dialog with focus on first action and Esc returns, version mismatch hides rec links, `recommendationHref`, ManualMoveDialog `initialFrom`.
- `frontend/e2e/locations-wall.spec.ts` (+ updated `locations-table`, `part-panel-search`, and any other spec broken by `?loc=` now opening the wall) -- see AC.

**Acceptance Criteria:**
- Given a sample plan on the Locations wall, when the user tabs into the wall and presses `→`, `↓` (past L1 into the bottom run), `PageUp`, `End` and `Ctrl+Home`, then focus lands on the expected cells, only one wall cell is ever in the tab order, and the focused cell's tooltip shows its code, "Level N", occupancy text and part lines.
- Given a location holding a kept part (set through `set_keep`), when its cell is focused, then the tooltip line shows "kept in place" with the pin glyph.
- Given a focused cell, when `Esc` is pressed, then the tooltip hides and focus stays; when `Enter` is pressed, then a dialog named by the code opens with focus on its first action, a part line opens the part panel, and `Esc` returns focus to the cell.
- Given a run with recommendations, when a cell that is a recommendation's from-location is pinned, then **Show recommendation #n** opens the Recommendations page with that row selected.
- Given a part panel location chip or a search location result, when it is activated, then the wall opens on that aisle with that cell's dialog pinned.
- Given a deep link `?aisle=C` (and, separately, Open as wall from list mode on aisle D), when the user visits another step and returns to Locations, then the wall reopens on C (resp. D) — the 10.2 follow-up.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 41 findings — high 0, medium 5, low 27, false 9, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) `?rec=` selection and band expansion untested (the e2e row was first, so `visible[0]` fallback passed) — e2e now opens a row at index ≥ 5 of its rule, not first on its tab, and asserts visible, `aria-selected`, focused.
  - `[low]` `[patch]` (verification-gap) Manual move `initialFrom` unverified (`…, select` matched any select) — e2e now pins a part's non-current location and asserts the From select's value is that code.
  - `[low]` `[patch]` (verification-gap) Pinned dialog surviving Esc in the move dialog not asserted — assertion added after Esc.
  - `[low]` `[patch]` (verification-gap) Tooltip hiding on Tab out not asserted — `[data-wall-tooltip]` count 0 asserted after the final Tab.
  - `[low]` `[defer]` (verification-gap) Tooltip placement geometry has no assertion — deferred as filed (layout-dependent; frontmatter `deferred`).
  - `[low]` `[reject]` (intent) Keyboard map partly exercised only by `nextCell` unit tests — every key goes through the same `onCellKeyDown` → `nextCell` path; each key is unit-tested and five are browser-tested.
  - `[low]` `[reject]` (intent) WCAG 2.4.11 bottom clearance is a fixed 96px `scroll-margin`, not measured — standard technique; toasts sit in the bottom strip; measuring live toasts adds new state.
  - `[low]` `[reject]` (intent) Placement ignores direction of travel; the below-run fallback can cover the bottom run — the AC fixes "above the run"; the fallback is only used without room above (EXPERIENCE.md allows it).
  - `[low]` `[reject]` (intent) Hover 150 ms / grace not browser-tested — reducer unit-tested and hover/hoverable/leave covered in e2e; timing assertions would be flaky.
  - `[low]` `[patch]` (intent) Selected cell not scrolled into view in the 70vh box; part-result selection only on the wall page — selected cell now scrolls into view (no focus move); other steps have no wall, so the scope part is `false`.
  - `[false]` `[reject]` (intent) Chips in list mode now leave the table — required by the AC ("LocationChips everywhere open the wall"); `?mode=list&loc=` still focuses a row.
  - `[false]` `[reject]` (intent) Show recommendation leads to the Recommendations step — descriptive; selection on the wall belongs to Story 10.4.
  - `[false]` `[reject]` (intent) Manual move… on a multi-part location moves the top part — spec Design Notes decision; other parts are reachable through part line → PartPanel → Manual move….
  - `[low]` `[reject]` (intent) Name/description verified with Playwright's accessibility computation, not a real screen reader — no screen reader in CI; accepted risk.
  - `[medium]` `[defer]` (intent) Retro items epic-4-27 (409 e2e) and epic-4-32 untouched in the changed file — pre-existing manual-move work; deferred in frontmatter.
  - `[low]` `[reject]` (blind) Re-clicking a link to an already handled `?loc=` does nothing — same URL gives no new search params; a fix needs a navigation counter/history state (new state) for a rare path (the dialog is one Enter away).
  - `[low]` `[reject]` (blind) `?loc=` without `?aisle=` opens nothing — every chip and search result writes both; only hand-typed URLs hit it.
  - `[false]` `[reject]` (blind) Multi-part Manual move only moves the top part — as the intent row above.
  - `[medium]` `[patch]` (blind) Tooltip can be off-screen (no bottom clamp) — `place()` clamps `top` between toolbar + gap and `innerHeight − height − gap`.
  - `[low]` `[patch]` (blind) Walk Path, mark sources and partner strips not reachable without pinning (tooltip is `aria-hidden`) — added to every located cell's hidden description.
  - `[low]` `[patch]` (blind) Description part lines run together — each line ends with a period (`descriptionLine` in lib/copy).
  - `[low]` `[patch]` (blind) Gap cells unnamed — `aria-label` "No location" (`GAP_CELL_LABEL`).
  - `[low]` `[reject]` (blind) Enter on a pinned cell does not toggle it closed; Space does not pin — the AC defines Enter/click to pin and Esc to close; adding a toggle adds a branch.
  - `[low]` `[patch]` (blind) `quietFocus` can stick when the cell is gone — set only when the element exists, cleared if it did not take focus.
  - `[low]` `[patch]` (blind) Manual move e2e selector weak — same as the verification-gap `initialFrom` row.
  - `[low]` `[reject]` (blind) Most keys untested in a browser; no axe scan — as the intent keyboard row; axe is not a project dependency.
  - `[low]` `[reject]` (blind) `?rec=` read once; stale status falls back to first row; `rec` stays in the URL — rare (status changed between wall fetch and click); fix adds URL-sync state.
  - `[false]` `[reject]` (blind) Per-render re-filtering will hurt Story 10.6 — the whole-warehouse mini-walls are decorative with no grid or tooltips (EXPERIENCE.md); 223 cells per aisle.
  - `[low]` `[patch]` (blind) Copy/type duplication left behind (part-panel re-exports, component-local strings, hard-coded status union) and the broken `urls.ts` header wrap — header comment reflowed; the re-exports stay (they keep existing imports working and no caller diverges).
  - `[false]` `[reject]` (blind) Spec file missing from the patch — excluded on purpose: the spec goes only to the edge-case layer as the claims file.
  - `[low]` `[patch]` (edge) Placement not recomputed when recommendations arrive — layout effect re-runs on `recommendations`.
  - `[medium]` `[patch]` (edge) Fallback below the run runs past the viewport — same root cause and fix as the blind off-screen row.
  - `[low]` `[reject]` (edge) Pointer crossing other cells toward the tooltip above the run switches it — the AC fixes the tooltip above the run; the 150 ms delay restarts on each cell, so normal motion does not switch.
  - `[low]` `[patch]` (edge) Alt/Shift+Arrow swallowed — `onCellKeyDown` returns early on `altKey`/`shiftKey`.
  - `[low]` `[patch]` (edge) Stale `followPart` when searching the already open part — set only when the part differs from `panel.part`.
  - `[low]` `[reject]` (edge) Same `?loc=` link twice does nothing — as the blind row.
  - `[medium]` `[patch]` (edge) Manual move keyed by top part; after a confirmed move the dialog unmounts mid-close and focus falls to body — one `ManualMoveAction` per pinned location keyed by code, keeps the last detail mounted; e2e asserts focus returns to the source cell after a confirmed move.
  - `[false]` `[reject]` (edge) Multi-part Manual move — as above.
  - `[low]` `[reject]` (edge) One Esc on the disabled Manual move closes its reason tip and the dialog — the fix changes the shared Button's Esc for every page; closing both is acceptable.
  - `[false]` `[reject]` (edge) Removed scroll-box tab stop leaves a wall with no cells unscrollable — an aisle exists in the layout only with locations, so the grid always has a tab stop.
  - `[false]` `[reject]` (edge) `?loc=` to an aisle without a layout — layout and wall view come from the same import; every aisle has a layout.

## Auto Run Result

**Summary.** The Locations wall is now keyboard-complete with tooltips (FR-42, UX-DR42/43, WCAG 1.4.13, 2.4.11). The SVG wall is the picture only (`aria-hidden`); an HTML overlay at the same scaled geometry is one `role="grid"` with row/column counts, runs as row groups, hidden section column headers and level row headers, named gap cells that are never focusable, and exactly one tab stop (roving). A pure `nextCell` handles ←/→, ↑/↓ across runs, Page Up/Down, Home/End and Ctrl/⌘+Home/End. Each cell is named "A-07-01-02, level 1, best location, occupied, fast-moving[, selected]" with a hidden description (part lines, mark sources, Walk Path, partner strips). The tooltip shows on focus or a 150 ms hover, is hoverable and persistent, `Esc` hides it, and `Enter`/click pins it as a non-modal dialog (part lines open the PartPanel, Manual move… for the top part starting from that cell, Show recommendation #n linking to `/recommendations?tab=&rec=`, which now selects that row and expands its band). Kept parts show the pin glyph and "kept in place" (closes the Story 7.1 deferral). `?aisle=&loc=` (LocationChips, search location results) opens the wall with that cell's dialog pinned; list mode is only `?mode=list`. The open part's location is drawn Selected, becomes the tab stop and scrolls into view; a part opened from the wall's search switches to its aisle. The 10.2 scroll-box tab stop is removed (the grid is the one stop), and the remembered aisle now has e2e coverage for a deep link and Open as wall. `markLabel` and `ManualMoveAction` moved to shared code; ManualMoveDialog gains `initialFrom` and reads its From choices on every render (first half of retro item epic-4-27).

**Files changed**
- `frontend/components/common/wall/navigation.ts`, `wall-grid.tsx`, `wall-tooltip.tsx` (new) -- key navigation, the grid overlay with tooltip state, the tooltip/pinned dialog.
- `frontend/components/common/wall/model.ts`, `wall-panel.tsx`, `key.tsx`, `index.ts` -- shared run-top/cell-rect geometry, aria-hidden SVG, Selected frame.
- `frontend/components/common/manual-move-dialog.tsx`, `part-panel.tsx` -- shared `ManualMoveAction` (`initialFrom`, `emptyReason`), From choices per render; re-exports kept.
- `frontend/components/common/location-chip.tsx` -- comment: chips open the wall.
- `frontend/modules/locations/locations-page.tsx`, `aisle-wall.tsx` -- wiring: `?loc=` pin, selection, recommendations at the wall's version, list mode only `mode=list`.
- `frontend/modules/recommendations/recommendations-page.tsx`, `list.ts` -- `?rec=` initial selection and band expansion.
- `frontend/modules/best-locations/marks.ts`, `best-locations-page.tsx` -- `markLabel` moved to `lib/copy`.
- `frontend/lib/copy/index.ts`, `frontend/lib/view-state/urls.ts`, `frontend/app/globals.css` -- wall strings, `recommendationHref`/`parseRecommendationId`, cell scroll margins.
- `frontend/tests/wall-navigation.test.ts`, `wall-tooltip.test.tsx` (new), `wall.test.tsx`, `best-locations.test.tsx` -- unit tests.
- `frontend/e2e/locations-wall.spec.ts` (six new `uj1` tests), `locations-table.spec.ts`, `part-panel-search.spec.ts` -- e2e.

**Review findings.** 41 findings (high 0, medium 5, low 27, false 9). Patched: 3 medium entries (`?rec=` e2e gap; tooltip off-screen without a bottom clamp, two rows; Manual move focus loss after a confirmed move) and 13 low rows (initialFrom e2e x2, pinned-after-Esc and Tab-out assertions, selected cell scroll, richer and period-terminated descriptions, gap cell names, quietFocus guard, Alt/Shift keys, re-place on recommendations, stale followPart, urls comment). Deferred: 2 (placement geometry assertion; retro items epic-4-27 second half and epic-4-32). Rejected: 23, each with its reason in the Review Triage Log (9 false; lows such as same-`loc` re-click, `loc` without `aisle`, Enter toggle/Space, direction-aware placement, fixed bottom scroll margin, shared Button Esc).

**Follow-up review recommendation:** `true` -- three medium entries patched (high 0, medium 3, low 13). Unverified risk: focus and blur ordering between the pinned wall dialog, the portalled Manual move dialog and the part panel is verified only in Chromium (Firefox and Edge not run), and tooltip placement geometry has no assertion.

**Verification** (against baseline `354e80050c3773b4b0bed3962710ecb9c84fcb08`, after the patches)
- `npm run lint:py` -- All checks passed; `npm run lint:imports` -- 5 kept, 0 broken.
- `npm run lint`, `npm run typecheck` -- clean.
- `npm test` -- pytest 930 passed, 2 skipped; Vitest 500 passed (31 files).
- `npm run e2e -- --project=chromium` -- 112 passed.
- Matrix audit: every I/O row is covered by a passing test (`fr42_wall_nav_*`, `fr42_wall_tooltip_*`, `fr42_wall_grid_*`, and the `uj1` e2e tests, including the empty-location disabled Manual move check).

**Residual risks**
- Firefox and Edge e2e not run; real screen readers not tested (names checked through Playwright's accessibility computation).
- Re-following a link to the same `?loc=` after dismissing its dialog does nothing (rejected low).
- Manual move… on a multi-part location moves the top part only; other parts go through their part line.

## Design Notes

Overlay over SVG: ARIA grid roles inside SVG are poorly supported and SVG `<g>` focus/scrolling is inconsistent across browsers, so the SVG stays the picture (`aria-hidden`) and a transparent HTML grid with identical scaled geometry carries focus, names, hover and clicks. Example mapping: cell rect = `left: (PAD + LABEL_WIDTH + columnX(run, col) + BIN_INSET) * scale`, `top: (runTops[run] + SECTION_HEADER + row * ROW_HEIGHT + BIN_TOP) * scale`, size `BIN_WIDTH × BIN_HEIGHT` × scale. Manual move… on a multi-part location moves the top part (most picks), matching the drag rule in EXPERIENCE.md; other parts are reached through their part line → PartPanel → Manual move…. Story 10.2's `data-cell` SVG hooks stay for its e2e.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean (no backend change)
- `npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass
