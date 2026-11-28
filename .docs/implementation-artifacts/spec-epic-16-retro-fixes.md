---
title: 'Epic 16 retro fixes: busy login, Vercel database guard, live flag check, small fixes'
type: 'bugfix'
created: '2026-11-28'
status: 'done'
baseline_commit: '31f3ea26c7adb6115411ab7cd3ac72f74fa35e7a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/epic-16-retro-2026-11-28.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Epic 16 retrospective left four code action items on the live deployment: (1, F1/F2) a busy database lock during Log in or Demo version answers 500 instead of `unavailable` (503); (3, F5) production on Vercel accepts an empty or SQLite `DATABASE_URL`, and a custom SQLite path on a read-only disk raises a traceback; (4, F6) the daily keep-alive checks only `SELECT 1`, so a dropped `FEATURE_AUTH`/`FEATURE_DEMO` or a broken demo login stays green; (6, F8/F9/F10) an exported empty `E2E_DEMO_PASSWORD` breaks `e2e:production`, seed-skip warnings promise a "next start" that production never runs, and no test pins that the Vercel bundle keeps `settings/` and `swp/`.

**Approach:** One batch of small, separate fixes, each with a test named by its FR/NFR, plus the docs that describe the changed rules. Retro items 2, 5, 7 and 8 stay open.

## Boundaries & Constraints

**Always:** `swp.app` never imports SQLAlchemy: the store turns a busy `OperationalError` into its own exception (as `UsersBusy` does) and the app maps it to `DomainError("unavailable", …)`. Any other `OperationalError` still raises. Refusal lines never show a setting's value (NFR-6). `e2e:production` (SQLite, `APP_ENV=production`, no `VERCEL`) keeps starting. Name tests with their IDs.

**Never:** No change to how the throttle counts, locks or prunes (item 2), to the function region (item 5), to `epics.md` (item 7) or to older retro bookkeeping (item 8). No migration. No frontend source change beyond the Playwright config. Do not push, and do not run the keep-alive workflow on GitHub.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Busy count | `POST /api/auth/login`, the `login_attempts` write is busy (SQLite busy/locked, pg 55P03) | 503 `unavailable`, "Log in is busy. Try again.", no cookie | the form shows the message |
| Busy clear | right password, the clearing write is busy | 503 `unavailable`, same message, no cookie | same |
| Other DB error | `reserve` raises a non-busy `OperationalError` | raises as before (500) | N/A |
| Demo, busy seed | `POST /api/auth/demo`, no `demo` row, the seed insert is busy | 503 `unavailable`, "The demo account is busy. Try again." | the button shows the message |
| Empty URL | production, `DATABASE_URL=""` or blanks | refused with the existing "DATABASE_URL is not set…" line only | one ERROR line, no traceback |
| SQLite on Vercel | production, `VERCEL` set, `DATABASE_URL=sqlite:///…` | refused with one new line naming SQLite and Vercel | no traceback, also when the directory cannot be created |
| SQLite off Vercel | production, no `VERCEL`, SQLite file | starts | N/A |
| Empty e2e password | `E2E_DEMO_PASSWORD=""` exported | a random password is generated | N/A |

</frozen-after-approval>

## Code Map

