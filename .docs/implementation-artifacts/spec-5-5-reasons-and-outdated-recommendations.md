---
title: 'Story 5.5: Reasons and outdated recommendations'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'ef8204471cc0e0f7176b87b5c997f57c0b337c60'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Recommendations carry no reason (FR-28), and their outdated status is computed only at apply time and never stored or shown, so a mark change or a move cannot tell the planner which recommendations no longer hold (FR-29, AD-7).

**Approach:** Store the rule 3 partner at run time; add `domain.recommendations.revalidate`, run by the command service after every command, which stores sticky `outdated(cause)` and emits `recommendations_outdated{count, cause}`; build a pure recommendations view (status, reason data, applied move, "no space" causes) served at `GET /api/plans/{id}/recommendations`; word reasons and causes only in a new `frontend/lib/copy`; and make the mark toast count outdated recommendations with **View**.

## Boundaries & Constraints

**Always:**
- **Stored shape (`swp/domain/state.py`)**: `Recommendation.status: Literal["open", "outdated"] = "open"`, new `outdated: Outdated | None = None` with `Outdated{cause: Literal["moved","filled","marks","partner_aisle"], location: str | None = None, move_number: int | None = None}` (`filled` records the location and the filling move); `Recommendation.partner: str | None = None` (rule 3 only); `NoSpace.partner: str | None = None` and `NoSpace.aisle: str | None = None` (rule 3: the partner and its aisle at run time). `rules.RuleMove` gets `partner`; `rule_3` fills it on moves and "no space" entries. State `schema_version` becomes 2 with an append-only upcaster `_state_v1_to_v2` in `state_migrations.py` (adds nothing that defaults don't, but marks the shape change) and a new fixture `tests/domain/fixtures/state_v1_with_run.json` (a v1 state with a run holding a rule 1, a rule 3 rec without partner, and a rule 3 "no space" without partner) that must validate.
- **Revalidate** `revalidate(data, analysis, state) -> Applied` in `swp/domain/recommendations.py`: one `replay`; for every recommendation of the latest run that is stored `open` and not applied (`applied_step` is None), the first true cause in order `moved`, `filled`, `marks`, `partner_aisle` (rule 3 with a stored partner: the partner's current aisle in the planning copy ≠ `aisle_of(to_location)`; a partner with no location also counts). `filled.move_number` = the highest-numbered effective move (`replay(...).moves`) whose `to_location` is the target, else None. Outdated stays stored (sticky); a new run replaces the latest run, so stickiness ends there. Events: one `RecommendationsOutdated{type:"recommendations_outdated", count, cause}` per cause that newly outdated ≥ 1 recommendation, in cause order; added to the closed `Event` union. `outdated_cause` is refactored to share the same per-rec check (one implementation) and `apply_recommendation` keeps rejecting stored-outdated or currently-failing recs with the cause in `details`.
- **Service** (`swp/app/commands.py`): after `apply` returns events, run `revalidate` on `applied.state` and append its events; a no-op command (no events) stays a no-op with no revalidate.
- **View** in `swp/domain/recommendations.py` (pure, AD-3): `build_recommendations_view(data, analysis, state, version) -> RecommendationsView{version, run: RunMeta{id, round, created_at, created_by} | None, recommendations: [...], no_space: [...]}` for the latest run only, in stored (server) order.
  - Recommendation row: `id, number, rule, part, from_location, to_location, status: "open"|"applied"|"outdated", applied: {move_number, round} | None, outdated: {cause: moved|filled|marks|partner_aisle|moved_back, location, move_number, partner, aisle} | None, reason`.
  - Applied = a step references it and an effective move carries its `recommendation_id` (applied shows that move's number and round). A referencing step with no such effective move (FR-34 removed it) → `outdated{cause:"moved_back", move_number: <the step's move number>}`. Else the stored status.
  - `reason`: rules 1/2 `{kind:"class", movement_class, picks, threshold: ClassThreshold}` from `plan.analysis`; rule 3 `{kind:"pick_group", partner, partner_aisle, shared_jobs, min_shared_jobs}` (`partner_aisle` = `aisle_of(to_location)` for recs, the stored `NoSpace.aisle` for "no space"; `shared_jobs` from the analysis group of the pair); `null` only for a legacy rule 3 entry with no stored partner.
  - "No space" row: `part, rule, reason` (same shapes) and `cause: {rule, aisle: str | None, outside_best: bool}`: rule 1 `{aisle:null, outside_best:false}`, rule 2 `{null, true}`, rule 3 `{partner aisle, slow/dead mover}`.
  - `ClassThreshold`/`class_threshold` move from `views/parts.py` to the kernel `analysis.py` (DRY; `views/parts.py` imports it, OpenAPI name `ClassThreshold` unchanged).
- **Endpoint**: `GET /api/plans/{plan_id}/recommendations` → `RecommendationsView` (router `swp/api/routers/recommendations.py`, service `swp/app/recommendations.py`, read-only, 404 `plan_not_found`), following `before_after`. `npm run gen:api` regenerates `frontend/lib/api/schema.ts`; `lib/api/plans.ts` exports the new types.
- **Copy** `frontend/lib/copy/index.ts` is the only place reasons, "no space" causes, outdated causes and the marks toast are worded (AD-11). It owns `CLASS_LABELS`, `thresholdText`, `picksLine`, `sharedJobsText` (moved from `class-glyph.tsx`/`part-panel.tsx`, which import them back). Exact strings: "Fast-moving: 61 picks in the period (24 or more)"; "Pick group with 2007060 (aisle D): 12 shared jobs (5 or more)"; "No space · no empty best location" / "No space · no empty location outside best locations" / "No space · no empty location in aisle D outside best locations" / "No space · no empty location in aisle D"; "A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Partner 2007060 is no longer in aisle D." / "4410281 was moved back, so move 16 was removed."; toast "Best-location marks changed · 3 recommendations are now outdated" (1 → "1 recommendation is now outdated"; 0 → the existing "Best-location marks changed.").
- **Mark toast** (`modules/best-locations`): the count is the sum of `recommendations_outdated.count` in the command's events; when > 0 the toast has action **View** → `/plans/{id}/recommendations?tab=outdated` (helper `recommendationsTabHref(planId, tab)` in `lib/view-state/urls.ts`); no Undo.
- Tests name their FR (`test_fr28_*`, `test_fr29_*`, `test_nfr12_*`). Domain tests call `revalidate`/the view directly, with shared fixtures from `tests/domain/conftest.py` (retro item 37). New e2e spec imports `test`/`expect` from `frontend/e2e/support/test.ts`.
- Retro items: none of the open items concerns the code this story changes (item 36 touches `apply.py` invariants/manual-move inputs, which this story does not change); item 37's conftest is reused. Name this in the Auto Run Result; leave statuses to the retro.

**Never:** No recommendations page, tabs, list, detail or Apply button (5.7); no `apply_all`, `apply_all_count` or flow-bar check (5.6); no `undo` cause or keep command (Epic 7); no change to `replay`, rule selection/order, or `manual_move`. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, or action-item statuses.

## I/O & Edge-Case Matrix

Answer-key import + analysis, marks `[aisle A]`, after run 1 unless stated (#1 1100 → A-01-01-03 rule 1, #2 4400 rule 2, #6 8100 → C-01-03-01 rule 3 partner 8200).

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reasons | view after run 1 | #1 `class{fast, picks, threshold{24,null}}`; #2 `class{slow/dead…}`; #6 `pick_group{partner 8200, aisle C, shared_jobs from analysis, min 5}`; no_space 1200 `cause{rule_1, null, false}`, 6600 `cause{rule_3, "A", true}` with partner 7000 | No error expected |
| filled | manual move of another part into A-01-01-03 | #1 stored `outdated{filled, location A-01-01-03, move_number = that move}`; event `recommendations_outdated{1, filled}` | Apply #1 → 409 `command_rejected` |
| moved | manual move of 1100 elsewhere (round 1) | #1 `moved` (beats `filled` when both hold) | Apply → 409 |
| marks | remove mark aisle A | rules 1 and 2 recs `marks`; one event per cause with the count; rule 3 recs stay open | No error expected |
| partner_aisle | manual move of 8200 out of aisle C | #6 `partner_aisle` (partner 8200, aisle C) | Apply → 409 |
| Sticky | outdated #1, then move the filling part away | #1 stays outdated; a new run lists fresh open recs | No error expected |
| Applied untouched | apply #1, then more moves | #1 `applied{move_number, round 1}`, never revalidated | No error expected |
| moved_back | apply #1, then manual move 1100 back to C-01-01-01 | #1 `outdated{moved_back, move_number of the apply step}` | No error expected |
| Order | both `moved` and `marks` hold | `moved` stored | No error expected |
| No run | fresh plan | `{version, run: null, recommendations: [], no_space: []}` | Unknown plan → 404 `plan_not_found` |
| Legacy | `state_v1_with_run.json` | validates as v2; legacy rule 3 rec/no-space `reason: null`; no `partner_aisle` check | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py` -- `Recommendation` (status `Literal["open"]`), `NoSpace`, `Run`, `PlanState.schema_version = 1`: widen as above.
- `backend/swp/domain/state_migrations.py` -- `CURRENT_VERSIONS["state"]`, `UPCASTERS["state"]` (empty): add v1→v2.
- `backend/swp/domain/rules.py` -- `RuleMove`, `rule_3` (mover/partner at `partner, mover = part_order(...)`; `NoSpace(part=mover, rule="rule_3")` → add partner + `current_aisle(copy, partner)`), `run` (copies `move.partner` into `Recommendation`).
- `backend/swp/domain/recommendations.py` -- `OutdatedCause`, `applied_step`, `_marks_fail`, `outdated_cause` (replays per call; refactor to a shared per-rec check given a `Replay`), `apply_recommendation`. Add `revalidate`, view models and `build_recommendations_view` here (slice per epic). Imports only the kernel; `analysis.PickGroup`/`class_threshold` are kernel.
- `backend/swp/domain/planning.py` -- read-only: `replay` → `Replay.copy/.moves` (`EffectiveMove.recommendation_id`; a combined move keeps the first step's id; a moved-back move is dropped), `is_empty`, `is_best`, `aisle_of`, `current_aisle`, `current_location`.
- `backend/swp/domain/views/parts.py:~88-137` -- `ClassThreshold`, `class_threshold(settings, movement_class)`: move to `swp/domain/analysis.py`.
- `backend/swp/domain/commands.py` -- `Event` union: add `RecommendationsOutdated`.
- `backend/swp/app/commands.py` -- `_run`: `applied = apply(...)`; insert `revalidate` after the no-op check.
- `backend/swp/app/before_after.py`, `backend/swp/api/routers/before_after.py`, `backend/swp/api/app.py` (router registration) -- pattern for the new read endpoint; `swp.app.plans.require`.
- `backend/.importlinter` -- no change expected (view lives in the `recommendations` slice).
- `backend/tests/domain/test_apply_recommendation.py`, `tests/domain/test_rules.py` (`_run`, `_apply_rec`, `_manual` helpers), `tests/domain/conftest.py`, `tests/domain/test_plan_state.py` (`test_nfr12_state_v1_fixture_upcasts_to_new`, `test_nfr12_runs_are_typed`), `tests/app/test_apply_command.py`, `tests/app/test_run_command.py` -- extend/adjust; schema_version 2 and the new optional fields may change stored-row assertions.
- `frontend/components/common/class-glyph.tsx` (`CLASS_LABELS`), `frontend/components/common/part-panel.tsx:~68-85` (`thresholdText`, `picksLine`, `sharedJobsText`) -- move into `frontend/lib/copy/index.ts`.
- `frontend/modules/best-locations/best-locations-page.tsx:33,77-88` -- `MARKS_CHANGED`, `sendMarkChange(send, body, notify)`: count events, View action via `useRouter`.
- `frontend/components/common/toast.tsx` -- `showToast(message, {action})`.
- `frontend/lib/view-state/urls.ts` -- add `recommendationsTabHref`.
- `frontend/lib/api/plans.ts` -- export `RecommendationsView` and row/reason/cause types.
- `frontend/tests/best-locations.test.tsx:~162`, `frontend/e2e/best-locations.spec.ts` (TOAST constant), `frontend/e2e/support/plan-api.ts`, `frontend/e2e/support/sample-plan.ts` -- tests and helpers.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/analysis.py`, `views/parts.py` -- move `ClassThreshold`/`class_threshold` to the kernel -- DRY.
- `backend/swp/domain/state.py`, `state_migrations.py`, `tests/domain/fixtures/state_v1_with_run.json` -- stored shape v2, upcaster, fixture -- NFR-12.
- `backend/swp/domain/rules.py` -- store the rule 3 partner (and "no space" aisle) -- FR-28.
- `backend/swp/domain/commands.py` -- `RecommendationsOutdated` event -- AD-6.
- `backend/swp/domain/recommendations.py` -- `revalidate`, shared cause check incl. `partner_aisle` and `filled` details, view models and `build_recommendations_view` -- FR-28, FR-29, AD-7.
- `backend/swp/app/commands.py` -- revalidate after every applied command -- AD-6.
- `backend/swp/app/recommendations.py`, `backend/swp/api/routers/recommendations.py`, `backend/swp/api/app.py` -- read endpoint -- AD-3.
- `backend/tests/domain/test_recommendations.py` (new) -- `test_fr28_*` reasons and "no space" causes, `test_fr29_*` each cause, the cause order, sticky, applied untouched, moved_back, legacy; adjust `test_apply_recommendation.py`/`test_rules.py`/`test_plan_state.py` for the new shape.
- `backend/tests/app/test_recommendations_api.py` (new) -- HTTP: run, then mark removal returns `recommendations_outdated` and the GET shows them outdated with `marks`; a filling manual move returns `{1, filled}`; 404; GET never bumps version.
- `frontend/lib/copy/index.ts` (new), `class-glyph.tsx`, `part-panel.tsx` -- wording owner -- AD-11, UX-DR39.
- `frontend/lib/view-state/urls.ts`, `frontend/lib/api/plans.ts`, `frontend/lib/api/schema.ts` (regenerated) -- types and link.
- `frontend/modules/best-locations/best-locations-page.tsx` -- outdated count toast with View -- UX-DR14, UX-DR28.
- `frontend/tests/copy.test.ts` (new) -- every exact string above incl. singular/plural; update `best-locations.test.tsx` for the toast and View.
- `frontend/e2e/recommendations-outdated.spec.ts` (new) -- `uj1 sees recommendations outdated by a mark change`: sample plan, mark aisle A and run through the command API, then in the Best locations UI remove the aisle A mark; the toast reads "Best-location marks changed · N recommendations are now outdated" with N equal to the outdated `marks` count from `GET /recommendations`; **View** opens `/plans/{id}/recommendations?tab=outdated`.

**Acceptance Criteria:**
- Given an answer-key plan after run 1, when `GET /api/plans/{id}/recommendations` is called, then every recommendation and "no space" entry carries the structured reason (and the "no space" cause) of the I/O matrix, in server order, with `version`.
- Given a recommendation of the latest run, when a command makes one of AD-7's causes true, then the command response contains `recommendations_outdated{count, cause}` with the first true cause, the GET shows it outdated with that cause until the next run, and `apply` on it is rejected 409 `command_rejected`.
- Given the Best locations page after a run, when the planner removes a mark that outdates N > 0 recommendations, then the toast reads "Best-location marks changed · N recommendations are now outdated" with **View** (no Undo), which opens the Outdated tab URL.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged after the commit.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 27 findings — high 0, medium 0, low 10, false 17, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind) no recommendations page, hook or tab UI — Story 5.7 owns the page, tabs and rows (epics.md 5.7 ACs); 5.5's ACs stop at the view data, `lib/copy` and the mark toast.
  - `[low]` `[patch]` (blind) `urls.ts` header says `?tab=` is "built and read here" but nothing reads it — comment reworded: only the link is built here, Story 5.7 reads it.
  - `[low]` `[reject]` (blind) a migrated v1 state with already-invalid open recs shows them `open` while `apply` rejects them — real only for plans run between Story 5.4 and this story (same day, local dev data, nothing deployed); the next plan-changing command revalidates them; a live check in the view adds a second status path. Named under residual risks.
  - `[low]` `[reject]` (blind) the first command after a v1 upgrade stores old causes and a mark toast counts them — same root cause and reason as the row above; after one revalidate per command a mark change can only newly outdate by `marks`.
  - `[false]` `[reject]` (blind) no notice when manual moves/apply outdate recs — not asked by any 5.5 AC; the apply toast and Outdated tab are Story 5.7; the events are on the wire.
  - `[false]` `[reject]` (blind) `partner_aisle` reason uses the target's aisle — by design: the reason states why the run suggested the move (the partner's aisle at run time, which equals the target's aisle); the `partner_aisle` cause then names that same aisle as the one the partner left, matching "Partner 2007060 is no longer in aisle D."
  - `[false]` `[reject]` (blind) flat nullable `OutdatedInfo` lets the copy print "Partner  is no longer in aisle ." — unreachable: `partner_aisle` is stored only when `rec.partner` is set and the view then fills partner and aisle; `moved_back` always carries the step's move number.
  - `[low]` `[patch]` (blind) duplicated literals (`ViewOutdatedCause`) — `ViewOutdatedCause` now builds on `OutdatedCause` (`Literal[OutdatedCause, "moved_back"]`), so Epic 7's `undo` cause is added once; schema unchanged. The hand-typed TS `MovementClass` and glyph type import are cosmetic and rejected.
  - `[false]` `[reject]` (blind) revalidate belongs in `domain.apply` — AD-6 says the service runs `domain.apply` and then `revalidate`; 5.6's fold calls it directly.
  - `[false]` `[reject]` (blind) toast punctuated two ways; `filled` ignores `move_number` — both strings are the AC/EXPERIENCE wording verbatim; only a manual move can fill a target in milestone 1 (Design Notes).
  - `[low]` `[reject]` (blind) copy tests miss the null branches — those branches serve legacy data only; adding cases for unreachable-in-practice fallbacks is not worth it.
  - `[low]` `[patch]` (blind) backend tests miss apply-induced outdating, the run case, the marks/partner_aisle order and `count >= 1` — grouped with the verification-gap order row (patched); apply-induced outdating runs through the same `_check` as manual moves (covered); `count` is built from a `Counter` of positives only.
  - `[false]` `[reject]` (blind) the spec is not in the diff — excluded on purpose so only the edge-case layer reads it.
  - `[low]` `[reject]` (edge) view shows migrated v1 open recs as open — grouped with the blind v1 row; same reason.
  - `[false]` `[reject]` (edge) `status: outdated` with `outdated: None` shows open — unreachable: `revalidate` is the only writer and always sets both.
  - `[false]` `[reject]` (edge) 409 details with cause null — same unreachable state as the row above.
  - `[low]` `[reject]` (edge) toast counts non-mark causes — grouped with the blind v1 row; same reason.
  - `[false]` `[reject]` (edge) manual move toast drops `recommendations_outdated` — same as the blind "no notice" row: not a 5.5 AC.
  - `[false]` `[reject]` (edge) View lands on a page that does not read `?tab=` — the Outdated tab is Story 5.7; the AC is pinned by the URL in the e2e.
  - `[false]` `[reject]` (edge) `outdatedText` null fields print broken sentences — unreachable (see the blind `OutdatedInfo` row).
  - `[false]` `[reject]` (edge) `filled.move_number` may name an earlier-round move — move numbers only grow, and the move that filled the target after the run has a higher number than any earlier-round move ending there, so `max` names it.
  - `[false]` `[reject]` (edge, claim) "filled by a manual move" may misstate non-manual fills — in milestone 1 only manual moves can fill a suggested location of the latest run (Design Notes).
  - `[low]` `[patch]` (verification-gap) the `filled` → `marks` → `partner_aisle` order is not pinned — added `test_fr29_filled_beats_marks` and `test_fr29_marks_beats_partner_aisle`; the partner_aisle-above-marks mutant now fails.
  - `[low]` `[reject]` (verification-gap other) the view never checks causes live — grouped with the blind v1 row; same reason.
  - `[false]` `[reject]` (intent) no row is rendered for AC4 "when an outdated row is shown" — rows are Story 5.7's; 5.5 delivers the wording and the domain tests the AC names.
  - `[false]` `[reject]` (intent) the endpoint is Story 5.7's AC1 pulled forward — the intent does not exclude it; Design Notes give the reason (wire types for `lib/copy`).
  - `[false]` `[reject]` (intent) retro item 16 not mentioned — item 16 is an owner decision about the shared plan-loading path this story does not change.

## Design Notes

- **Endpoint in 5.5.** The AC "when its view is built … `lib/copy` words them" needs the view on the wire, with generated types for `lib/copy`. The endpoint shape is the one 5.7's AC names; 5.7 then builds only the page on top of it.
- **Filled wording.** Within one run each location is offered to at most one part, and only the latest run's recommendations are revalidated, so in milestone 1 only a manual move can fill a suggested location; UX-DR39's "… was filled by a manual move." is therefore the one wording. `move_number` is still recorded (AD-7) for later surfaces (Epic 7's "other location" may revisit the wording).
- **Revalidate in the service**, as AD-6 says, not in `domain.apply`: Story 5.6's fold calls `revalidate` itself between applies.
- **Legacy rule 3 entries** (made between Story 5.4 and this story) have no stored partner; it cannot be derived without ambiguity, so their reason is `null` and `partner_aisle` is not checked for them. A new run replaces them.

## Verification

**Commands:**
- `npm run lint:py` and `uv run --directory backend --locked ruff format --check` -- expected: clean
- `npm run lint:imports` -- expected: every contract kept
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` (after committing the regenerated file) -- expected: no diff
- `npm run typecheck` and `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against a local `postgres:17` container -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new spec

## Auto Run Result

Status: done

**Summary:** Every recommendation and "no space" entry now carries structured reason data, and outdated status is stored. Rule 3 stores its partner (and, for "no space", the partner's aisle). `domain.recommendations.revalidate` runs in the command service after every plan-changing command: an open, unapplied recommendation of the latest run becomes outdated by the first of `moved`, `filled` (location + filling move), `marks`, `partner_aisle`, sticky until the next run, with one `recommendations_outdated{count, cause}` event per cause; outdated ones are rejected by `apply`. `GET /api/plans/{id}/recommendations` returns the latest run, each row's status (open / applied with move and round / outdated incl. the derived `moved_back`), its reason (class, picks, threshold; or partner, aisle, shared jobs) and the "no space" causes. `frontend/lib/copy` is the one place that words reasons, causes and the marks toast; the Best locations toast now reads "Best-location marks changed · N recommendations are now outdated" with **View** (Outdated tab URL), no Undo. State schema is v2 (no-op upcaster + v1 fixture). Retro items: none of the open items concerns the changed code (item 36 is `apply.py`/manual-move inputs, untouched); item 37's conftest fixtures are reused; statuses left to the retro.

**Files changed:**
- `backend/swp/domain/analysis.py`, `views/parts.py` -- `ClassThreshold`/`class_threshold` moved to the kernel.
- `backend/swp/domain/state.py`, `state_migrations.py` -- `Outdated`, widened `status`, `partner`, `NoSpace.partner/aisle`, schema v2.
- `backend/swp/domain/rules.py` -- rule 3 stores its partner.
- `backend/swp/domain/commands.py` -- `RecommendationsOutdated` event.
- `backend/swp/domain/recommendations.py` -- `_check`, `revalidate`, view models, `build_recommendations_view`.
- `backend/swp/app/commands.py` -- revalidate after every applied command.
- `backend/swp/app/recommendations.py`, `api/routers/recommendations.py`, `api/app.py` -- read endpoint.
- `backend/tests/domain/test_recommendations.py`, `tests/app/test_recommendations_api.py`, `tests/domain/fixtures/state_v1_with_run.json` (new); `test_rules.py`, `test_plan_state.py`, `test_mark_commands.py` (adjusted).
- `frontend/lib/copy/index.ts` (new), `class-glyph.tsx`, `part-panel.tsx`, `settings-list.tsx`, `overview-page.tsx`, `parts-page.tsx` -- wording owner.
- `frontend/lib/view-state/urls.ts`, `lib/api/plans.ts`, `lib/api/schema.ts` -- tab link, types.
- `frontend/modules/best-locations/best-locations-page.tsx` -- counted toast with View.
- `frontend/tests/copy.test.ts` (new), `best-locations.test.tsx`, `part-panel.test.tsx`; `frontend/e2e/recommendations-outdated.spec.ts` (new).

**Review findings:** 27 findings (high 0, medium 0, low 10, false 17). Patched: 4 low rows in 3 entries (cause-order tests, `ViewOutdatedCause` from `OutdatedCause`, `urls.ts` comment). Deferred: 0. Rejected: 23, each with its reason in the triage log (6 low: the legacy v1 state group ×5 and copy null-branch tests; 17 false).

**Follow-up review:** not recommended (`false`): only low entries were patched (3), none medium or high.

**Verification (after the patches):** `npm run lint:py` all checks passed; `ruff format --check` 127 files formatted; `npm run lint:imports` 5 contracts kept; `npm run gen:api` leaves `schema.ts` byte-identical; `npm run typecheck` and `npm run lint` clean; `npm test` pytest 504 passed, Vitest 226 passed; `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container 112 passed, 1 skipped; `npm run e2e -- --project=chromium` 50 passed (incl. the new spec). Mutation: moving the `partner_aisle` check above `marks` fails `test_fr29_marks_beats_partner_aisle`.

**Residual risks:** a plan whose run was made between Story 5.4 and this story (stored v1, local only) can show already-invalid recommendations as `open` until its next plan-changing command, and that command's events (and a mark toast's count) include those older causes; its legacy rule 3 entries have `reason: null`. **View** opens `/plans/{id}/recommendations?tab=outdated`, which shows the "not built yet" placeholder until Story 5.7.
