---
title: 'Story 5.6: Apply all'
type: 'feature'
created: '2026-11-22'
baseline_revision: '4e00d5266490a23b9897b7877e558de9ff1eb9cf'
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

**Problem:** The planner can apply recommendations only one at a time (Story 5.2), the plan summary has no `apply_all_count`, and the flow bar never checks Recommendations, so a long round means many clicks and no sign that the round is finished (FR-30, AD-3, AD-6, UX-DR6).

**Approach:** Add the `apply_all` command, handled in the `recommendations` slice as a fold over the latest run in `number` order that applies each open, not-kept recommendation that still holds and revalidates after each apply, all in one command (one transaction, one version bump), with the event `apply_all_done{applied[], skipped[{number, cause}]}`. Move the "applied" and "latest run" derivations to the kernel so the summary can add `apply_all_count` and check Recommendations when the latest run has no open recommendation left.

## Boundaries & Constraints

**Always:**
- **Command** `ApplyAll{type:"apply_all", command_id, base_version}` in `swp/domain/commands.py`, added to the closed `Command` union; dispatched in `swp/domain/apply.py` to `recommendations.apply_all(state, command, ctx, data, analysis)`.
- **Fold** (`swp/domain/recommendations.py`): no latest run → no-op (`Applied(state)`, no events). Otherwise first `revalidate` the state, then for each recommendation of the latest run in `number` order, read its *current* copy from the intermediate state:
  - applied before this command (`applied_step` is set and it is not one this fold applied) → ignored, not listed;
  - stored `outdated` → `skipped{number, cause: rec.outdated.cause}`;
  - part in `state.keep_marks` → `skipped{number, cause: "kept"}`;
  - otherwise apply it exactly as a single `apply` would (reuse `apply_recommendation`), add its number to `applied`, then `revalidate` the new state.
  "No space" entries are never touched. If `applied` ends empty, the command is a no-op (unchanged input state, no events). Otherwise events are `[ApplyAllDone{type:"apply_all_done", applied: [numbers], skipped: [{number, cause}] in number order}, *RecommendationsOutdated]`, where the `recommendations_outdated` events sum every revalidate of the fold per cause, one per cause with count ≥ 1, in `CAUSE_ORDER`. `ApplyAllSkipped.cause: Literal[OutdatedCause, "kept"]`. Both event models join the closed `Event` union. Each applied step carries the recommendation's rule and the run's round; `check_step_invariants` (in `apply`) must hold over all added steps (retro item 36's invariant).
- **Kernel** (`swp/domain/planning.py`): move `latest_run` and `applied_step` here from `recommendations.py` (which imports them back, so existing imports keep working) and add `open_recommendations(state) -> list[Recommendation]`: latest run's recommendations with stored status `open` and no applied step (empty without a run).
- **Summary** (`swp/domain/views/summary.py`): `PlanSummary.apply_all_count: int` = `open_recommendations` whose part is not in `keep_marks`; step `recommendations` is checked when a latest run exists and `open_recommendations` is empty (kept recommendations still count as open, per EXPERIENCE "no unapplied, non-outdated recommendation left"). Its `count` stays None.
- The command service (`swp/app/commands.py`) needs no change: its trailing `revalidate` finds nothing new; a no-op stays a no-op.
- `npm run gen:api` regenerates `frontend/lib/api/schema.ts`; `frontend/lib/api/plans.ts` exports the `apply_all_done` event type if it exports the other events' types.
- Tests name their FR (`test_fr30_*`, `test_fr7_*`/`test_ad3_*` for the summary). Domain tests use `tests/domain/conftest.py` fixtures and `tests/domain/test_rules.py` helpers. New e2e spec imports `test`/`expect` from `frontend/e2e/support/test.ts`.
- Retro items: item 36 (`apply` asserts `next_move_number` never decreases and new steps number from it) concerns `apply`, which now validates a multi-step command; it is already implemented in `check_step_invariants`, and a test pins it for the fold. Name it in the Auto Run Result and the commit message; leave its status to the retro.

**Never:** No Apply all button, confirm popover, toast or recommendations page (Story 5.7); no `keep` command (Epic 7: keep marks are set in state fixtures); no change to rule selection, `replay`, `manual_move`, `revalidate`'s causes or the recommendations view. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, action-item statuses, or anything under `.logs/`.

## I/O & Edge-Case Matrix

Answer-key import + analysis, marks `[aisle A]`.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer key (`test_fr30_apply_all`) | answer-key steps 1–13 (as `test_fr25_answer_key_rounds`, keep `0500` in state), then `apply_all` | 4 new steps in round 2, move numbers consecutive from `next_move_number`: 1200 → A-01-01-01, 10240 → A-01-01-02, 2400 → A-01-03-02 (rule 1), 8400 → D-01-03-03 (rule 3); `apply_all_done{applied:[1,2,3,4], skipped:[]}`; summary `apply_all_count` 0 and Recommendations checked | No error expected |
| Kept part | after run 1, `keep_marks` includes the part of an open rec | that rec not applied, `skipped{number, "kept"}`; counted out of `apply_all_count` | No error expected |
| Already outdated | after run 1, a manual move fills rec #1's target | #1 `skipped{1, "filled"}`, others applied | No error expected |
| Outdated during fold | a later rec fails `revalidate` after an earlier one is applied | it is stored outdated and skipped with that cause; a `recommendations_outdated` event counts it | No error expected |
| Already applied | rec #1 applied before `apply_all` | #1 not listed in `applied` or `skipped`; no second step for it | No error expected |
| Nothing to apply | no run yet, or every rec applied/outdated/kept | no events, state and version unchanged | No error expected |
| Idempotent | same `command_id` sent twice over HTTP | second response equals the first; version bumped once | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/commands.py` -- `Command` union (add `ApplyAll`), `Event` union (add `ApplyAllDone`), `RecommendationsOutdated`, `OutdatedCause` import.
- `backend/swp/domain/apply.py` -- `_dispatch` match (add `ApplyAll()` case); `check_step_invariants` already validates several new steps per command (rewritten-log safe).
- `backend/swp/domain/recommendations.py` -- `latest_run`, `applied_step` (move to kernel), `revalidate` (returns `Applied` with `recommendations_outdated` events; reuse it for each fold step), `apply_recommendation` (reuse per applied rec), `CAUSE_ORDER`. Add `apply_all` here.
- `backend/swp/domain/planning.py` -- kernel; `current_round`, `append_step` (step round = current round). Receives `latest_run`, `applied_step`, `open_recommendations`.
- `backend/swp/domain/views/summary.py` -- `PlanSummary`, `steps(...)` check rules, `build_summary`; `views.summary` and `recommendations` are independent slices in `backend/.importlinter` (`domain-slices`), so the summary may only use the kernel.
- `backend/swp/app/plans.py:121-141` -- `summary()` calls `build_summary` (no change expected beyond what the signature needs).
- `backend/swp/app/commands.py` -- service; no change expected.
- `backend/tests/domain/test_rules.py` -- `CTX`, `MARKS`, `_run`, `_apply_rec`, `_manual`, `test_fr25_answer_key_rounds` (steps 1–13 incl. the keep mark fixture) to reuse for `test_fr30_apply_all`.
- `backend/tests/domain/test_apply_recommendation.py` -- `_after_run_1`, `_manual`, `_do` helpers.
- `backend/tests/domain/test_plan_summary.py` -- `_summary`, step check tests; `test_fr7_steps_in_flow_order_with_m1_check_rules_and_counts` stays green.
- `backend/tests/app/test_apply_command.py` (`_answer_key_after_run`, `_command`, `_state`), `tests/app/test_run_command.py` (`_sample_plan`, `test_nfr8_run_on_sample_within_budget` pattern), `tests/app/test_plan_summary.py` -- HTTP helpers.
- `frontend/components/common/app-shell/toolbar.tsx:26` -- flow bar `doneSteps` from `summary.steps[].checked` (no change; the e2e observes it); `flow-bar.tsx` announces "Recommendations, step 6, done".
- `frontend/e2e/recommendations-outdated.spec.ts` -- pattern for a command-API helper; `frontend/e2e/support/plan-api.ts` (`getJson`, `planVersion`), `support/sample-plan.ts` (`createSamplePlan`).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py`, `backend/swp/domain/recommendations.py` -- move `latest_run`/`applied_step` to the kernel, add `open_recommendations` -- DRY across slices.
- `backend/swp/domain/commands.py` -- `ApplyAll`, `ApplyAllSkipped`, `ApplyAllDone` -- AD-6.
- `backend/swp/domain/recommendations.py`, `backend/swp/domain/apply.py` -- `apply_all` fold and dispatch -- FR-30, AD-6.
- `backend/swp/domain/views/summary.py` -- `apply_all_count` and the Recommendations check -- AD-3, UX-DR6.
- `backend/tests/domain/test_apply_all.py` (new) -- `test_fr30_apply_all` (answer key) and every row of the I/O matrix at domain level, incl. the step-invariant check over the fold and determinism (same state → same result).
- `backend/tests/domain/test_plan_summary.py` -- `apply_all_count` (open minus kept) and the Recommendations check (no run → unchecked; open left → unchecked; none open → checked).
- `backend/tests/app/test_apply_all_command.py` (new) -- over HTTP: `apply_all` after a run returns `apply_all_done` with one version bump, stored steps, idempotent repeat, no-op without a run; summary `apply_all_count` before/after; `test_nfr8_apply_all_on_sample_within_budget` (marks aisle A on `data/sample/`, run, `apply_all` under 1 s).
- `frontend/lib/api/schema.ts` (regenerated), `frontend/lib/api/plans.ts` -- wire types.
- `frontend/e2e/apply-all.spec.ts` (new) -- `uj1 applies all recommendations and the round is done`: sample plan, mark aisle A and run via the command API; the overview's flow bar link reads "Recommendations, step 6" without "done"; send `apply_all` via the command API; after reload the flow bar link's accessible name includes "Recommendations, step 6, done", and `GET /api/plans/{id}` shows `apply_all_count` 0.

**Acceptance Criteria:**
- Given a plan after a run, when `apply_all` is sent, then the response has one version bump and `apply_all_done{applied, skipped}`, and every applied recommendation shows as applied in `GET /recommendations` with the run's round.
- Given the plan summary, when it is built, then it carries `apply_all_count` and the flow bar checks Recommendations exactly when the latest run has no open recommendation left.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged after the commit.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 23 findings — high 0, medium 0, low 13, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) e2e drives `apply_all` through the command API, not a UI button — the epics give the Apply all button and popover to Story 5.7 (epics.md 5.7 AC); 5.6's visible change is the flow bar check, which the e2e asserts in the real UI.
  - `[false]` `[reject]` (intent) nothing-applied gives no `apply_all_done` — the UI disables Apply all at n = 0 (5.7) and n > 0 means a stored open, not-kept recommendation that the fold applies; the no-op follows AD-6's no-op rule (Design Notes).
  - `[false]` `[reject]` (intent) kept parts block the Recommendations check while `apply_all_count` excludes them — EXPERIENCE's check rule is "no unapplied, non-outdated recommendation left", which a kept one is; pinned by `test_fr7_recommendations_unchecked_while_kept_open_left`.
  - `[false]` `[reject]` (intent) no frontend handling of `apply_all_done` — the toast for Apply all is Story 5.7's.
  - `[false]` `[reject]` (edge) stored `outdated` with `outdated=None` falls through and aborts the fold — unreachable: `revalidate` is the only writer of `outdated` and always sets both fields (same as 5.5's triage).
  - `[low]` `[reject]` (edge) a fold whose first revalidate outdates recs but applies nothing drops those statuses — only a legacy v1 state can hold stale open statuses, because the service revalidates after every plan-changing command; a no-op changes nothing that could outdate. Same residual risk as 5.5.
  - `[low]` `[reject]` (edge) a no-op `apply_all` is not stored under its `command_id`, so a later resend could apply — pre-existing AD-6 no-op contract shared by every command (marks too); the client never resends a confirmed command.
  - `[low]` `[reject]` (edge) quadratic cost for large runs — measured 0.36 s over HTTP for 186 recommendations on `data/sample/`, inside the 1 s budget; restructuring revalidate adds complexity no current data needs.
  - `[low]` `[reject]` (edge) summary may show open for a stale unrevalidated rec — same legacy-only root as the row above.
  - `[false]` `[reject]` (blind) one bad rec aborts the batch / `apply_all` does not filter by `open_recommendations` — same unreachable `outdated=None` state as the edge row; the fold must read every rec to list skipped causes, so `open_recommendations` does not fit.
  - `[low]` `[reject]` (blind) the service revalidates again after the fold — one extra replay, inside the measured budget; skipping it would add a command-specific branch to the one write path.
  - `[false]` `[reject]` (blind) nothing applied gives no explanation — same as the intent no-op row.
  - `[low]` `[reject]` (blind) quadratic cost — grouped with the edge cost row; same reason.
  - `[low]` `[patch]` (blind) NFR-8 test only asserts `applied` non-empty — now reads `apply_all_count` before the command and asserts `count > 1` and `len(applied) == count`.
  - `[low]` `[reject]` (blind) missing tests: stale base_version, kept+outdated precedence, zero-rec run, earlier-run recs, kept over HTTP, moved-back — the conflict path and earlier-run filtering are shared pre-existing code; the remaining cases follow from the covered branches (outdated checked before kept; applied-earlier ignored) and add little.
  - `[low]` `[reject]` (blind) tests import private helpers from other test modules — the existing test suite's pattern (5.5 does the same); moving helpers is unrelated churn.
  - `[false]` `[reject]` (blind) exported frontend types have no consumer — they are the wire types Story 5.7 builds on; `"kept"` wording belongs to 5.7's copy.
  - `[low]` `[reject]` (blind) `apply_all_count` is an upper bound, undocumented; step count None — only differs for legacy states (above); the spec keeps the step count None.
  - `[false]` `[reject]` (blind) implicit re-export fails mypy `no_implicit_reexport` — the project runs no mypy or pyright (none in `backend/pyproject.toml`, `package.json` or `ci.yml`); ruff passes.
  - `[low]` `[reject]` (blind) lazy `current_locations` changes `Replay` equality cost — equality still compares the same values; no production code compares Replays; `test_ad5_step_fold_matches_replay_after_every_step` pins the values.
  - `[low]` `[reject]` (blind) inner applies reuse the outer `command_id` — `apply_recommendation` ignores the id; cosmetic.
  - `[false]` `[reject]` (blind) the spec is not in the diff — excluded on purpose so only the edge-case layer reads it.
  - `[low]` `[reject]` (blind) duplicated skip logic instead of `open_recommendations` — grouped with the blind "one bad rec" row; the fold needs per-rec causes the helper does not give.

## Design Notes

- **Reuse, not re-implement.** The fold calls `apply_recommendation` and `revalidate`, so "applies as a single apply would" and AD-7's causes have one implementation each. Reading each recommendation's current copy from the intermediate state is what makes a recommendation outdated mid-fold get skipped.
- **Nothing to apply is a no-op**, like setting an existing mark (AD-6): 200, no events, no version bump. The UI disables the button at n = 0 (Story 5.7), so this only guards a stale client.
- **Skipped** lists every recommendation of the latest run that was neither applied earlier nor applied now, with its cause, so Story 5.7's toast can say what happened. Already-applied recommendations are not "skipped".
- **Events.** Recommendations outdated during the fold are stored by the fold's own revalidates, so the service's trailing revalidate finds nothing new; the fold therefore returns the summed `recommendations_outdated` events itself.

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

**Summary:** New `apply_all` command (FR-30, AD-6). The domain folds over the latest run in `number` order, revalidating first and after each apply. Each open, not-kept recommendation that still holds is applied exactly as a single `apply` would (reusing `apply_recommendation`). Outdated recommendations are skipped with their cause and kept ones with `"kept"`; "no space" entries are never touched. Everything is one command, so one transaction and one version bump. The event is `apply_all_done{applied[], skipped[{number, cause}]}`, plus the summed `recommendations_outdated` from the fold. When nothing is applied, the command is a no-op. `latest_run` and `applied_step` moved to the kernel, and the kernel gained `open_recommendations`. The plan summary has `apply_all_count` (open minus kept) and checks Recommendations when the latest run has no open recommendation left. To meet the 1 s budget, the kernel gained `StepFold`, an incremental `replay` that `replay` itself now uses, and `Replay.current_locations` is computed lazily.

Retro items: item 36 (`apply` asserts that `next_move_number` never decreases and that new steps number from it) concerns `apply`, which now validates a multi-step command. `check_step_invariants` already enforces it, and `test_ad5_apply_all_step_invariants` pins it over the fold. Its status is left to the retro.

**Files changed:**
- `backend/swp/domain/planning.py` -- `latest_run`, `applied_step`, `open_recommendations` (kernel); `StepFold`; lazy `current_locations`.
- `backend/swp/domain/commands.py` -- `ApplyAll`, `ApplyAllSkipped`, `ApplyAllDone`.
- `backend/swp/domain/recommendations.py` -- `apply_all` fold; optional `replayed` on `outdated_cause`/`revalidate`/`apply_recommendation`.
- `backend/swp/domain/apply.py` -- dispatch.
- `backend/swp/domain/views/summary.py` -- `apply_all_count`, Recommendations check.
- `backend/tests/domain/test_apply_all.py`, `backend/tests/app/test_apply_all_command.py` (new); `test_plan_summary.py`, `test_replay.py`, `test_mark_commands.py` (extended).
- `frontend/lib/api/schema.ts` (regenerated), `frontend/lib/api/plans.ts` -- wire types; `frontend/tests/commands.test.tsx`, `plan-views.test.tsx` -- fixtures gain `apply_all_count`.
- `frontend/e2e/apply-all.spec.ts` (new) -- `uj1 applies all recommendations and the round is done`.

**Review findings:** 23 findings: high 0, medium 0, low 13, false 10. Patched: 1 low (the NFR-8 test now asserts the full batch was applied). Deferred: 0. Rejected: 22, each with its reason in the triage log:
- 12 low: legacy stale-status rows, the cost and the double revalidate (inside the budget), pre-existing no-op idempotency, test-helper and extra-test suggestions, and cosmetic items;
- 10 false: Story 5.7 scope, unreachable states, no mypy in the project, and the spec deliberately left out of the diff.

**Follow-up review:** not recommended (`false`). Only one low entry was patched.

**Verification (after the patch):**
- `npm run lint:py`: all checks passed.
- `ruff format --check`: 129 files formatted.
- `npm run lint:imports`: 5 contracts kept.
- `npm run typecheck` and `npm run lint`: clean.
- `npm test`: pytest 528 passed, Vitest 226 passed.
- `pytest tests/app --database-url postgresql+psycopg://…` on a local `postgres:17` container: 117 passed, 1 skipped.
- `npm run e2e -- --project=chromium`: 51 passed.
- `npm run gen:api`: checked after the commit.

**Residual risks:**
- A plan stored as v1 before Story 5.5 can still hold stale `open` statuses. Its `apply_all_count` can overstate until the next plan-changing command, and an `apply_all` that applies nothing drops the fold's revalidation.
- The cost of `revalidate` grows with the number of recommendations times the number of applies. It is fine at 186 recommendations, about 0.36 s per HTTP command.
- A kept recommendation keeps the Recommendations step unchecked (EXPERIENCE's rule), while `apply_all_count` excludes it.
