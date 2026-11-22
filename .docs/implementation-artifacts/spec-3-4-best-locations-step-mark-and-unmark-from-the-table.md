---
title: 'Story 3.4: Best locations step: mark and unmark from the table'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: 'bbadcba9dda4d3ed468efbdb91bbd32ed96c748d'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Marks, the command endpoint and the client command flow exist (Stories 3.1–3.3), but the planner has no screen to set or remove best-location marks; `/plans/{id}/best-locations` still shows "This step is not built yet."

**Approach:** Build the Best locations step (`modules/best-locations`): the Locations table in marking mode with a **Whole aisle | Level | Single location** segmented control, a marks list with remove buttons and live "N best · M empty" counts, all changes sent through `lib/commands`. The table pieces the Locations module already has move to `components/common` so both modules share them. The server adds the plan's marks (in a fixed order) and the import's levels to the locations view so the client lists and offers only server values.

## Boundaries & Constraints

**Always:** Every mark sent carries the import's own `aisle`/`level`/`location` strings exactly as the locations view returned them (marks match by exact text, Story 3.1). Every mark change goes through `usePlanCommands(planId).send`; every plan-changing control passes its `disabledReason` (`"Saving the last change…"` while pending). The screen changes only from refetched server data; best status, counts and the marks list come from the server (`summary.best_locations`, `summary.empty_best_locations`, `LocationsView.marks`, `row.location.is_best`, `row.covering_marks`); summary and locations render through `useConsistentPlanData`. After a send returns `"confirmed"`: `showToast("Best-location marks changed.")` with no action. Mode is kept per plan in `localStorage` key `swp:best-locations-mode:<planId>` through a `lib/view-state` helper whose every access is wrapped in try/catch (default `aisle` mode). Mark labels: `Aisle A`, `Level 1 in aisle A`, `Level 1 in all aisles`, `Location A-01-01-01`; remove buttons are labelled `Remove mark <label>`, show the `close` icon, and are at least 24 × 24px. Best is always shown in text. Copy verbatim: "Best-location marks changed.", "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations.", "Choose an aisle in the aisle filter." Modules import only `components/*` and `lib/*`. Tests name their FR/UX-DR.

