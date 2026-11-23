---
title: 'Story 12.5: Milestone 2 gate'
type: 'chore'
created: '2026-11-23'
status: 'done'
baseline_revision: '04ddf77c0e7f32f04351cc78929d83db405ae717'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-12-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      AD-18's 4 MB limit is met by gzip, not by smaller views; plain JSON for a max-size plan's parts and locations views is 6-8 MB.
    evidence: |-
      test_ad18_nfr8_max_size_plan_views_under_4_mb measures bytes as sent with Accept-Encoding: gzip (largest ~0.37 MB). Whether Vercel's 4.5 MB function limit counts the encoded body, and whether the Next proxy path keeps gzip, is unverified until deployment (Story 16.2).
    location: >-
      backend/swp/api/app.py
    severity: medium (unverified)
  - summary: >-
      Apply all on a max-size import is quadratic (9,160 recommendations did not finish in 3 minutes).
    evidence: |-
      Each apply re-replays and revalidates; seen while building the max-size view test, which therefore applies one recommendation. No scaling work is in scope (NFR-7).
    location: >-
      backend/swp/domain (apply_all)
    severity: low
  - summary: >-
      epics.md still names frontend/e2e/m1-flow.spec.ts, renamed to sm2-flow.spec.ts in this story.
    evidence: |-
      .docs/planning-artifacts/epics/epics-Project-2026-11-17/epics.md:1418; planning artifacts are off-limits to this run.
    location: >-
      .docs/planning-artifacts/epics/epics-Project-2026-11-17/epics.md:1418
    severity: low
  - summary: >-
      chromium locations-wall.spec.ts:512 failed once in the implementer's full run (Manual move confirm sent no command); cause unknown.
    evidence: |-
      Passed 6/6 alone and in full runs 1, 2 and 4 by the orchestrator. A trace of a failing run would settle whether it is a load-timing race in the move dialog's Enter handling.
    location: >-
      frontend/e2e/locations-wall.spec.ts:512
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Milestone 2 (Epics 6–12) has no single proof that it works. There is no SM-7 script mapping core FRs and NFRs to test names. No test checks that every plan view stays under 4 MB at `MAX_ROWS_PER_FILE`. No end-to-end test walks the whole SM-2 flow through the planning copy and the move-list print. The README demo stops at before/after and still says the answer-key steps 15–20 are skipped. And the full three-browser Playwright suite is not green: `recommendations-page.spec.ts:231` crashes the Firefox page at 1300px (epic-10 retro item 84), and `delete-plan.spec.ts:63` is flaky under parallel load.

**Approach:** Add an SM-7 traceability script that fails when a core FR has no test, and run it from pytest so CI enforces it. Add one max-size plan-view size test. Extend the M1 e2e flow into the SM-2 flow, ending with the move list and its print check. Extend the README to the milestone 2 demo. Fix both e2e problems at their root cause, then prove the gate: every check, the full `npm run e2e` in `chromium`, `firefox` and `msedge` with 0 failed, 0 flaky and 0 skipped, and `npm run e2e:production`.

## Boundaries & Constraints

