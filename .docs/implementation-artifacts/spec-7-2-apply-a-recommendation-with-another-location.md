---
title: 'Story 7.2: Apply a recommendation with another location'
type: 'feature'
created: '2026-11-22'
baseline_revision: '42b701fc81c0d84bede60785c3f412382f3a04ae'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A planner can only apply a recommendation to its suggested location. When they know a better empty spot that still fits the rule, the only option is a manual move, which loses the rule and the recommendation link (FR-31, UX-DR36).

**Approach:** Add `domain.recommendations.other_locations` as the single implementation of the FR-31 allowed set, a read endpoint that returns it, and an `apply_other_location` command that appends the recommendation's step with the chosen location. In the recommendation detail, add an **Other location ▾** listbox (`Alt+O`) that applies the highlighted location on `Enter` or click. Applied rows and details show the effective to-location.

## Boundaries & Constraints

**Always:**
- Command (kernel `domain/commands.py`): `ApplyOtherLocation {type:"apply_other_location", command_id, base_version, recommendation_id, to_location}`. Both strings use `Field(min_length=1, max_length=CODE_MAX_LENGTH)`. Add it to the `Command` union and dispatch it in `domain/apply.py`. A success emits the existing `MoveMade` event. No new event type is needed.
- `other_locations(data, analysis, state, recommendation_id) -> list[str]` in `domain/recommendations.py` is the only code for the allowed set. The listing and the command both use it. It returns location codes in `ordering.location_code_order`. A code is in the set when all of these hold:
  - it is empty in the planning copy now (`replay(data, state.steps)`);
  - it was empty in `run_baseline(data, state.steps, run.round)`;
  - it is not in `data.virtual_locations`;
  - it is not `rec.to_location`;
  - it fits the rule, using best marks judged on the current copy: rule 1 best; rule 2 not best; rule 3 in the partner's current aisle (`current_aisle(copy, rec.partner)`, or the aisle of `rec.to_location` when `partner` is None), and not best when the part is slow or dead.
  The set is `[]` when the recommendation is not applicable: it is not in the latest run, already applied, outdated (stored, or a cause now holds via `_check`), or its part is kept.
