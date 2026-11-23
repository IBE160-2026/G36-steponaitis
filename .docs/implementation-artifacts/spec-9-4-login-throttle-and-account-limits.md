---
title: 'Story 9.4: Login throttle and account limits'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '8ddcc56c98be62749e7722610cbef890eb3e3a44'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `POST /api/auth/login` can be guessed against without limit, and on the public demo anyone can create unlimited accounts and plans, so one person can fill the database (FR-39, FR-40, AD-18, UX-DR53, UX-DR55).

**Approach:** A new expand-only migration adds `login_attempts`; `swp.app.auth.login` counts failures per casefolded submitted username (pure rules in `swp.domain.accounts`) and answers `login_locked` 429 for 60 s after 5 failures. With `FEATURE_DEMO` on, `swp.app.limits` refuses a sign-up beyond `MAX_ACCOUNTS` and a New Plan beyond `MAX_PLANS` with `limit_reached` 409. The existing Log in, Create account and New Plan pages already show a server message for any other error code; the story pins that with tests.

## Boundaries & Constraints

**Always:**
- Migration `backend/swp/store/migrations/versions/0003_login_attempts.py` (revision `0003`, down `0002`) creates only `login_attempts`: `username_key` String primary key, `failures` Integer not null, `locked_until` `UtcDateTime` nullable. No existing table or JSON changes. Model `LoginAttemptRow` in `swp/store/models.py`.
- Domain (`swp/domain/accounts.py`, pure, no clock): `LOGIN_MAX_FAILURES = 5`, `LOGIN_LOCK = timedelta(seconds=60)`, `LOGIN_LOCKED = "Too many failed logins for this username. Wait a minute and try again."`, a frozen `LoginAttempts(failures: int, locked_until: datetime | None)`, `is_locked(attempts | None, now) -> bool` (`locked_until is not None and now < locked_until`), `after_failure(attempts | None, now) -> LoginAttempts`: a missing record or one whose lock has passed starts from 0; failures + 1; at `>= LOGIN_MAX_FAILURES` set `locked_until = now + LOGIN_LOCK`, else keep None.
- Store (`swp/store/login_attempts.py`): `get(key) -> LoginAttempts | None`, `record_failure(key, now) -> LoginAttempts` (read the row `with_for_update()`, apply `after_failure`, upsert in one transaction; on `IntegrityError` from a concurrent first insert, retry once), `clear(key)` (delete the row).
- `auth.login(username, password, *, now)` order: (1) malformed username or password → `unauthenticated` WRONG_LOGIN, nothing recorded (the key never reaches the database, as in 9.2); (2) `is_locked(get(key), now)` → `DomainError("login_locked", LOGIN_LOCKED)` with no bcrypt and no new failure recorded; (3) unknown user or wrong password → `record_failure(key, now)`, then WRONG_LOGIN; (4) success → `clear(key)`, then the token. Every failure counts the same whether or not the account exists. The router keeps passing `datetime.now(UTC)`; tests call `auth.login(..., now=...)` with chosen times and never sleep.
- Settings (`swp/config.py`): `max_plans: PositiveInt = 50`, `max_accounts: PositiveInt = 200` (env `MAX_PLANS`, `MAX_ACCOUNTS`). `swp/app/limits.py` reads them and owns `ensure_account_room()` and `ensure_plan_room()`, both no-ops unless `feature_demo` is on.
- `ensure_account_room()`: when the number of users other than `username_key == "demo"` is `>= max_accounts`, raise `DomainError("limit_reached", "The demo has reached its account limit. Use Demo version instead.", [{"limit": "max_accounts"}])`. `auth.signup` calls it first, before field checks and bcrypt.
- `ensure_plan_room()`: when the number of plans is `>= max_plans`, raise `DomainError("limit_reached", f"The demo holds at most {max_plans:,} plans. Delete a plan to make room.", [{"limit": "max_plans"}])`. `swp.app.plans` exposes it; `create_plan` in `swp/api/routers/plans.py` calls it first (before name, file or import checks, and before any file is read), for both upload and reuse.
- HTTP status (`swp/api/errors.py`, the only status mapper): `limit_reached` whose details hold `limit` in `{"max_plans", "max_accounts"}` → 409; every other `limit_reached` stays 413. `error_responses` on `/auth/login` adds 429; `/auth/signup` and `POST /plans` add 409. Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- `tests/app/conftest.py` `empty_tables` also deletes `login_attempts`; the migration table-set assertions in `tests/app/test_create_plan.py` and `tests/test_cli.py` include `login_attempts`.
- Frontend: Log in shows `login_locked` through the existing `failed` outcome (one alert with the server message, both fields kept); Create account and New Plan show `limit_reached` through their existing form alert / message panel. No new copy in the frontend.
- Every test names its FR/NFR; new e2e tests import `test`/`expect` from `frontend/e2e/support/test.ts` and name the journey.

