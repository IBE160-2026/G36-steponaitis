---
title: 'Story 10.5: Wall crops in the recommendation detail'
type: 'feature'
created: '2026-11-23'
baseline_revision: 'd96106142f97650dbe7de83a79409f76e13a9e51'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-10-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The crops' live switch between 3 and 2 sections on a viewport resize (matchMedia change) has no test.
    evidence: |-
      Verification-gap review: wall-crop.test.tsx reads only the snapshot (`currentCropSections`) with a no-op addEventListener stub, and the e2e test reloads the page after resizing. Making `subscribeNarrow` a no-op would fail no test. Closing it: resize 1440 to 1300 on the same page without goto, then count `[data-section]` again.
    location: >-
      frontend/modules/recommendations/crops.tsx (useCropSections, subscribeNarrow)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The recommendation detail (Story 5.7) shows a move only as two location codes. The planner cannot see the move in its shelf context without leaving Recommendations, cannot jump to the Locations wall with the move selected, and cannot see which moves the planning copy already holds.

**Approach:** For a selected recommendation, the detail draws wall crops with the shared wall primitives: the import layout cut to the sections around each end, joined to the plan wall view of that aisle, and the Story 10.4 moves layer with this recommendation selected. It adds **Show on the Locations wall** (`?aisle=&rec=`) to the eyebrow row. Under the crops, "Moves in the planning copy" lists the last 3 effective moves from a new server field, with "Undo reverses move N first".

## Boundaries & Constraints

**Always:**
- **Which rows.** Crops, the link and the moves section show for `kind === "rec"` items, in any status. "No space" and kept-part items keep today's detail. The ends are `row.from_location` and `effectiveTo(row).location`.
- **No code parsing (AD-15).** An end's aisle, level, run and column come from finding its code in the import layout (`useImportLayout(summary.import_id)`, the cells' `LocationRef`). An end that is not in the layout gets no crop. If neither end is in the layout, the detail shows neither crops nor the link. BEST comes from the row (`from_best`, `effectiveTo(row).best`).
- **Crop window (pure helper `cropLayout(aisle: AisleLayout, codes: string[], sections: number): AisleLayout | null` in `components/common/wall/crop.ts`).**
  - With sections: in each run that holds one of `codes`, take the `sections` consecutive section spans around each code. The code's own section is centred (N=3: one on each side; N=2: its own section and the next one). The window is shifted to stay inside the run, or covers the whole run when the run has fewer spans. Keep the contiguous span range covering every window in that run. Columns are re-based to 0 and `first_column` is shifted to match. Runs holding none of the codes are dropped.
  - Without sections (the `walk_path` fallback): use a window of N positions (columns) on the same rules.
  - Cells outside the window are dropped, and `run` and `column` are renumbered. Levels and the source are kept. The result is null when no code is found.