**Never:** No Undo or View action on the toast, no outdated-recommendation count (Epic 5). No wall marking (Epic 10). No new command or event types, no change to the command endpoint or service. No client-side best/count computation, no optimistic updates. No new dependencies. No change to `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Whole aisle | mode aisle, aisle filter `A` | button "Mark aisle A" sends `set_best_mark {kind:"aisle", aisle:"A"}`; after confirm toast, aisle-A rows show Best, mark "Aisle A" listed, counts updated | — |
| No aisle chosen | mode aisle (or level "in this aisle"), filter All aisles | Mark button `aria-disabled` with "Choose an aisle in the aisle filter." | no request |
| Already marked | the mark is in `view.marks` | Mark button disabled with reason "<label> is already marked." | no request |
| Level in all aisles | mode level, level `1`, scope "in all aisles" | "Mark level 1 in all aisles" sends `{kind:"level", level:"1", aisle:null}` | — |
| Level in this aisle | mode level, filter `B`, level `2`, scope "in this aisle" | sends `{kind:"level", level:"2", aisle:"B"}`; level picker lists only levels present in aisle B, in `view.levels` order | — |
| Single location | mode single | each row has **Mark** (`set_best_mark {kind:"location"}`) or, when its `covering_marks` holds its location mark, **Unmark** (`remove_best_mark`); accessible names "Mark <code>" / "Unmark <code>" | — |
| Remove with overlap | marks Aisle A + Level 1 in all aisles; remove "Aisle A" | `remove_best_mark {kind:"aisle", aisle:"A"}`; aisle-A level-1 rows stay Best | — |
| No marks | `view.marks` empty | empty-state text shown in place of the list; counts "0 best · 0 empty" | — |
| Saving | a command in flight | every Mark/Unmark/Remove button `aria-disabled` with "Saving the last change…" | — |
| Failure | send returns `"dropped"` | no toast; the shared save-status notice/toast from `lib/commands` handles it | — |
| Mode memory | mode level chosen, page reloaded | Level is still selected; storage throwing → default Whole aisle, no crash | try/catch |

</intent-contract>

## Code Map

- `backend/swp/domain/views/locations.py` -- `LocationsView`/`build_locations_view`; add `marks: list[BestMark]` (`mark_order(state.best_marks, copy.locations)`) and `levels: list[str]` (distinct levels, `level_key` order).
- `backend/swp/domain/ordering.py` -- AD-14 home; `level_key`, `aisle_order`, `location_order`. Add `mark_order`.
- `backend/swp/domain/state.py` -- `AisleMark`, `LevelMark` (`aisle: str | None`), `LocationMark`, `BestMark` union.
- `backend/tests/domain/test_locations_view.py` -- domain test style (`answer_key_import()`, `build_locations_view(data, state, version)`); `backend/tests/app/test_locations_api.py` -- API test.
- `npm run gen:api` -- regenerates `frontend/lib/api/schema.ts` (CI diffs it).
- `frontend/modules/locations/locations-page.tsx` -- holds `COLUMNS`, `filterLocations`, `occupancyLine`, `countLine`, `isFiltered`, `aisleFromParams`, `ToggleGroup`, filter bar and table inside `LocationsView`. Move the reusable parts to `frontend/components/common/locations-table.tsx`; the Locations page keeps its behaviour (URL `?aisle=&loc=`, search, part panel).
- `frontend/tests/locations.test.tsx` -- imports those helpers from `@/modules/locations/locations-page`; update imports to the new home.
- `frontend/app/plans/[planId]/locations/page.tsx` -- route pattern to copy for `best-locations/page.tsx`; `[step]/page.tsx` is the placeholder that the new static route overrides.
- `frontend/lib/commands/react.tsx` -- `usePlanCommands(planId)` → `{send, pending, disabledReason, …}`; `useConsistentPlanData([a, b])`.
- `frontend/lib/api/plans.ts` -- `usePlanSummary`, `usePlanLocations`, types; add `BestMark` type alias.
- `frontend/components/common/button.tsx` -- `disabledReason`; sizes `sm` = 24px (`--spacing-control-sm`).
- `frontend/components/common/icons.tsx` -- `close` icon. `components/common/toast.tsx` -- `showToast(message)`.
- `frontend/components/common/app-shell/save-status.tsx` -- `data-testid="save-status"` live region with sr-only "Saved automatically" after a confirmed change; the e2e asserts it.
- `frontend/components/common/app-shell/toolbar.tsx` -- flow bar done steps from `summary.steps[].checked`; server already checks `best-locations` when marks exist (`domain/views/summary.py:96`).
- `frontend/e2e/locations-table.spec.ts`, `frontend/e2e/support/sample-plan.ts` -- e2e style and `createSamplePlan`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `mark_order(marks, locations)`: aisle marks (by aisle), then level marks (by `level_key` over the import's levels, then all-aisles before per-aisle, then aisle), then location marks (by `location_order` position; codes not in the import last, by code).
- `backend/swp/domain/views/locations.py` -- add `marks` and `levels` to `LocationsView`.
- `backend/tests/domain/test_locations_view.py` -- `test_fr21_locations_view_lists_marks_in_order` (mixed marks in insertion order come back ordered) and `test_fr21_locations_view_lists_levels`; extend `backend/tests/app/test_locations_api.py` so the API returns `marks` after a `set_best_mark` command.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `frontend/components/common/locations-table.tsx` (new) -- shared columns, filter helpers, `ToggleGroup`, occupancy/count lines, and a filter bar + table component with controlled filters and optional extra columns.
- `frontend/modules/locations/locations-page.tsx` + `frontend/tests/locations.test.tsx` -- use the shared pieces; behaviour unchanged.
- `frontend/components/common/segmented-control.tsx` (new) -- `role="radiogroup"` with `role="radio"` items, `aria-checked`, roving tabindex, Arrow keys move and select (wrap), Home/End.
- `frontend/lib/view-state/storage.ts` (new) -- `readStored(key)`/`writeStored(key, value)` with try/catch; `bestLocationsModeKey(planId)`.
- `frontend/modules/best-locations/marks.ts` (new) -- pure helpers: `markLabel`, `sameMark`, `hasLocationMark(row)`, `bestCountsLine(best, empty)` ("174 best · 7 empty", thousands separators), `levelsInAisle(levels, rows, aisle)`.
- `frontend/modules/best-locations/best-locations-page.tsx` (new) -- the step per the matrix: heading "Best locations", segmented control "Marking mode", level controls (level `select` labelled "Level", scope segmented control "in this aisle | in all aisles"), shared table (with the Mark/Unmark column in single mode), a "Marks" region with counts, list or empty state; loading/error like `LocationsPage`.
- `frontend/app/plans/[planId]/best-locations/page.tsx` (new) -- renders `BestLocationsPage`.
- `frontend/tests/best-locations.test.tsx` (new) -- helpers, segmented-control keyboard logic (export a pure `nextRadioIndex`), and markup tests: empty state, list labels + remove-button names, disabled reasons (no aisle, already marked, saving), Unmark for a location-marked row, mode read from a throwing storage.
- `frontend/e2e/best-locations.spec.ts` (new) -- `uj1 marks aisle A and level 1 in all aisles, removes a mark and keeps the marks after a reload`: on a sample plan open Best locations from the flow bar; see the empty state; choose aisle A, Mark aisle A → toast "Best-location marks changed.", save-status region contains "Saved automatically", aisle-A rows show Best, counts equal the API summary; Level mode, level 1, in all aisles, Mark → "Level 1 in all aisles" listed, counts equal the API; Best locations step marked done in the flow bar; Single mode Mark then Unmark one non-best location (saved each time); reload → both marks, the same counts and Level mode still selected; remove "Aisle A" → aisle-A level-1 rows still Best; Overview shows the same best/empty counts.

**Acceptance Criteria:**
- Given the step opens, when it renders, then the segmented control is a radio group with arrow-key selection, the table is the Locations table, and the marks list and "N best · M empty" counts sit beside it.
- Given a confirmed mark change, when the views refetch, then the Locations step's best column and filter, the Overview counts and the flow bar's Best locations check all reflect it after a reload too.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `schema.ts` matches `npm run gen:api`.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 18, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) Single mode shows Mark on rows already best through an aisle/level mark, so marking adds a location mark with no visible count change — that mark is a real change (it appears in the marks list), so the toast is accurate; UX-DR28 asks for Mark/Unmark on every row.
  - `[low]` `[reject]` (blind) nothing shows which mark makes a row best — the story does not ask for it; showing covering marks per row is new UI.
  - `[low]` `[reject]` (blind) Single mode has no hint text replacing the primary button — cosmetic; the Mark column is the action, and adding copy is new UI the story did not ask for.
  - `[low]` `[reject]` (blind) the primary button's "already marked" and "saving" reasons are not checked in rendered markup — the e2e checks "Aisle A is already marked." as the button's accessible description in the browser; the saving reason is one `??` expression, and testing it needs a new injectable-filters prop.
  - `[medium]` `[patch]` (blind) `mark_order`'s branch for a text level mark over an all-numeric import is untested; a regression would make GET /locations raise ValueError — added `test_fr21_text_level_mark_over_numeric_import_sorts_last`.
  - `[low]` `[reject]` (blind) `mark_order` repeats the "all levels numeric" check that `level_key` owns — needed because `level_key` cannot take a level outside the import; changing `level_key`'s API is a refactor for a rule unlikely to change.
  - `[low]` `[patch]` (blind) the API test sends the second command with `base_version` 1 after version 2 — now sends 1 then 2.
  - `[low]` `[patch]` (blind) the e2e never opens the Locations step, although the spec AC names its best column and filter — the journey now opens `/locations?aisle=A`, turns on the Best filter and checks the row count against the API and every Best cell.
  - `[low]` `[reject]` (blind) the Best locations step has no `?aisle=`/`?loc=` URL state or search, and the scope resets after reload — the story does not ask for them; the mode, which it does ask for, is remembered.
  - `[false]` `[reject]` (blind) `SegmentedControl` shows the first item checked when `value` is not an option — every caller passes a valid value (`readMode` maps unknown stored values to "aisle"; `scope` is typed).
  - `[low]` `[patch]` (blind) `BestMark` hand-spells the union and can drift from the schema — now `LocationsView["marks"][number]`. (The ToggleGroup/SegmentedControl note names no harm: the two widgets are different ARIA patterns — filters are toggle buttons, modes are a radio group.)
  - `[low]` `[reject]` (edge) in Single mode with the Best filter on, Mark/Unmark removes the row and focus drops to the body — rare combination; fixing needs new focus management.
  - `[low]` `[reject]` (edge) the e2e's non-null `find` would throw a TypeError if every location were best — on `data/sample/` most locations stay not best after aisle A and level 1; a clearer failure message only.
  - `[medium]` `[patch]` (verification-gap) same as the blind `mark_order` row — same test added.
  - `[low]` `[patch]` (verification-gap other) `levels` ordering for text-level imports untested — added `test_fr21_text_levels_list_in_str_order`.
  - `[low]` `[patch]` (intent) the toolbar save state is checked only through the sr-only text in the save-status region — `expectSaved` now also checks the toolbar plan-plate tooltip for "Saved automatically".
  - `[low]` `[reject]` (intent) `expectSaved` is not tied to a specific change for later changes — each step is then pinned to server data (marks list, Mark/Unmark button state, counts equal the API), so a passing journey means each change was confirmed.
  - `[low]` `[reject]` (intent) no single-location mark is checked across a reload — the intent's reload check holds for the aisle and level marks; every mark kind goes through the same command and storage path.
  - `[false]` `[reject]` (intent) exact text is not tested with unusual values — every sent value is a server string by construction (no input field), and the domain's exact matching is tested in Story 3.1.
  - `[low]` `[patch]` (intent) the Locations step page and its Best filter are not exercised — same patch as the blind Locations-step row.
  - `[low]` `[reject]` (intent) no test checks that the toast has no Undo — `showToast(MARKS_CHANGED)` is called without an action, and no action exists to render.
  - `[low]` `[patch]` (intent) the 24 × 24 remove button is only class-checked — the e2e now asserts the button's bounding box is at least 24 × 24.
  - `[false]` `[reject]` (intent) the arrow-key radio group is exercised with one ArrowRight in the browser — wrap and Home/End run as the pure `nextRadioIndex` test; the browser check proves the handler is wired.
  - `[false]` `[reject]` (intent) backend fields, the shared table refactor and the placeholder-test change widen scope — the spec plans each of them (server-authoritative marks/levels; modules may not import each other).
  - `[false]` `[reject]` (intent) the spec file is not in the reviewed patch — intentional; it is the claims file and is committed with the change.

## Design Notes

Marks list and levels come from the server, not from folding `covering_marks`: a union of covering marks would hide a mark that covers nothing and has no AD-14 order. Already-marked buttons are disabled instead of sending a no-op, because a no-op confirms with no events and the toast would claim a change.

## Verification

**Commands:**
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` (after committing the regenerated file) -- expected: no diff
- `npm run lint:py`, `npm run lint:imports`, `npm run test:py` -- expected: pass
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including `best-locations.spec.ts`

