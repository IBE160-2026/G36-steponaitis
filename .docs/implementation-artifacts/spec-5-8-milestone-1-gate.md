---
title: 'Story 5.8: Milestone 1 gate'
type: 'chore'
created: '2026-11-22'
baseline_revision: '63e9e2dc50681b24e1750b90f796689ea20fae37'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      AGENTS.md still describes Chromium-only e2e installs and server reuse, not the all-browser gate, the e2e.db reset or ruff format --check.
    evidence: |-
      Story 5.8 changed README.md, package.json (e2e:reset-db) and CI (ruff format --check); AGENTS.md "Running and verifying" was not updated. It is an agent-context file, so the fix is deferred (bmad-project-context refresh).
    location: >-
      AGENTS.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** Milestone 1 (Epics 1–5) has no single proof that it works: answer-key checks are scattered over many domain tests, the NFR-8 timings live in five files, there is no end-to-end test of the whole flow, the README has no step-by-step demo, and every e2e spec except one is skipped in Firefox and Edge.

**Approach:** Add one answer-key replay suite (steps 1–14, deferred skips for 15–20), one `tests/app/test_nfr8_timing.py`, one `frontend/e2e/m1-flow.spec.ts` walking the whole milestone 1 journey through the UI, and an English README demo section; remove the Chromium-only skips so the **full** Playwright suite runs green in `chromium`, `firefox` and `msedge`, fixing any real failure in code or tests.

## Boundaries & Constraints

