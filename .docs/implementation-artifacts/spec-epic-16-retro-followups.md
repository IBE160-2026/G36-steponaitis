---
title: 'Epic 16 retro follow-ups: Log in on a busy clear, 503 declared, demo exempt from the throttle, function region arn1'
type: 'bugfix'
created: '2026-11-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'dc50b18a2e4d911041566de8f2c5d0c9b16cb301'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four decisions from 2026-11-28 are not in the code. (1) Log in and Demo version can answer 503 but do not declare it. (2) A right password answers 503 when clearing the attempt count meets a busy lock. (3) Every Log in as the published `demo` account is counted on one row, so five overlapping logins lock `demo` for everyone (retro item 2). (4) The function runs in `iad1` while the database is in Stockholm, about 1 s per database call (retro item 5).

**Approach:** Declare 503 and regenerate the API types. Give the session on a busy clear and log a warning. Skip the throttle for `demo` while Demo version is on. Set the function region to `arn1` in `vercel.json`.

## Boundaries & Constraints

**Always:**
- A busy lock while *counting* an attempt still answers 503 with no cookie.
- The `demo` exemption applies only when `FEATURE_DEMO` is on and the casefolded username is `demo`; then Log in neither reads nor writes `login_attempts`. Every other name, and `demo` with the flag off, is throttled as today.
- The busy-clear warning shows no username and no password.
- `frontend/lib/api/schema.ts` changes only through `npm run gen:api`.

**Never:**
- No migration and no prune rule for unlocked `login_attempts` rows: accepted by Justas, recorded in AD-18.
- No change to the counting rule, the lock length or Demo version.
- No push, no deploy, no Vercel dashboard change by the build: the region takes effect when Justas pushes.
- No change to labels, `epics.md` or `sprint-status.yaml` (separate work).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Busy clear | right password, `clear` raises `LoginAttemptsBusy` | 200, session cookie, one warning logged, the count row stays | N/A |
| Busy count | `reserve` raises `LoginAttemptsBusy` | 503 `unavailable`, no cookie | unchanged |
| Demo, flag on | 6 wrong passwords for `demo` (any casing), then the right one | six 401s, then 200; no `login_attempts` row for `demo` | N/A |
| Demo, flag on, lock held | `login_attempts` write-locked, right `demo` password | 200 | N/A |
| Demo, flag off | 5 wrong passwords for `demo` | the 6th attempt is 429 | unchanged |
| Other name, flag on | 5 wrong passwords for `kari7` | the 6th attempt is 429 | unchanged |
| OpenAPI | `swp openapi` | `/api/auth/login` and `/api/auth/demo` list 503 | N/A |

</frozen-after-approval>

## Code Map

- `backend/swp/api/routers/auth.py:67,91` -- `error_responses(401, 403, 404, 422, 429)` and `(403, 404)`; add 503 to both.
- `backend/swp/app/auth/__init__.py:124-158` -- `login()`: `reserve` (keep its 503 mapping), `clear` (now 503; change to warning + session). `demo_enabled()` at `:51`, `logger` already used by the seed. `DEMO_USERNAME` is in `swp.domain.accounts` and already casefolded; `key = username_key(username)`.
- `backend/swp/store/login_attempts.py` -- do not change.
- `backend/tests/app/test_fr40_login_throttle.py:329` -- `test_fr40_busy_clear_after_right_password_answers_unavailable_without_cookie` asserts the old 503; rewrite it. `:408` `test_fr40_real_write_lock_is_unavailable` (busy count) stays; reuse its `_login_attempts_locked()` helper.
- `backend/tests/app/test_fr50_demo_account.py` -- demo fixtures with `FEATURE_DEMO` on.
- `vercel.json` -- `services.api.functions."swp/main.py"` holds `excludeFiles`; top-level keys are `services`, `rewrites`, `git`.
- `backend/tests/test_deploy.py` -- `_vercel()` helper and `test_nfr5_*` tests.
- `README.md:103` -- says five wrong passwords lock Log in as `demo`; Deploy steps at `:105-150`.
- `ARCHITECTURE-SPINE.md` (`.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/`) -- `:131` (throttle writes answer `unavailable`), AD-18 *Login throttle* `:305` and *As built* `:307-312`, tree line `:419` (`vercel.json`).
- `.docs/implementation-artifacts/deferred-work.md` -- the `spec-epic-16-retro-fixes.md` entry (503 not declared) is closed by this work.

## Tasks & Acceptance

