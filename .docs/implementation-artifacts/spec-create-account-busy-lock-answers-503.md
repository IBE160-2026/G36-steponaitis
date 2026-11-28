---
title: 'Create account answers 503 on a busy database lock'
type: 'bugfix'
created: '2026-11-28'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/auth/signup` answers 500 when another writer holds the database lock: `insert_user` (`backend/swp/store/users.py`) catches only `IntegrityError` and runs in `transaction()`, so a busy lock is not mapped to `unavailable` (503) the way Log in, Demo version and the seed are (deferred from `spec-epic-16-retro-followups.md`).

**Approach:** The user insert runs in `write_transaction` and raises `UsersBusy` on a busy lock; Create account answers `unavailable` (503) with "Create account is busy. Try again." and sets no cookie. The route declares 503, `frontend/lib/api/schema.ts` is regenerated, and `test_fr39_…` tests cover it.

</frozen-after-approval>

## Implementation Notes

- `backend/swp/store/users.py`: the raw insert is the private `_insert`, now in `write_transaction` (BEGIN IMMEDIATE on SQLite, the 3 s `lock_timeout` on Postgres). The public `insert_user` maps a busy lock to `UsersBusy`, as `login_attempts.reserve` does. `insert_seed_user` is removed: it did the same mapping, so the `demo` seed now calls `insert_user`. This supersedes `spec-16-0-production-hardening-before-going-public.md:88`, which kept signup's `insert_user` unchanged.
- `backend/swp/app/auth/__init__.py`: `signup` answers `unavailable` with `SIGNUP_BUSY` ("Create account is busy. Try again."), worded like `LOGIN_BUSY`. No cookie is set and no account is stored. No frontend source change: the form already shows any other error's message once (`fr39_other_errors_are_one_form_message`).
- `backend/swp/api/routers/auth.py` declares 503 on `/signup`; `frontend/lib/api/schema.ts` is regenerated with `npm run gen:api`.
- Tests: `test_fr39_busy_insert_answers_unavailable_without_cookie` (both driver causes), `test_fr39_other_operational_error_still_raises`, `test_fr39_user_insert_runs_in_a_write_transaction`, `test_fr39_real_write_lock_is_unavailable`, `test_fr39_signup_route_declares_503`, and `test_fr50_demo_with_real_write_lock_on_users_answers_unavailable` for the seed path. The held-lock helper moved from `test_fr40_login_throttle.py` to `backend/tests/conftest.py` as `table_write_locked(table)`, with `LockNotAvailable` and `BUSY_CAUSES`. Three `test_fr50_…` tests now patch `user_store._insert`.
- `ARCHITECTURE-SPINE.md` (AD-6 service text and AD-18 "As built, decided 2026-11-28") names Create account and the `demo` seed among the `write_transaction` writes that answer 503.
- Known limit, unchanged: only the insert is bounded. The reads before it (`count_accounts`, `username_key_taken`) run in a plain `transaction()` with no `lock_timeout`, as the reads of Log in do; a Postgres lock that blocks reads (a migration's `ACCESS EXCLUSIVE`) still waits. On SQLite the insert waits the driver's 5 s before the 503.
- Verification on SQLite: `npm run test:py` 1249 passed, 2 skipped before the review patches, then the four auth test files 133 passed after them; `npm run lint:py`, `ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run test:web` (796 passed) and `npm run trace` are clean; `npm run e2e -- --project=chromium` 152 passed. The Postgres branches of the held-lock tests run only in CI.

## Review Triage Log

- Spec unfinished while `deferred-work.md` says resolved — false: the review ran before the spec was finalized; the notes above and `status: 'done'` close it. A one-shot spec has only Intent and Implementation Notes by the workflow's rule.
- Spec does not record that the `demo` seed changed — low, patched: recorded in the first note, with the superseded line of the 16.0 spec.
- No real-lock test for the seed path — medium, patched: `test_fr50_demo_with_real_write_lock_on_users_answers_unavailable`.
- The real-lock test cannot catch a revert to `transaction()` — low, patched: `test_fr39_user_insert_runs_in_a_write_transaction` spies on `write_transaction`, as `test_fr40_clear_runs_in_a_write_transaction` does.
- `table_write_locked` leaves pooled connections with the 50 ms busy timeout — low, patched: the SQLite branch disposes the engine in `finally`. The f-string table name and the whole-file lock on SQLite — false: test-only code with constant callers, and the docstring states the SQLite behaviour.
- `_LockNotAvailable` and the cause list duplicated in two test files — low, patched: `LockNotAvailable` and `BUSY_CAUSES` are shared from `conftest.py`. The two 503-declaration tests stay separate so each carries its FR id for `npm run trace` — rejected.
- A busy Create account leaves no log line — low, rejected: no `unavailable` path logs (Log in while counting, commands, Delete, categories); a warning only here would be inconsistent, and logging every 503 is a separate change.
- Only the insert is covered, not the reads — low, rejected as a fix, recorded as a known limit above: the same holds for every other route, and only a migration takes a lock that blocks reads.
- Planning documents partly updated (`ARCHITECTURE-SPINE.md:224` "the client retries", no busy texts in `EXPERIENCE.md` or `epics.md`, no signup-specific 503 frontend test) — low, rejected: the wording and the missing busy texts predate this change and apply to Log in equally; the generic form-message test covers a 503.