## Auto Run Result

Status: done

**Summary:** The Best locations step (`/plans/{id}/best-locations`) now works. It shows the Locations table in marking mode with a **Whole aisle | Level | Single location** radio group (arrow keys, remembered per plan in localStorage behind try/catch). Level mode has a level picker and "in this aisle | in all aisles". Single mode adds Mark/Unmark to each row. Beside the table are the marks list with 24 × 24 × remove buttons ("Remove mark Level 1 in all aisles") and the "N best · M empty" counts from the plan summary. Every change goes through `lib/commands`. The step renders summary and locations as one version-consistent set, and shows "Best-location marks changed." only after a confirmed change. Mark buttons explain why they are disabled: no aisle chosen, already marked, or saving. The server's locations view now also returns the plan's marks (in a fixed AD-14 order) and the import's levels, so the client sends only the import's own strings. The Locations table pieces moved to `components/common/locations-table.tsx`, shared by both steps.

**Files changed:**
- `backend/swp/domain/ordering.py` -- `mark_order`.
- `backend/swp/domain/views/locations.py` -- `marks` and `levels` on `LocationsView`.
- `backend/tests/domain/test_locations_view.py`, `backend/tests/app/test_locations_api.py` -- mark/level order, text levels, API marks after commands.
- `frontend/lib/api/schema.ts` (regenerated), `frontend/lib/api/plans.ts` -- `BestMark` type.
- `frontend/components/common/locations-table.tsx` (new) -- shared columns, filters, table.
- `frontend/components/common/segmented-control.tsx` (new) -- radio group with roving tabindex.
- `frontend/lib/view-state/storage.ts` (new) -- guarded localStorage, mode key.
- `frontend/modules/best-locations/marks.ts`, `best-locations-page.tsx` (new), `frontend/app/plans/[planId]/best-locations/page.tsx` (new) -- the step.
- `frontend/modules/locations/locations-page.tsx`, `frontend/tests/locations.test.tsx` -- use the shared table.
- `frontend/tests/best-locations.test.tsx` (new) -- helpers, keyboard, markup, disabled reasons, storage, toast only on confirm.
- `frontend/e2e/best-locations.spec.ts` (new) -- UJ-1 journey; `frontend/e2e/plan-overview.spec.ts`, `frontend/e2e/support/warm-routes.ts`, `frontend/app/plans/[planId]/[step]/page.tsx` -- placeholder example moved to Recommendations.