**Execution:**
- [x] `backend/swp/app/auth/__init__.py` -- in `login()`, skip `reserve` and `clear` when `demo_enabled()` and `key == DEMO_USERNAME`; on `LoginAttemptsBusy` from `clear`, log one warning (cause only) and return the session; update the docstring -- decisions 2 and 3.
- [x] `backend/swp/api/routers/auth.py` -- add 503 to the Log in and Demo version `error_responses(...)` -- decision 1.
- [x] `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`; no hand edit -- CI diffs it.
- [x] `vercel.json` -- add top-level `"regions": ["arn1"]` and `"regions": ["arn1"]` beside `excludeFiles` in the api function -- decision 4.
- [x] `backend/tests/app/test_fr40_login_throttle.py`, `backend/tests/app/test_fr50_demo_account.py` -- one test per matrix row (`test_fr40_…`, `test_fr50_…`); rewrite the busy-clear test.
- [x] `backend/tests/app/test_fr40_login_throttle.py` -- `test_fr40_login_and_demo_routes_declare_503`: the app's OpenAPI document lists 503 for both routes (no OpenAPI route test file exists; `backend/tests/test_cli.py` only tests the `swp openapi` command).
- [x] `backend/tests/test_deploy.py` -- `test_nfr5_vercel_functions_run_in_stockholm`: both `regions` values equal `["arn1"]`.
- [x] `README.md` -- line 103: Log in as `demo` is not throttled while Demo version is on; Deploy: the function region is `arn1`, set in `vercel.json`, and how to check it (`x-vercel-id`).
- [x] `ARCHITECTURE-SPINE.md` -- `:131`, AD-18 (exemption; busy clear logs in; stale unlocked rows accepted, decided 2026-11-28), `:419`.
- [x] `.docs/implementation-artifacts/deferred-work.md` -- add a `resolved: 2026-11-28` line to the 503 entry.

**Acceptance Criteria:**
- Given the built tree, when `npm run gen:api` runs again, then `git diff --exit-code frontend/lib/api/schema.ts` is clean.
- Given `vercel.json`, when it is validated against `https://openapi.vercel.sh/vercel.json`, then it is valid.
- Given the change, when `npm test`, the linters, `npm run trace` and `npm run e2e` (three browsers) run, then all pass with 0 failed, 0 flaky, 0 skipped.

## Implementation Notes

- `login()` computes `throttled = not (demo_enabled() and key == DEMO_USERNAME)` once and guards both `reserve` and `clear` with it. The busy-clear warning is `Login attempt count not cleared: the database was busy (<driver cause>). The login was given; the count row stays, and a count that had reached 5 keeps the name locked until the lock passes.`; `LoginAttemptsBusy` carries `str(error.orig)` only, so no SQL parameters reach the log.
- `test_fr50_demo_works_while_demo_login_is_locked` counted a `demo` lock through `auth.login` with Demo version on, which no longer counts. It is replaced by `test_fr50_demo_and_log_in_ignore_a_lock_row_left_for_demo`: a lock row written straight through the store blocks neither Demo version nor Log in as `demo`, and stays untouched.
- Outside the task list, text only: README `:101` and the Deploy check at `:141`, and the header comments of `frontend/e2e/production/demo-front-page.spec.ts` and `frontend/playwright.public.config.ts`, said Log in as `demo` writes a login-attempts row or can be locked on the public deployment. Both are false once the exemption ships, so they are reworded.
- After review: `.github/workflows/keep-alive.yml`'s health step fails unless the second `::` field of the `x-vercel-id` header of `GET /api/health` is `arn1` (tried with a stubbed curl under `bash -eo pipefail`: `iad1::arn1::…` passes; another region, a two-field id, a missing header and a curl failure all fail). Against the live site it fails today (`arn1::iad1::…`), as expected before the push. `test_fr40_busy_clear_on_the_fifth_attempt_logs_in_and_leaves_the_lock` covers a busy clear after the fifth counted attempt.
- `vercel.json` validates against the schema downloaded from `https://openapi.vercel.sh/vercel.json` (jsonschema): `regions` is defined at the top level and under `services.*.functions.*`.
- Verified by the build agent: `npm test` (pytest 1236 passed, 2 skipped: the Postgres-only lock tests on SQLite, as before; Vitest 791 passed), the throttle, demo and login test files on Postgres 17 (88 passed), ruff, ruff format, import-linter, ESLint, tsc, `npm run trace`, and `npm run gen:api` twice with the same result. Not run by the build agent: `npm run e2e`, `npm run e2e:production`.

