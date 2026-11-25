---
title: 'Story 16.0: Production hardening before going public'
type: 'bugfix'
created: '2026-11-25'
status: 'done'
baseline_commit: '29bfdf7296e5f564ef5931b5cab526fe115a0ab5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four gaps found in earlier retros must be closed before the app goes on a public URL. (1) The startup check passes with `VERCEL` set and `APP_ENV=local`, and an invalid setting crashes with a pydantic traceback that shows the value. (2) Concurrent failed logins can run more than 5 password checks before the lock. (3) The starter seed reads the TOML before it checks whether the tables are empty, and it skips silently on a busy SQLite lock. (4) A change held back after the session expired is saved under the name of whoever logs in next.

**Approach:** (1) Refuse when `VERCEL` is set and `APP_ENV` is not `production`, and turn a settings `ValidationError` into `StartupRefused` lines. (2) Count the attempt atomically before checking the password. (3) Check that both tables are empty, then load the TOML, and retry a busy lock before logging the real cause. (4) Remember who was logged in when the session ended, and drop the held change with a message when someone else logs in.

## Boundaries & Constraints

**Always:** A refusal line never contains a setting's value. Exactly one `Refusing to start: …` line per problem, in both the backend and `swp db upgrade`, with exit code 2 from the CLI. Throttle constants (5 failures, 60 s lock) and the `login_locked` / `unauthenticated` copy are unchanged, and a locked username still gets no bcrypt check. Layering stays `api > app > store > domain`. Name tests with FR/NFR ids.