- `apply_other_location` runs the same checks and messages as `apply_recommendation`, in the same order: not in latest run, already applied, outdated (with `details=[{"cause": …}]`), kept. Share that code; do not copy it. After the checks, a `to_location` that is not in `other_locations` raises `DomainError("command_rejected", "<to> is not an allowed location for recommendation #<n>.")`. Otherwise it appends a step with `part`, `from_location=rec.from_location`, the chosen `to_location`, `rule=rec.rule`, `recommendation_id=rec.id` and the current round (= the run's round). The stored `Recommendation` is never changed.
- Views: `AppliedInfo` gains `to_location: str` and `to_best: bool`, taken from the effective move in `_status`. Best is judged on the replayed copy.
- Read endpoint: `GET /api/plans/{plan_id}/recommendations/{recommendation_id}/other-locations` → `OtherLocationsView {version, recommendation_id, locations: list[LocationRef]}`. Each entry is built with `planning.location_ref`. An unknown or not-applicable id gives 200 with `locations: []`. An unknown plan gives 404. Add the app service in `app/recommendations.py`, the route in `api/routers/recommendations.py`, and the view model next to `other_locations`.
- Retro item epic-5 #45, as far as this story touches that code:
  - Add one kernel constant `SLOW_MOVING_CLASSES = frozenset({"slow", "dead"})` in `domain/analysis.py`, and use it for the four inline sets (`rules.py:118,200`, `recommendations.py:66,494`).
  - Add one kernel predicate in `domain/planning.py`, `fits_rule_target(rule, movement_class, to_best) -> bool` (the to-location side of the rule). Use it in `_marks_fail` and in `other_locations`.
  - Behaviour must not change: all existing rule and revalidate tests stay green.
  - Do not change `action_items` statuses in `sprint-status.yaml`.
- Run `npm run gen:api`, commit `frontend/lib/api/schema.ts`, and export the `OtherLocationsView` type from `lib/api/plans.ts`.
- Frontend:
  - Add the query hook `usePlanOtherLocations(planId, recId, enabled)` with a key under `planRecommendationsKey(planId)`, so the command refetch of `['plan', planId]` also refreshes it.
  - Add a new component file `modules/recommendations/other-location.tsx`:
    - It has a tertiary Button "Other location ▾" (`aria-haspopup="listbox"`, `aria-expanded`, `aria-keyshortcuts="Alt+O"`) that opens a popover with a listbox of the server's set.
    - Each option shows the code, "Aisle X · Level Y" and "BEST" or "not best".
    - The listbox takes focus when it opens. Arrow keys, Home and End, and typing (a typeahead on the code prefix) only move the highlight. `Enter` or a click applies the highlighted location. `Esc` closes the popover and returns focus to the trigger.
    - There is no text input.
    - While loading, show "Loading locations…". An empty set shows `noOtherLocationText(rule)` = "No other location fits rule N right now.".
  - Show the button only in the detail of an `open` recommendation, between Apply and Keep in place. Disable it with the same reason as Apply: saving, outdated or kept.
  - `Alt+O` / `⌥O` (`event.code === "KeyO"`, never from a text field) opens it for the selected open recommendation. Add `isOtherLocationShortcut` to `list.ts`, next to `isApplyShortcut`.
  - Applying sends `{type:"apply_other_location", recommendation_id, to_location}`. On `move_made` it toasts the existing `appliedToast(event)` ("Applied · move N, round R · part from → to"). Focus follows the same pending-focus rule as Apply.
  - An applied row (list `OptionRow` and detail move line) shows `applied.to_location`, with BEST from `applied.to_best`, instead of the suggested `to_location`.
  - Put all new strings in `lib/copy`.
- Every test names its FR or UX-DR (SM-7). The new e2e spec is `frontend/e2e/other-location.spec.ts`. It imports `test`/`expect` from `./support/test` and names its journey `uj1 …`.

**Never:**
- No free-text location entry, and no client-side computation of the allowed set (AD-3).
- No edit of the stored recommendation, no new stored status, and no DB migration.
- No Undo button in the toast (Story 7.3), and no wall crops (Epic 10).
- No change to `manual_move`, `apply_all` or the rules' outputs.
- No further split of `recommendations-page.tsx` or `recommendations.py` beyond the new `other-location.tsx` (retro item 46 stays open).
- No edits under `.docs/planning-artifacts/`, `data/` or `.logs/`. No session logs, no push.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rule 1 set | open rule-1 rec, best marks cover several empty locations | every empty best location except the suggested one, in code order | — |
| Rule 2 set | open rule-2 rec | empty non-best, non-virtual locations except the suggested one | — |
| Rule 3 set, slow part | slow mover; partner aisle has best and non-best empties | only non-best empties in the partner's aisle | — |
| Rule 3 set, fast part | fast or medium mover | best and non-best empties in the partner's aisle | — |
| Emptied this round | a manual move in the run's round empties L | L not offered (not empty in `run_baseline`) | — |
| Filled since run | L was empty at run time, now holds stock | L not offered | — |
| Apply other | allowed L | step `{rule, round, recommendation_id, to=L}`; event `move_made`; row `applied` with `to_location=L`; stored rec unchanged | — |
| Not allowed | L outside the set, or the suggested location | 409 `command_rejected` "<L> is not an allowed location for recommendation #n." | state unchanged |
| Not applicable | rec outdated, applied, kept, or not in the latest run | set `[]`; command 409 with the `apply` message | state unchanged |
| Empty set UI | set `[]` | listbox area says "No other location fits rule 1 right now." | — |

</intent-contract>

## Code Map

- `backend/swp/domain/recommendations.py` -- `_marks_fail` (:57), `_check` (:72), `outdated_cause` (:98), `apply_recommendation` (:149; extract its checks into a shared helper), `AppliedInfo` (:276), `_status` (:437; build `to_location`/`to_best` from `move`), `_no_space_row` (:494 slow set). Add `other_locations`, `apply_other_location` and `OtherLocationsView` here.
- `backend/swp/domain/planning.py` -- `run_baseline` (:280), `replay`, `latest_run`, `applied_step`, `append_step`, `is_empty`, `is_best`, `aisle_of`, `current_aisle`, `location_ref`/`LocationRef` (:453). Add `fits_rule_target` here (kernel).
- `backend/swp/domain/rules.py` -- `_empty_pool` (:51) shows the virtual and empty filter pattern. Slow sets at :118 and :200.
- `backend/swp/domain/analysis.py` -- `MovementClass`. Add `SLOW_MOVING_CLASSES`.
- `backend/swp/domain/ordering.py` -- `location_code_order`.
- `backend/swp/domain/commands.py` -- `ApplyRecommendation` (pattern), `Command` union, `MoveMade`.
- `backend/swp/domain/apply.py` -- `_dispatch`. `check_step_invariants` requires the step in the current round.
- `backend/swp/app/commands.py` -- revalidates after every command; no change expected.
- `backend/swp/app/recommendations.py`, `backend/swp/api/routers/recommendations.py`, `backend/swp/app/moves.py` -- the read-service and route pattern (`require(plan_id)`, `error_responses(404, 422)`).
- `backend/tests/domain/test_apply_recommendation.py` -- `_rejected` helper and the answer-key-based rec fixtures; the pattern for the FR-31 domain tests. `tests/domain/conftest.py` gives the `data`/`analysis` fixtures; `answer_key.py` has the state helpers.
- `backend/tests/app/test_apply_command.py`, `test_recommendations_api.py`, `test_keep_api.py` -- the HTTP command and view test patterns.
- `frontend/lib/api/plans.ts` -- `planRecommendationsKey` (:100), `usePlanPart`/`usePlanMovePreview` hook pattern, the type aliases.
- `frontend/lib/copy/index.ts` -- `appliedText`/`appliedToast` (:160-166). Add `OTHER_LOCATION_LABEL`, `LOADING_LOCATIONS`, `noOtherLocationText(rule)`, `otherLocationOptionMeta`.
- `frontend/components/common/listbox.tsx` -- `Listbox`/`nextListboxIndex`. Reuse it (an optional `onActivate` for Enter and click plus a typeahead is fine) or follow its pattern.
- `frontend/components/common/button.tsx` -- `variant="tertiary"`, `disabledReason`.
- `frontend/modules/recommendations/recommendations-page.tsx` -- `OptionRow` (:174), `Detail` (:211, the action bar), `apply` (:552), `onRegionKeyDown` (:573), `RecommendationsPage` (wires `manualMove` as a render prop; wire the other-location action the same way so the view stays testable).
- `frontend/modules/recommendations/list.ts` -- `isApplyShortcut` (:247).
- `frontend/tests/recommendations.test.tsx`, `copy.test.ts`, `components.test.tsx` -- extend; the fixtures need the new `AppliedInfo` fields.
- `frontend/e2e/keep-in-place.spec.ts`, `recommendations-page.spec.ts`, `e2e/support/*` -- the plan creation, best-mark and run-via-API helpers.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/analysis.py`, `planning.py`, `rules.py` -- `SLOW_MOVING_CLASSES` and `fits_rule_target`, with no change in behaviour.
- `backend/swp/domain/commands.py`, `apply.py` -- the `ApplyOtherLocation` command and its dispatch.
- `backend/swp/domain/recommendations.py` -- the shared applicability check, `other_locations`, `apply_other_location`, `OtherLocationsView`, and `AppliedInfo.to_location`/`to_best`.
- `backend/swp/app/recommendations.py`, `backend/swp/api/routers/recommendations.py` -- the other-locations read endpoint.
- `backend/tests/domain/test_other_location.py` (new) -- `test_fr31_*` for every matrix row, with small hand-built states: rules 1, 2 and 3 (slow and fast), virtual excluded, suggested excluded, emptied-by-manual-move-this-round not offered, filled since the run not offered, not-applicable gives `[]`, apply makes the step with rule/round/id, the stored rec is unchanged, the view shows applied with the chosen `to_location`, and rejections.
- `backend/tests/app/test_other_location_api.py` (new) -- GET list (codes, order, `LocationRef` fields, `[]` for a not-applicable or unknown id, 404 for an unknown plan); POST `apply_other_location` 200 with version +1 and the `move_made` event; 409 for a location not allowed; recommendations view `applied.to_location`; before/after reflects the chosen location.
- `frontend/lib/api/schema.ts` (generated), `lib/api/plans.ts`, `lib/copy/index.ts`, `modules/recommendations/{other-location.tsx,list.ts,recommendations-page.tsx}` -- the UI as above.
- `frontend/tests/recommendations.test.tsx` (+ `copy.test.ts`) -- Vitest:
  - the button shows only on open rows and is disabled with the reason;
  - the listbox renders the options with aisle, level and best;
  - arrows and typing move the highlight without sending;
  - `Enter` and click send `apply_other_location`;
  - the empty-set text;
  - `Alt+O` opens it, but not from a text field;
  - an applied row shows `applied.to_location`.
- `frontend/e2e/other-location.spec.ts` (new) -- `uj1 applies a recommendation with another location`:
  - mark aisle A best and run via the API;
  - select the first open rule-1 recommendation and press `Alt+O`;
  - the listbox shows the server's locations; ArrowDown, then Enter;
  - the toast names the move with the chosen to-location;
  - the row on the Applied tab reads "Applied · move N, round R" and shows the chosen location;
  - the before/after page shows the move to the chosen location.

**Acceptance Criteria:**
- Given an open recommendation of the latest run, when `other_locations` is called or the other-locations endpoint is read, then it returns exactly the FR-31 allowed set in location-code order, and the matrix rows hold.
- Given `apply_other_location` with an allowed location, when it is posted to `POST /api/plans/{id}/commands`, then a step with the recommendation's rule, round and id is made, the recommendation shows as applied with that move, and the stored recommendation is unchanged. A location outside the set, or an outdated or not-latest recommendation, gets 409 `command_rejected`.
- Given the detail of an open recommendation, when the planner presses `Alt+O` or clicks **Other location ▾**, then a listbox of the server's set shows aisle, level and best / not best; arrows and typing only move the highlight; `Enter` or a click applies; an empty set says "No other location fits rule 1 right now."; and there is no free-text entry.
- Given the apply succeeds, when the views refetch, then the row shows "Applied · move N, round R" with the chosen location, the toast names the move with its from- and to-location, and the before/after table shows the chosen location.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 32 findings — high 0, medium 4, low 21, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) Click-to-apply and typeahead in the Other location listbox are never driven in a real browser; Vitest calls props by hand — `other-location.spec.ts` now types a full code (the highlight moves, the version is unchanged) and clicks an option on a second recommendation (toast plus `applied.to_location`).
  - `[low]` `[patch]` (verification-gap, other) `effectiveTo` orphaned `optionName`'s JSDoc in `list.ts` — moved above that comment.
  - `[low]` `[patch]` (verification-gap, other) Code sits between imports in `listbox.tsx` — `import { cn }` moved up.
  - `[medium]` `[patch]` (edge) A failed other-locations query shows "Loading locations…" forever — `failed` prop shows `LOCATIONS_LOAD_FAILED` ("Could not load the locations. Try again.") as an alert; Vitest `fr31_load_error_shows_a_sentence_not_loading`.
  - `[low]` `[patch]` (edge) A cached set from an older plan version is shown and selectable while it refetches — the action gets `view.version` and shows the loading text until `recommendation_id` and `version` both match; Vitest `fr31_action_gets_the_view_version`.
  - `[low]` `[patch]` (edge) `otherOpenId` is never cleared, so the popover can reopen when the row's detail mounts again — cleared when the tab or the selected row changes.
  - `[low]` `[reject]` (edge) A save starting while the popover is open still lets Enter send — the popover holds focus, so no other command can start from the page while it is open. The fix would add a guard for a path that is very unlikely to happen.
  - `[low]` `[reject]` (edge) Space after the typeahead window expires starts a " " prefix — Space has no other meaning in this listbox, so nothing visible changes.
  - `[false]` `[reject]` (edge) A recommendation step combined with a later same-round manual move shows the combined destination — AC2 says the row shows "applied with that step's effective move". The effective move is the combined one (FR-34), by design.
  - `[low]` `[reject]` (edge, claim) The button also shows, disabled, on outdated and kept rows — this matches Apply's disabled-with-reason pattern (EXPERIENCE.md button rule), and `Alt+O` acts only on open rows.
  - `[low]` `[reject]` (intent) Retro #45 is only partly closed: `rules.py` selection still states its own pool conditions — the spec limits #45 to the code this story touches (the constant everywhere, the predicate in `_marks_fail` and `other_locations`). The item stays open for the retro.
  - `[false]` `[reject]` (intent) Retro #36/#41/#42/#46 not addressed — none of them concerns behaviour this story adds; the spec keeps them open, and the intent asks only to take touched items into account.
  - `[medium]` `[patch]` (intent) Typeahead, click and the empty set are verified only in Vitest — the same root cause as the verification-gap row; typeahead and click are now in the e2e. The empty-set text stays in Vitest, because the sample data has no rule-1 recommendation with an empty set.
  - `[false]` `[reject]` (intent) Before/after is checked only at aisle level — the before/after table is per aisle (FR-22), so aisle level is what it shows.
  - `[false]` `[reject]` (intent) The `other_locations` signature differs from AC1's `(state, rec_id)` — the replay needs the import data, as every other domain function takes it; the name and module match.
  - `[low]` `[reject]` (intent) The rule-3 no-partner fallback is unstated in the AC — it is a defensive path for legacy entries, pinned by `test_fr31_rule_3_without_partner_uses_suggested_aisle`.
  - `[false]` `[reject]` (intent) The `AppliedInfo` wire change touches every applied row — this is intended (Design Notes), so the applied row shows the effective to-location.
  - `[false]` `[reject]` (intent) The shared Listbox gains behaviour — the new props are optional, and existing callers pass none of them.
  - `[low]` `[patch]` (blind) Orphaned JSDoc in `list.ts` — same as the verification-gap row; fixed there.
  - `[low]` `[patch]` (blind) Code before an import in `listbox.tsx` — same as the verification-gap row; fixed there.
  - `[low]` `[patch]` (blind) The typeahead inline comment does not match the code — the comment is reworded: a single or repeated character cycles from the next option.
  - `[low]` `[patch]` (blind) `applyOther` duplicates `apply`'s toast and focus tail — one shared `sendApply` now holds them.
  - `[low]` `[patch]` (blind) `otherOpenId` is never cleared, and the open popover ignores a later disabled state — the clearing part is the same as the edge row and fixed there. The disabled part is rejected as in the edge row.
  - `[low]` `[reject]` (blind) A recommendation applied elsewhere and then moved back shows the suggested location struck through — the row still reads "Outdated · moved back". The fix would add a field to `OutdatedInfo` for a rare path.
  - `[low]` `[patch]` (blind) The client never uses `OtherLocationsView.version` — same as the edge row; fixed there.
  - `[low]` `[reject]` (blind) `other_locations` catches every `DomainError` — `_applicable` raises only `command_rejected`. An unknown id → `[]` is the spec's design, and the future-error harm is speculative.
  - `[medium]` `[patch]` (blind) The Vitest tests do not exercise the Listbox key and click handlers — same root cause as the verification-gap row; covered by the e2e.
  - `[low]` `[reject]` (blind) Backend test gaps: dead rule 3, a partner moved since the run, 422 and stale `base_version`, the path param `max_length`.
    - Dead uses the same `SLOW_MOVING_CLASSES` as slow.
    - A moved partner outdates the recommendation, which `test_fr31_recommendation_with_cause_now_has_empty_set` covers.
    - 422 and `base_version` are generic command-endpoint behaviour, already tested.
  - `[low]` `[reject]` (blind) Brittle e2e details: version 3, `!` before `expect`, a clamp comment — cosmetic, and the test passes deterministically on the sample data.
  - `[low]` `[reject]` (blind) No `aria-controls`, and the popover and the listbox share one name — this is minor; the popover is the Radix pattern already used for Apply all.
  - `[low]` `[reject]` (blind) Extra replays in `apply_other_location` and the GET — a few replays per request on small data, with no measured cost.
  - `[false]` `[reject]` (blind) The spec is not in the patch — by design: the spec goes only to the edge-case layer.

## Design Notes

**Not-applicable gives an empty set, not an error.** The listbox opens only for open recommendations. A read endpoint that returns 409 would be odd. The command still rejects with the precise `apply` message, so the server stays the authority.

**Applied rows show the effective to-location.** The stored recommendation keeps its suggested `to_location` (FR-31: "not stored as an edit"). The view's `AppliedInfo` carries where the move actually went, so the row and the detail show the chosen location without the client working it out.

**Other recommendations' targets are not excluded.** FR-31 names only "empty now, empty at run time, fits the rule". Applying into another open recommendation's target makes that recommendation `outdated(filled)` through the normal revalidate.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .` -- expected: all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` -- expected: no diff after committing.
- `npm test` -- expected: pytest and Vitest pass.
- `npm run e2e -- --project=chromium` -- expected: all pass, including `other-location.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A planner can apply a recommendation to another allowed location (FR-31, UX-DR36).
- `domain.recommendations.other_locations` is the only code for the allowed set. A location is in the set when it is:
  - empty now, and empty in the run baseline;
  - not virtual, and not the suggested location;
  - a fit for the rule.
- `apply_other_location` appends a step with the recommendation's rule, round and id, and leaves the stored recommendation unchanged.
- `GET …/recommendations/{id}/other-locations` returns the set as `LocationRef`s.
- The recommendation detail has **Other location ▾**, which opens with `Alt+O` or a click. Arrows and typing only move the highlight; `Enter` or a click applies.
- Applied rows and details show the effective to-location (`AppliedInfo.to_location`/`to_best`).
- Retro item epic-5 #45 is taken into account as far as this story touches it: `SLOW_MOVING_CLASSES` replaces all four inline sets, and `fits_rule_target` is shared by `_marks_fail` and `other_locations`. Its status is left to the retro.

**Files changed**
- `backend/swp/domain/analysis.py`, `planning.py`, `rules.py`: the slow-class constant and the rule-target predicate.
- `backend/swp/domain/commands.py`, `apply.py`: the `ApplyOtherLocation` command and its dispatch.
- `backend/swp/domain/recommendations.py`: the shared applicability check, `other_locations`, `apply_other_location`, `OtherLocationsView` and the `AppliedInfo` fields.
- `backend/swp/app/recommendations.py`, `api/routers/recommendations.py`: the read endpoint.
- `backend/tests/domain/test_other_location.py`, `tests/app/test_other_location_api.py` (new): the FR-31 domain and HTTP tests. Three existing tests are adjusted for the new fields and the new command.
- `frontend/lib/api/schema.ts` (generated), `lib/api/plans.ts`, `lib/copy/index.ts`: the types, hook and strings.
- `frontend/components/common/listbox.tsx`: optional `onActivate`, typeahead and `optionLabel`.
- `frontend/modules/recommendations/other-location.tsx` (new), `list.ts`, `recommendations-page.tsx`: the UI.
- `frontend/tests/recommendations.test.tsx`, `copy.test.ts`: Vitest.
- `frontend/e2e/other-location.spec.ts` (new): `uj1 applies a recommendation with another location`.

**Review findings.** 32 findings: high 0, medium 4, low 21, false 7. Patched entries by root cause: 2 medium and 6 low.
- Medium: real-browser click and typeahead coverage; the load-error state.
- Low: the version check, `otherOpenId` clearing, the DRY `sendApply`, the JSDoc placement, the import order, the typeahead comment.

Nothing was deferred. Every rejected finding and its reason is in the Review Triage Log.

**Follow-up review: recommended (true).** Two medium entries were patched after the review: the e2e click and typeahead path, and the load-error state. The patched popover behaviour (version gating, clearing on tab or row change) was not re-reviewed by an independent layer.

**Verification.** All passed on the final tree:
- `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck`, `uv run --directory backend --locked ruff format --check .`.
- `npm run gen:api` gives no schema diff.
- `npm test`: 631 pytest passed (12 skipped), 339 Vitest passed.
- `npm run e2e -- --project=chromium`: 77 passed.

**Residual risks**
- Firefox and Edge were not run.
- The empty-set sentence is checked only in Vitest.
- A recommendation applied elsewhere and then moved back shows the suggested location struck through.
- Retro items 45 (rules.py pool predicates) and 46 stay open.