- **One crop or two.** If both ends are in the same aisle, draw one crop with `codes = [from, to]`. Otherwise draw a **From aisle G** crop (from-code) over a **To aisle A** crop (to-code). Both are drawn at scale 1 (the natural 27px bin, the same size in both). The caption "Rule 1 · round 1" (`RULE_LABELS[rule]`, the run's round) sits between the two crops, or under the single crop.
- **Crop drawing.** Use `WallPanel` with `cells = wallCells(crop, wall)`, the wall view of that aisle, `marks = moveMarks(wall.moves, code ∈ crop, row.id)` and `selectedEnds` from the matching `WallMove`. The selected move's arrow is drawn only when both ends are in that crop. The crop has no grid, tooltip, hover note, clickable markers, drag or end-cap text (`WallPanel` gains an opt-out for the end cap). The shared `Key` comes once under the crops.
- **Accessible name (UX-DR34/57).** Each crop is `role="img"` (via `WallPanel`'s `label`) with the move name from `lib/copy`, for example "From G-14-04-02, aisle G, level 4 → to A-02-01-01, aisle A, level 1, best location". ", best location" is added per end when that end is best. The crops add no tab stops.
- **Version consistency (AD-12).** A crop renders only when its wall view's `version` equals the recommendations view's `version`. Until then a fixed-height placeholder holds its place, with no name and no stale picture. Walls are read with `usePlanWall(planId, aisle, true)` and refetched under `['plan', planId]` like every plan view.
- **Show on the Locations wall.** A Next `Link` on the right of the eyebrow row to `planStepHref(planId, "locations", { aisle: <from aisle>, rec: row.id })`. The Locations wall opens on that aisle with the move selected (Story 10.4 selection).
- **Moves in the planning copy (server, AD-3/AD-14).** `RecommendationsView` gains `recent_moves: list[RecentMove]`: the last 3 effective moves of the replay (FR-34), highest `move_number` first, from the same replay the view already makes. Each has `move_number`, `part`, `rule`, `round`, `from_location` and `to_location` (codes). The detail lists them in server order, for example "Move 3 · Rule 1 · 9723950 · A-03-04-02 → A-05-01-03" (`RULE_LABELS`, "Manual" for a manual move). Under them is "Undo reverses move N first", where N = `summary.undo_preview.effect.move_number`, shown only when `undo_preview` is not null. With no moves the section says "No moves in the planning copy yet."
- **Responsive (UX-DR58).** At 1280–1439px viewport width the crops use 2 sections (or 2 positions), otherwise 3. Use one `matchMedia` hook, SSR-safe, that defaults to 3. The existing grid already stacks the detail under the list below 1280. The crops sit in one wrapper with `overflow-auto` and a bounded max width, so below 1024 they scroll in 2D inside it and the page never scrolls sideways. The wrapper adds no tab stop.
- **Retro item 46 (take into account).** Move `Detail` and its helpers (`eyebrowText`, `BestTag`, `NoSpaceChip`) from `recommendations-page.tsx` into `modules/recommendations/detail.tsx`. New crops and moves UI goes in `modules/recommendations/crops.tsx`, and every new string goes in `lib/copy`. `recommendations-page.tsx` re-exports `eyebrowText` if tests import it from there. This advances item 46 without closing it: do not change its status.
- **Wiring.** The page passes render props (the same pattern as `manualMove` and `otherLocation`): `crops(row)` and `showOnWall(row)`, which the page fills with components that use the layout and wall hooks. `RecommendationsView` stays testable with plain props. Module rule: `modules/recommendations` imports only `components/*` and `lib/*`.
- Tests are named `fr42`/`test_fr42_*` with the UX-DR id. The e2e test is `uj1 …` and imports from `frontend/e2e/support/test.ts`.

**Never:** No new endpoint or command. No frontend code parsing, status, aisle membership or move ordering. No grid, tooltip, keyboard, drag or clickable markers in crops. No Whole warehouse (10.6), marking (10.7), Key buttons (Epic 11). No changes to the Locations wall's behaviour other than the `WallPanel` end-cap opt-out. No edits to `data/sample/`, `data/answer-key/` or `.docs/planning-artifacts/`. No session logs or `.logs/`. No deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Same aisle | rec A-…→A-… | one crop containing both cells, arrow drawn, caption under it | — |
| Cross aisle | rec G-…→A-… | From aisle G crop over To aisle A crop, caption between, no arrow | — |
| Section at run edge | from in the run's first section | window shifted right: first 3 spans | — |
| Fallback layout | aisle source `walk_path` (no sections) | window of N columns around each code | — |
| Run shorter than N | run with 2 spans, N=3 | whole run | — |
| Applied rec | status applied | crop around `effectiveTo` location, applied check marker | — |
| Code not in layout | end unknown | that end has no crop; none if both unknown | — |
| Versions disagree | wall version ≠ recs version | placeholder, no picture | — |
| No moves | empty step log | "No moves in the planning copy yet.", no undo line | — |
| 1280–1439px | viewport 1300 | crops show 2 sections | — |

</intent-contract>

## Code Map

- `frontend/modules/recommendations/recommendations-page.tsx:213-334` -- `Detail` (move to `detail.tsx`); `:114` `eyebrowText`; `:811-828` Detail wiring; `:840-874` `RecommendationsPage` (add `crops`/`showOnWall` render props; `summary.id`, `summary.import_id`, `summary.undo_preview`); `:798` `xl:grid-cols-[640px_minmax(0,1fr)]` (stacks below 1280).
- `frontend/modules/recommendations/list.ts` -- `effectiveTo(row)` (location + best), `ListItem`, `ruleNumber`.
- `frontend/components/common/wall/model.ts` -- `wallCells`, `wallNaturalSize`, `cellRect`, `sectionIndex`, `runTops`; geometry constants (end cap `END_CAP`).
- `frontend/components/common/wall/wall-panel.tsx` -- `WallPanel` (`label` → `role="img"`; `marks`, `selectedEnds`; end cap text at the bottom, which needs an opt-out prop).
- `frontend/components/common/wall/moves.ts` -- `moveMarks(moves, onWall, selectedKey)`, `moveKey` (a rec's key is its id). `moves-layer.tsx` -- `cellGeometry`, `WallMovesLayer` (drawn inside `WallPanel`).
- `frontend/components/common/wall/key.tsx` -- `Key`; `index.ts` -- export the new `cropLayout`.
- `frontend/modules/locations/aisle-wall.tsx` -- reference for how layout + wall + marks are composed (do not import across modules).
- `frontend/lib/api/imports.ts` -- `useImportLayout`, `AisleLayout`, `LayoutCell.location: LocationRef`. `frontend/lib/api/plans.ts:195-210` -- `usePlanWall(planId, aisle, enabled)`; types `WallView`, `WallMove`, `RecommendationsView`; add `RecentMove` export.
- `frontend/lib/copy/index.ts:173` `RULE_LABELS`; `:299` `undoLabel` (`effect.move_number` convention); add the crop name, caption, headings, section title, move line, undo line, empty text and link label.
- `frontend/lib/view-state/urls.ts:88` `planStepHref(planId, "locations", { aisle, rec })`.
- `backend/swp/domain/recommendations.py:510-518` `RecommendationsView`; `:659-713` `build_recommendations_view` (has `replayed = replay(...)`; both return paths need `recent_moves`). `backend/swp/domain/planning.py:82` `EffectiveMove` (`move_number`, `part`, `from_location`, `to_location`, `rule`, `round`).
- Backend tests: `backend/tests/domain/` recommendations view tests and `backend/tests/app/` recommendations API test (find with `grep -rln build_recommendations_view backend/tests`).
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- Frontend tests: `frontend/tests/recommendations.test.tsx` (Detail), `frontend/tests/wall-moves.test.tsx`/`wall.test.tsx` (patterns).
- E2E: `frontend/e2e/recommendations-page.spec.ts`, `frontend/e2e/locations-wall.spec.ts` (setup: `createSamplePlan`, `postCommand` mark/run/apply in `e2e/support/plan-api.ts`, `sample-plan.ts`).
- Retro: `.docs/implementation-artifacts/sprint-status.yaml` epic-5-retro-item-46 (read only; do not change status).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/recommendations.py` -- `RecentMove` model; `recent_moves` on `RecommendationsView` (both branches) -- server-built list (AD-3).
- `backend/tests/domain/…`, `backend/tests/app/…` -- `test_fr42_recommendations_recent_moves_*`: empty, fewer than 3, more than 3 (the newest 3, in order), combined move (FR-34) appearing once, before the first run.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerate; export `RecentMove`.
- `frontend/components/common/wall/crop.ts` (new), `index.ts`, `wall-panel.tsx` -- `cropLayout`; end-cap opt-out.
- `frontend/lib/copy/index.ts` -- every new string listed above.
- `frontend/modules/recommendations/detail.tsx` (new, moved `Detail`), `crops.tsx` (new: crops, placeholder, moves section, Show-on-wall link, viewport hook), `recommendations-page.tsx` -- wiring.
- `frontend/tests/wall-crop.test.tsx` (new) -- `cropLayout` matrix rows (centre, edge shift, N=2, short run, fallback, two codes in two runs, unknown code), crop names, one vs two crops, caption, placeholder on version mismatch, moves section and undo line, link href, 2 sections under a mocked 1300px `matchMedia`; update `recommendations.test.tsx` as needed.
- `frontend/e2e/recommendations-page.spec.ts` -- new `uj1` test, see the AC below.

**Acceptance Criteria:**
- Given a sample plan with best marks and round 1 run, when an open recommendation is selected on Recommendations at 1440px, then the detail shows `role="img"` crops whose names state from and to with aisle and level, the caption "Rule n · round 1", lifted-bin and target markers for that move, and no new tab stops between the list and the action bar.
- Given that detail, when **Show on the Locations wall** is clicked, then the URL has `?aisle=<from aisle>&rec=<id>` and the wall draws that move's arrow (`data-move-arrow`).
- Given a recommendation is applied, when the detail renders again, then "Moves in the planning copy" lists that move first and "Undo reverses move N first" names its number.
- Given a 1300px wide viewport, when a crop renders, then it shows 2 section labels per run, not 3.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 33 findings — high 0, medium 3, low 25, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` (edge) "Undo reverses move N first" is wrong for `splits_combined_move` and `restores_removed_move` — `undoFirstText` now branches on `effect.kind` ("reverses" / "splits" / "restores"), with a test per kind.
  - `[low]` `[reject]` (edge) A failed wall query leaves the crop placeholder up with no error — needs a network or 4xx failure on a read that the rest of the page also depends on; an error state adds a new branch and copy.
  - `[low]` `[reject]` (edge) A failed layout query makes the crops and link vanish silently — same reasoning as the row above; the rest of the detail still works.
  - `[false]` `[reject]` (edge) A wall version that stays behind never gets refetched — `planWallKey` is under `planRootKey`, and `lib/commands/client.ts:229,249` invalidates and refetches every active `['plan', planId]` query after a command, so the crop's wall catches up.
  - `[low]` `[defer]` (verification-gap) A live `matchMedia` change (resize across 1280/1440 with the detail open) is untested — deferred as filed (frontmatter).
  - `[medium]` `[patch]` (blind) The undo line is wrong for combined and removed moves — same root cause and fix as the edge undo row.
  - `[low]` `[reject]` (blind) The recent-moves order (highest move number) can leave out a combined move edited last — the spec fixes "newest first" as the highest move number; the undo line names the move separately; a "last touched" order needs new server data.
  - `[low]` `[patch]` (blind) No backend test of a cancelled move (moved back to its start) — `test_fr42_recommendations_recent_moves_moved_back_is_not_listed` added.
  - `[low]` `[reject]` (blind) `RecentMove.round` is sent but not shown — a harmless extra field that the tests pin; showing it is copy nobody asked for.
  - `[low]` `[patch]` (blind) `CropPlan.wallAisle` is dead and duplicates `showOnWallHref` — field and its assertion deleted.
  - `[low]` `[reject]` (blind) The e2e helper rebuilds the crop name and takes BEST from the wall's `LocationRef` — the e2e test checks against server data on purpose, rather than against the code under test.
  - `[low]` `[reject]` (blind) Errors are not handled in `RecommendationCrops` — as the two edge error rows.
  - `[low]` `[reject]` (blind) The crop wrapper cannot be scrolled by keyboard — the intent contract requires that the crops add no tab stops (UX-DR57), so the fix would edit this build's spec; the Locations wall uses the same untabbable 2D-scroll region.
  - `[low]` `[reject]` (blind) Both cross-aisle crops carry the same full name, and their headings are `<p>` — the epic gives the full move sentence as "a crop"'s name; renaming per end departs from the AC.
  - `[low]` `[patch]` (blind) The `RecentMoves` section had both `aria-label` and an h3 with the same text — it now uses `aria-labelledby` on the h3.
  - `[low]` `[reject]` (blind) The markers sit outside the named img, and the e2e test pins that — the markers are `aria-hidden` either way; the assertion is a test detail with no user effect.
  - `[low]` `[patch]` (blind) No test that a kept-part item has no crops — added, together with no-space.
  - `[low]` `[patch]` (blind) No test that an outdated rec still gets crops and moves — added.
  - `[false]` `[reject]` (blind) `sectionIndex` returns 0 for a column before the first span — `backend/swp/domain/layout.py:158` builds spans from column 0 with no gaps, so every column is inside a span.
  - `[low]` `[defer]` (blind) `useCropSections` is never tested on a live `matchMedia` change — same as the verification-gap row; deferred.
  - `[false]` `[reject]` (blind) The caption could read "round 0" — crops render only for `rec` items, which exist only when `view.run` is set, and every row belongs to that latest run, so `view.run.round` is its round.
  - `[low]` `[patch]` (blind) The `wall-panel.tsx` header comment line is overlong — rewrapped.
  - `[low]` `[patch]` (blind) `aisle: "G"` is set twice in a test — the duplicate was dropped.
  - `[low]` `[reject]` (blind) `heapq.nlargest` instead of sort — at most hundreds of moves; style only.
  - `[low]` `[reject]` (blind) `RecentMove` repeats `EffectiveMove`'s fields — the wire model is deliberately separate from the domain dataclass (AD-3); sharing it would couple them.
  - `[low]` `[reject]` (intent) A same-aisle crop can be wider than 3 sections — a recorded decision in the spec's Design Notes; changing it means editing this build's spec.
  - `[medium]` `[patch]` (intent) The crops and recent moves rendered after the action bar, whereas DESIGN.md/EXPERIENCE.md place them after the reason and before the move line and actions — now rendered right after the reason, with the recent moves under the crops, for every rec status; the order is unit-tested, and e2e confirms Tab from the link still lands on Apply.
  - `[low]` `[reject]` (intent) Stacking at 1024–1279 and 2D scroll below 1024 are untested — the existing `xl:` grid (unchanged) does the stacking; the scroll wrapper is plain CSS.
  - `[low]` `[reject]` (intent) The fallback crop is unit-tested only — the sample data has no `walk_path` aisle; `cropLayout` is pure and its fallback branch is tested.
  - `[false]` `[reject]` (intent) The `endCap`/`interactive` defaults are not pinned — `e2e/locations-wall.spec.ts:89` checks the end cap and `:677-681` clicks a marker (verification-gap layer).
  - `[low]` `[reject]` (intent) The e2e test does not cover recent-move order or the cap of 3 — both are backend-tested in the domain and over HTTP.
  - `[false]` `[reject]` (intent) There is no runtime "milestone 2" mode — the app has no milestone switch (the wall is already the default Locations view), so "in milestone 2" is delivery timing.
  - `[low]` `[reject]` (intent) Retro items 46/64 are only partly advanced — the spec says to advance item 46 without closing it; the `recommendations.py` split is the item's own work.

## Auto Run Result

**Summary.** The recommendation detail now shows the selected recommendation's move in its shelf context (FR-42, UX-DR34/57/58).
- **Crops.** A same-aisle move gets one crop; a cross-aisle move gets a From aisle crop over a To aisle crop. Each crop is the import layout cut to the N sections around each end (N positions in the `walk_path` fallback), drawn with the shared `WallPanel` and moves layer at scale 1. The recommendation is the selected move, and its arrow is drawn when both ends are in one crop.
- **Accessibility.** Each crop is `role="img"` with the full move name and adds no tab stops. The markers in a crop cannot be clicked.
- **Caption and Key.** "Rule n · round n" sits between or under the crops, with the Key once under them.
- **Version consistency.** A crop renders only when its wall view's version matches the recommendations view's (AD-12).
- **Show on the Locations wall.** The eyebrow row opens `?aisle=<from aisle>&rec=<id>`.
- **Moves in the planning copy.** Under the crops it lists the server's new `recent_moves` (the last 3 effective moves, highest number first), followed by an undo line that matches the undo preview's kind ("Undo reverses/splits/restores move N first").
- **Width.** Crops show 2 sections at 1280–1439px.
- **Retro item 46.** `Detail` moved out of `recommendations-page.tsx` into `detail.tsx`, and all new strings are in `lib/copy`. The item is advanced, not closed.

**Files changed**
- `backend/swp/domain/recommendations.py` -- `RecentMove` and `RecommendationsView.recent_moves`.
- `backend/tests/domain/test_recommendations.py`, `backend/tests/app/test_recommendations_api.py` -- `test_fr42_recommendations_recent_moves_*` (empty, fewer than 3, newest 3, combined once, after apply, moved back, over HTTP).
- `frontend/components/common/wall/crop.ts` (new), `index.ts` -- `cropLayout`.
- `frontend/components/common/wall/wall-panel.tsx` -- `endCap` opt-out.
- `frontend/components/common/wall/moves-layer.tsx` -- `interactive` opt-out.
- `frontend/modules/recommendations/detail.tsx` (new) -- the moved `Detail`, with crops, link and recent moves.
- `frontend/modules/recommendations/crops.tsx` (new) -- crops, placeholder, recent moves, link, viewport hook.
- `frontend/modules/recommendations/recommendations-page.tsx` -- wiring.
- `frontend/lib/copy/index.ts`, `lib/api/plans.ts`, `lib/api/schema.ts` -- strings, `RecentMove`, regenerated schema.
- `frontend/tests/wall-crop.test.tsx` (new), `tests/recommendations.test.tsx` -- unit tests.
- `frontend/e2e/recommendations-page.spec.ts` -- new `uj1` test: crops, link to the wall, recent moves after Apply, 2 sections at 1300px.

**Review findings.** 33 findings: high 0, medium 3, low 25, false 5.
- **Patched (2 medium entries, 7 low rows).**
  - Medium: the undo line per effect kind (edge and blind rows), and the crops and recent moves placed after the reason per DESIGN.md/EXPERIENCE.md.
  - Low: the moved-back backend test, the dead `wallAisle`, `aria-labelledby` on the recent-moves section, the kept-part and outdated detail tests, the comment rewrap, and the duplicate test key.
- **Deferred (1).** The live matchMedia resize test, filed by two rows.
- **Rejected (16 low, 5 false).** Each has its reason in the Review Triage Log.
  - Low: no error states for failed reads (3 rows), recent-move order for combined moves, `round` not shown, the e2e name helper, the keyboard scroll of the crop wrapper (would need a spec change), repeated crop names, markers outside the img in the e2e test, heapq, the duplicated `RecentMove` fields, wide same-aisle crops (a spec decision), untested responsive stacking and fallback rendering, the e2e order and cap, and retro items 46/64 being only partly done.
  - False: the wall version never catching up, `sectionIndex` before the first span, round 0, the opt-out defaults being unpinned, and a milestone mode.

**Follow-up review recommendation:** `true`. Two medium entries were patched (high 0, medium 2, low 7). The unverified risk is the new detail order: crops and recent moves now sit between Show on the Locations wall and Apply. This is checked only by unit tests and in Chromium. Firefox, Edge and real screen readers were not run, so the reading order with two crop images before the actions is unverified.

**Verification** (against baseline `d96106142f97650dbe7de83a79409f76e13a9e51`, after the patches)
- `npm run lint:py` -- All checks passed.
- `npm run lint:imports` -- 5 kept, 0 broken.
- `uv run --directory backend --locked ruff format --check .` -- 180 files already formatted.
- `npm run lint`, `npm run typecheck` -- clean.
- `npm run gen:api` -- schema stable (same hash before and after).
- `npm test` -- pytest 947 passed, 2 skipped; Vitest 550 passed (33 files).
- `SWP_EXPECT_DIALECT=postgresql pytest tests/app --database-url postgresql://…` on a local `postgres:17` container -- 306 passed, 3 skipped.
- `npm run e2e -- --project=chromium` -- 116 passed.
- Matrix audit: every I/O row has a passing test.
  - Same aisle, cross aisle, applied, unknown end, versions disagree and 1300px: `fr42_uxdr57_*`, `fr42_ad12_*`, `fr42_uxdr58_*` in wall-crop.test.tsx.
  - Section at run edge, fallback and short run: `fr42_crop_*`.
  - No moves: `fr42_recent_moves_empty_without_an_undo_line` and `test_fr42_recommendations_recent_moves_empty`.

**Residual risks**
- Firefox and Edge e2e were not run, and neither were real screen readers.
- Crops keep the section count they loaded with if a live resize breaks (deferred test).
- A failed layout or wall read shows no error in the detail (rejected low).
- A same-aisle move with far-apart ends gives a wide crop that only scrolls with a pointer.

## Design Notes

Defining a crop as "the contiguous span range covering the windows around the codes in that run" fits every case in one rule: a cross-aisle end (one code), a same-aisle move (two codes, maybe in two runs), and the fallback (columns instead of spans). The same-aisle crop can get wider than 3 sections when the ends are far apart. That is accepted, because "one crop when both ends are in the same aisle" has to show both ends, and the wrapper scrolls. Each crop carries the full move name, because the epic's example name (a cross-aisle G → A move) is given for "a crop". The recent moves come from the server, because "newest first" is an order and the frontend shows lists in server order.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean
- `uv run --directory backend --locked ruff format --check .` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm run gen:api` -- expected: schema matches the backend (no further diff)
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass
