---
title: 'CI 45017052318: e2e route handlers end with their test'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_revision: 'b78b4aa6ea6d102f994d417fd681080e0f74d67b'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      No deterministic test forces a route handler to be in flight when a test ends, so removing the fixture teardown would not fail any check.
    evidence: |-
      The out-of-test error only appears when the timing race hits (once in CI run 45017052318, once locally in Story 4.6). Deleting the unrouteAll line in frontend/e2e/support/test.ts leaves the suite green on a normal run. A self-test of the harness costs more than the one-line teardown; revisit if the error shows up again.
    location: >-
      frontend/e2e/support/test.ts
    severity: low
  - summary: >-
      Nothing automated checks that the e2e no-restricted-imports rule still fires.
    evidence: |-
      All specs comply, so npm run lint passes whether or not the rule or its glob matches. Checked by hand with throwaway specs (named and default imports, .test.mts and .spec.tsx in a subfolder) that were deleted afterwards. The repo's other lint rules (module boundaries) have no tests either.
    location: >-
      frontend/eslint.config.mjs
    severity: low
---

<intent-contract>

## Intent

**Problem:** CI run 45017052318 failed the `End-to-end (Playwright, Chromium)` job although all 48 tests passed: Playwright reported "1 error was not a part of any test" — `route.fetch: Test ended` for `GET /api/plans` (referer `/`) inside a route callback. A `page.route` handler (here the `**/api/plans` handlers in `plan-overview.spec.ts`, which call `route.fetch`) can still be running when the test's last assertion passes, because the app may request the plan list again after the redirect; the page then closes under the handler and the error lands outside any test. The same error was seen once locally in Story 4.6.

**Approach:** Give every e2e spec one shared `test` from `frontend/e2e/support/test.ts` whose `page` fixture, after the test body, calls `await page.unrouteAll({ behavior: "ignoreErrors" })` before the page closes, so in-flight handlers can never report after their test. Enforce the shared import with an ESLint rule so new specs cannot bypass it.

## Boundaries & Constraints

**Always:** Teardown is deterministic and does not depend on timing. Every spec in `frontend/e2e/*.spec.ts` imports `test` from `./support/test`. Existing test bodies, assertions and route handlers keep their behaviour. Tests keep naming their journey/FR.

**Never:** Raise any timeout, add or change retries, add sleeps/waits, skip tests, or change app code under `frontend/app`, `frontend/modules`, `frontend/components`, `frontend/lib` or the backend. Do not use `behavior: "wait"` (a handler awaiting a held promise could hang teardown). Do not edit `.docs/planning-artifacts/`, `data/sample/` or `data/answer-key/`.

</intent-contract>

## Code Map

- `frontend/e2e/plan-overview.spec.ts:116-121,152-156,193-197` -- `**/api/plans` handlers calling `route.fetch()`; the CI error (`GET /api/plans`, referer `/`) comes from one of these. Line 131/221 use `fulfill`/`abort`.
- `frontend/e2e/manual-move.spec.ts:272-281,315-326` -- `/commands` POST handlers; 320 calls `route.fetch()`.
- `frontend/e2e/views-follow-planning-copy.spec.ts:128-138,164-174,193-198,225-227` -- part/locations handlers calling `route.fetch()`/`fallback()`.
- `frontend/e2e/new-plan.spec.ts:44-50,213-217` -- `**/api/plans` handlers calling `route.continue()`; same risk class.
- All 12 specs in `frontend/e2e/*.spec.ts` import `test`/`expect` from `@playwright/test`; support helpers (`support/plan-api.ts`, `support/sample-plan.ts`, `support/warm-routes.ts`) import types/`expect`/`request` only and stay as they are.
- `frontend/eslint.config.mjs` -- flat config; add a block for `e2e/**/*.spec.ts` with `no-restricted-imports` (`paths: [{ name: "@playwright/test", importNames: ["test"] }]`).
- `frontend/playwright.config.ts` -- unchanged (no timeout/retry edits). `@playwright/test` is pinned at 1.65.1 (`page.unrouteAll` with `behavior` exists since 1.41).