**Never:** No migration and no new column. The timestamp for `login_attempts` rows with 1–4 failures stays an open point in `issues.md`. No server-side change to how commands record the user. No re-seed marker (AD-9 decision still open). Do not touch Vercel config (that is Story 16.1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vercel, local | `VERCEL=1`, `APP_ENV` unset or `local` | refuses: `VERCEL is set but APP_ENV is not production. Set APP_ENV=production.` | `StartupRefused` |
| Bad setting | `DEMO_PASSWORD=x` (too short) | one `Refusing to start: DEMO_PASSWORD: …` line, no value, no pydantic traceback | `StartupRefused … from None` |
| Concurrent logins | 10 parallel wrong logins, one username | ≤5 bcrypt checks, the rest `login_locked`; row `(5, now+60s)` | — |
| Right password 5th | 4 failures, then right password | logs in, row cleared | — |
| Seed, not empty | rules exist, TOML missing/broken | returns False, TOML never read, start succeeds | — |
| Seed, busy | lock busy on every try | retries, then logs `Starter categories skipped: the database was busy (<cause>). They are added on the next start or swp db upgrade.` | no crash |
| Same user | held change, `Kari7` logs back in | change is sent once, as today | — |
| Other user | held change, `Ola` logs in (or demo) | change dropped, toast `The last change was not saved: a different user logged in.`, plan refetched | — |
| Previous user unknown | cached session had no user | treated as a different user (dropped) | — |
| Create account | held change, a new account is created | treated as a different user (dropped, same toast) | — |

**Decisions (2026-11-25):** Create account after expiry drops the held change; `e2e/session-expiry.spec.ts:90` changes to expect the toast and no save. The spec is kept whole (~2,800 tokens) by the author's choice.

</frozen-after-approval>

## Code Map

- `backend/swp/app/startup.py` -- `startup_problems` (VERCEL rule at line 49), `check_startup`: wrap `get_settings()` and map `ValidationError.errors(include_input=False)` to `"<FIELD>: <msg without 'Value error, '>"`.
- `backend/swp/cli.py` -- prints `swp: refusing to start:` *and* the logger falls back to `lastResort`, so two lines per problem. Call `configure_logging()` (from `swp.api.request_log`) and drop the print.
- `backend/swp/config.py` -- `_demo_password_can_log_in` already prefixes `DEMO_PASSWORD:`; avoid a double prefix.
- `backend/swp/app/auth/__init__.py:120` `login` -- today: `is_locked(get)` → bcrypt → `record_failure`. Change to `login_attempts.reserve(key, now)` (False = locked) → bcrypt → success `clear(key)`, failure nothing more.
- `backend/swp/store/login_attempts.py` -- `_record_failure` already does a locked read-modify-write with an IntegrityError retry. Reuse it for `reserve`: when `is_locked`, return without writing.
- `backend/swp/domain/accounts.py:101-122` -- `is_locked`, `after_failure`; unchanged.
- `backend/swp/app/categories.py:290` `seed_starter_categories` -- add an emptiness check before `load_starter_categories`, plus a retry loop (3 tries, injectable `sleep`) around `CategorySeedBusy`.
- `backend/swp/store/category_seed.py` -- add `tables_empty() -> bool` (plain read); `seed_if_empty` keeps its atomic re-check.
- `backend/swp/app/bootstrap.py:1-2` -- docstring: written only when missing; the categories come back when both tables are empty.
- `backend/swp/app/auth/__init__.py:148` `seed_demo_account` -- a busy `OperationalError` (use `store.db.is_busy` via a store wrapper) is logged and skipped. `demo_login` seeds on demand anyway.
- `frontend/lib/api/session-expiry.ts` -- `expire(href, user)` remembers the first user, as it does for href. `restore(user)` resolves waiters with `"same-user" | "other-user"`; unknown → `"other-user"`.
- `frontend/app/providers.tsx:39` -- read `current.user` before nulling it; pass it to `expire`.
- `frontend/lib/api/query-errors.ts:18` -- `sessionExpired: () => Promise<"same-user" | "other-user" | void>`. `void` (test mocks) counts as same user.
- `frontend/lib/commands/client.ts:166` -- on `"other-user"`: `notify(HELD_CHANGE_DROPPED)`, `dropForReload`, return `"dropped"`.
- `frontend/modules/auth/api.ts:81` `afterLoginHref(user)` -- callers `login-page.tsx:191`, `signup-page.tsx:181` and `demo-version-button.tsx:78` pass the user from the outcome. `runLogin`/`runSignup`/`runDemo` call `navigate(user)`.
- Tests: `backend/tests/app/test_nfr6_startup_checks.py`, `tests/test_cli.py:74`, `tests/app/test_fr40_login_throttle.py`, `tests/app/test_fr47_starter_categories.py`, `frontend/tests/session-expiry.test.ts`, `frontend/tests/auth.test.tsx:741`, `frontend/e2e/session-expiry.spec.ts`.
- `README.md:88-94` -- rule 1 text → "`VERCEL` is set and `APP_ENV` is not `production`", and add an invalid-value rule.

## Tasks & Acceptance

**Execution:**
- [x] `backend/swp/app/startup.py`, `backend/swp/cli.py`, `README.md` -- VERCEL rule, ValidationError → problems, one line per problem in the CLI -- AC 1–2
- [x] `backend/tests/app/test_nfr6_startup_checks.py`, `backend/tests/test_cli.py` -- `test_nfr6_vercel_with_local_app_env_refuses`, `test_nfr6_invalid_setting_refuses_without_value` (assert the value is absent and no `ValidationError` text), CLI single line -- coverage
- [x] `backend/swp/store/login_attempts.py`, `backend/swp/app/auth/__init__.py` -- `reserve` before bcrypt -- AC 3
- [x] `backend/tests/app/test_fr40_login_throttle.py` -- `test_fr40_concurrent_failed_logins_check_at_most_five_passwords`: 10 threads + Barrier, count bcrypt calls with a spy that wraps the real check. It runs on SQLite locally and on Postgres in CI (tests/app). Adjust the existing tests whose row expectations change.
- [x] `backend/swp/store/category_seed.py`, `backend/swp/app/categories.py`, `backend/swp/app/bootstrap.py`, `backend/swp/app/auth/__init__.py`, `backend/swp/store/users.py` -- emptiness check first, busy retry/log, docstring, demo seed busy-safe -- AC 4
- [x] `backend/tests/app/test_fr47_starter_categories.py` -- `test_fr47_seed_skips_toml_when_tables_not_empty` (missing path), `test_fr47_seed_retries_busy_then_logs_cause`, demo seed busy test
- [x] frontend `session-expiry.ts`, `query-errors.ts`, `providers.tsx`, `commands/client.ts`, `modules/auth/*` -- same-user vs other-user resume -- AC 5
- [x] `frontend/tests/session-expiry.test.ts`, `frontend/tests/auth.test.tsx` -- `fr40_held_change_is_dropped_when_another_user_logs_in`, `fr40_same_user_still_saves_held_change`, unknown user → drop
- [x] `frontend/e2e/session-expiry.spec.ts` -- `uj3 fr40 a change held after the session expired is dropped when another user logs in`; change the Create-account test at line 90 to expect the drop

**Acceptance Criteria:**
- Given `VERCEL` set and `APP_ENV` unset or `local`, when the backend starts, then it refuses with one `Refusing to start: …` line, and a test covers both cases.
- Given an invalid setting, when the backend or `swp db upgrade` starts, then one line names the setting and why, never its value, and no pydantic traceback is printed.
- Given one username, when many failed logins arrive at once, then at most 5 password checks run before the lock, tested concurrently (SQLite locally; Postgres in CI's tests/app job and locally in a docker postgres:17 run).
- Given the starter seed, when it runs at startup or in `swp db upgrade`, then the TOML is read only after both tables are found empty, a locked SQLite database does not crash startup, and the bootstrap docstring states the behaviour.
- Given a held change after session expiry, when a different user logs in, then it is dropped with a message; when the same user logs in, it is still saved.

## Implementation Notes

- `login_attempts.get` and `record_failure` are gone; `reserve` replaces both. `seed_demo_account` uses a new `users.insert_seed_user` (raises `UsersBusy`) so signup's `insert_user` is unchanged.
- `config._demo_password_can_log_in` no longer prefixes `DEMO_PASSWORD:`; startup adds the field name from the error `loc`. `tests/test_config.py` asserts the `loc` instead of the old prefix.
- Signup passes `afterLoginHref(null)`, so Create account always drops the held change (decision 2026-11-25), even if a deleted user's name is reused.
- Not run by the build agent: `npm run e2e` (the orchestrating session runs the gate per AGENTS.md).
- Orchestrator, e2e gate run 1: 451 passed, 2 failed, 3 skipped (the Epic 16 deployment placeholder in each browser). Both failures were `e2e/support/test.ts` getting 429 `login_locked`: on a fresh database every worker logged in before the e2e account existed, and with attempts counted first the 6th concurrent 401 for `e2eplanner` hit the lock, as intended. Fix: the helper signs up first (sign-up has no throttle) and logs in only when sign-up is refused; a 404 from sign-up means auth is off. Side effect worth knowing: 6 or more *correct* concurrent logins for one account in the same instant now briefly get `login_locked` until the first one clears the row.
- Orchestrator, e2e gate run 2: 452 passed, 1 failed (chromium `recommendations-page.spec.ts:25`, the Alt+A toast). Pre-existing flake: 2/20 failures on the baseline commit in a clean worktree, 3/20 with this change. Cause: Alt+A is ignored while the preceding Keep going command is still saving (`savingReason`). Test fix: wait for the selected recommendation's Apply button to be enabled before pressing Alt+A; 30/30 green after.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence / route |
|---|--------|---------|---------|------------------|
| 1 | verification-gap | `tables_empty` busy branch never exercised | medium | Pre-verified gap; every busy test patches `_seed_if_empty`. Patch: add test. |
| 2 | verification-gap | CLI tests can't detect `configure_logging()` removed | medium | Pre-verified gap; caplog captures regardless, `swp` handler leaks from earlier tests. Patch: clear handlers, assert stdout. |
| 3 | verification-gap (other) | `test_fr47_real_lock_held_skips_the_seed` sleeps for real (~10 s on Postgres) | low | Real; trivial direct correction. Patch: pass a no-op `sleep`. |
| 4 | blind + edge | Concurrent *correct* logins for one name can get `login_locked` | low (product) / medium (e2e helper) | Real, inherent in the frozen "count before verify" intent; production impact needs ≥5 simultaneous logins of one account, cleared by the first success. Product side rejected as low; noted in Implementation Notes. E2e helper on a reused server: patch (retry on 429). |
| 5 | blind | `login()` docstring and AD-18 (spine :301) still describe counting failures | low | Real doc drift caused by the change; one-sentence fix. Patch. |
| 6 | edge | `reserve` busy `OperationalError` → 500 on every login | medium (unverified likelihood) | Real mapping gap, but pre-existing for the failure write (spine :130 lists login-throttle writes as not mapped to 503); now on every login. Transactions are tiny, so contention is unlikely. Defer. |
| 7 | edge + blind | `username_key_taken` read in demo seed not busy-safe | low | Under WAL a plain read is not blocked by a writer; Postgres reads ignore row locks. Unlikely, and the fix adds a guard. Reject. |
| 8 | edge + blind | Cached user already null at first 401 → same user dropped with "different user" toast | low | The first `expire` reads the cache before `providers.tsx` nulls it, and a GET 401 records the user too; only a session refetch that already saw logout reaches this, and then the auth guard has left the page. Reject. |
| 9 | edge | Usernames compared with `===`, case may differ | false | Both values are the server's stored username (`SessionOut.user`, `LoginResponse.user`), never the typed one. |
| 10 | edge + blind | CLI refusal moved from stderr to stdout | low | Real; the spec chose `configure_logging()` (stdout handler), Vercel/CI show both streams, exit code 2 unchanged. Reject. |
| 11 | blind | A `ValidationError` hides the other startup problems | low | Real: without valid `Settings` the other rules can't be evaluated; the operator fixes the value and restarts. Fix needs partial settings construction. Reject. |
| 12 | blind | `void` verdict counts as same user (fail-open) | low | Only test doubles return `void`; the one production effect (`providers.tsx`) always returns a verdict. The spec chose this. Reject. |
| 13 | blind | Several held commands → duplicate toasts | low | One command is pending per plan and only one plan page is open at a time; not reachable in normal use. Reject. |
| 14 | blind | Demo-after-expiry drop not behaviour-tested | low | Demo goes through the same `afterLoginHref(user)` → `restore` path, which is unit-tested; `navigate` receiving `"demo"` is tested. Reject. |
| 15 | blind | Attempt counted even when a later exception aborts the check | low | Real but needs an outage mid-login; at worst one extra counted attempt. Reject. |
| 16 | blind | Alt+A silently ignored while saving (UX) | medium | Pre-existing behaviour surfaced by the flaky-test fix. Defer. |
| 17 | blind | Unreachable `return False  # not reached` | low | Harmless, kept for the type checker's return path. Reject. |
| 18 | blind | Diff leaves out the staged story files | false | By design: the review diff covers `backend`, `frontend` and `README.md` only. |

## Design Notes

Counting before checking: `reserve` increments with `after_failure` under the row lock. The 5th reservation sets the lock, so a 6th concurrent request sees `login_locked` without bcrypt. A successful check then clears the row, so a right password on the 5th try still logs in. The cost is that every login briefly writes a row, which is acceptable.

The "other user" decision is made on the client because the server cannot tell a held command from a new one. The username comparison is exact: both values come from the server's stored username.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports && npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: all pass
- `docker run -d --rm -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swp_test postgres:17` then `SWP_EXPECT_DIALECT=postgresql uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5433/swp_test` -- expected: all pass
- `npm run trace` -- expected: passes
- `npm run e2e` -- expected: chromium, firefox and msedge with 0 failed, 0 flaky, 0 skipped beyond the known Epic 16 placeholders