**Always:**
- Every new test names its FR/NFR/SM (`test_sm7_…`, `test_ad18_nfr8_…`, e2e title starting `uj1 uj2 …`). New e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts`.
- Fix the Firefox crash at its root cause. First establish whether the app or Playwright's Firefox build is at fault, and record the evidence (Design Notes and commit message). If it is an app defect, fix the app. If it is a Firefox/Playwright engine defect, change what the app or test does so the crash cannot occur, keep the assertion's intent (2 sections per run at 1300px), and record the upstream cause.
- Make `delete-plan.spec.ts:63` independent of other specs' plans. Its saved-plans list may contain only the plans it created, while the real backend still serves those plans and performs the delete.
- Use only synthetic data (`data/sample/`, `data/answer-key/`, generated rows).
- Name the retro items this story touches in the commit message (84, 37, 47, 73, 83). Leave their status changes to the retro.

**Never:**
- No raised timeouts, no added retries, no `test.skip`/`fixme`/`only`, no per-browser skips or branches that bypass an assertion.
- Never edit `data/sample/`, `data/answer-key/`, `.docs/planning-artifacts/` or `.logs/`. Never read `data/private/`. No deploy, no Vercel/Supabase.
- No scaling or concurrency work beyond the existing optimistic-version retry (NFR-7, AD-6). CI keeps running Playwright on Chromium only.
- No new runtime dependencies. The traceability script uses only the stdlib.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trace, all covered | repo test files | prints each core FR (FR-1–FR-40, FR-42, FR-50, FR-51) and each NFR (NFR-1–NFR-12) with its test names; exit 0 | — |
| Trace, FR missing | a core FR with no name token | exit 1, names the uncovered FR(s) | message lists the missing IDs |
| ID matching | `test_fr51_fr34_…`, `fr1_…` vs `fr10_…`, `nfr8` vs `fr8` | each ID token is counted once, exactly. `fr1` never matches `fr10`, and `nfr8` never counts as `fr8` | — |
| NFR without test | NFR-3 (no AI) and NFR-4 (confidentiality) have no tests today | listed as "no test" in the report. Does not fail (the AC fails only on core FRs) | — |
| Max-size views | generated import at `MAX_ROWS_PER_FILE` rows per file, after a run | every plan view response (summary, parts, locations, pick-groups, recommendations, before-after, move-list, wall per aisle, warehouse, layout) is < 4,000,000 bytes | assert message names the view and its size |
| SM-2 flow, each browser | fresh server, `data/sample/` uploaded through New Plan | overview → parts (classes) → pick groups → best marks → run → apply → manual move → before/after → move list lines → print media check; no `pageerror` | test fails on any page error |

</intent-contract>

## Code Map

- `.docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md:691-702` -- NFR-1..12 (read-only); SM-7 at `:788`.
- Name conventions (from the inventory): pytest `def test_fr17_…`, several IDs per name (`test_fr51_fr38_fr35_…`), also `test_sm1_…`, `test_nfr8_…`. Vitest `it("fr21_…")`, `uxdr47_…`. Playwright titles are mostly `uj<N> …` with FR IDs only in auth/demo/colour specs. pytest alone covers every core FR today; the thinnest are fr16, fr24, fr25, fr17 and fr36.
- New `scripts/traceability.py` (repo root, stdlib only) -- scans `backend/tests/**/*.py` (`def test_…`), `frontend/tests/**/*.test.ts(x)` and `frontend/e2e/**/*.spec.ts` (first string argument of `it(`/`test(`/`test.describe(`). Tokens are matched with `(?<![a-z])(n?fr)(\d+)(?!\d)` on lowercase names split at `_`/space. It prints the FR and NFR tables and exits 1 if a core FR has none. Root `package.json` gets the script `"trace": "uv run --directory backend --locked python ../scripts/traceability.py"`.
- New `backend/tests/rules/test_sm7_traceability.py` -- runs the script's main function (or a subprocess) and asserts exit 0. It also unit-tests the token matcher on the matrix rows (`fr1` vs `fr10`, `nfr8` vs `fr8`, multiple IDs), so CI enforces SM-7. Check `backend/tests/rules/` for how existing rule tests locate the repo root.
- `backend/tests/app/test_layout_api.py:95-122` -- `_max_size_import()` builds a `NormalizedImport` at the max rows and creates it with `plans.create("Max", …, now=NOW)`. `test_wall_api.py:269` has the warehouse 4 MB test. Reuse `_max_size_import` by moving it to a shared test helper module (e.g. `backend/tests/app/max_size.py`), not by copying it, and update both importers.
- `backend/tests/app/test_nfr8_timing.py` -- `VIEWS` (:23), `_command`, `client` fixture. Add `test_ad18_nfr8_max_size_plan_views_under_4_mb`: max-size plan, `set_best_mark` + `run`, then GET every view in the matrix row. Find the move-list, wall (per aisle) and warehouse paths in `swp/api/` routers.
- `frontend/e2e/m1-flow.spec.ts` -- rename with `git mv` to `frontend/e2e/sm2-flow.spec.ts`. Retitle it `uj1 uj2 milestone 2 flow on the sample data` and extend it after before/after: open the Move list step, assert the manual move's and the applied recommendation's lines, then `page.emulateMedia({ media: "print" })` and assert the print layout. Reuse the checks from `e2e/move-list.spec.ts:39` / `move-list-print.spec.ts:21`, either the shared print header or the printed lines visible with the app chrome hidden. Keep the `pageerror` collection. Update every reference to `m1-flow` (README, comments: `grep -rn m1-flow`).
- `frontend/e2e/recommendations-page.spec.ts:231-325` -- crop test. The crash comes after `setViewportSize(1300)` + `goto` for the cross-aisle rec (`:317-325`), in Firefox only, 3/3. Suspects:
  - `frontend/modules/recommendations/crops.tsx:52-78` (`CROP_NARROW_QUERY`, `useSyncExternalStore` on `matchMedia`)
  - the crop/wall render (`CropsView`)
  - the `evaluateAll` itself
  - `modules/locations/warehouse-view.tsx:155` ResizeObserver
  
  Reproduce with `npm run e2e -- --project=firefox e2e/recommendations-page.spec.ts:231 --repeat-each=3`. Bisect: same URL opened fresh at 1300px vs resized; without `evaluateAll`; Firefox crash reason in the trace or browser stderr (`DEBUG=pw:browser`).
- `frontend/e2e/delete-plan.spec.ts:63-118` -- computes `following` from `data-row-index`, then deletes. Concurrent specs create and delete plans, so the refetched list puts another row after `a`. Fix: `page.route("**/api/plans", …)` with `route.fetch()`, keeping only the ids of `a` and `b` in the GET reply (DELETE and others fall back). Then `b` is the row after `a`, and the test asserts focus on `b`'s row (`#plan-actions-${b.id}`) without reading positions. Update the file's header comment, which says it reads row positions.
- `README.md` -- `## Milestone 1 demo` (:99-125). Make it a milestone 2 demo. Add the planning copy (manual move, undo), the move list and Print steps, and a drag swap on the One aisle wall. Fix the stale `:125` sentence about skipped answer-key tests. Add `npm run trace` to the checks table (:42-52). State that a run of the README flow by someone else is still to be done before submission (SM-2). Keep the Norwegian group sections.
- `AGENTS.md` "Running and verifying" (:20-29) -- E2E line: the three-browser local gate (`npm run e2e` = chromium, firefox, msedge; install with `npx --workspace frontend playwright install chromium firefox`, Edge installed separately; macOS Edge gets `--disable-gpu` from the config). Also add `e2e:reset-db` on every server start, `npm run e2e:production`, `ruff format --check` in Lint, and `npm run trace`. These are retro items 47, 73 and 83. Keep it short.
- `frontend/e2e/support/test.ts`, `support/sample-plan.ts` (`createSamplePlan`), `support/plan-api.ts` -- shared e2e helpers (read; extend only if needed).

## Tasks & Acceptance

**Execution:**
- `scripts/traceability.py`, root `package.json` (`trace`), `backend/tests/rules/test_sm7_traceability.py` -- the SM-7 script and its test.
- `backend/tests/app/max_size.py` (new shared helper), `test_layout_api.py`, `test_wall_api.py`, `test_nfr8_timing.py` -- share `_max_size_import`; add the max-size plan-view test.
- `frontend/e2e/sm2-flow.spec.ts` (renamed from `m1-flow.spec.ts`) -- the SM-2 flow with the move list and print check.
- `frontend/e2e/recommendations-page.spec.ts` and/or `frontend/modules/recommendations/*` -- the Firefox crash, fixed at its root cause.
- `frontend/e2e/delete-plan.spec.ts` -- independent of other specs' plans.
- `README.md`, `AGENTS.md` -- milestone 2 demo and checks; the three-browser gate.
- Run the gate (Verification) on the final tree and record the results per browser in the Auto Run Result.

**Acceptance Criteria:**
- Given the repo, when `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run trace` run, then all pass, `npm test` shows no skipped answer-key test, and `npm run trace` lists every core FR with at least one test.
- Given a free port 3000, when `npm run e2e` runs, then chromium, firefox and msedge each pass every test, with 0 failed, 0 flaky and 0 skipped. `recommendations-page.spec.ts:231` passes in Firefox with `--repeat-each=3`, and `delete-plan.spec.ts` passes with `--repeat-each=5` while the full suite runs in parallel (or alongside it).
- Given a free port 3000, when `npm run e2e:production` runs, then it passes.
- Given a clean checkout, when someone follows only the README, then every command and demo step it lists exists and works on `data/sample/`.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 46 findings — high 0, medium 3, low 24, false 14, maybe-false 5
- findings:
  - `[low]` `[reject]` (intent) no green full run recorded after the toolbar fix — at review time true; the orchestrator's full runs after it (run 2: 393 passed; run 4, see Auto Run Result) are the evidence; the stale Auto Run Result is rewritten at finalize (a fix that edits this spec).
  - `[false]` `[reject]` (intent) item 84 fixed at the test layer, evidence only in prose — the intent asks to find whether app or Playwright is at fault; the bisection (crash at any width, with `(g) => g.length`, only after a role-scoped `waitFor` + `evaluateAll`, SIGSEGV in XUL) is recorded in Design Notes, and the assertion is kept.
  - `[false]` `[reject]` (intent) `evaluateAll` still used in other specs with the same trigger — they passed in Firefox in every full run (runs 1–4); the trigger is specific to the role-scoped region on this page.
  - `[false]` `[reject]` (intent) delete-plan independence by route interception — matches the intent ("independent of other specs' plans"); delete and focus still run through the real app and backend.
  - `[maybe-false]` `[defer]` (intent) AD-18 met by gzip, not smaller views — whether Vercel's 4.5 MB limit counts the encoded body decides it; deferred to Story 16.2 (medium if true).
  - `[false]` `[reject]` (intent) CI runs Chromium only — the spec and intent keep CI Chromium-only; the three-browser gate is local.
  - `[low]` `[patch]` (intent) SM-2 e2e does not walk the README's undo/drag steps — header now names the README steps it walks and the specs covering undo, outdated and drag.
  - `[false]` `[reject]` (intent) session log not in the diff — the orchestrating session writes it (persistent fact).
  - `[false]` `[reject]` (intent) retro bookkeeping — items are named for the commit; status changes stay with the retro.
  - `[low]` `[reject]` (blind) spec status/deferred do not reflect the failed gate — rewritten at finalize (edits this spec); deferrals added below.
  - `[low]` `[reject]` (blind) toolbar fix not documented — documented in Design Notes at finalize (edits this spec).
  - `[false]` `[reject]` (blind) fixed 240px plate overflows narrow toolbars — the header is `flex-wrap` and 240px fits 320px minus gutters; app-shell.spec.ts narrow checks pass in all browsers.
  - `[low]` `[reject]` (blind) short names leave space; placeholder copies the plate markup — the fixed slot is the point (no shift); the box class is shared and the e2e compares the boxes, so drift fails a test.
  - `[low]` `[patch]` (blind) SM-2 e2e vs README steps — grouped with the intent row above.
  - `[low]` `[patch]` (blind) new titles lack FR/NFR/SM tokens — sm2-flow title now `uj1 uj2 sm2 fr38 nfr9 …`; the plate test keeps `ux_dr5`, the project's convention for UX-only tests (epic-10 retro item 91).
  - `[low]` `[patch]` (blind) max_size hard-codes 25,000 — `MAX_ROWS` now comes from the `max_rows_per_file` setting, and the import asserts its size equals it.
  - `[maybe-false]` `[defer]` (blind) AD-18 depends on gzip; no check through the Next proxy or for clients without gzip — grouped with the AD-18 intent row.
  - `[low]` `[reject]` (blind) max-size test is slow and unmarked; brittle base_version — pytest runs in ~3.5 min in total; a new plan starts at version 1 by contract (other app tests rely on it).
  - `[low]` `[reject]` (blind) scanner misses `.each`/`.serial` forms, counts describe titles and comments — no spec uses those forms; an undercount fails loudly, an overcount needs an FR named only in a describe title, which no spec has.
  - `[low]` `[patch]` (blind) CORE_FRS has no source — comment added (epics.md Story 12.5 AC; PRD NFRs).
  - `[low]` `[patch]` (blind) weak SM-7 assertions — NFR-8 row asserted not "no test"; temp-tree test asserts NFR-10 credited and FR-100 absent. `sys.modules` cleanup rejected (no other module of that name).
  - `[false]` `[reject]` (blind) Firefox workaround not applied to other `evaluateAll` call sites — same as the intent row.
  - `[false]` `[reject]` (blind) `ownPlansOnly` glob misses query strings; gzip headers kept on rewritten body — the list GET has no query; Playwright fulfils with the rewritten body and the test passes in all browsers (345/345 under repeat load).
  - `[low]` `[defer]` (blind) epics.md:1418 still names `m1-flow.spec.ts` — planning artifacts are off-limits; noted for the owner.
  - `[low]` `[reject]` (blind) AGENTS.md bullet long; `e2e:reset-db` is a root script — cosmetic.
  - `[false]` `[reject]` (verification) GZip, trace, plate, e2e — no gaps found.
  - `[low]` `[reject]` (verification) Auto Run Result stale vs the toolbar fix — rewritten at finalize.
  - `[false]` `[reject]` (verification) `JS_NAME` misses `.serial`/`.parallel` — same as the blind row; no caller.
  - `[low]` `[reject]` (edge) list GET non-2xx makes the route handler throw — the test fails either way (loudly).
  - `[false]` `[reject]` (edge) stale content-encoding on the rewritten list — passes in all three browsers under load.
  - `[maybe-false]` `[reject]` (edge) runs re-render between `all()` and `count()` — the page is settled after the panel is visible; 3/3 in Firefox and green in every full run; low if true.
  - `[low]` `[patch]` (edge) bare StopIteration in the max-size test — `next(..., None)` plus an assert message.
  - `[maybe-false]` `[defer]` (edge) clients without gzip get 6–8 MB views — grouped with the AD-18 row.
  - `[false]` `[reject]` (edge) `stocked_max_size_import(parts<=0)` — no caller passes 0.
  - `[low]` `[reject]` (edge) escaped quotes in test names — none in the suites; an undercount fails loudly.
  - `[low]` `[reject]` (edge) non-UTF-8 test file — all test files are UTF-8 (ruff/eslint read them).
  - `[low]` `[reject]` (edge) `python -OO` strips `__doc__` — the script runs through `npm run trace`/pytest only.
  - `[low]` `[reject]` (edge) `--root` wrong dir reports all FRs uncovered — fails loudly; only the test passes `--root`.
  - `[low]` `[reject]` (edge) plate test does not release on assertion failure — the test has already failed; Playwright closes the page.
  - `[medium]` `[reject]` (edge, claim) spec says gate not met — true of the implementer's runs; the orchestrator fixed the remaining causes and re-ran the gate (Auto Run Result); rewriting the spec is not a code fix.
  - `[false]` `[reject]` (edge, claim) AGENTS.md/README state a gate that does not pass — full run 2 and run 4 passed with 0 failed.
  - `[low]` `[patch]` (edge, claim) new test titles lack IDs — grouped with the blind row.
  - `[medium]` `[patch]` (orchestrator verify, run 1) Firefox `move-list.spec.ts:39` and run-2 `best-locations.spec.ts:55` click a flow-bar step that never opens — root cause: the plan plate mounts after the summary loads and pushes the flow bar right, so a click aimed at a step lands elsewhere; fixed with a fixed 240px plate slot and an invisible placeholder of the same box, plus `uj1 ux_dr5 the flow bar keeps its place while the plan plate loads` (fails on the old code).
  - `[medium]` `[patch]` (orchestrator verify, run 3) Firefox `parts-roster.spec.ts:26` timed out — every `getByRole("main")`/`getByRole("table")` lookup walks the ~38k-element roster in Firefox (~1 s per action); the spec now uses CSS for the landmark and table and scopes role lookups to the chip group and the header (47 s → 30 s in Firefox under load).
  - `[low]` `[patch]` (orchestrator verify, run 3) Firefox `session-expiry.spec.ts:80` missed the 10 s toast — it was asserted after slower checks; it is now read first after Log in.
  - `[maybe-false]` `[defer]` (implementer run 3) chromium `locations-wall.spec.ts:512` Manual move confirm sent no command — not reproduced alone (6/6) nor in runs 1, 2 and 4; would need a trace of a failing run.

## Design Notes

- The M1 gate's lessons apply here (`spec-5-8-milestone-1-gate.md`). Edge on macOS needs `--disable-gpu`, which is already in the config. The shared `expect` waits for the element first, because Firefox's per-poll aria snapshot was costly. Only one Playwright run can happen at a time (port 3000). `e2e:reset-db` gives each run a fresh `e2e.db`.
- The deletion e2e routes only the list GET. The delete and focus behaviour still come from the real app and backend. The list content is narrowed to this test's own plans, which removes the cross-spec race at its cause: shared global state. No waits or retries are needed.
- **Firefox crash (retro item 84) — cause: Playwright's Firefox build, not the app.** Evidence: the content process dies with SIGSEGV (`EXC_BAD_ACCESS`, `KERN_INVALID_ADDRESS at 0x0`, a null pointer in `XUL` on the main thread, called from JIT code; macOS report `plugin-container-*.ips`; `DEBUG=pw:browser`: "process … exited on signal 11"). Playwright 1.65.1, Firefox 159.0 build 20261030233710 (`firefox-1572`). Bisection with throwaway specs: it crashes at 1440px as well as 1300px, on an inner-aisle recommendation as well as a cross-aisle one, and with the trivial function `(g) => g.length`. So the narrow-crop path (`CROP_NARROW_QUERY`, `useCropSections`) is not involved. The minimal trigger is `detail.locator(A).first().waitFor()` (or the shared `expect(...).toBeVisible()`, which calls `waitFor`) followed by `detail.locator(B).evaluateAll(fn)`, where `detail` is the role-scoped `getByRole("main").getByRole("region", …)`. With a page-scoped wait or a page-scoped `evaluateAll`, with `count()` per run, or with a plain time wait instead of `waitFor`, it never crashes (3/3 each). A `page.evaluate` that reads `getComputedStyle` and `checkVisibility` on every element twice does not crash either, so nothing the page itself does can trigger it. Fix: the test counts sections per run with `runs.all()` + `count()` (no `evaluateAll`). The assertion is unchanged: some run shows exactly 2 sections at 1300px. Upstream: a Gecko null dereference reachable through Juggler's `evaluateAll` after `waitFor` on a chained role locator; without symbols for this build no upstream report is filed from here.
- **Max-size views and gzip.** As plain JSON, a generated import at `MAX_ROWS_PER_FILE` (25,000 locations, inventory lines, parts and transactions) gives a parts view of about 7.7 MB and a locations view of about 6 MB, which breaks AD-18. The API now gzips responses (Starlette `GZipMiddleware`, `minimum_size=1000`, no new dependency). The largest view as sent is then about 0.37 MB. The test measures the bytes as sent (`num_bytes_downloaded` with `Accept-Encoding: gzip`). On `data/sample/` the NFR-8 command-plus-views sum stays at about 0.35 s (0.32 s without gzip). Risk: AD-18's 4 MB is assumed to be Vercel's 4.5 MB function response limit on the encoded body; that is to be confirmed at deployment (Story 16.2).
- **`apply_all` at max size** is quadratic: a run on the max-size import gives 9,160 recommendations, and Apply all did not finish in 3 minutes (each apply re-replays and revalidates). The size test therefore applies one recommendation. Out of scope here (no scaling work); noted for later.
- **Login field height in Firefox** (`login.spec.ts:38`, failed 5/5 in Firefox): `boundingBox().height` reads 39.99998474121094 for a 40px field. The test now asserts the used CSS height (`toHaveCSS("height", "40px")`) in every browser.
- **Flow bar shift (found by the orchestrator's full runs).** Firefox `move-list.spec.ts:39` (run 1) and `best-locations.spec.ts:55` (implementer run 2) clicked a flow-bar step right after `goto` and never navigated. The trace shows the click while "Opening the plan…" is on screen; the plan plate then mounts and pushes the flow bar right, so the click lands off its target. An app layout-shift defect, also for a quick human click. Fix: the plate has a fixed 240px slot (UX-DR5: at least 214px; long names truncate, the button's name keeps them) and an invisible placeholder with the same box holds it while the summary loads. Covered by `uj1 ux_dr5 the flow bar keeps its place while the plan plate loads`, which fails on the old code.
- **Firefox role-lookup cost on the roster.** Every `getByRole("main")`/`getByRole("table")` lookup walks the ~38k-element Parts roster in Firefox (~1 s per action), so `parts-roster.spec.ts` ran 72-100 s of its 90 s under the parallel suite. The spec now uses CSS for the landmark and table and scopes role lookups to the chip group and header (47 s to 30 s under load). Other heavy-table specs still use role lookups; the suite stays load-sensitive in Firefox (residual risk).
- **Toast order in `session-expiry.spec.ts:80`.** The 10 s toast was read after slower checks; it is now read first after Log in.
- **Environment:** leave no background processes (stop servers; remove any Postgres container you start). Docker can use only the local `postgres:17` image. Do not write session logs or anything under `.logs/`. Do not commit; the orchestrator commits.

## Verification

**Commands:**
- `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass, with no answer-key skips
- `npm run trace` -- expected: exit 0, every core FR listed with tests
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against a local `postgres:17` container -- expected: pass
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` -- expected: no diff
- `npm run e2e -- --project=firefox e2e/recommendations-page.spec.ts:231 --repeat-each=3` -- expected: 3 passed
- `npm run e2e` -- expected: every test in all three projects passes; 0 failed, 0 flaky, 0 skipped; per-browser counts recorded
- `npm run e2e:production` -- expected: pass


## Auto Run Result

Status: done
Blocking condition: none

**Summary.** The milestone 2 gate is in place and passes on the final tree.
- SM-7: `scripts/traceability.py` (`npm run trace`) lists every core FR and NFR with its tests and fails when a core FR has none; CI runs it through pytest. All 43 core FRs are covered; NFR-3 and NFR-4 have no test (reported).
- AD-18/NFR-8: `test_ad18_nfr8_max_size_plan_views_under_4_mb` checks every plan view of a generated import at `MAX_ROWS_PER_FILE`; the API now gzips responses (plain JSON was 6-8 MB).
- SM-2: `m1-flow.spec.ts` became `sm2-flow.spec.ts` (`uj1 uj2 sm2 fr38 nfr9 …`) and ends with the move list and its print-media check, in all three browsers. README has the milestone 2 demo; AGENTS.md the three-browser gate (retro items 47, 73, 83).
- Retro item 84 (Firefox crash at 1300px): Playwright's Firefox build, not the app (SIGSEGV in XUL after a role-scoped `waitFor` + `evaluateAll`, at any width); the test counts sections with `count()`, assertion unchanged.
- `delete-plan.spec.ts:63`: the list reply is narrowed to the test's own plans (retro item 37).
- Further root-cause fixes found by the full runs: the flow bar shifting when the plan plate loads (app), Firefox role-lookup cost on the Parts roster (test), a toast read too late (test), Firefox login field height (test).

**Files changed**
- `scripts/traceability.py` (new), `package.json` (`trace`), `backend/tests/rules/test_sm7_traceability.py` (new): SM-7.
- `backend/tests/app/max_size.py` (new; shared by `test_layout_api.py`, `test_wall_api.py`), `test_nfr8_timing.py`: the max-size view test.
- `backend/swp/api/app.py`: `GZipMiddleware`.
- `frontend/components/common/app-shell/plan-plate.tsx`, `toolbar.tsx`: fixed plate slot and placeholder.
- `frontend/e2e/sm2-flow.spec.ts` (renamed), `plan-overview.spec.ts`, `recommendations-page.spec.ts`, `delete-plan.spec.ts`, `login.spec.ts`, `parts-roster.spec.ts`, `session-expiry.spec.ts`.
- `README.md`, `AGENTS.md`.

**Review findings.** 46 findings (high 0, medium 3, low 24, false 14, maybe-false 5): 11 patched (2 medium, 9 low), 4 deferred (frontmatter `deferred`), the rest rejected with reasons in the Review Triage Log.

**Follow-up review: recommended (true).** Two medium entries were patched. Unverified risks: the fixed 240px plate is a visible layout change; the heavy-table specs other than the Parts roster still use whole-page role lookups that are slow in Firefox, so the full suite remains load-sensitive (one implementer run had an unexplained chromium `locations-wall.spec.ts:512` failure).

**Verification (final tree)**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` (5 kept), `npm run typecheck`, `npm run lint`: clean.
- `npm test`: pytest 1016 passed, 2 skipped (Postgres-only lock tests; no answer-key skip); Vitest 713 passed.
- `npm run trace`: exit 0, all 43 core FRs covered.
- `pytest tests/app` on local `postgres:17`: 319 passed, 3 skipped; container removed.
- `npm run gen:api`: `schema.ts` unchanged.
- `recommendations-page.spec.ts:231`, Firefox, `--repeat-each=3`: 3 passed (was 3/3 "Page crashed").
- `delete-plan`, `saved-plans`, `reuse-import`, `new-plan` with `--repeat-each=5`, three browsers in parallel: 345 passed.
- `npm run e2e` full suite, final tree (run 4, 16.4 min): 393 passed, 0 failed, 0 flaky, 0 skipped — chromium 131, firefox 131, msedge 131. History: orchestrator run 1 (before the plate fix) 389/1 failed (firefox move-list); run 2 (after it) 393 passed; run 3 (after review patches) 391/2 failed (firefox parts-roster timeout, session-expiry toast), both fixed before run 4.
- `npm run e2e:production`: 2 passed.

**Residual risks**
- AD-18 relies on gzip; Vercel's limit semantics unconfirmed until Story 16.2.
- The full three-browser suite on this 8-core/8 GB machine is load-sensitive in Firefox (heavy tables).
- CI still runs Chromium only; the three-browser gate is local.
- A run of the README flow by someone else is still to do before submission (SM-2).