## Tasks & Acceptance

**Execution:**
- `frontend/e2e/support/test.ts` -- create: `export const test = base.extend({ page: async ({ page }, use) => { await use(page); await page.unrouteAll({ behavior: "ignoreErrors" }); } })` and re-export `expect` (and the types specs import) from `@playwright/test`, with a short comment citing CI 45017052318 -- one shared teardown for every spec (DRY).
- `frontend/e2e/*.spec.ts` (all 12) -- import `test` (and `expect`) from `./support/test` instead of `@playwright/test`; type-only imports may stay on `@playwright/test` -- every page gets the teardown.
- `frontend/eslint.config.mjs` -- add a `files: ["e2e/**/*.spec.ts"]` block forbidding the `test` import from `@playwright/test` with a message pointing to `./support/test` -- keeps future specs on the fixture.

**Acceptance Criteria:**
- Given a test whose `page.route` handler is still inside `route.fetch`/`route.continue` when the test body ends, when the test finishes, then the handler is unrouted with `ignoreErrors` before the page closes and Playwright reports no "error was not a part of any test".
- Given the full suite, when `npm run e2e -- --project=chromium` runs three times in a row, then every run passes all tests with no out-of-test errors.
- Given a spec that imports `test` from `@playwright/test`, when `npm run lint` runs, then ESLint reports a `no-restricted-imports` error.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 22 findings — high 0, medium 0, low 15, false 6, maybe-false 1
- findings:
  - `[false]` `[reject]` (intent) Handlers are not guarded one by one and the root cause is not confirmed — the intent explicitly offers a shared fixture; a grep shows every `.route(` in `frontend/e2e` is `page.route` on the fixture page, so the fixture covers every handler.
  - `[false]` `[reject]` (intent) No CI evidence, only local runs — the intent names three local `npm run e2e -- --project=chromium` runs as the verification; six were run (49/49 each, no out-of-test error).
  - `[low]` `[defer]` (intent) No test deliberately keeps a handler in flight past the test body — same root cause as the verification-gap finding; deferred.
  - `[low]` `[reject]` (intent) `ignoreErrors` also hides real handler errors thrown after the test body — the intent explicitly offers `ignoreErrors`; assertions are already done at that point. Fixing would add complexity for a rare case.
  - `[false]` `[reject]` (intent) ESLint rule and spec go beyond scope — the rule keeps future specs on the shared teardown (DRY); no harm named.
  - `[low]` `[reject]` (intent) `context.route` / extra pages are not covered — none exist today; covering them adds a second fixture for an unlikely case.
  - `[low]` `[defer]` (blind) No regression test proves the fix — grouped with the verification-gap finding; deferred.
  - `[maybe-false]` `[reject]` (blind) Root cause guessed; the app may refetch `/api/plans` after the redirect — settle by reading the CI trace; if true it is only an extra GET (low), so rejected.
  - `[low]` `[reject]` (blind) `page.unrouteAll` throws on a closed or crashed page — no spec closes the page; only a test that already failed would see extra noise. Adding a guard for an unlikely case.
  - `[low]` `[reject]` (blind) Only the built-in `page` is covered — same as the intent finding above; none exist today.
  - `[low]` `[patch]` (blind) ESLint glob `e2e/**/*.spec.ts` misses `*.test.ts`, `.tsx`, `.mts` etc. — widened to `e2e/**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}`.
  - `[low]` `[patch]` (blind) Lint message `./support/test` is wrong for nested specs — message now names `e2e/support/test.ts`.
  - `[false]` `[reject]` (blind) Hand-picked type re-exports force edits for new types — the rule restricts only `test`/default, so a spec can still `import type { Route } from "@playwright/test"`.
  - `[false]` `[reject]` (blind) Verification covers Chromium only — the intent and CI run Chromium only; the fixture is project-agnostic.
  - `[low]` `[reject]` (blind) Spec does not mention CI `retries: 1` — fix edits this build's spec.
  - `[false]` `[reject]` (blind) Spec in-review with no recorded results — results are filled in at finalize; session log is the orchestrator's job.
  - `[low]` `[reject]` (edge) `unrouteAll` on a closed page fails teardown — same as the blind finding above.
  - `[low]` `[reject]` (edge) `context.route` / `newPage` handlers not covered — same as above.
  - `[low]` `[patch]` (edge) ESLint glob misses other Playwright test file names — same fix as the blind glob finding.
  - `[low]` `[defer]` (verification-gap) No deterministic check that an in-flight handler is unrouted — filed as defer; recorded in `deferred`.
  - `[low]` `[defer]` (verification-gap) Nothing automated checks the ESLint guard — filed as defer; recorded in `deferred`.
  - `[low]` `[patch]` (verification-gap, other) `importNames: ["test"]` misses `import test from "@playwright/test"` (default export) — added `"default"` to `importNames`; checked with a throwaway default-import spec.

