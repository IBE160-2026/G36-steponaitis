---
title: 'Story 8.1: Move-list order and header in the domain'
type: 'feature'
created: '2026-11-23'
baseline_revision: '31e7568c1e07b69f77bc60c82757422cea002780'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Two uncombined moves of the same part in one round (A->B, then B->C where B already
      held the part) print in reverse log order, so following the paper leaves A's stock at
      B while the plan has all of it at C.
    evidence: |-
      replay's _fold_move combines a follow-up step only when the earlier move's target held
      none of the part (target_was_empty), so both moves stay effective. FR-38's explicit rule
      (a line into a location comes after every line in the round that empties it) puts B->C
      before A->B. Doing them in log order would violate the stated FR-38 rule; fixing it
      needs a product decision: a same-part exception to FR-38's order, or combining in FR-34
      even when the target held the part. Same root cause covers a same-part pair inside a
      cycle, which is ordered by Walk Path rather than log order.
    location: >-
      backend/swp/domain/move_list.py _order_round
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The plan's effective moves exist (`replay(...).moves`) but nothing builds the printed move list: no safe order within a round (out before in, cycles in Walk Path order), no header, no endpoint. Stories 8.2–8.4 build on this view, and the answer-key test `test_fr38_answer_key_move_list` is still skipped.

**Approach:** A pure domain slice `domain/move_list.py` turns the effective moves into rounds of ordered lines plus a header; a read-only app service and `GET /api/plans/{id}/move-list` return it with one `replay` per request. Un-skip the answer-key move-list test.

## Boundaries & Constraints

**Always:**
- `swp/domain/move_list.py` imports only kernel modules (`planning`, `ordering`, `import_data`, `state`, ...); add `swp.domain.move_list` to the `domain-slices` contract in `backend/.importlinter`.
- Models (pydantic, wire-ready): `MoveListLine {move_number, round, part, description: str, from_location, to_location, rule: Rule}`; `MoveListRound {round, label: str | None, lines}` — `label` is `"before the first run"` for round 0, else `None`; `MoveListHeader {name, data_as_of: date, uploaded_at: AwareDatetime, rounds: int, generated_at: AwareDatetime}`; `MoveListView {version, header, rounds: list[MoveListRound]}`.
- `build_move_list_rounds(data, moves: Sequence[EffectiveMove]) -> list[MoveListRound]`: exactly one line per effective move (no more, no fewer); description = `data.parts.get(part, "")`. Rounds ascending, only rounds that have a move, round numbers as stored (gaps kept).
- Order within a round (FR-38, AD-14): precedence edge X → Y when `X.from_location == Y.to_location` (X ≠ Y): Y must come after X. Lines in one strongly connected component of that graph form a cycle and are ordered among themselves by the base key. The component graph is ordered by a Kahn topological sort that always takes the ready component whose smallest base key is lowest. Base key = from-location's Walk Path (numeric), then part number (`str` order), then move number; a from-location missing from `data.locations` sorts after every known one, by code. The base key function lives in `domain/ordering.py` (AD-14 owner).
- `build_move_list_view(data, state, *, version, name, data_as_of, uploaded_at, generated_at) -> MoveListView` calls `replay` once; header `rounds` = number of distinct rounds with a move.
- App service `swp/app/move_list.py`: `move_list(plan_id, *, now: datetime | None = None)` uses `plans.require`, `generated_at = now or datetime.now(UTC)`; never writes. Router `swp/api/routers/move_list.py` `GET /plans/{plan_id}/move-list` with `error_responses(404, 422)`, mounted in `swp/api/app.py`.
- Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- Tests name their FR (`test_fr38_*`); `test_fr38_out_before_in` is a seeded-random property test (no new dependency).

