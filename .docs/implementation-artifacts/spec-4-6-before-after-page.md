---
title: 'Story 4.6: Before/after page'
type: 'feature'
created: '2026-11-22'
baseline_revision: '2715bc3cbad77908589f0c2eb10bc24606a3240a'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 4.5 built the FR-37 before/after counts in the domain, but nothing serves or shows them: the Before/after flow step is the "not built yet" placeholder, so the planner cannot see what the moves change (UJ-1 climax).

**Approach:** Add `GET /api/plans/{id}/before-after` (one `replay` per request, carries `version` and whether there are effective moves) through a new app service and router, and a `modules/before-after` page at `/plans/{id}/before-after` with a DataTable of one row per aisle plus a total row, cells "Before → After".

## Boundaries & Constraints

**Always:**
- Domain: add to `swp/domain/before_after.py` (same slice, no new module) `BeforeAfterView(version: int, has_moves: bool, aisles, total)` and `build_before_after_view(data, analysis, state, version)`. It calls `planning.replay(data, state.steps)` exactly once, passes `result.copy` and `state.best_marks` to `build_before_after`, and sets `has_moves = len(result.moves) > 0` (effective moves; a move undone by moving back counts as none).
- App `swp/app/before_after.py` mirrors `app/pick_groups.py` (`require(plan_id)` → build view). Router `swp/api/routers/before_after.py` mirrors the pick-groups router (`responses=error_responses(404, 422)`), registered in `swp/api/app.py`. Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api` (never hand-edit).
- Client: in `lib/api/plans.ts` add types `BeforeAfterView`, `AisleBeforeAfter`, `BeforeAfterCount`, key `planBeforeAfterKey` under `planRootKey` (so a confirmed command refetches it) and `usePlanBeforeAfter`.
- Page (`modules/before-after/before-after-page.tsx`, route `app/plans/[planId]/before-after/page.tsx`): heading "Before/after"; when `has_moves` is false the note "No moves yet: before and after are the same." above the table; one `DataTable` labelled "Before/after" whose rows are the server's aisles in server order then a "Total" row. Columns: Aisle · Moved in · Moved out · Fast-moving in best locations · Pick groups in the same aisle · Occupied · Empty. Count cells render `{before} → {after}` right-aligned and tabular (`formatNumber`); when after ≠ before the after value is in `type-body-strong`, and each count cell carries `data-count="<column>"`. Moved in/out show the part numbers in `type-code-table`, comma-separated, or "None"; the Total row leaves them empty. "best" appears as a word in the column head; nothing is shown by colour alone.
- Loading/error states reuse `PlanOpening` / `PlanLoadError` / `showsLoadError` like the pick-groups page.
- Tests name their FR/UX-DR (`test_fr37_*`, vitest `fr37_*`/`uxdr51_*`, e2e `uj1 …`).

**Never:**
- The frontend never computes counts, in/out lists or whether there are moves. No change to `build_before_after`'s counts, `replay`, commands, `DataTable` or the summary's step-check rules (Before/after is already never checked; only assert it). No part panel on this page. No edits to `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh sample plan | GET before-after, no steps | 200, `version` 1, `has_moves` false, every Count before == after, lists empty; page shows the note | No error expected |
| After a manual move | one manual move of a single-location part to an empty location in another aisle | `has_moves` true; part in target aisle's `moved_in` and source aisle's `moved_out`; occupied before → after changes in both aisles; version bumped | No error expected |
| Move then move back | move and return in round 0 | `has_moves` false, values equal | No error expected |
| Unknown / malformed id | random uuid / `abc` | 404 `plan_not_found` / 422 `validation_failed` | error envelope |
| One replay | any plan | `replay` called once per request | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/before_after.py` -- `build_before_after(data, copy, analysis, marks)` and models from 4.5; add the view here.
- `backend/swp/domain/planning.py:189` -- `replay` returns `Replay(copy, moves, current_locations)`.
- `backend/swp/domain/views/pick_groups.py` -- reference view with `version`.
- `backend/swp/domain/state.py:63,67` -- `PlanState.best_marks`, `.steps`.
- `backend/swp/app/pick_groups.py`, `backend/swp/api/routers/pick_groups.py`, `backend/swp/api/app.py:43-51` -- service/router/registration pattern.
- `backend/tests/app/test_pick_groups_api.py` -- API test pattern (`_sample_plan`, `_row` no-write check, 404/422, NFR-8 < 1 s); `backend/tests/app/test_views_follow_planning_copy_api.py` -- making a manual move through the command endpoint in tests.
- `backend/tests/domain/test_before_after.py` -- answer-key helpers for the domain view test.
- `frontend/lib/api/plans.ts` -- keys, fetchers, hooks; `frontend/lib/format` -- `formatNumber`.
- `frontend/modules/pick-groups/pick-groups-page.tsx`, `frontend/app/plans/[planId]/pick-groups/page.tsx` -- module/route pattern; `frontend/app/plans/[planId]/[step]/page.tsx` -- placeholder (a static route wins over it).
- `frontend/components/common/data-table.tsx` -- `DataTable` (single tab stop, ↑/↓); `frontend/components/common/plan-status.tsx`.
- `frontend/tests/pick-groups.test.tsx` -- static-markup vitest pattern; `frontend/tests/module-boundaries.test.ts` guards module imports.
- `frontend/e2e/views-follow-planning-copy.spec.ts`, `frontend/e2e/support/plan-api.ts` (`moveFromPanel`, `partDetail`, `locationRows`), `frontend/e2e/support/sample-plan.ts`.
- `backend/swp/domain/views/summary.py` -- step checks; before-after stays unchecked.
- Retro action items: item 15 (DataTable Enter guard) concerns `data-table.tsx`, which this story uses but does not change, and this table has no `onOpen`; left open. No other open item touches this code.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/before_after.py` -- add `BeforeAfterView` + `build_before_after_view`.
- `backend/swp/app/before_after.py` (new) -- service.
- `backend/swp/api/routers/before_after.py` (new) + `backend/swp/api/app.py` -- endpoint.
- `frontend/lib/api/schema.ts` -- regenerate via `npm run gen:api`.
- `frontend/lib/api/plans.ts` -- types, key, fetcher, hook.
- `frontend/modules/before-after/before-after-page.tsx` (new), `frontend/app/plans/[planId]/before-after/page.tsx` (new) -- page and route.
- `backend/tests/domain/test_before_after.py` -- `test_fr37_view_has_moves_and_version` (answer-key steps → has_moves true; no steps / move-and-back → false).
- `backend/tests/app/test_before_after_api.py` (new) -- `test_fr37_before_after_endpoint_on_sample` (shape, version, equal counts, no write), `test_fr37_before_after_follows_a_manual_move`, `test_fr37_before_after_uses_one_replay` (monkeypatch-count `replay`), `test_fr37_before_after_unknown_plan_404`, `test_nfr8_before_after_view_under_one_second`.
- `frontend/tests/before-after.test.tsx` (new) -- markup: rows in server order + Total, "1 → 5" with strong after, equal values plain, note only without moves, "None" lists, head contains "best".
- `frontend/e2e/before-after.spec.ts` (new) -- `uj1 before/after shows a manual move`: fresh sample plan → page shows the note, flow-bar link "Before/after, step 7" without ", done"; move a part from the part panel on Parts; open Before/after from the flow bar; note gone, source/target aisle rows show the part in Moved out / Moved in and occupied cells change; flow step still unchecked.