**Never:** no IP-based limiting; no throttle on sign-up; no Demo version endpoint, button or seed (9.5); no front page (9.6); no production secret checks (9.7); no change with `FEATURE_DEMO` off to signup or plan creation, and no limit change with auth off; no `FEATURE_DEMO` in the Playwright server env (e2e creates far more than 50 plans); no fix for retro item epic-6 "take now after the files are parsed in POST /api/plans" (left open); no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 5th failure | 4 recorded failures for `kari7`, wrong password at t | 401 WRONG_LOGIN; row failures 5, locked_until t+60 s | — |
| Locked | after the 5th failure, login with the right password at t+59 s | 429 `login_locked` LOGIN_LOCKED; failures unchanged | — |
| Lock passed | correct password at t+60 s | 200, row deleted | — |
| Failure after lock | wrong password at t+61 s | 401; failures 1, not locked | — |
| Unknown name | 5 failures for `ghost` (no account), 6th at t+1 s | 6th → 429 | — |
| Casefold | failures as `KARI7`, then `kari7` | same counter | — |
| Malformed | `"ola n"` / empty password | 401, no row written | — |
| Success resets | 3 failures, then success | row deleted; next failure gives failures 1 | — |
| Account limit | demo on, max_accounts 2, users `a`, `b` (+ `demo` row) | signup 409 `limit_reached` account copy, no user added | demo off → 201 |
| Plan limit | demo on, max_plans 1, one plan | POST /plans (upload or reuse) 409 plans copy "at most 1 plans…" | demo off → 201 |
| Upload too big | over MAX_UPLOAD_BYTES | still 413 `limit_reached` | — |

</intent-contract>

## Code Map

- `backend/swp/app/auth/__init__.py` -- `login()` (format check, `store.get_user_by_key`, `_dummy_hash`, WRONG_LOGIN), `signup()`; add throttle and account-room calls.
- `backend/swp/domain/accounts.py` -- pure account rules; add throttle constants, `LoginAttempts`, `is_locked`, `after_failure`. Domain ruff bans clock/uuid4 (`swp/domain/ruff.toml`).
- `backend/swp/store/users.py` -- `transaction()` + `IntegrityError` pattern to copy; add `count_accounts()` excluding `demo`. `backend/swp/store/plans.py` -- add `count_plans()`. `backend/swp/store/models.py:49` -- `UserRow` pattern for `LoginAttemptRow`. `backend/swp/store/migrations/versions/0002_users.py` -- migration pattern (UtcDateTime from `swp.store.types`).
- `backend/swp/app/limits.py` -- the single place limits are read; `upload_too_large` pattern.
- `backend/swp/config.py` -- `Settings` (`feature_demo`, `max_upload_bytes`).
- `backend/swp/api/errors.py:20-33` -- `STATUS_BY_CODE` (`limit_reached: 413`, `login_locked: 429`), `error_response`.
- `backend/swp/api/routers/auth.py` -- `signup`/`login` routes and `error_responses`. `backend/swp/api/routers/plans.py:39-80` -- `create_plan` (reuse branch and upload branch).
- `backend/tests/app/conftest.py` -- `empty_tables`; `backend/tests/app/test_login.py` -- `auth_on`, `client`, `account`, `_login`, `SAME_ORIGIN`, `NOW`; `backend/tests/app/test_signup.py` -- `_signup`, migration column test pattern; `backend/tests/app/test_create_plan.py:58-62` -- table-set test, `_multipart`, `_small_files`; `backend/tests/app/test_reuse_import.py` -- `_reuse`; `backend/tests/test_cli.py:15,23` -- table set and OpenAPI status set; `backend/tests/api/test_api_errors.py:150-210` -- 413 tests.
- `frontend/modules/auth/api.ts` -- `runLogin` (`unauthenticated` → wrong-login, else failed), `runSignup` (non-field error → failed). `frontend/modules/auth/login-page.tsx` -- `afterFailedLogin` keeps fields on `failed`. `frontend/modules/new-plan/selection.ts:142` -- `errorView` (any other code → message panel).
- `frontend/tests/auth.test.tsx`, `frontend/tests/new-plan.test.tsx` -- Vitest patterns. `frontend/e2e/login.spec.ts`, `frontend/e2e/signup.spec.ts`, `frontend/e2e/new-plan.spec.ts` -- journeys to extend.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/accounts.py` -- throttle rules -- AD-18.
- `backend/swp/store/models.py`, `backend/swp/store/migrations/versions/0003_login_attempts.py`, `backend/swp/store/login_attempts.py` (new), `backend/swp/store/users.py`, `backend/swp/store/plans.py` -- table, attempts store, counts.
- `backend/swp/config.py`, `backend/swp/app/limits.py` -- `MAX_PLANS`, `MAX_ACCOUNTS`, `ensure_*_room`.
- `backend/swp/app/auth/__init__.py`, `backend/swp/app/plans.py` -- throttle in `login`, account room in `signup`, `ensure_plan_room` export.
- `backend/swp/api/errors.py`, `backend/swp/api/routers/auth.py`, `backend/swp/api/routers/plans.py` -- 409 mapping, OpenAPI statuses, plan room check first.
- `backend/tests/app/conftest.py`, `backend/tests/app/test_create_plan.py`, `backend/tests/test_cli.py` -- table sets and cleanup.
- `backend/tests/domain/test_fr40_login_attempts.py` (new) -- `is_locked`/`after_failure` matrix rows.
- `backend/tests/app/test_fr40_login_throttle.py` (new, SQLite and Postgres) -- migration columns; every throttle matrix row through `auth.login(now=...)`; one HTTP test: 5 wrong `/api/auth/login` then the 6th is 429 with the envelope `{code: "login_locked", message: LOGIN_LOCKED, details: []}` and no cookie.
- `backend/tests/app/test_fr39_limits.py` (new, SQLite and Postgres) -- account limit (demo user not counted, demo off unlimited), plan limit on upload and reuse (409, copy, nothing written, demo off unlimited), upload-size 413 unchanged.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/tests/auth.test.tsx`, `frontend/tests/new-plan.test.tsx` -- Vitest: `runLogin` on `login_locked` → `failed` with the message and `afterFailedLogin` keeps both fields; `runSignup` on `limit_reached` → `failed` with the message; `errorView` on a 409 `limit_reached` → message panel.
- `frontend/e2e/login.spec.ts` -- `fr40 uj3 five wrong logins lock the username for a minute` (logged-out, a fresh unique username with no account: 5 wrong submits show the wrong-login alert, the 6th shows the lockout copy; a different username still gets the wrong-login alert).
- `frontend/e2e/signup.spec.ts`, `frontend/e2e/new-plan.spec.ts` -- `fr39 uj5 a full demo refuses a new account` / `fr39 uj1 a full demo refuses a new plan`: `page.route` answers the POST with the real 409 envelope and copy; the page shows that copy (the e2e server runs with `FEATURE_DEMO` off).