**Review:** 25 findings (high 0, medium 1, low 18, false 6). Patched entries: 1 medium (the untested text-level branch of `mark_order`) and 5 low (text-level `levels` test, API `base_version`, `BestMark` derived from the schema, e2e Locations step + Best filter, e2e toolbar tooltip save state, e2e 24 × 24 size). Deferred: 0. Rejected: 13 low and 6 false, each with its reason in the triage log.

**Follow-up review recommended:** false (patched: high 0, medium 1, low 5).

**Verification:**
- `npm run lint:py`: pass. `npm run lint:imports`: 5 kept, 0 broken. `npm run test:py`: 343 passed.
- `npm run lint`, `npm run typecheck`: pass. `npm run test:web`: 183 passed (13 files).
- `npm run gen:api`: no change against the committed schema.
- `npm run e2e -- --project=chromium`: 35 passed, including the new best-locations journey (marks aisle A and level 1 in all aisles, sees "Saved automatically" after each change, marks and unmarks a location, reloads and sees the same marks, counts and mode).

**Residual risks:**
- The mode is read from storage on first render; it is safe only because the view mounts after client-side data loads.
- In Single mode with the Best filter on, focus drops to the page when the clicked row leaves the table.
- The default level scope "in this aisle" needs an aisle chosen after each reload.