**Acceptance Criteria:**
- Given the Before/after page with the table focused, when ↑/↓ are pressed, then focus moves between rows and the table is one tab stop.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 26 findings — high 0, medium 2, low 19, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) the manual-move API test picks its part only by `not other_locations`, so the source may hold other parts and stay occupied — now picks a `/locations` row holding exactly one part stored nowhere else (as the e2e does).
  - `[low]` `[reject]` (edge) bare `StopIteration` when no matching part exists — the test still fails loudly; the sample data is fixed and has such parts.
  - `[low]` `[reject]` (edge) e2e `rows.find(...)!` for the target may be undefined — fails loudly as a TypeError; same pattern as `views-follow-planning-copy.spec.ts`.
  - `[low]` `[reject]` (edge) e2e `fresh.aisles.find(...)!` may be undefined — every aisle of the Locations file is a row (pinned by the 4.5 tests); fails loudly otherwise.
  - `[low]` `[reject]` (blind) NFR-8 timing runs on a plan with no steps — replay of a few manual steps is negligible next to view building; the timing test matches the other views'.
  - `[low]` `[reject]` (blind) move-then-back only tested in the domain — the endpoint passes the view through unchanged; `test_fr37_view_has_moves_and_version` pins `has_moves` on that case.
  - `[low]` `[reject]` (blind) round-trip test checks only occupied and hard-codes 1200 at B-01-01-02 — the answer key is fixed (never edited), and moved in/out plus occupancy already show a no-op; extra asserts add no failing case.
  - `[low]` `[reject]` (blind) manual-move API test omits no-write check and some aisle/total asserts — GET read-only is pinned by the endpoint test; totals are sums by the 4.5 domain test.
  - `[low]` `[reject]` (blind) OpenAPI schema name `Count` is generic — the name comes from Story 4.5's model; a future clash would surface at `gen:api`/`tsc`, not silently.
  - `[false]` `[reject]` (blind) the view should live in `domain/views/` and may escape import-linter — the spec places it in the `before_after` slice on purpose (epic: `domain/before_after.py`); the slice is in the `domain-slices` contract and all 5 contracts are kept.
  - `[low]` `[reject]` (blind) count cells read "1 → 5" to screen readers with the change only in weight — both numbers are read under a named column head, so the change is conveyed in text, not colour (NFR-10); an aria-label per cell adds surface for no named failure.
  - `[low]` `[reject]` (blind) Total row is a `tbody` row without `th scope="row"` — changing it means changing the shared `DataTable`, which this story must not; the label "Total" is text.
  - `[low]` `[reject]` (blind) long moved in/out lists have no width handling — the list span wraps inside its cell like other tables; no overflow seen at the tested widths.
  - `[low]` `[reject]` (blind) loading/error states untested — they reuse the shared `PlanOpening`/`PlanLoadError`, tested with the other pages.
  - `[low]` `[reject]` (blind) e2e locates moved-in/out cells by position and aisle cells by name — aisle names (letters) cannot equal part numbers; column order is fixed by the spec.
  - `[low]` `[reject]` (blind) e2e never asserts the `rows.find` target — same as the edge row above.
  - `[low]` `[reject]` (blind) keyboard check does not press Tab — it asserts exactly one row has `tabindex="0"`, the roving-tabindex mechanism `DataTable` uses for one tab stop.
  - `[false]` `[reject]` (blind) `version` is unused by the frontend — `lib/commands/client.ts` `baseVersion` and the stale-refetch rounds read `version` from every cached query under `planRootKey`, including this one.
  - `[low]` `[reject]` (blind) Vitest row helpers split markup on `<tr` — cosmetic test fragility; would fail loudly on a markup change.
  - `[medium]` `[patch]` (intent) refetch after a command is in the code but untested: the e2e reloaded the page before the move — grouped with the verification-gap row below.
  - `[false]` `[reject]` (intent) undo and reset untested — undo and reset do not exist yet (Epic 7); they will reach the view through `replay`.
  - `[low]` `[reject]` (intent) FR-22 "shows which locations are best" met only as a column-head word — the table is per aisle (UX-DR51) and has no location cells; the AC's "word best, never colour" is met.
  - `[false]` `[reject]` (intent) AD-14 aisle order not tested at the API — order is pinned by `test_fr37_aisles_in_text_order_and_totals_are_sums` and the page keeps server order (Vitest uses non-text order).
  - `[low]` `[reject]` (intent) body-strong change only tested in static markup — that is where the class is decided; e2e checks the text.
  - `[false]` `[reject]` (intent) retro item 16 not considered — item 16 is about `require`/store plan loading, which this story does not change (same call as Story 4.5); owner Justas.
  - `[medium]` `[patch]` (verification-gap) nothing checks `planBeforeAfterKey` sits under `planRootKey`, and the e2e emptied the cache before the move — added Vitest `fr37_query_key_is_under_the_plan_root`; the e2e now goes Before/after → Parts → Before/after through flow-bar links and opens the part from search, so the cached query must refetch.