**Never:**
- No swap marks (Story 8.2), no frontend page or print route (8.3/8.4), no new Playwright spec (no user-visible change).
- No change to `replay`, commands, stored state or other views. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`. No new third-party dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer-key final state | Story 7.5 scenario's final state | 14 lines equal `expected.json` `move_list.lines_in_order` in order (round, part, from, to, rule); header rounds 3 | No error expected |
| Out before in | round 1: 1100 C-01-01-01→A-01-01-03, 9300 B-01-03-02→C-01-01-01 | 9300 after 1100 although its Walk Path is lower | No error expected |
| Cycle | 9100 D-01-02-02→D-01-02-03, 9200 D-01-02-03→D-01-02-02 | Walk Path order: 9100 then 9200 | No error expected |
| Chain | a: L1→L2, b: L2→L3, c: L3→L4 (Walk Path L1<L2<L3) | c, b, a | No error expected |
| Same Walk Path | two lines whose from-locations share a Walk Path | part-number `str` order (`"30400"` before `"3050"`) | No error expected |
| Round gaps | moves in rounds 0, 1, 3 | rounds [0, 1, 3]; round 0 label "before the first run"; header rounds 3 | No error expected |
| No moves | fresh plan | `rounds: []`, header rounds 0 | No error expected |
| Unknown plan | random UUID | 404 `plan_not_found` | error envelope |
| Bad id | non-UUID path | 422 | error envelope |

</intent-contract>

## Code Map

- `backend/swp/domain/planning.py:82` -- `EffectiveMove` (move_number, part, from/to, rule, round, steps) and `replay(data, steps).moves`; input of the slice.
- `backend/swp/domain/ordering.py` -- AD-14 home; add the base key (e.g. `walk_path_key(locations) -> Callable[[str, str, int], tuple]`). `LocationData.walk_path` is `Decimal`.
- `backend/swp/domain/import_data.py:17,42` -- `LocationData`, `ImportData.parts: dict[str, str]` (descriptions).
- `backend/swp/domain/before_after.py:148-167` -- pattern for a `...View` with `version` built from one `replay`.
- `backend/swp/app/before_after.py`, `backend/swp/api/routers/before_after.py` -- service/router pattern to copy; `swp/app/plans.py:172 require` returns `StoredPlan` (`name`, `version`, `state`, `imported.{data, uploaded_at, data_as_of}`).
- `backend/swp/app/commands.py:39` -- `now` injection pattern (`datetime.now(UTC)` default).
- `backend/swp/api/app.py` -- mount the router.
- `backend/.importlinter` `[importlinter:contract:domain-slices]`; `backend/tests/rules/test_layer_rules.py:182` fails until the slice is listed.
- `backend/tests/domain/test_answer_key.py:489` -- skipped `test_fr38_answer_key_move_list`; fixtures `final`, `key`, `data` (shared `tests/domain/conftest.py`); `MOVE_LIST` constant and docstring mention the skip.
- `backend/tests/app/test_answer_key_api.py:50` -- whole scenario over HTTP; extend with a move-list GET.
- `backend/tests/app/test_before_after_api.py` -- API test pattern (`_sample_plan`, `_row` for the never-writes check, `empty_tables` fixture).
- `data/answer-key/Locations.csv`, `expected.json` `move_list` -- read-only.
- Retro items: epic-2 #16 (plan views load transactions) concerns `store.get_plan`, which this read-only view uses like every other view; not changed here (Story scope is the move-list view). epic-4 #37's shared `tests/domain/conftest.py` is reused. No other open item touches this code.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add the base move-line key -- AD-14 owner of the order.
- `backend/swp/domain/move_list.py` (new) -- models, `build_move_list_rounds`, `build_move_list_view` per Always.
- `backend/.importlinter` -- list `swp.domain.move_list` in `domain-slices`.
- `backend/swp/app/move_list.py` (new), `backend/swp/api/routers/move_list.py` (new), `backend/swp/api/app.py` -- read-only endpoint.
- `frontend/lib/api/schema.ts` -- regenerate (`npm run gen:api`).
- `backend/tests/domain/test_move_list.py` (new) -- `test_fr38_lines_are_exactly_the_effective_moves`, `test_fr38_out_before_in` (seeded random rounds incl. cycles and chains: no line moves into a location a later same-round line empties unless both are in one cycle; line multiset equals the moves), `test_fr38_cycle_in_walk_path_order`, `test_fr38_chain_orders_out_before_in`, `test_fr38_same_walk_path_by_part_text_order`, `test_fr38_rounds_keep_gaps_and_label_round_0`, `test_fr38_no_moves_gives_no_rounds`.
- `backend/tests/domain/test_answer_key.py` -- un-skip and implement `test_fr38_answer_key_move_list`; drop `MOVE_LIST`; update the docstring.
- `backend/tests/app/test_move_list_api.py` (new) -- `test_fr38_move_list_endpoint_empty_plan` (keys, version, header name/data_as_of/uploaded_at match the plan, rounds 0, `generated_at` between before/after request instants, plan row unchanged), `test_fr38_move_list_after_a_manual_move` (one round-0 line with description), `test_fr38_move_list_unknown_plan_404`.
- `backend/tests/app/test_answer_key_api.py` -- assert the HTTP move list equals the answer key's 14 lines in order.

**Acceptance Criteria:**
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass, and `test_fr38_answer_key_move_list` runs (not skipped) and passes.
- Given `GET /api/plans/{id}/move-list`, when called twice, then the plan's `version` and `last_edited_at` are unchanged (never writes).

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 20 findings — high 0, medium 3, low 15, false 2, maybe-false 0
- findings:
  - `[medium]` `[defer]` (blind) same part A->B then B->C in one round, B already holding it, prints B->C first, so the paper's result differs from replay — verified in `planning._fold_move` (no combine when `target_was_empty` is false); the code follows the intent's explicit FR-38 rule, and the fix needs a product decision (same-part exception vs FR-34 combine); deferred.
  - `[low]` `[patch]` (blind) the property test never checks the Walk Path half (lowest ready key first) — added `test_fr38_cycle_ranked_by_its_lowest_walk_path`, which fails on the `component[-1]` mutant.
  - `[low]` `[patch]` (blind) the round-gaps test cannot tell distinct-round count from highest round and never checks `header.rounds` — added `test_fr38_header_counts_distinct_rounds` (rounds 1 and 3 → header 2) through `build_move_list_view`.
  - `[low]` `[reject]` (blind) 3-cycle with an attached chain and a from==to move untested — the seeded property test generates overlapping cycles and chains; manual moves refuse to==from (`IS_FROM_LOCATION`), so a self-move never reaches replay.
  - `[low]` `[patch]` (blind) the HTTP answer-key test duplicates the rule map — now imports `_rule` from `tests.domain.test_answer_key`.
  - `[low]` `[reject]` (blind) `ROUND_0_LABEL` puts display text in the domain — the spec's Always section fixes the `label` field and the domain already owns user-facing strings (`planning.ENTER_TO_LOCATION`); the fix edits this build's spec.
  - `[low]` `[reject]` (blind) `ordering.py` module docstring does not mention `walk_path_key` — the function's own docstring states its rules (Walk Path numeric, unknown last by code); cosmetic.
  - `[low]` `[reject]` (blind) manual-move API test setup uses `next(...)` without a default — same pattern as `test_before_after_api.py`; sample data is generated deterministically and a failure is still loud.
  - `[low]` `[patch]` (blind) the HTTP answer-key test skips `move_number`/`description` — grouped with the intent-audit field rows; the domain answer-key test now checks both against the effective moves and `data.parts` (same model serialized over HTTP).
  - `[medium]` `[defer]` (edge) same-part chain gives a different stock result than replay — same root cause as the first row; deferred with it.
  - `[medium]` `[defer]` (edge) same-part moves inside one cycle ordered by Walk Path not log order — same root cause; deferred with it.
  - `[false]` `[reject]` (edge) a naive `now` makes `AwareDatetime` validation fail with 500 — the only caller (`routers/move_list.py`) passes no `now`, so the default `datetime.now(UTC)` is always aware.
  - `[low]` `[patch]` (intent) the answer-key AC is checked through `build_move_list_rounds`, not the header, and without `description`/`move_number` — header count with gaps now asserted via the view; fields patched as above (header rounds 3 also asserted over HTTP).
  - `[low]` `[patch]` (intent) only five line fields compared on answer-key data — same fix as the row above.
  - `[low]` `[patch]` (intent) header round count with gaps not asserted — same fix as the blind round-gaps row.
  - `[low]` `[reject]` (intent) the no-write check runs only on the empty plan — the service path has no write call regardless of moves (`app/move_list.py` only calls `require` and the pure builder); not worth a second fixture.
  - `[low]` `[patch]` (intent) the Walk Path half of the order is only pinned by fixed examples — same fix as the blind property-test row.
  - `[false]` `[reject]` (intent) move-number tie-break and unknown-location rule go beyond the story — they are spec-set, deterministic and tested (`test_fr38_unknown_from_location_sorts_last_by_code`); no bad outcome.
  - `[low]` `[reject]` (intent) new API test imports helpers from other test modules instead of a shared helper — existing pattern; open retro item epic-7 #64 owns the shared helpers.
  - `[low]` `[patch]` (verification-gap) ready components ranked by lowest key untested (mutant `component[-1]` passes) — same fix as the blind property-test row.

## Design Notes

**Order algorithm.** A plain stable sort cannot express "after every line that empties my target". Kahn over strongly connected components with a min-priority queue gives the lexicographically smallest valid order, i.e. Walk Path order wherever the out-before-in rule allows it. Answer key round 1: ready lines pop by Walk Path (9000, 4400, 8100, 8500, 3050, 1100); 1100 releases 9300 (160 < 340), then the 9100/9200 cycle in Walk Path order — exactly `lines_in_order`.

## Verification

**Commands:**
- `npm run lint:py` -- expected: all checks passed
- `npm run lint:imports` -- expected: all contracts kept
- `npm run typecheck` -- expected: no errors (schema regenerated)
- `npm test` -- expected: pytest and Vitest pass; `test_fr38_answer_key_move_list` passes
- `npm run e2e -- --project=chromium` -- expected: all pass (no user-visible change)

## Auto Run Result

Status: done

**Summary:** New pure domain slice `domain/move_list.py` (FR-38, AD-17): `build_move_list_rounds` turns `replay(...).moves` into one line per effective move (move number, round, part, description, from, to, rule), rounds ascending with gaps kept and round 0 labelled "before the first run". Within a round, lines are ordered out-before-in: strongly connected components (cycles) are ordered internally by the base key, and a Kahn sort always takes the ready component with the lowest key. The base key `ordering.walk_path_key` is the from-location's Walk Path, then part number (`str`), then move number, with unknown from-locations last by code. `build_move_list_view` adds the header (name, data-as-of, uploaded_at, distinct-round count, generated_at) with one `replay`. Read-only `GET /api/plans/{id}/move-list` (service + router). `test_fr38_answer_key_move_list` is un-skipped and passes: the 14 answer-key lines come out in the answer key's order. Retro items: no open item changes this code. epic-2 #16 (plan loading) is untouched, epic-4 #37's shared domain conftest is reused, and epic-7 #64 (shared test helpers) is left to its own item.

**Files changed:**
- `backend/swp/domain/move_list.py` -- new slice: models, ordering, view builder.
- `backend/swp/domain/ordering.py` -- `walk_path_key`.
- `backend/.importlinter` -- `swp.domain.move_list` in `domain-slices`.
- `backend/swp/app/move_list.py`, `backend/swp/api/routers/move_list.py`, `backend/swp/api/app.py` -- read-only endpoint.
- `frontend/lib/api/schema.ts` -- regenerated.
- `backend/tests/domain/test_move_list.py` -- `test_fr38_*` order, cycle, chain, gaps, header and seeded property tests.
- `backend/tests/domain/test_answer_key.py` -- un-skipped answer-key move-list test (all line fields).
- `backend/tests/app/test_move_list_api.py`, `backend/tests/app/test_answer_key_api.py` -- endpoint tests and the 14 lines over HTTP.

**Review findings:** 20 findings (high 0, medium 3, low 15, false 2). Patched: 4 entries, all low and test-only (cycle ranked by lowest key, header round count with gaps, shared rule map, answer-key line fields). Deferred: 1 entry (3 medium rows): same-part uncombined moves in one round print in an order whose physical result differs from replay. This needs a product decision between FR-38's order rule and FR-34 combining. Rejected: 7, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): patched entries were 0 high, 0 medium and 4 low.

**Verification:** `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm run typecheck` clean; `npm test` pytest 688 passed, 2 skipped (Postgres-only), Vitest 373 passed; `npm run e2e -- --project=chromium` 79 passed (before and after the patches).

**Residual risks:** the deferred same-part ordering case above. The JSON uses `from_location`/`to_location`/`rule_1`…`manual`, so Stories 8.3/8.4 render these names.