- `backend/swp/store/login_attempts.py` -- add `LoginAttemptsBusy`; `reserve` and `clear` raise it when `is_busy(error)` (`store/db.py:82`). `clear` moves from `transaction()` to `write_transaction()` so Postgres applies the 3 s `lock_timeout` there too. Do not touch `_reserve`'s counting or `_prune_lock_passed`.
- `backend/swp/app/auth/__init__.py:123-146` `login` -- catch `LoginAttemptsBusy` around `reserve` and `clear`, raise `unavailable` with a new `LOGIN_BUSY`. `:176-188` `demo_login` -- a row still missing after the seed means the seed was busy: raise `unavailable` with `DEMO_BUSY`, and correct the false comment. `:149-173` seed docstring and warning -- new wording (below).
- `backend/swp/app/categories.py:295-326`, `backend/swp/app/bootstrap.py:1-8` -- same wording. The lifespan seeds only when `APP_ENV=local` (`api/app.py:40`), so the text names `swp db upgrade` first: "Run swp db upgrade again to add it; a local start also adds it" (demo: "… or Demo version").
- `backend/swp/app/startup.py:47-62` `startup_problems` -- in the production block: a blank `database_url` counts as unset (`DATABASE_URL_UNSET`); a set URL starting with `sqlite` while `environ["VERCEL"]` is set adds a new `SQLITE_ON_VERCEL`. A string check, no SQLAlchemy.
- `backend/swp/config.py:86-90` -- wrap the custom-SQLite `mkdir` in `suppress(OSError)` like the default branch.
- `.github/workflows/keep-alive.yml` -- `defaults.run.shell: bash` (pipefail); keep the health step; add a step piping `GET /api/session` to `jq --exit-status '.feature_auth == true and .feature_demo == true and .user == null'`, and a step `POST /api/auth/demo` with `Origin: <public URL>` piped to `jq --exit-status '.user == "demo"'`. Same curl retry flags.
- `frontend/playwright.production.config.ts:15` -- `??=` to `||=` (as `playwright.public.config.ts`).
- `backend/tests/test_deploy.py` -- new test: expand the `excludeFiles` brace list and assert with `fnmatch` that no file under `backend/settings/` or `backend/swp/` matches.
- Tests: `backend/tests/app/test_fr40_login_throttle.py`, `test_fr50_demo_account.py` (`:140-158` asserts the old warning), `test_fr47_starter_categories.py:207,234` (old warning), `test_nfr6_startup_checks.py` (`:203` `test_nfr6_vercel_with_production_app_env_starts` uses the fixture's SQLite file under `VERCEL`: change it to a Postgres URL checked with `startup_problems`, without starting the app).
- Docs: `README.md:95` (refusal list) and `:143` (keep-alive); `ARCHITECTURE-SPINE.md:131` (login-throttle writes answer `unavailable`), `:308`, `:421`; `deferred-work.md` first entry gets a `resolved:` line.

## Tasks & Acceptance

**Execution:**
- [x] `store/login_attempts.py`, `app/auth/__init__.py` + `test_fr40_*` (busy reserve, busy clear, other error) and `test_fr50_*` (busy seed on Demo version) -- item 1.
- [x] `app/startup.py`, `config.py` + three `test_nfr6_*` (blank URL, SQLite on Vercel, unwritable custom SQLite directory) and the changed `:203` test -- item 3.
- [x] `.github/workflows/keep-alive.yml` -- item 4; run the same curl and jq commands once by hand against the public URL.
- [x] `playwright.production.config.ts`, the three seed-skip texts with their tests, `test_deploy.py` -- item 6.
- [x] README, spine and `deferred-work.md` -- as built.

**Acceptance Criteria:**
- Given the I/O matrix, when the backend tests run, then every row except the last has a passing test named with its ID.
- Given `E2E_DEMO_PASSWORD=""` exported, when `npm run e2e:production` runs, then it starts and passes.
- Given the keep-alive commands run by hand against the public URL, then all three exit 0, and the session check exits non-zero on a JSON body with a flag false.
- Given the full gate (`npm test`, the lint commands, `npm run typecheck`, `npm run trace`, `npm run e2e` in three browsers), then all pass with 0 failed, 0 flaky, 0 skipped.

## Implementation Notes

- Item 1: `LoginAttemptsBusy` in `store/login_attempts.py`, raised by `reserve` and `clear`; `clear` runs through a private `_clear` in `write_transaction()`. `auth.login` answers `unavailable` with `LOGIN_BUSY`; `demo_login` answers `unavailable` with `DEMO_BUSY` when the row is missing after the seed. Tests inject the busy error (SQLite "database is locked" and a pg 55P03 stand-in); no test holds a real lock.
- Item 3: blank `DATABASE_URL` gets the existing `DATABASE_URL_UNSET` line; `SQLITE_ON_VERCEL` is new. `test_nfr6_vercel_with_production_app_env_starts` became `test_nfr6_vercel_with_production_app_env_and_postgres_passes_the_check` (it no longer starts the app).
- Item 4: `keep-alive.yml` has three steps and a workflow-level `PUBLIC_URL`. The steps were parsed from the YAML and run locally under `bash -eo pipefail` against the public URL on 2026-11-28: all exit 0; a body with `feature_demo` false exits 1 and a POST without `Origin` (403) exits non-zero.
- Item 6: `||=`; seed-skip texts name `swp db upgrade` first; `test_nfr5_vercel_bundle_keeps_settings_and_swp`.
- Docs: README refusal list (now 7 points) and keep-alive step; spine lines 131, 308, 421 and the mermaid label at 452 (not listed in the Code Map); `deferred-work.md` first entry resolved.
- Not done, by the spec's boundary: `POST /api/auth/login` and `/api/auth/demo` do not declare 503 in `error_responses(...)`, unlike the other busy-capable routes. Declaring it regenerates `frontend/lib/api/schema.ts`.
- Gate 2026-11-28: `npm test` 1227 passed, 2 skipped (the existing dialect-only tests) and 791 passed; ruff, ruff format, import-linter (5 kept), ESLint, tsc and trace clean; `npm run e2e` 453 passed, 0 failed, 0 flaky, 0 skipped in chromium, firefox and msedge; `E2E_DEMO_PASSWORD= npm run e2e:production` 3 passed.
- Review patches (pass 1, tests and workflow only): `test_fr40_busy_retry_after_integrity_error_answers_unavailable`; `test_fr40_real_write_lock_is_unavailable` (real lock on SQLite and Postgres, Log in 503 and `clear` raising `LoginAttemptsBusy`); the bundle test matches leading `**/`, bare directories, skips byte-code caches and refuses unexpanded braces; the VERCEL test calls `check_startup()`; `keep-alive.yml` prints the checked fields and has `timeout-minutes: 10`.
- Gate after the patches, 2026-11-28: `npm test` 1229 passed, 2 skipped and 791 passed; all lints, typecheck and trace clean; `pytest tests/app --database-url postgresql://…` on a local Postgres 17 container (as CI's `postgres` job) 449 passed, 3 skipped (the existing SQLite-only tests); the patched keep-alive steps run from the parsed YAML against the public URL exit 0. The e2e gates were not run again: the patches changed no file under `backend/swp/` or `frontend/`.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-11-28). Layers: blind (B), edge-case (E), verification-gap (V). Groups: G1 busy clear, G2 OpenAPI 503, G3 real lock, G4 bundle test, G5 VERCEL start test, G6 keep-alive.

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| B1 | blind | A busy `clear` refuses a login whose password was right; the 503 leaves the same count as giving the session would | low | reject (G1) | Real: `auth.login` raises `unavailable` after `checkpw` passed, and the row stays counted either way. It is the frozen matrix row "Busy clear" and retro action item 1, so the fix edits this spec. Five busy clears in a row are needed to lock a right password. Raised with the author at the presentation. |
| B2 | blind | No test holds a real lock on the throttle writes | medium | patch (G3) | Every other busy-capable write has one (`test_fr43_real_write_lock_is_unavailable` and others); here only injected errors. |
| B3 | blind | `demo_login` calls every missing row "busy", also after a silent `IntegrityError` | false | reject | An `IntegrityError` on `username_key` means a committed `demo` row exists, which the re-read finds; "insert returns False and no row" exists only under the mock in `test_fr50_concurrent_seed_integrity_error_is_success`. |
| B4 | blind | A busy Log in logs nothing | low | reject | True, and the same for `PLAN_BUSY`, `IMPORT_BUSY`, `RULES_BUSY` and `AISLES_BUSY`; the 503 shows in the request log. A new log line only here adds an inconsistency. |
| B5 | blind | The 503 is not declared in OpenAPI and tracked nowhere | low | defer (G2) | `routers/auth.py:67,91` list no 503; every other busy-capable route does. Declaring it regenerates `frontend/lib/api/schema.ts` (CI diffs it), which the frozen "no frontend source change" excludes. Entry added to `deferred-work.md`. |
| B6 | blind | The form and the button showing a 503 message are untested; spine says the client retries | false | reject | `runLogin`/`runDemo` show any non-`unauthenticated` error's message, pinned by `fr40_other_errors_keep_both_fields` and `fr50_demo_version_button_failure_toasts_and_re_enables`. The new spine sentence does not say the client retries. |
| B7 | blind | The `DATABASE_URL` guard is narrower than its wording (blank `MIGRATION_DATABASE_URL`, padded or upper-case URL off Vercel, `VERCEL=0`, blank URL when local, README:134 and `.env.example`) | low | reject | All true and all outside retro item 3 (blank or SQLite under `VERCEL`). `VERCEL` truthiness matches the existing `VERCEL_WITHOUT_APP_ENV` check; README:134 points to the list that now has both lines. Each fix adds a guard for a value nobody sets in everyday use. |
| B8 | blind | No test goes through `check_startup()` with `VERCEL` set and a passing configuration | low | patch (G5) | The changed test hands `startup_problems` a hand-built environ; `check_startup()` needs no database. |
| B9 | blind | `get_settings.cache_clear()` after the `with` blocks is not in a `finally` | low | reject | Only changes the teardown noise of a test that already failed; the same pattern is at `test_nfr6_invalid_setting_refuses_without_value`. |
| B10 | blind | The bundle test misses leading `**/`, lists `.pyc` files as shipped, expands only whole-string braces, ignores `.vercelignore` | medium | patch (G4) | `fnmatch("settings/analysis.toml", "**/settings/**")` is False, so the regression F10 names would pass. `.vercelignore`/`includeFiles` do not exist in the repo: not patched. |
| B11 | blind | A failed keep-alive step prints only `false`; POST retries a 403; job id still `health`; GitHub run not yet done | low | patch (G6) | Printing the fields is a direct change. Retrying a 403 costs 30 s on a failing run; the job id is not referenced anywhere: neither patched. The GitHub run needs a push: tracked as an open point, retro item 4 stays open until it is green. |
| B12 | blind | Bookkeeping (sprint-status, issues.md) and the spec are not in the diff; spine:305 has no pointer to the busy case | false | reject | The spec is the claims file and is kept out of the diff on purpose; the trackers are updated when the build is presented. Spine:131 carries the busy case. |
| E1 | edge | Five busy clears leave a right-password user locked for 60 s; retry the clear once | low | reject (G1) | Same root as B1. Needs five consecutive lock waits of 3 s; a retry adds a branch and up to 3 s more. |
| E2 | edge | Log in and Demo version routes do not list 503 | low | defer (G2) | As B5. |
| E3 | edge | A real `DATABASE_URL` with leading or trailing blanks passes the check and reaches the engine padded | low | reject | Pre-existing: the padded URL reached the engine before this change too. Not met in everyday use; stripping in the validator changes every URL path. |
| E4 | edge | On Vercel a URL that is neither SQLite nor Postgres still gives a traceback | low | reject | Pre-existing and outside retro item 3; a new problem line and URL parsing in `swp.app`. |
| E5 | edge | A blank `DATABASE_URL` with `APP_ENV=local` gives a traceback | low | reject | Pre-existing, local only, developer-facing; a new branch outside the production block. |
| E6 | edge | Off Vercel an unwritable custom SQLite directory now fails later with "unable to open database file" | low | reject | Real and caused by the `suppress(OSError)` the retro asked for; the same trade-off as retro F11 (deferred there, low). A directory check is a new guard. |
| E7 | edge | Three steps can take 450 s, longer than `timeout-minutes: 5` | low | patch (G6) | 4 tries x 30 s + 3 x 10 s = 150 s per step. One-number fix. |
| E8 | edge | `**/settings/**` is not caught by `fnmatch` | medium | patch (G4) | As B10. |
| E9 | edge | Nested braces are split into patterns that match nothing | low | patch (G4) | `{tests/**,s{ettings,wp}/**}` would pass; one assertion that no brace remains. |
| E10 | edge | `__pycache__` files count as shipped | low | patch (G4) | As B10. |
| E11 | edge | A non-empty but too short `E2E_DEMO_PASSWORD` still fails the start | false | reject | The backend refuses it with a line naming `DEMO_PASSWORD`: a loud failure on an invalid value the user chose is correct. The intent covers the empty value only. |
| E12 | edge | The `_starts()` with `VERCEL=1` was removed; no full start with `VERCEL` set | low | patch (G5) | As B8: `check_startup()` restores the real entry point. A Postgres-only full start test is not added (only `startup.py` reads `VERCEL`). |
| E13 | edge | Claim "each with a test named by its FR/NFR": no automated test reads `keep-alive.yml` or the `\|\|=` fallback | low | reject | True; both are checked by hand and recorded: the workflow's steps were run from the parsed YAML against the public URL, and `E2E_DEMO_PASSWORD= npm run e2e:production` passed. A test that greps a workflow file would pin text, not behaviour. |
| V1 | verification-gap | Busy lock on the retry after a lost first-insert race has no test | medium | patch (G3) | Filed as pre-verified: flattening the nested `try` in `reserve` brings back the 500 with a green suite. |
| V2 | verification-gap | No real-lock test; the Postgres `lock_timeout` on `clear` is checked only by a call spy | medium | patch (G3) | Filed as pre-verified; as B2. |
| V3 | verification-gap | `/api/auth/login` and `/api/auth/demo` do not declare 503 | low | defer (G2) | Filed with disposition defer; as B5. |
| V4 | verification-gap | The bundle test misses `**/`-prefixed and bare-directory patterns | medium | patch (G4) | Filed as pre-verified; as B10. |

## Design Notes

- A busy `clear` answers 503 instead of logging the user in with a stale count: the retro item says so, and a count that is never cleared would lock the next attempts. The counting model itself is item 2.
- The Demo version step is the optional half of retro item 4. It is included because Demo version is the examiners' guaranteed way in; it writes nothing when the `demo` row exists.
- The SQLite line fires only for a URL that was set: an unset URL under `VERCEL` keeps its single "not set" line (`test_nfr6_read_only_filesystem_still_refuses_unset_database_url`).

## Verification

The orchestrating session runs the two e2e commands and the by-hand keep-alive check against the public URL; a build sub-agent runs the others and starts no server on port 3000 or 8000.

**Commands:**
- `npm test` -- expected: pytest and Vitest pass
- `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run lint`, `npm run typecheck`, `npm run trace` -- expected: all clean
- `npm run e2e` -- expected: chromium, firefox and msedge pass, 0 failed, 0 flaky, 0 skipped
- `E2E_DEMO_PASSWORD= npm run e2e:production` -- expected: passes (port 3000 free)

**Manual checks (if no CLI):**
- After the author pushes: *Actions → Keep-alive → Run workflow* is green.