**Acceptance Criteria:**
- Given 5 failed logins for one casefolded username, whether or not the account exists, when another login for that name arrives within 60 s, then it returns 429 `login_locked` with "Too many failed logins for this username. Wait a minute and try again." and the Log in page shows that text; after 60 s a successful login works and resets the count.
- Given `FEATURE_DEMO` on, when an account would exceed `MAX_ACCOUNTS` or a New Plan would exceed `MAX_PLANS`, then the request returns 409 `limit_reached` with the AD-18 copy and Create account / New Plan show it; with `FEATURE_DEMO` off neither limit applies.
- Given the full suites, when they run, then pytest (SQLite and Postgres 17), Vitest and Playwright chromium pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 36 findings — high 0, medium 0, low 26, false 10, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind: parallel login requests all pass `is_locked` before the 5th failure commits, so a burst gets more than 5 guesses per window — real, but accounts hold nothing private (plans are shared by every logged-in user), guesses stay CPU-bound by bcrypt, and AD-18 defers stronger limiting; the fix (reserving an attempt before bcrypt) reorders the contract's login steps, more than a direct correction.
  - `[low]` `[reject]` Blind: `login_attempts` grows without bound for random unknown usernames — real; needs a sustained scripted attack (one bcrypt per row) on a synthetic demo; bounding it needs a time column or purge policy the AC's three columns do not have; recorded as a residual risk.
  - `[low]` `[reject]` Blind: five wrong guesses a minute keep a known username locked; claim that this blocks the whole public demo — per-username lockout is AD-18's chosen design (no IP limiting); Demo version bypasses the throttle (9.5), so the demo is not blocked.
  - `[low]` `[reject]` Blind: 429 has no `Retry-After` or lock time — the copy is fixed by UX-DR53 ("Wait a minute"); no client reads it; adds surface.
  - `[false]` `[reject]` Blind: comment "before any file is read" is wrong because FastAPI spools the body — the comment says the check runs before any name, file or import check reads anything, which is true; spooling up to MAX_UPLOAD_BYTES happens for every request regardless.
  - `[low]` `[reject]` Blind: `max_plans`/`max_accounts` strings duplicated in `limits.py` and `errors.py` — `test_fr39_limits` pins 409 with the exact details for both, so a divergence fails tests; sharing constants across layers adds surface for no named caller.
  - `[false]` `[reject]` Blind: a real user signing up as "Demo" is not counted before 9.5 — `demo` is in `RESERVED_USERNAMES` (casefold), so no user can sign up as Demo.
  - `[low]` `[reject]` Blind: "at most 1 plans" with MAX_PLANS=1 — only for a test-only config; default is 50 and the copy is fixed by the epic; a singular branch adds complexity.
  - `[low]` `[patch]` Blind: nothing proves a locked login skips bcrypt — patched: `test_fr40_locked_login_skips_bcrypt` spies `checkpw` and asserts no call and an unchanged row.
  - `[false]` `[reject]` Blind: nothing proves signup checks the account limit before bcrypt — `test_fr39_account_limit_checked_before_fields` shows the limit wins over field errors, and bcrypt runs only after field checks.
  - `[low]` `[patch]` Blind: `IntegrityError` retry in `record_failure` never runs — patched together with the verification-gap row: `test_fr40_record_failure_retries_once_after_integrity_error`.
  - `[false]` `[reject]` Blind: nothing proves a 429 leaves `failures` unchanged — `test_fr40_locked_username_refuses_right_password` asserts the row stays `(5, T+60s)` after locked attempts through the same `auth.login` the route calls.
  - `[low]` `[patch]` Blind: loop variable `minutes` used as hours — patched: renamed to `hours`.
  - `[low]` `[patch]` Blind: inline imports in `test_fr39_plan_limit_message_groups_thousands` — patched: moved to the module top.
  - `[low]` `[reject]` Blind: throttle tests redefine `SAME_ORIGIN`/`auth_on`/`client` instead of importing them from `test_login.py` — test-only duplication matching 9.1–9.3 test files; importing fixtures across modules trips ruff redefinition rules.
  - `[false]` `[reject]` Blind: e2e "another username is not locked" step does not wait on the response — `expect(alert).toHaveText(WRONG_LOGIN)` waits for the alert to change from the lockout text, which only happens after the new answer.
  - `[low]` `[reject]` Blind: `swp.app.plans` re-exports `ensure_plan_room` — the spec places it there ("`swp.app.plans` exposes it"); no caller diverges.
  - `[low]` `[patch]` Verification gap: defaults 50/200 not pinned — patched: `test_fr39_demo_limit_defaults` and `test_fr39_max_plans_must_be_positive` in `tests/test_config.py`.
  - `[low]` `[patch]` Verification gap: `record_failure` retry after a concurrent first insert untested — patched: the retry test asserts failures 2, no lock, no error.
  - `[low]` `[reject]` Verification gap (other): a Postgres `lock_timeout` (55P03) inside `record_failure` surfaces as 500 — needs a row lock on one username held past the timeout; the lock is held for one small update; mapping it adds an error path.
  - `[low]` `[reject]` Edge: concurrent wrong logins pass `is_locked` together — same as the Blind parallel-login row.
  - `[low]` `[reject]` Edge: concurrent sign-ups exceed MAX_ACCOUNTS — the Design Notes accept a soft cap at the boundary; counting inside the insert transaction adds locking to every sign-up.
  - `[low]` `[reject]` Edge: concurrent New Plans exceed MAX_PLANS — same accepted soft cap.
  - `[low]` `[reject]` Edge: `login_attempts` grows without bound — same as the Blind growth row.
  - `[low]` `[reject]` Edge: second `IntegrityError` or 55P03 escapes as 500 — same as the verification-gap other row; a second IntegrityError cannot happen once the row exists.
  - `[low]` `[reject]` Edge: `clear()` racing a concurrent failure can wipe or keep a count — needs a success and a failure for one name at the same instant; either outcome is harmless.
  - `[low]` `[reject]` Edge (claim): MAX_ACCOUNTS exceeded under concurrency — same as the sign-up race row.
  - `[low]` `[reject]` Edge (claim): MAX_PLANS exceeded under concurrency — same as the plan race row.
  - `[low]` `[reject]` Edge (claim): more than 5 guesses per window via parallel requests — same as the parallel-login row.
  - `[false]` `[reject]` Intent: the throttle could be a sliding 60 s window — AD-18 says "After 5 failures, logins for that name are blocked for 60 s"; the 60 s is the lock, not a counting window.
  - `[false]` `[reject]` Intent: the clock is injected only below the router — the AC asks that `tests/app/test_fr40_login_throttle.py` runs without sleeping, which it does through `auth.login(now=)`; the HTTP test covers the 429 envelope.
  - `[low]` `[reject]` Intent: caps are not atomic across workers — same accepted soft cap.
  - `[false]` `[reject]` Intent: excluding key `demo` also excludes a user-created "Demo" — `demo` is reserved at sign-up.
  - `[low]` `[reject]` Intent: the pages show the 409 only with a mocked answer in e2e — the real 409 envelope is asserted by TestClient and the mock sends those exact bytes; turning `FEATURE_DEMO` on in e2e would cap the suite at 50 plans.
  - `[low]` `[reject]` Intent: `login_locked` keeps the password while a wrong login clears it — UX-DR53 only defines clearing for wrong details; keeping the fields is the existing `failed` path the spec names.
  - `[false]` `[reject]` Intent: retro item epic-1-3 (New Plan size pre-check) not acknowledged — the 413 path is unchanged (`test_fr39_upload_too_large_stays_413`); the item concerns the frontend pre-check rule, which this story does not touch.