## Design Notes

`has_moves` comes from the server (effective moves after replay) so the "No moves yet" note follows combine/move-back rules without the client counting anything. "Change in body-strong" is read as the after value set in body-strong when it differs from before; equal values stay plain, so an unchanged row reads quietly.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: every contract kept
- `npm run lint` and `npm run typecheck` -- expected: no errors
- `npm test` -- expected: pytest and Vitest pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including `before-after.spec.ts`

## Auto Run Result

Status: done

**Summary:** `GET /api/plans/{id}/before-after` returns the FR-37 view with `version` and `has_moves`, built from one `replay` (`build_before_after_view` in the `before_after` slice). The new `modules/before-after` page at `/plans/{id}/before-after` shows a DataTable with one row per aisle in server (AD-14) order plus a Total row: Moved in, Moved out, Fast-moving in best locations, Pick groups in the same aisle, Occupied, Empty; counts read "Before → After" with a changed after value in body-strong; "No moves yet: before and after are the same." when there are no effective moves. The query sits under `['plan', planId]`, so it refetches after every confirmed command; the flow bar still never checks Before/after. Retro item 15 (DataTable Enter guard) is untouched (DataTable not changed, no `onOpen`); no other open item touches this code.

**Files changed:**
- `backend/swp/domain/before_after.py` -- `BeforeAfterView`, `build_before_after_view` (one replay, `has_moves`).
- `backend/swp/app/before_after.py` -- read-only service.
- `backend/swp/api/routers/before_after.py`, `backend/swp/api/app.py` -- endpoint and registration.
- `frontend/lib/api/schema.ts` -- regenerated with `npm run gen:api`.
- `frontend/lib/api/plans.ts` -- types, `planBeforeAfterKey`, fetcher, `usePlanBeforeAfter`.
- `frontend/modules/before-after/before-after-page.tsx`, `frontend/app/plans/[planId]/before-after/page.tsx` -- page and route.
- `frontend/e2e/support/warm-routes.ts` -- warms the new route.
- `backend/tests/domain/test_before_after.py`, `backend/tests/app/test_before_after_api.py`, `frontend/tests/before-after.test.tsx`, `frontend/e2e/before-after.spec.ts` -- tests.

**Review findings:** 26 findings (high 0, medium 2, low 19, false 5). Patched: 2 entries (one medium: query-key/refetch verification, grouping the intent and verification-gap rows; one low: API test part choice). Deferred: 0. Rejected: 23 findings, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): one medium entry patched, test-only.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm run lint` and `npm run typecheck` clean; `npm test` pytest 420 passed, Vitest 219 passed; `npm run e2e -- --project=chromium` 49 passed (after the patches). One earlier e2e run before review ended with "1 error was not a part of any test" (server start); the immediate re-run and the post-patch run passed.

**Residual risks:** the Total row is an ordinary body row of the shared DataTable (no `tfoot`/row headers).