- Gate, run by the orchestrating session on 2026-11-28: `npm test` 1237 passed, 2 skipped (pytest) and 791 passed (Vitest); ruff, ruff format, import-linter, ESLint, tsc and `npm run trace` clean; `npm run gen:api` leaves `schema.ts` unchanged; `npm run e2e` 453 passed in chromium, firefox and msedge (0 failed, 0 flaky, 0 skipped), run before the review fixes, which changed only a log message and a docstring under `backend/swp/`; `npm run e2e:production` 3 passed after them.
- The keep-alive steps were run locally against the public URL: the session and Demo version steps pass, and the health step fails with `x-vercel-id: arn1::iad1::…`, as it must until the region change is deployed.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-11-28 (blind hunter B1–B14, edge-case hunter E1–E4, verification gap V1–V3). Route: P = patched, D = deferred, R = rejected.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| B1 | README region check uses `curl -sI` (HEAD), which answers 404 | low | HEAD `/api/health` is 404 in-process and on the live site; GET is 200. | P |
| B2 | Docs state `arn1` as fact before a deploy proves it; no rollback line | low | Vercel's docs are silent for `services`; README now has the rollback sentence and `deferred-work.md` an "unverified until the push" entry. | P |
| B3 | Nothing automated checks the live function region | medium | Same as V1. | P |
| B4 | README step 1 does not say which Supabase region to pick | low | `vercel.json` pins `arn1`; step 1 said only "create a project". | P |
| B5 | Busy clear on the fifth counted attempt leaves the lock; "next successful login clears the count" is wrong there | low | `reserve` writes `(5, now + 60 s)` before the check; the busy clear leaves it, so the next login is 429. Wording fixed in four places; `test_fr40_busy_clear_on_the_fifth_attempt_logs_in_and_leaves_the_lock` added. | P |
| B6 | AD-18 "at most 5 password checks" is not true for `demo` with the flag on | low | `demo` skips `reserve`; AD-18 accepted risks and the docstring now say so. | P |
| B7 | README settings table does not say `FEATURE_DEMO` turns off the throttle for `demo` | low | Rows `FEATURE_DEMO` and `DEMO_PASSWORD` now say it, and "never reuse a secret". | P |
| B8 | A `demo` row left in `login_attempts` is ignored with the flag on and counts again when it goes off | low | True by construction; described in the AD-18 stale-rows bullet. No code change: turning the flag off on a deployment with a leftover row is unlikely, and a lock passes in 60 s. | P (doc) |
| B9 | Planning documents contradict the build (`epics.md:183,1966,1995`, `epic-16-context.md:18`, spine `:202`) | low | Only `epics.md:1995` is stale ("while `demo` is locked by the throttle"); the other lines still hold ("demo bypasses it", "no throttle"). `epics.md` is excluded by the frozen boundary and is corrected in the bookkeeping pass. | D |
| B10 | Closing retro items 120 and 123 and the `issues.md` lines is not tracked | false | They are closed in the commit and session-log step after the review, as in `spec-epic-16-retro-fixes.md`; item 123 closes only after the post-push region check. | R |
| B11 | The two new `deferred-work.md` entries have `source_spec: none` and no target | false | The format is the workflow's for goals split at step 1; both are picked up in this session (label build, bookkeeping pass). The note about `issues.md:223` is carried to the label spec. | R |
| B12 | The spec file is untracked and not in the diff | false | It is kept out of the review diff on purpose and committed with the change. | R |
| B13 | No frontend test covers the declared 503 | false | `fr40_other_errors_keep_both_fields` (`frontend/tests/auth.test.tsx:350`) covers any other error's message on Log in, and the Demo version button notifies `outcome.message` (404 toast test). | R |
| B13b | Create account answers 500 on a busy lock | low | `store/users.py:24-39` catches only `IntegrityError`. Pre-existing, not caused by this change. | D |
| B14 | `test_fr50_demo_account.py` imports a private helper from another test module and holds `test_fr40_…` tests | false | The file already imports `_multipart`, `_small_files`, `_error`, `_login` the same way; the `fr40` names are on purpose for `npm run trace`, and the module docstring names the exemption. | R |
| E1 | Busy clear after the fifth counted attempt | low | Same as B5. | P |
| E2 | A non-busy database error from `clear` after a right password still answers 500 | false | By design: only a busy lock is mapped (frozen matrix); any other database error raises unchanged, pinned by `test_fr40_other_database_error_on_the_throttle_writes_still_raises`. | R |
| E3 | A non-published `DEMO_PASSWORD` can be guessed without limit while the flag is on | low | Same as B7. | P |
| E4 | Spine "the first success clears it" no longer always holds | low | Reworded with B5. | P |
| V1 | `arn1` is checked only as JSON text | medium | Filed gap: `test_deploy.py` reads `vercel.json`; keep-alive and `e2e:public` read no header. The keep-alive health step now fails unless the second field of `x-vercel-id` is `arn1`. | P |
| V2 | README `curl -sI` sends HEAD | low | Same as B1. | P |
| V3 | Stale "60 s login lock" reason above `retries: 0` in `playwright.public.config.ts` | low | Comment reworded. | P |

## Design Notes

- **Why both `regions` keys.** Vercel's docs do not say whether a top-level `regions` applies to a `services` project. The JSON schema accepts it at the top level and inside a service's function config, and `excludeFiles` in that function config is known to work on this project. Hobby allows one region; both name the same one.
- **Region check after the push (Justas, then the session).** `curl -sI https://g36steponaitis.vercel.app/api/health | grep -i x-vercel-id` shows `arn1::arn1::…`, and `/api/health` answers in well under 1 s. A failed build leaves the current deployment live; `git revert` of the region lines restores `iad1`.
- **Why `demo` loses nothing.** With Demo version on, anyone gets a `demo` session without a password, so its password needs no guessing protection.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports && npm run lint && npm run typecheck && npm run trace` -- expected: clean
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: clean after the regenerated file is in the tree
- `npm run e2e` and `npm run e2e:production` -- run by the orchestrating session, not the build agent
