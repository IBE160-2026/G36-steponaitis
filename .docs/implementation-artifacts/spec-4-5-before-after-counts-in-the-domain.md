---
title: 'Story 4.5: Before/after counts in the domain'
type: 'feature'
created: '2026-11-22'
baseline_revision: '90b83b3b234a65b7bd206d42b2098cee4ae01536'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The planner cannot yet judge a plan against the import: nothing in the domain compares the import ("before") with the planning copy ("after") per aisle and for the whole warehouse (FR-37). Story 4.6 needs these counts to build its endpoint and page.

**Approach:** Add a pure domain slice `domain/before_after.py` that takes the import, the planning copy, the analysis and the current best-location marks, and returns per-aisle and total before/after counts (in/out lists, fast-moving parts in best locations, pick groups in one aisle, occupied/empty). Pin it with the answer-key `before_after` section.

## Boundaries & Constraints

**Always:**
- `swp/domain/before_after.py` imports only the kernel: `planning`, `ordering`, `values` plus the data kernel modules (`analysis`, `import_data`, `state`). Add `swp.domain.before_after` to the `domain-slices` independence contract in `backend/.importlinter`.
- Entry point: `build_before_after(data: ImportData, copy: PlanningCopy, analysis: Analysis, marks: Sequence[BestMark]) -> BeforeAfter`. It never calls `replay` itself; the "before" side comes from a new kernel function `planning.import_copy(data) -> PlanningCopy` (the import's inventory indexed with `_copy_of`, no fold), so 4.6's endpoint keeps exactly one `replay` per request.
- Pydantic models (wire-ready for 4.6, no `version` here): `Count {before: int, after: int}`; `AisleBeforeAfter {aisle, moved_in: list[str], moved_out: list[str], fast_in_best: Count, pick_groups_together: Count, occupied: Count, empty: Count}`; `BeforeAfterTotal {fast_in_best, pick_groups_together, occupied, empty}` (all `Count`); `BeforeAfter {aisles: list[AisleBeforeAfter], total: BeforeAfterTotal}`.
- Aisles: every aisle of `data.locations`, in `ordering.aisle_order`, including aisles where every count is 0.
- Moved in to aisle X: parts (any part in either copy's inventory) with stock > 0 at some location in X in the planning copy and at none in X in the import; moved out is the reverse. Lists in part-number text order from a new `ordering.part_number_order(parts: Iterable[str]) -> list[str]` (distinct, `str` order, AD-14).
- Fast in best: each part of `planning.listed_parts(data, analysis)` with `movement_class == "fast"` counts once, in the aisle of its `current_location` on that side, when `is_best(copy, current, marks)`; no current location → counted nowhere. Both sides use the same (current) `marks`.
- Pick groups together: each group in `analysis.pick_groups` counts in aisle X on a side when both parts' `current_aisle` on that side equal X (None never matches).
- Occupied/empty per aisle and in total via `planning.is_occupied` on each side. Totals are the sums over aisles.
- Tests name their FR: `test_fr37_*`.

**Never:**
- No endpoint, app service, router, schema regeneration or frontend change (that is Story 4.6). No change to `replay`, commands or existing views.
- Do not recompute classes or pick groups; never read transactions. Do not edit `.docs/planning-artifacts/`, `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer-key final state | answer-key import; the 14 move-list lines of `expected.json` replayed as steps (rule `"1"`→`rule_1`, `"Manual"`→`manual`, each line's round); marks `[aisle A]` | `fast_in_best`, `pick_groups_together`, `moved_in`, `moved_out`, `occupancy_after` per aisle and total equal `expected.json` `before_after` exactly (1 → 5, 1 → 6); before-side occupancy equals `occupancy_import` | No error expected |
| No moves | copy = `import_copy(data)` | every Count has before == after; all in/out lists empty | No error expected |
| Part with no stock | 1008614-00 (fast, stock 0) | counted in no aisle's fast_in_best; its group with 2300 never together | No error expected |
| Part keeps a location in the aisle | 1200 A-01-02-01 (2) + B-01-01-02 (8) moved B → A | not in A's moved_in; in B's moved_out; counts in A after (current A-01-01-01) | No error expected |
| Marks changed | answer key, no moves, marks `[]` | fast_in_best 0 before and after in every aisle | No error expected |
| Swap inside an aisle | 9100/9200 swap in D only | neither part in any in/out list | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/planning.py` -- kernel: `_copy_of(data, inventory)` (build `import_copy` on it), `replay`, `current_location`, `current_aisle`, `aisle_of`, `is_occupied`, `is_best`, `listed_parts`, `PlanningCopy.stock_of`.
- `backend/swp/domain/ordering.py` -- `aisle_order`; add `part_number_order`.
- `backend/swp/domain/analysis.py` -- `Analysis.parts` (`PartAnalysis.movement_class`), `Analysis.pick_groups` (`PickGroup.part_a/part_b`).
- `backend/swp/domain/state.py` -- `BestMark`, `AisleMark`, `Step` (construct steps directly for the move list: `Step(move_number=, part=, from_location=, to_location=, rule=, round=)`; `replay` trusts steps).
- `backend/swp/domain/views/locations.py` -- reference for per-aisle occupancy from one copy (do not change).
- `backend/.importlinter` -- `[importlinter:contract:domain-slices]` modules list; `backend/tests/rules/test_layer_rules.py:test_nfr1_every_domain_module_is_kernel_or_independent_slice` fails until the slice is listed.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()`; `backend/tests/domain/test_pick_groups_view.py:_analysis()` builds the answer-key analysis (reuse it, as `test_views_follow_planning_copy.py` does).
- `data/answer-key/expected.json` -- `before_after`, `move_list.lines_in_order`, `occupancy_import`, `final_current_locations`, `best_location_marks`.
- Retro action items: none open touches this code (item 16 is about plan loading in the store; unchanged).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py` -- add `import_copy(data)` -- the "before" side without a second fold.
- `backend/swp/domain/ordering.py` -- add `part_number_order` -- AD-14 owner of the in/out order.
- `backend/swp/domain/before_after.py` (new) -- models and `build_before_after` per Always.
- `backend/.importlinter` -- list `swp.domain.before_after` in `domain-slices`.
- `backend/tests/domain/test_before_after.py` (new) -- `test_fr37_answer_key_before_after` (also asserts the replayed current locations equal `final_current_locations` as a sanity check), `test_fr37_no_moves_before_equals_after`, `test_fr37_part_without_stock_counts_nowhere`, `test_fr37_part_keeping_a_location_in_the_aisle_is_not_moved_in`, `test_fr37_both_sides_use_current_marks`, `test_fr37_swap_inside_an_aisle_moves_nothing_in_or_out`, `test_fr37_aisles_in_text_order_and_totals_are_sums`.

**Acceptance Criteria:**
- Given `domain/before_after.py`, when import-linter runs, then all contracts are kept and the slice imports only kernel modules.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 19 findings — high 0, medium 1, low 9, false 9, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) the marks test uses no moves and empty marks, so it cannot catch a side ignoring the marks — test now replays the answer-key move list with marks `[A, B]` and asserts per-aisle `fast_in_best` (B 2 → 0, total 3 → 5).
  - `[low]` `[patch]` (blind) the answer-key test never checks which aisles come back — added `[row.aisle ...] == sorted(want["moved_in"])`.
  - `[low]` `[reject]` (blind) per-aisle occupancy repeats `views/locations.py` — both count with the kernel rule `is_occupied`; the views differ only in the trivial sum, and a shared helper adds kernel surface for no named divergence.
  - `[low]` `[reject]` (blind) `import_copy` and `part_number_order` have no direct tests — both are one-liners exercised by every before/after test and pinned by the answer key; no failing behaviour shown.
  - `[low]` `[patch]` (blind) the no-stock test asserts the class in `analysis.parts`, not in `listed_parts` — now asserts `listed_parts(data, only)["1008614-00"].movement_class == "fast"`.
  - `[low]` `[reject]` (blind) `total()` uses string field names — a wrong name fails loudly at once in the tests that call it; not met in use.
  - `[false]` `[reject]` (blind) fast parts and pick groups use different part sets — a pick group part outside the Inventory has no stock, so `current_aisle` is None and the group never counts; no different outcome.
  - `[low]` `[reject]` (blind) no test for a part keeping stock in the source aisle — the in/out rule is a set comparison of aisles with stock, covered on the target side by the 1200 test; no failing case shown.
  - `[false]` `[reject]` (blind) unknown location raises `KeyError` — inventory codes are checked against the Locations file at import (`import_.py:401`) and manual moves refuse codes not in it, so no copy holds stock at an unknown code.
  - `[low]` `[reject]` (blind) `_row` returns `Any`, `_analysis` imported from another test module, swap test skips occupancy — same pattern as the Story 4.4 tests; cosmetic.
  - `[false]` `[reject]` (edge) stock at a code absent from `copy.locations` crashes `_aisles_holding` — same refutation as the blind `KeyError` row.
  - `[false]` `[reject]` (edge) fast part's current location unknown → `KeyError` — same refutation.
  - `[false]` `[reject]` (edge) copy built from another import gives wrong sizes — the only intended caller (4.6) passes `replay(data, steps).copy`, whose `locations` are `data.locations`; not reachable.
  - `[low]` `[patch]` (edge) answer-key loop passes vacuously on missing aisles — same root cause and fix as the blind aisle-set row.
  - `[false]` `[reject]` (intent) the slice imports `analysis`, `import_data`, `state` beyond the named `planning`/`ordering`/`values` — the AC says "as the slice rules allow"; these are kernel modules (`KERNEL_MODULES` in `tests/rules/test_layer_rules.py`) and import-linter keeps all contracts.
  - `[false]` `[reject]` (intent) undo/reset not exercised — undo and reset do not exist yet (Epic 7); the function takes the replayed copy, so they reach it through `replay`.
  - `[medium]` `[patch]` (intent) "both sides use the current marks" only tested trivially — same root cause and fix as the blind marks row.
  - `[false]` `[reject]` (intent) a part with no current location untested in moved in/out — such a part has no aisle with stock on either side, so the set comparison yields nothing; the no-moves test covers 1008614-00 in every list being empty.
  - `[low]` `[patch]` (intent) answer-key test does not catch an omitted aisle — same fix as the blind aisle-set row.

## Design Notes

**Why `import_copy` instead of `replay(data, [])`.** AD-3 asks each view to fold the step log once per request; 4.6 passes the replayed copy in and the slice derives "before" from the import directly, so no second fold is hidden in the slice.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: every contract kept
- `npm test` -- expected: pytest and Vitest pass, including `test_before_after.py`
- `npm run e2e -- --project=chromium` -- expected: all pass (no user-visible change; existing journeys stay green)

## Auto Run Result

Status: done

**Summary:** New pure domain slice `domain/before_after.py` (FR-37): `build_before_after(data, copy, analysis, marks)` returns per aisle (text order) and in total the before/after counts — parts moving in and out (part-number text order), fast-moving parts in best locations (once, at the current location, same current marks on both sides), pick groups whose two parts share an aisle, and occupied/empty. The "before" side comes from the new kernel `planning.import_copy(data)`, so Story 4.6 keeps one `replay` per request. The answer-key test replays the 14 move-list lines and matches `expected.json` exactly (1 → 5, 1 → 6, every aisle's lists and occupancy). No open retro action item touches this code (item 16 concerns plan loading in the store).

**Files changed:**
- `backend/swp/domain/before_after.py` -- new slice: models and `build_before_after`.
- `backend/swp/domain/planning.py` -- `import_copy`.
- `backend/swp/domain/ordering.py` -- `part_number_order`.
- `backend/.importlinter` -- `swp.domain.before_after` in `domain-slices`.
- `backend/tests/domain/test_before_after.py` -- 7 `test_fr37_*` tests.

**Review findings:** 19 findings (high 0, medium 1, low 9, false 9). Patched: 3 entries (one medium: marks test; two low: answer-key aisle set, no-stock part listed). Deferred: 0. Rejected: 13, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): one medium entry patched, test-only.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm test` pytest 414 passed, Vitest 212 passed; `npm run e2e -- --project=chromium` 48 passed (before and after the patches).

**Residual risks:** none known; the endpoint and page (Story 4.6) will be the first caller.