## Design Notes

`ignoreErrors` rather than `wait`: by the time teardown runs, the test's assertions are done, so the in-flight response no longer matters; `wait` would block teardown on any handler awaiting an unresolved promise (e.g. the held `/api/plans/{id}` route in "uj1 shows opening text while loading" if a test failed before `release()`). Overriding the built-in `page` fixture runs this teardown before the context closes, and covers every route registered on that page.

## Verification

**Commands:**
- `npm run e2e -- --project=chromium` (three runs) -- expected: all tests pass each run, no "error was not a part of any test" line.
- `npm run lint` -- expected: no errors.
- `npm run typecheck` -- expected: no errors.

## Auto Run Result

**Summary:** Every e2e spec now uses one shared `test` whose `page` fixture calls `page.unrouteAll({ behavior: "ignoreErrors" })` after the test body and before the page closes. A `page.route` handler that is still inside `route.fetch`/`route.continue` when its test ends (the CI case: `GET /api/plans` in `plan-overview.spec.ts`) can no longer report "route.fetch: Test ended" outside any test. An ESLint rule keeps future specs on the shared `test`. No timeouts, retries, waits, app code or Playwright config changed.

**Files changed:**
- `frontend/e2e/support/test.ts` -- new shared `test` with the teardown; re-exports `expect` and the types the specs use.
- `frontend/e2e/*.spec.ts` (12 files) -- import `test`/`expect` from `./support/test` instead of `@playwright/test`; no other change.
- `frontend/eslint.config.mjs` -- `no-restricted-imports` for `e2e/**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}` forbids the named and default `test` import from `@playwright/test`.

**Review findings:** 22 findings (low 15, false 6, maybe-false 1). Patches applied: 3 entries, all low (ESLint glob widened, default import blocked, message names `e2e/support/test.ts`). Deferred: 2 low (no deterministic in-flight-handler test; no automated check of the lint rule). Rejected: 6 false (per-handler guards not needed, CI evidence, scope of lint rule, type re-exports, Chromium-only, results not yet recorded), 1 maybe-false (possible app refetch of `/api/plans`, low if true), and low findings for closed-page guard, `context.route` coverage, `ignoreErrors` hiding later handler errors and a spec-only note about CI retries -- each unlikely in everyday use or requiring a spec edit; see the triage log.

**Follow-up review recommendation:** false -- 0 high and 0 medium entries patched (3 low).

**Verification:**
- `npm run lint` -- exit 0 (before and after the review patches).
- `npm run typecheck` -- exit 0 (before and after the review patches).
- `npm run e2e -- --project=chromium` -- 3 runs before the patches and 3 runs after: each 49 passed, 0 failed, 0 flaky, no "not a part of any test" line.
- Lint rule checked by hand with throwaway specs (named import, default import, `.test.mts` and `.spec.tsx` in a subfolder): each reported `no-restricted-imports`; files deleted afterwards.

**Residual risks:** The original error is a timing race and was not reproduced locally, so the clean runs are consistent with the fix but do not prove it; a clean CI run is the real confirmation. Routes registered on a `context` or on extra pages would not be covered (none exist today).
