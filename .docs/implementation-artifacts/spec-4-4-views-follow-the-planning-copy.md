---
title: 'Story 4.4: Views follow the planning copy'
type: 'feature'
created: '2026-11-22'
baseline_revision: '5a139734987177bc0f55d6677101d73b37f1446c'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The parts, locations, pick-groups, part-detail and search views already fold the step log (`planning_copy` → `replay`), but nothing proves they follow manual moves, and the client still renders a page and its part panel from queries at different versions: a page shows a new table next to an old panel after a move, and a first load with mismatched versions is never repaired (epic 3 retro item 20). Two open retro items sit in the same code: the part-aisle and listed-parts rules are re-derived in three views (item 14), the Locations aisle change wipes the Occupancy/Best filters (item 12), and the Pick groups empty state hard-codes 5 (item 13).

**Approach:** Pin the backend behaviour with answer-key domain tests and an HTTP test that move through the real command (FR-13, FR-14, FR-20, FR-36), moving the shared rules into `domain/planning.py`. On the client, add one hook that renders a set of plan queries only when their versions agree and refetches the stale ones at most twice; use it for every page with its part panel and for Best locations; make the command flow refetch up to the highest version seen.

## Boundaries & Constraints

**Always:**
- Backend: each of the parts, part-detail, locations, pick-groups and search builders calls `replay` exactly once per request (through `planning_copy`, which stays the delegate) and returns `version`. No cross-request cache.
- `domain/planning.py` gains `current_aisle(copy, part) -> str | None` (aisle of `current_location`, None without stock) and `listed_parts(data, analysis) -> dict[str, PartAnalysis]` (parts in `data.parts` order that have an analysis entry). `views/parts.py` (roster and `_partner`), `views/pick_groups.py` (`_part`) and `views/search.py` use them instead of their own copies; `build_part_detail` raises `not_found` exactly when the part is not in `listed_parts`.
- `PickGroupsView` gains `min_shared_jobs: int` (= `analysis.settings.pick_group_min_shared_jobs`); regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`. The page's empty sentence is `emptyMessage(n)`: "No pick groups: no two parts share {n} or more jobs in the period."
- `lib/commands/client.ts`: `refetchConsistent` treats as stale every active plan query below `max(confirmed version, baseVersion(...))` re-read each round (retro 20, part 1); still at most `MAX_STALE_REFETCHES` extra rounds.
- `lib/commands/client.ts`: pure `staleIndexes(datas): number[]` — the indexes whose `version` is below the highest, `[]` unless every item is defined and versions differ.
- `lib/commands/react.tsx`: `useConsistentPlanQueries(queries)` where each query is `{data, isFetching, refetch}`: returns what `useConsistentPlanData` returns for the datas; in an effect, when `staleIndexes` is non-empty and no query is fetching, refetches those queries, at most `MAX_STALE_REFETCHES` times per highest version seen (retro 20, part 2). Best locations uses it for `[summary, locations]`.
- `components/common/part-panel.tsx`: `usePlanPart(planId, part | undefined)` runs only with a part. New `usePanelPlanData(planId, viewQuery, part)` returns `{view, detail}` or undefined: the latest version-consistent `[view, detail]` set (or `[view]` with no part) via `useConsistentPlanQueries`; a remembered detail is used only when `detail.part === part`; with no consistent set yet but view data present, `{view: view.data, detail: undefined}`. `PartPanel` no longer fetches: `WithPartPanel` takes `detail` and `detailError` and the panel shows "Loading part {part}…" while `detail` is undefined and there is no load error. Parts, Locations and Pick groups pages render from `usePanelPlanData`.
- Locations step (retro 12): changing the aisle in the table keeps the Occupancy and Best filters; a different `?aisle=&loc=` link still resets them.
- Tests name their FR/AD (e.g. `test_fr14_move_that_empties_a_location_updates_occupancy`).

**Never:**
- No frontend computation of occupancy, aisles, same-aisle or current locations; no new endpoint; no change to commands, `replay` semantics, the preview or the search dropdown's rendering.
- Do not change the import-scoped queries, the store, or plan loading (retro item 16 is a decision for the owner and stays open). Do not edit `.docs/planning-artifacts/`, `data/sample/` or `data/answer-key/`.
- A frontend module never imports another module.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Move empties a location | answer key: manual 9300 B-01-03-02 → C-01-01-01 (occupied by 1100) | B-01-03-02 `occupied: false`, no contents; aisle B occupied −1, empty +1; aisle C unchanged; warehouse occupied −1 and `occupied_percent` recomputed; 9300's roster row and detail show C-01-01-01 | No error expected |
| Mover into partner's aisle | manual 8100 B-01-02-01 → C-01-03-01 | row (8100, 8200) aisles C/C, `same_aisle: true`; other rows keep their current aisles | No error expected |
| Classes and groups stable | any sequence of valid manual moves | every listed part's `movement_class`, `picks` and the pick groups (parts, shared jobs, order) equal the no-move views | No error expected |
| Panel lags the page | page view v5, detail v4 after a command | previous agreeing set stays on screen; detail refetched; both render at v5 | after two extra refetches the old set stays |
| First load mismatched | summary v6, locations v5 | Best locations shows the opening state, locations refetched (≤ 2), then renders | stays on the opening state if still mismatched |
| Other writer bumps version | confirmed v5, a refetch returns v6 for one view | views below v6 are refetched (≤ 2 rounds) | — |

</intent-contract>

## Code Map

- `backend/swp/domain/planning.py` -- kernel: `planning_copy` (→ `replay`), `current_location`, `aisle_of`; add `current_aisle`, `listed_parts` (imports `Analysis`, `PartAnalysis` from `domain.analysis`, a kernel module — allowed).
- `backend/swp/domain/views/parts.py` -- `build_parts_view` (`listed` dict comprehension), `_partner`, `build_part_detail` (`facts is None or part not in data.parts`).
- `backend/swp/domain/views/pick_groups.py` -- `_part`, `PickGroupsView`, `build_pick_groups_view(data, analysis, state, version)`.
- `backend/swp/domain/views/search.py` -- `classified` comprehension; `views/locations.py` -- occupancy from one copy (already correct, test only).
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()`; `tests/domain/test_pick_groups_view.py:_analysis()` builds the answer-key analysis (reuse pattern); manual steps via `planning.append_step(state, part=, from_location=, to_location=, rule="manual")`.
- `backend/tests/app/test_planning_copy_api.py`, `tests/app/test_manual_move_api.py` (`_command` helper / `manual_move` body, `_sample_plan` from `tests/app/test_parts_api.py`) -- HTTP pattern with `empty_tables`.
- `frontend/lib/commands/client.ts` -- `versionOf`, `baseVersion`, `isConsistent`, `refetchConsistent` (lines ~208-222), `MAX_STALE_REFETCHES`.
- `frontend/lib/commands/react.tsx` -- `latestConsistent`, `useConsistentPlanData` (render-time state), exported via `lib/commands/index.ts`.
- `frontend/lib/api/plans.ts` -- `usePlanPart` (only caller: `PartPanel`).
- `frontend/components/common/part-panel.tsx` -- `PartPanel`, `WithPartPanel`, `usePartPanel`, `PartMoveAction`.
- `frontend/modules/parts/parts-page.tsx:205`, `modules/locations/locations-page.tsx:89`, `modules/pick-groups/pick-groups-page.tsx:99`, `modules/best-locations/best-locations-page.tsx:242` -- page roots.
- `frontend/modules/locations/locations-page.tsx:41-55` -- `urlKey`/`seenUrl` reset that clears filters after the page's own `replaceState` (retro 12); `onAisleChange` writes `planStepHref(planId, "locations", { aisle, part })`.
- `frontend/modules/pick-groups/pick-groups-page.tsx:21` -- `EMPTY_MESSAGE`; `tests/pick-groups.test.tsx:67,73` use it.
- Tests: `frontend/tests/commands.test.tsx` (`setup({summary, locations})` serve lists, `ad12_stale_refetch_*`), `tests/part-panel.test.tsx` (static markup), `e2e/manual-move.spec.ts` (helpers `singleLocationPart`, `emptyTarget`, `openDialog`, `enterTarget`), `e2e/locations-table.spec.ts`, `e2e/pick-groups.spec.ts`, `e2e/support/sample-plan.ts`.
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 12, 13, 14, 20.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py` -- add `current_aisle`, `listed_parts`.
- `backend/swp/domain/views/parts.py`, `views/pick_groups.py`, `views/search.py` -- use them; `PickGroupsView.min_shared_jobs`.
- `frontend/lib/api/schema.ts` -- regenerate.
- `backend/tests/domain/test_views_follow_planning_copy.py` (new) -- `test_fr14_move_that_empties_a_location_updates_occupancy`, `test_fr13_parts_and_detail_follow_manual_moves`, `test_fr20_mover_moved_into_partner_aisle_shows_same_aisle`, `test_fr36_classes_and_groups_stable_after_moves` (several move sequences on the answer key), `test_ad3_views_replay_once_per_request` (count calls by monkeypatching `swp.domain.planning.replay`), `test_fr13_current_aisle_and_listed_parts`, `test_fr20_pick_groups_view_carries_min_shared_jobs`.
- `backend/tests/app/test_views_follow_planning_copy_api.py` (new) -- `test_fr14_views_follow_a_manual_move_command`: sample plan, one `manual_move` over `POST /commands`, then parts, part detail, locations, pick-groups and search all return `version` 2 and the moved part's new location.
- `frontend/lib/commands/client.ts`, `react.tsx` -- `staleIndexes`, highest-version rule, `useConsistentPlanQueries`.
- `frontend/lib/api/plans.ts`, `components/common/part-panel.tsx` -- optional part, `usePanelPlanData`, panel props.
- `frontend/modules/parts/parts-page.tsx`, `modules/locations/locations-page.tsx`, `modules/pick-groups/pick-groups-page.tsx`, `modules/best-locations/best-locations-page.tsx` -- render from the consistent sets; locations filter fix; `emptyMessage`.
- `frontend/tests/commands.test.tsx` -- `ad12_refetch_brings_views_up_to_the_highest_version_seen`, `ad12_stale_indexes_only_for_defined_mismatched_sets`.
- `frontend/tests/pick-groups.test.tsx` -- `emptyMessage` from the server value (`fr20_…`).
- `frontend/e2e/views-follow-planning-copy.spec.ts` (new) -- "uj1 locations show the emptied location after a manual move" (move a single-location part out of an aisle through the panel dialog on Locations; its source row reads empty and that aisle's occupancy line changes); "uj6 a pick group shows same aisle after its part moves into the partner's aisle" (pick a sample row with different aisles whose part has one location, move it via the dialog into an empty location of the partner's aisle, Pick groups row reads "Same aisle"); "ad12 the part panel waits for a version that matches the page" (route the first part-detail response to `version - 1`; the panel shows facts after a refetch).
- `frontend/e2e/locations-table.spec.ts` -- "uj1 changing the aisle keeps the occupancy filter" (retro 12).
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 12, 13, 14, 20 → `done`.

**Acceptance Criteria:**
- Given a plan with manual moves, when the parts, part, locations, pick-groups and search views are requested, then each uses one `replay` and carries the plan `version`, and the client renders a page with its panel (or Best locations' summary + locations) only when their versions agree, refetching stale ones at most twice.
- Given a move that empties a location, when the Locations step refetches, then the row shows Empty and the aisle and warehouse occupancy lines show the new counts.
- Given a pick group whose part was moved into its partner's aisle, when Pick groups refetches, then the row shows "Same aisle" with the current aisles.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 27 findings — high 0, medium 5, low 17, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) a failed part-detail query freezes the page's view on the remembered set — real when a panel for an unknown part is opened after a `[view]` set existed; `usePanelPlanData` now builds the set from `[viewQuery]` alone when the detail has an error and no data.
  - `[low]` `[reject]` (blind) nothing shows when the refetch budget runs out — needs a server that keeps answering one version behind; the next focus refetch or command repairs it; an exhausted state adds a new branch to every page.
  - `[medium]` `[patch]` (blind) the hook's refetch effect and budget have no test — new e2e "ad12 best locations stops refetching a view that stays behind" (always-stale route, hits settle at 3, no counts).
  - `[low]` `[reject]` (blind) `ownUrl` can stick or reset filters on two aisle changes before the URL lands — `replaceState` is synchronous and a select fires one change per input; not met in use; a queue of writes adds state.
  - `[low]` `[reject]` (blind) `build_part_detail` builds the whole listed dict for one lookup — O(parts) dict build next to an O(inventory) replay in the same request; negligible.
  - `[false]` `[reject]` (blind) `planning.py` now importing `analysis` risks a cycle — `domain/analysis.py` imports nothing from `planning`; both are kernel modules and import-linter keeps all 5 contracts.
  - `[low]` `[reject]` (blind) the API test skips `same_aisle`, occupancy counts and part search — those are asserted in the domain tests on the answer key; the API test pins the HTTP version and the moved location.
  - `[low]` `[reject]` (blind) e2e candidate search makes many detail calls — each test runs in ~6 s; stable in 4 full runs.
  - `[low]` `[reject]` (blind) `td:nth-child` selectors in the pick-groups e2e — a column change would fail the test loudly, not silently; adding data attributes adds UI surface.
  - `[low]` `[reject]` (blind) `moveFromPanel` hides its empty-target, round-0 assumptions — its doc names the flow; both callers move to an empty location in round 0.
  - `[low]` `[reject]` (blind) only the "detail behind the page" direction is e2e-tested — `staleIndexes` is direction-free (unit-tested both ways) and the hook refetches whichever query is lower.
  - `[false]` `[reject]` (blind) the story's own sprint status is not updated — the orchestrating session records the story status in its own "Sprint:" commits (see `git log`); build-auto does not.
  - `[low]` `[reject]` (blind) disabled `usePlanPart` uses a placeholder key — TanStack treats a query whose only observer is disabled as inactive, and the client only refetches `type: "active"`; no fetch of `/parts/` happens.
  - `[medium]` `[patch]` (edge) failed detail freezes the view — same root cause and patch as the first blind row.
  - `[low]` `[reject]` (edge) exhausted budget leaves Best locations on the opening state — same reasoning as the blind row.
  - `[false]` `[reject]` (edge) budget shared across parts leaves a newly opened stale part on Loading — a newly opened part mounts its query, which fetches (isFetching gates the effect) and returns the current version; no budget is needed for it to agree.
  - `[low]` `[reject]` (edge) two aisle changes before the URL is observed reset filters — same reasoning as the blind row.
  - `[low]` `[reject]` (edge) own write equal to the current URL leaves `ownUrl` set — `changeFilters` writes only when the aisle differs from the filter's aisle, which follows the URL; not reachable from the select.
  - `[false]` `[reject]` (edge, claim) "at most twice" exceeded across versions — the spec defines the limit per highest version seen (Always + Design Notes), which the code implements.
  - `[medium]` `[patch]` (verification-gap) direct A→B panel switch untested — new e2e "ad12 switching the panel to another part never shows the previous part's facts" (held `/parts/{B}`, panel B shows Loading and not A's description).
  - `[medium]` `[patch]` (verification-gap) refetch budget never reached — same patch as the blind budget row.
  - `[low]` `[reject]` (intent) one replay per request is counted at the builder, not over HTTP — each app service calls its builder once (`app/parts.py`, `locations.py`, `pick_groups.py`, `search.py`); the HTTP test pins the version.
  - `[low]` `[reject]` (intent) the warehouse occupancy line after a move is not asserted in the UI — it uses the same `occupancyLine` renderer as the asserted aisle line; counts asserted in the domain test.
  - `[low]` `[reject]` (intent) Parts page and search not exercised with a real move in the UI — Story 4.3's `manual-move.spec.ts` asserts the panel chip and the Locations row after a real move; the search dropdown shows no planning-copy facts.
  - `[low]` `[reject]` (intent) toolbar summary and search dropdown are outside any consistent set — neither shows a fact a move changes (plan name/round; part and location text, class, best).
  - `[false]` `[reject]` (intent) per-version budget differs from a literal "twice" — same refutation as the edge claim row.
  - `[low]` `[reject]` (intent) retro item 16 (plan views load transactions) not addressed — owner Justas, a decision ("or amend AD-4"); the story does not change the store or plan loading, so it stays open.

## Design Notes

**Why the panel joins the page's set.** The page table and the panel are both plan views on one screen; after a move the table can arrive at v+1 before the panel. Keeping the last agreeing pair (and showing the view alone only before any pair exists) is what AD-12 asks for, without a loading flash on every refetch.

**Why the budget is per highest version.** A new highest version (another confirmed command, another writer) earns a fresh two refetches; a view that stays behind cannot loop.

## Verification

**Commands:**
- `npm run gen:api` -- expected: `schema.ts` gains `min_shared_jobs` only
- `npm run lint:py`, `npm run lint:imports` -- expected: pass
- `npm run lint`, `npm run typecheck` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new spec

## Auto Run Result

Status: done

**Summary:** The plan views were already built from `replay`; this story pins that with answer-key domain tests and an HTTP test that moves a part through `POST /commands` (FR-13, FR-14, FR-20, FR-36, AD-3). On the client, `useConsistentPlanQueries` renders a set of plan queries only when their versions agree and refetches the stale ones at most twice per highest version; Parts, Locations and Pick groups render their view and part panel as one set (`usePanelPlanData`), Best locations its summary and locations. The command flow refetches up to the highest version seen. Retro items closed: epic 2 items 12 (aisle change keeps filters), 13 (empty sentence from `min_shared_jobs`), 14 (`current_aisle`, `listed_parts` in `domain/planning.py`) and epic 3 item 20. Item 16 stays open (owner decision).

**Files changed:**
- `backend/swp/domain/planning.py` -- `current_aisle`, `listed_parts`.
- `backend/swp/domain/views/parts.py`, `pick_groups.py`, `search.py` -- use them; `PickGroupsView.min_shared_jobs`.
- `frontend/lib/api/schema.ts` -- regenerated (`min_shared_jobs`).
- `frontend/lib/commands/client.ts`, `react.tsx` -- `staleIndexes`, highest-version refetch, `useConsistentPlanQueries`.
- `frontend/lib/api/plans.ts` -- `usePlanPart` runs only with a part.
- `frontend/components/common/part-panel.tsx` -- `usePanelPlanData`; the panel takes its detail from the page.
- `frontend/modules/{parts,locations,pick-groups,best-locations}/*-page.tsx` -- consistent sets; Locations filter fix; `emptyMessage`.
- Tests: `backend/tests/domain/test_views_follow_planning_copy.py` (new), `backend/tests/app/test_views_follow_planning_copy_api.py` (new), `test_pick_groups_api.py`; `frontend/tests/commands.test.tsx`, `part-panel.test.tsx`, `pick-groups.test.tsx`; `frontend/e2e/views-follow-planning-copy.spec.ts` (new, 6 journeys), `locations-table.spec.ts`, `manual-move.spec.ts`, `e2e/support/plan-api.ts` (new, shared helpers).
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 12, 13, 14, 20 `done`.

**Review findings:** 27 findings (high 0, medium 5, low 17, false 5). Patched: 3 entries, all medium (failed detail freezing the view; budget e2e; A→B panel switch e2e). Deferred: 0. Rejected: 22, each with its reason in the triage log.

**Follow-up review:** recommended (`true`). Three medium entries were patched; the budget and A→B patches are tests that pass, but the failed-detail fallback in `usePanelPlanData` (view alone when the detail errors) has no test of its own.

**Verification:** `npm run gen:api` adds only `min_shared_jobs`; `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm run lint` and `npm run typecheck` clean; `npm test` pytest 407 passed, Vitest 212 passed; `npm run e2e -- --project=chromium` 48 passed (twice after the patches).

**Residual risks:** Before the patches, 3 of 8 full e2e runs had one intermittent failure each in tests outside this story (`manual-move.spec.ts` "ad12 retries a command after a proxy 500" twice, `createSamplePlan` not 201 once); each passed alone and in repeated runs, so it looks like load-related flakiness. The refetch effect is checked only in Playwright (Vitest renders without effects).