**Always:**
- Every new test names its FR/NFR (`test_fr17_…`, `test_nfr8_…`, e2e title starts `uj1 …`). Domain answer-key tests call `classify`, `pick_groups`, `rules`, `recommendations`, `planning`, `before_after` (and `domain.apply`) directly with data and settings — no DB, file I/O beyond reading `data/answer-key/` through `tests/domain/answer_key.py`, network or UI.
- Reuse the shared answer-key fixtures in `backend/tests/domain/conftest.py` / `answer_key.py` (retro item 37); move step helpers (`_run`, `_apply_rec`, `_manual`, `CTX`, `MARKS`) there if the new suite needs them rather than importing private helpers from another test module.
- Steps 15–20, the full move list and the final before/after are `pytest.mark.skip` tests whose reason names the story that will un-skip them: undo/keep/run 3 → Story 7.3 "Undo the last move" / 7.5 "Answer-key scenario through run 3"; move list → Story 8.1 "Move list order and header in the domain"; final before/after → Story 7.5.
- 0500's keep mark is set in the state (`keep_marks=["0500"]`) after step 5, as the existing `_answer_key_after_run_2` does.
- e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts`. The full suite (`npm run e2e`, all three projects) passes with 0 failed and 0 flaky.
- Real failures are fixed in code or tests. A browser-specific failure is a real failure.

**Never:**
- No raised timeouts, no added retries, no new `test.skip`/`fixme`/`only`, no per-browser skip.
- Never edit `data/sample/`, `data/answer-key/`, planning artifacts or `.logs/`; never read `data/private/`.
- No deploy, no Vercel/Supabase. CI keeps running only `--project=chromium`.
- No Epic 6+ features (undo, keep command, move list).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer-key replay | `expected.json` steps 1–14 applied in order to `PlanState(best_marks=[aisle A])` | each run's recommendations/no-space equal the step's lists in order; each apply/manual move gives the step's `expect_move` (from/to/rule/round) | assertion names the step number |
| Deferred step | steps 15–20, `move_list`, `before_after` final | reported as skipped with reason naming Story 7.x / 8.1 | — |
| Timing on sample | `data/sample/*.xlsx` | import+analysis < 10 s; run < 5 s; one command + summary/parts/locations/pick-groups/recommendations/before-after views < 1 s | message shows elapsed seconds |
| M1 flow, each browser | fresh server, `data/sample/` via New Plan UI | overview → parts → pick groups → mark aisle A and level 1 → run → apply one → one manual move → before/after shows the change; no page errors | test fails on any `pageerror` |

</intent-contract>

## Code Map

- `data/answer-key/expected.json` -- read-only. Keys: `parts` (class/picks/current_location), `not_classified`, `merged_inventory`, `pick_groups_in_order`, `occupancy_import`, `empty_with_zero_stock_row`, `steps` (1–20), `move_list`, `final_current_locations`, `before_after`, `settings`.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()`, `expected()`, `answer_key_analysis()`; `conftest.py` module fixtures `data`, `analysis`.
- `backend/tests/domain/test_rules.py:34-90` -- `CTX`, `MARKS`, `_run`, `_apply_rec`, `_manual`, `_outcome`, `_expected_outcome` (run outcome vs. expected lists). `test_apply_all.py:28-41` `_answer_key_after_run_2` is the steps 1–13 sequence; `test_apply_recommendation.py` has `_apply`, `_manual` commands.
- Existing answer-key checks to keep (do not duplicate wholesale; the new suite may assert the same facts in one place): `test_classify.py::test_fr17_answer_key_classes`, `test_pick_groups.py::test_fr19_answer_key_pick_groups`, `test_locations_view.py` (FR-14 occupancy, zero-stock), `test_rules.py::test_fr24_answer_key_round1`, `test_apply_all.py::test_fr30_apply_all`.
- `backend/swp/domain/` -- `classify.py`, `pick_groups.py`, `rules.py`, `recommendations.py`, `planning.py` (`replay`, `current_location`), `before_after.py`, `apply.py` (`apply`), `views/locations.py`.
- `backend/.importlinter` + `backend/tests/rules/test_layer_rules.py` -- layers contract already keeps `swp.domain` free of `swp.store`/`swp.app`; add a test asserting the six rule modules are under `swp.domain` and the layers contract passes (or point to the existing one in the suite's docstring if it already covers this).
- `backend/tests/app/` -- timing patterns: `test_create_plan.py:226` (import), `test_apply_all_command.py:98`, `test_parts_api.py:14 _sample_plan`, `test_create_plan.py SAME_ORIGIN/_multipart`, `test_import_readers._data_files`. Fixture `empty_tables`.
- `frontend/e2e/support/` -- `test.ts` (shared test), `sample-plan.ts` (`SAMPLE`, `SAMPLE_FILES`), `plan-api.ts` (`moveFromPanel`, `enterTarget`, `locationRows`, `partDetail`). UI patterns: `new-plan.spec.ts` (upload tiles, URL wait), `best-locations.spec.ts` (Marking mode radiogroup, aisle/level marking, toast), `recommendations-page.spec.ts` (Run, Apply), `before-after.spec.ts` (table rows).
- All 14 specs carrying `test.skip(({ browserName }) => browserName !== "chromium", …)` -- remove that line.
- `frontend/playwright.config.ts` -- projects chromium/firefox/msedge, `webServer` `npm run e2e:serve` against `backend/var/e2e.db` (never reset; reached 5 GB locally — issues.md).
- `package.json` scripts `e2e:serve`/`e2e:backend` -- add a reset of `backend/var/e2e.db*` before `swp db upgrade` (cross-platform, e.g. `node -e` with `fs.rmSync`), so each fresh server starts empty.
- `README.md` -- keep the Norwegian group sections; add an English "Milestone 1 demo" section and update the checks table/browser install lines.

## Tasks & Acceptance

**Execution:**
- `backend/tests/domain/answer_key.py` / `conftest.py` -- move shared step helpers here if needed; update importers -- DRY (retro item 37).
- `backend/tests/domain/test_answer_key.py` (new) -- classes + `not_classified` (FR-17), pick groups in order (FR-19), merged inventory (FR-6), occupancy per aisle and zero-stock empty location (FR-14), then one replay of steps 1–14 checking each step (FR-23–FR-30, FR-33/34 for manual moves); skipped tests for steps 15–20, move list and final before/after with story-naming reasons.
- `backend/tests/app/test_nfr8_timing.py` (new) -- `test_nfr8_import_under_10_s`, `test_nfr8_run_under_5_s`, `test_nfr8_command_plus_views_under_1_s` on `data/sample/` (keep the existing scattered timing tests).
- `package.json` -- e2e db reset before `swp db upgrade` in `e2e:backend`.
- `frontend/e2e/m1-flow.spec.ts` (new) -- `uj1 milestone 1 flow on the sample data` per the matrix; collects `pageerror`s and asserts none.
- `frontend/e2e/*.spec.ts` -- remove the Chromium-only skips; fix whatever then fails in Firefox/Edge in code or test.
- `README.md` -- step-by-step demo (install, start, New Plan with the three `data/sample/` files, Best locations aisle A + level 1, Run recommendations, Apply, Before/after, run every check incl. `npm run e2e` with `playwright install chromium firefox` and Edge), plus "the public deployment holds synthetic data only" in English.

**Acceptance Criteria:**
- Given the repo, when `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run lint` and `npm test` run, then all pass and the deferred answer-key tests show as skipped with their story reasons.
- Given a free port 3000, when `npm run e2e` runs (chromium, firefox, msedge), then every test passes in every project with 0 failed, 0 flaky, and no test skipped by browser.
- Given a clean checkout, when someone follows only the README, then every command it lists exists and works.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 43 findings — high 0, medium 5, low 27, false 11, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) no per-browser evidence that the suite is green — the orchestrator's own `npm run e2e` after implementation: 159 passed (53 chromium, 53 firefox, 53 msedge), 0 failed, 0 flaky, 0 skipped.
  - `[false]` `[reject]` (intent) Edge fixed with a launch flag, not app code — the failure is Edge's GPU display link under Playwright on macOS (no frames, no rAF), an environment defect; the app was never at fault.
  - `[low]` `[reject]` (intent) Firefox fixed partly in the test harness (`expect` wrapper) — the blocking cost is Playwright 1.65's per-poll aria snapshot, a test-tool cost; the app side was also improved (memoized rows). No user-facing defect left.
  - `[medium]` `[patch]` (intent) new m1-flow sets `test.setTimeout(180_000)`, above every other spec — lowered to 120 s, as before-after.spec.ts.
  - `[medium]` `[patch]` (intent) retro item 15 not handled though `data-table.tsx` is rewritten: Enter on an interactive child opens the row — guard added in the open branch (`enterOpensRow`), with a Vitest test.
  - `[low]` `[patch]` (intent) retro item 7 not handled though `dev:backend` is edited — `--no-access-log` added.
  - `[low]` `[patch]` (intent) `test_ad1_rule_modules_are_domain_modules` is vacuous — replaced by an AST import scan of the six modules (`test_nfr1_…`).
  - `[medium]` `[patch]` (intent) timing checks each request, AC says "one command plus the plan views under 1 s" — the sum is now asserted (measured ~0.3 s).
  - `[false]` `[reject]` (intent) m1-flow picks the manual-move part through the API — every user step runs through the UI; the API only chooses test data, as before-after.spec.ts does.
  - `[false]` `[reject]` (intent) README does not mention Edge `--disable-gpu` — the config applies it; a reader runs `npm run e2e` unchanged.
  - `[false]` `[reject]` (intent) gate record in the session log missing — the orchestrating session writes the log (persistent fact); not this diff's job.
  - `[medium]` `[patch]` (blind) m1-flow raises timeouts (180 s; `toHaveURL` 30 s) — same root cause as the intent row: 120 s; the 30 s URL wait matches new-plan.spec.ts's import wait and is kept.
  - `[low]` `[patch]` (blind) README claims m1-flow walks steps 3–9 — narrowed to what it does.
  - `[low]` `[patch]` (blind) README lists `ruff format --check` but CI does not run it — `ruff format --check` step added to the CI python job.
  - `[low]` `[defer]` (blind) AGENTS.md still says Chromium only / reuse — agent-context file; deferred.
  - `[low]` `[patch]` (blind) README says e2e.db is deleted at each start, but a reused server skips it — reworded to "each time Playwright starts the server itself".
  - `[low]` `[patch]` (blind) test_ad1 cannot fail — grouped with the intent row.
  - `[false]` `[reject]` (blind) replay never checks `no_outcome` — `run_outcome == expected_run_outcome` compares the full recommendation and no-space lists, so any extra outcome fails it.
  - `[low]` `[reject]` (blind) end-of-replay before/after checks only "before" values — those facts are already pinned by test_before_after.py; extra asserts add nothing new.
  - `[low]` `[patch]` (blind) `final_current_locations` and `settled_check` have no deferred placeholder — two skipped placeholders added (Story 7.5). `xfail(strict)` suggestion rejected: the AC asks for skips with a reason.
  - `[low]` `[patch]` (blind) keep step bypasses `domain.apply` while docstrings say all through it — docstrings name the exception.
  - `[low]` `[patch]` (blind) helper move half done (`test_apply_all.py` imports private helpers from another test module) — moved to `answer_key.py`.
  - `[low]` `[reject]` (blind) timing test hard-codes versions, single cold sample, only `apply` timed — a version change fails loudly at `_command`'s 200 assert; budgets are 3–30× the measured times.
  - `[low]` `[patch]` (blind) m1-flow non-null assertions give TypeErrors — `expect(...).toBeDefined()` guards added. Sequential `partDetail` calls and positional `td` lookups rejected: same pattern as before-after.spec.ts, stops at the first match.
  - `[low]` `[reject]` (blind) wrapper hard-codes the 5 s default and does not wrap `expect.soft/poll/configure` — none are used on locators (`expect.poll` only on plain values); handling them adds branches for no current caller.
  - `[low]` `[reject]` (blind) wrapper waits for `attached` before negative-state options (`visible: false` …) — no spec uses those options; guarding adds a branch for no caller.
  - `[low]` `[patch]` (blind) `--disable-gpu` applies on every OS — gated on `process.platform === "darwin"`.
  - `[low]` `[patch]` (blind) `latest.current` refreshed in `useEffect` — `useLayoutEffect` now. The "cells close over nothing else" contract is documented; rejected as no caller breaks it.
  - `[low]` `[reject]` (blind) `--timeout-keep-alive 75` unexplained — the reason (Node proxy reusing a socket uvicorn closed at 5 s, ECONNRESET) goes in the commit message; package.json takes no comments.
  - `[false]` `[reject]` (blind) spec Auto Run Result stale — rewritten at finalize; fix would edit this build's spec.
  - `[false]` `[reject]` (blind) README does not say CI runs Chromium only — the checks table row says "Chromium only (what CI runs)".
  - `[false]` `[reject]` (blind) `test_rules.py` formatting awkward — ruff format output; `ruff format --check` passes.
  - `[false]` `[reject]` (edge) `{ timeout: 0 }` on a wrapped matcher — no spec passes 0.
  - `[low]` `[reject]` (edge) negative-state options burn the timeout — same as the blind row; no caller.
  - `[false]` `[reject]` (edge) `toHaveURL` with `ignoreCase` — no spec uses it.
  - `[low]` `[reject]` (edge) `expect.soft/configure` bypass the wrapper — same as the blind row; unused.
  - `[low]` `[patch]` (edge) timing test StopIteration — `next(..., None)` with an assert message.
  - `[low]` `[patch]` (edge) m1-flow `first` may be undefined — grouped with the blind non-null row.
  - `[low]` `[patch]` (edge) m1-flow target row may be undefined — grouped with the blind non-null row.
  - `[low]` `[patch]` (edge) answer-key before/after aisle set not checked — aisle-set assert added.
  - `[low]` `[patch]` (edge) README "fresh e2e.db at each start" vs reused server — grouped with the blind README row.
  - `[medium]` `[patch]` (verification) opening a row after sort/filter untested with ref-forwarded handlers — a DOM test library is not installed (adding `@testing-library/react`/`jsdom` was denied), so: pure-helper Vitest tests `fr13_open_after_sort_uses_the_sorted_row` and `fr13_enter_on_a_link_or_button_inside_a_row_does_not_open_it` (helpers `shownRows`, `enterOpensRow` used by DataTable), plus `parts-roster.spec.ts` now presses Enter on row 2 and clicks row 1 after the Picks sort and asserts `?part=` is the sorted row (real DOM, all three browsers).
  - `[low]` `[patch]` (verification) README says CI runs the same checks, CI has no format check — grouped with the blind CI row.

## Design Notes

- Retro items touched: 37 (shared answer-key fixtures; e2e flakiness under load — reset e2e db, run full suite). Name them in the commit message; status changes stay with the retro (item 38).
- Removing the browser skips is required by the gate: "Chromium, Firefox, Edge" in the story and the caller's "full suite in all three projects".
- **Baseline (HEAD `63e9e2d`, fresh `e2e.db`, Firefox 159 installed with `npx --workspace frontend playwright install firefox`, Edge at `/Applications/Microsoft Edge.app`):** `npm run e2e` → 74 passed, 32 failed, 50 skipped (12.9 min). Every failure is `[msedge]`; chromium is all green; firefox runs only `skeleton.spec.ts` (the rest is skipped). The `msedge` project has `browserName === "chromium"`, so the skips do not apply to it. Edge failures are mostly timeouts waiting for an element to be "visible, enabled and stable" (e.g. `app-shell.spec.ts:126` clicking "Plan steps" below 1024 px) — find the root cause (e.g. Edge headless/animation/viewport behaviour, or load from three browsers at once) rather than raising timeouts. Artifacts land in `frontend/test-results/`.
- **Environment:** only one Playwright run at a time (port 3000 webServer). Leave no background processes running (stop servers, remove any Postgres container you start). Docker can only use the local `postgres:17` image; other pulls hang. Do not write session logs (`sesjonslogg`) or anything under `.logs/`. Commit nothing — the orchestrator commits.

## Verification

**Commands:**
- `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass; answer-key deferrals skipped
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against local `postgres:17` -- expected: pass
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` -- expected: no diff
- `npm run e2e` -- expected: all three projects green, 0 flaky

## Auto Run Result

Status: done
Blocking condition: none

**Summary.** The milestone 1 gate is in place and every check passes:
- a single answer-key suite: steps 1–14 replayed, with deferred skips that name Stories 7.3, 7.5 and 8.1;
- one NFR-8 timing file;
- an end-to-end m1-flow test through the UI;
- a README demo section;
- the full Playwright suite now runs in Chromium, Firefox and Edge, because every Chromium-only skip was removed.

Real cross-browser failures were fixed at their root:
- **Edge on macOS:** the GPU display link fails, so the flag `--disable-gpu` is set on darwin.
- **Firefox:** Playwright's full-page aria snapshot on each `expect` poll blocked the page. The shared `expect` now waits for the element or URL first, with the same total timeout. Toast lookups are scoped.
- **Proxy ECONNRESET:** a keep-alive race, fixed with uvicorn `--timeout-keep-alive 75`.
- **Table re-renders:** DataTable rows are memoized.

Retro items 7, 15 and 37 are addressed.

**Files changed**
- `backend/tests/domain/answer_key.py`: shared step helpers (CTX, MARKS, run, apply, manual, after_run_1 …).
- `backend/tests/domain/test_answer_key.py` (new): FR-6/14/17/19 facts, the steps 1–14 replay, an NFR-1 import scan, and 10 deferred skips.
- `backend/tests/domain/test_{rules,recommendations,apply_recommendation,apply_all}.py`: use the shared helpers.
- `backend/tests/app/test_nfr8_timing.py` (new): import < 10 s, a run < 5 s, and a command plus the six views < 1 s in total.
- `frontend/e2e/m1-flow.spec.ts` (new): the UJ-1 milestone 1 flow; fails on any page error.
- `frontend/e2e/*.spec.ts`: Chromium-only skips removed; toast lookups scoped. `parts-roster.spec.ts` also opens rows after a sort.
- `frontend/e2e/support/test.ts`: `expect` waits for the element or URL first; new `toasts()` helper.
- `frontend/e2e/support/plan-api.ts`: `moveFromPanel` takes a round.
- `frontend/components/common/data-table.tsx`: memoized rows with stable handlers (`useLayoutEffect`), `shownRows`/`enterOpensRow` helpers, and the Enter guard for retro item 15.
- `frontend/components/common/locations-table.tsx`: memoized columns.
- `frontend/tests/parts.test.tsx`: sort-then-open and Enter-guard tests.
- `frontend/playwright.config.ts`: Edge gets `--disable-gpu` on macOS.
- `package.json`:
  - `e2e:reset-db`, run before the e2e backend starts;
  - `--timeout-keep-alive 75`;
  - `--no-access-log` on `dev:backend` (retro item 7).
- `.github/workflows/ci.yml`: `ruff format --check`.
- `README.md`: English milestone 1 demo, all-browser e2e, and "synthetic data only".

**Review findings.** 43 findings: 23 patched, 1 deferred, 19 rejected. Every rejection has its reason in the Review Triage Log.
- Patched entries by verdict: 5 medium, 18 low.
- Deferred: AGENTS.md is out of date (an agent-context file).
- One partial patch: a DOM unit test of DataTable could not be added because installing `@testing-library/react`/`jsdom` was denied. Pure-helper tests and a three-browser e2e cover the change instead.

**Follow-up review: recommended (true).** At least two medium entries were patched. The specific unverified risks:
- The `expect` wrapper in `frontend/e2e/support/test.ts` depends on Playwright 1.65 behaviour (the per-poll snapshot, and matcher options passed last).
- DataTable's ref-forwarded row handlers have no DOM unit test; only e2e covers them.

**Verification (final tree)**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` (5 kept), `npm run typecheck`, `npm run lint`: all clean.
- `npm test`: pytest 544 passed, 10 skipped (the answer-key deferrals, each with its story reason); Vitest 250 passed.
- `pytest tests/app --database-url postgresql+psycopg://…` on local `postgres:17`: 121 passed, 1 skipped.
- `npm run gen:api`: `schema.ts` unchanged.
- `npm run e2e` (fresh server, reset db): 159 passed in 5.2 min, 0 failed, 0 flaky, 0 skipped. Per browser: chromium 53, firefox 53, msedge 53.
- Baseline before the change: 74 passed, 32 failed (all msedge), 50 skipped (firefox).

**Residual risks**
- The Parts and Locations pages render every row (about 38k elements), which makes them slow in Firefox; virtualization is later work.
- CI still runs Chromium only, so the three-browser gate is local.
- `--disable-gpu` hides Edge's GPU path on macOS.
- AGENTS.md is out of date (deferred).