## Design Notes

The 409/413 split for one code follows AD-11 (413 for upload size and rows, 409 for plans and accounts). The status is chosen in `swp.api.errors` from the `limit` detail, so the domain never knows HTTP and the frontend still branches only on `code`.

The counter has no time window: failures add up until a success or until a lock passes. A lock that has passed starts the count over, so a sixth wrong guess after the minute is an ordinary failure, and five more lock the name again. Limits are checked by count before insert; two concurrent requests at the boundary may both pass (accepted: AD-18 limits are a soft cap on a synthetic demo).

Retro items checked: epic-6 "take now after the files are parsed in POST /api/plans" touches `create_plan`; the plan-room check is added before any work and does not use `now`, so the item is neither fixed nor made harder and stays open. Earlier specs' deferrals naming 9.4 (9.1 signup rate limit, 9.2 login brute force) are closed by this story's account limit and login throttle.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:<port>/swp_test` against a local `postgres:17` container (removed afterwards) -- expected: all pass.
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: only the new statuses.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean.
- `npm run e2e -- --project=chromium` -- expected: all pass.

## Auto Run Result

Status: done

**Summary:** Login throttle and demo limits (FR-39, FR-40, AD-18, AD-11, UX-DR53, UX-DR55). Migration 0003 adds only `login_attempts` (`username_key` PK, `failures`, `locked_until`). `auth.login` refuses malformed input without recording, answers `login_locked` 429 ("Too many failed logins for this username. Wait a minute and try again.") without bcrypt while a name is locked, records every wrong or unknown login per casefolded name (5th failure locks for 60 s; a failure after the lock starts over), and clears the record on success. With `FEATURE_DEMO` on, sign-up beyond `MAX_ACCOUNTS` (200, `demo` not counted) and a New Plan (upload or reuse) beyond `MAX_PLANS` (50) answer `limit_reached` 409 with the AD-18 copy; the upload-size `limit_reached` stays 413. The existing Log in, Create account and New Plan pages show the server message; no frontend app code changed.

**Files changed:**
- `backend/swp/domain/accounts.py` -- throttle constants, `LoginAttempts`, `is_locked`, `after_failure`.
- `backend/swp/store/migrations/versions/0003_login_attempts.py`, `backend/swp/store/models.py` -- the table and `LoginAttemptRow`.
- `backend/swp/store/login_attempts.py` (new) -- `get`, `record_failure` (row lock, one retry), `clear`.
- `backend/swp/store/users.py`, `backend/swp/store/plans.py` -- `count_accounts`, `count_plans`.
- `backend/swp/config.py`, `backend/swp/app/limits.py` -- `MAX_PLANS`, `MAX_ACCOUNTS`, `ensure_account_room`, `ensure_plan_room`.
- `backend/swp/app/auth/__init__.py`, `backend/swp/app/plans.py` -- throttle in `login`, account room in `signup`, plan room export.
- `backend/swp/api/errors.py`, `backend/swp/api/routers/auth.py`, `backend/swp/api/routers/plans.py` -- 409 for count limits, OpenAPI 409/429, plan room checked first.
- `backend/tests/domain/test_fr40_login_attempts.py`, `backend/tests/app/test_fr40_login_throttle.py`, `backend/tests/app/test_fr39_limits.py` (new); `backend/tests/app/conftest.py`, `test_create_plan.py`, `backend/tests/test_cli.py`, `backend/tests/test_config.py` -- tests.
- `frontend/lib/api/schema.ts` -- regenerated (new statuses only).
- `frontend/tests/auth.test.tsx`, `frontend/tests/new-plan.test.tsx` -- Vitest for lockout and limit messages.
- `frontend/e2e/login.spec.ts`, `frontend/e2e/signup.spec.ts`, `frontend/e2e/new-plan.spec.ts` -- real lockout journey; full-demo journeys with a routed 409.

**Review findings:** 36 findings (high 0, medium 0, low 26, false 10). Patches applied: 6 rows (all low, test-only: bcrypt skipped while locked, `record_failure` retry, default limits, loop variable name, inline imports). Deferred: 0. Rejected: 30 -- see the Review Triage Log (parallel-burst guesses and unbounded `login_attempts` rows: real but negligible on a synthetic demo and needing a contract change; soft caps under concurrency: accepted in Design Notes; per-username lockout: AD-18 design, Demo version bypasses; Retry-After, singular copy, duplicated strings, fixture duplication, re-export: negligible or spec-mandated; 10 false).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 0, low 6.

**Verification:**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 844 passed, 2 skipped (after review patches).
- `pytest tests/app --database-url postgresql://...` on a local postgres:17 container (removed after) -- 262 passed, 3 skipped before the patches; 264 passed, 3 skipped after them.
- `npm run gen:api` -- schema.ts diff only the new 409/429 statuses.
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- clean, 437 passed.
- `npm run e2e -- --project=chromium` -- 97 passed (review patches touched backend tests only).

**Residual risks:** parallel bursts of login guesses can exceed 5 per lock window; `login_attempts` rows for never-used usernames are never purged; the account and plan caps are soft under concurrent requests; firefox and msedge e2e were not run; retro item epic-6 "take now after the files are parsed" stays open.
