---
title: 'Story 9.1: Create an account'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'c331904b2b5d1b9d06e1355a518b66d76a9bed99'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      With FEATURE_AUTH on and APP_ENV=production the backend still starts on the committed default JWT_SECRET, so session cookies could be forged.
    evidence: |-
      backend/swp/config.py sets jwt_secret = DEFAULT_JWT_SECRET; no startup check exists yet. The epic assigns the production refusal to Story 9.7 (AD-10).
    location: >-
      backend/swp/config.py
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The app has no accounts: every request acts as `planner`, and nobody can register under their own name (FR-39). Epic 9 starts with sign-up, which the later login, guard and demo stories build on.

**Approach:** Add the auth slice end to end: an expand-only `users` migration, pure username/password rules in the domain, a bcrypt + PyJWT service in `swp/app/auth`, `POST /api/auth/signup` (gated by `FEATURE_AUTH`) that sets the `swp_session` cookie, `GET /api/session` returning the cookie's user, and a `/signup` Create account page in `frontend/modules/auth`.

## Boundaries & Constraints

**Always:**
- Layers: `swp.domain.accounts` is pure (stdlib + pydantic); bcrypt and PyJWT are used only in `swp.app.auth`; SQLAlchemy only in `swp.store`; `swp.api` never imports `swp.store`. Add `bcrypt` and `jwt` to the `domain-pure` forbidden list and `swp.domain.accounts` to the `domain-slices` independence contract in `backend/.importlinter`.
- Dependencies exactly as pinned in the spine: `bcrypt==5.0.0`, `PyJWT==2.15.1` (added with `uv add --directory backend`, lockfile updated).
- Username rule (AD-10): 1–32 characters, `str.isalnum()`, unique by `casefold()`, stored as typed; `planner` and `demo` (by casefold) are reserved and rejected with the taken message. Password: 4–64 characters and at most 72 UTF-8 bytes; `password_repeat` must equal `password`.
- Errors use the AD-11 envelope: `validation_failed` (422) with `details` = one `{field, message}` per failing field in the order username, password, password_repeat; `message` = the first detail's message. The taken check runs only when the username's format is valid; a unique-constraint race also returns the taken message.
- Exact copy: "That username is taken. Try another." / "The passwords don’t match." (U+2019). Format messages: username empty "Enter a username."; over 32 "Use at most 32 letters and numbers."; non-alphanumeric "Use letters and numbers only."; password under 4 "Use at least 4 characters."; over 64 characters "Use at most 64 characters."; over 72 bytes "This password is too long. Use fewer special characters."
- Session: HS256 JWT, `sub` = user UUID string, `iat`, `exp` = now + 30 days, signed with `JWT_SECRET` (setting `jwt_secret`, a ≥32-byte local default). Cookie `swp_session`: httpOnly, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, `Secure` only when `APP_ENV=production`. `GET /api/session` decodes it and loads the user from the database each request; an invalid, expired or unknown-user token, or `FEATURE_AUTH` off, gives `user: null`.
- `FEATURE_AUTH` off: every `/api/auth/*` path (including unknown ones) returns `not_found` 404 envelope.
- Time and ids come from the caller (`now` passed from the router, `uuid.uuid4()` in app), never from the domain.
- Every test names FR-39 / NFR (SM-7). The e2e spec imports `test`/`expect` from `frontend/e2e/support/test.ts`.

**Never:** no email, roles, admin or password reset; no login/logout endpoint or page guard (Story 9.2); no change to `created_by`/`last_edited_by` (Story 9.3); no throttle or account limits (9.4); no demo seed (9.5); no production `JWT_SECRET` startup check (9.7); no change to existing tables or JSON documents; no deployment or external services; no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `{username:"Kari7", password:"secret", password_repeat:"secret"}`, flag on | 201 `{user:"Kari7"}`, row stored with bcrypt hash, `swp_session` cookie set; `GET /api/session` → `user:"Kari7"` | — |
| Casefold taken | `kari7` after `Kari7` exists | 422, username: "That username is taken. Try another." | no row added |
| Reserved | `Planner`, `DEMO` | 422 taken message on username | — |
| Bad format | `""`, 33 chars, `"ola nordmann"`, `"ola_n"` | 422 with the matching username message | — |
| Password limits | 3 chars; 65 chars; 25×"€" (25 chars, 75 bytes) | 422 password message; 64 chars of ASCII accepted; 24×"€" (72 bytes) accepted | — |
| Mismatch | repeat differs | 422 password_repeat: "The passwords don’t match." | — |
| Several errors | bad username and mismatch | details list both, username first | — |
| Flag off | any `/api/auth/*` | 404 `not_found` | — |
| Cross-site POST | `Sec-Fetch-Site: cross-site` | 403 `forbidden_origin`, no row | — |
| Bad cookie | tampered / expired JWT, deleted user | `GET /api/session` → `user: null` | no 500 |

</intent-contract>

## Code Map

- `backend/swp/store/migrations/versions/0001_imports_and_plans.py` -- pattern for `0002_users.py` (`down_revision="0001"`; `sa.Uuid`, `UtcDateTime`; unique constraint on `username_key`).
- `backend/swp/store/models.py` -- add `UserRow` (`users`: `id`, `username`, `username_key` unique, `password_hash`, `created_at`).
- `backend/swp/store/plans.py` / `db.py` -- `db.transaction()` pattern for the new `swp/store/users.py` (`insert_user` returning False on `IntegrityError`, `get_user(id)`, `username_key_taken(key)`).
- `backend/swp/app/plans.py:27` -- `DEFAULT_USER = "planner"` (unchanged here); `plan_name` shows how app raises `DomainError("validation_failed", …, [{field, message}])`.
- `backend/swp/api/routers/plans.py` -- router pattern, `error_responses`, `datetime.now(UTC)` taken in the router.
- `backend/swp/api/routers/session.py`, `api/schemas/session.py` -- `Session.user: str | None` already exists; fill it from the cookie.
- `backend/swp/api/app.py` -- mount the new auth router under `/api`.
- `backend/swp/api/errors.py` -- envelope; `NOT_FOUND` message for the flag-off case.
- `backend/swp/config.py` -- add `jwt_secret`.
- `backend/.importlinter`, `backend/pyproject.toml`, `backend/uv.lock` -- deps and contracts.
- `backend/tests/app/conftest.py` -- `empty_tables` must also delete `UserRow` (Postgres shares one DB).
- `backend/tests/app/test_create_plan.py:58` (`test_nfr12_migration_creates_exactly_imports_and_plans`) and `backend/tests/test_cli.py:15` -- table-set assertions to extend with `users`.
- `backend/tests/api/test_api_errors.py` -- `SAME_ORIGIN`, `_error` helpers; `test_fr11_session_*` keep passing (no cookie → `user: null`).
- `frontend/lib/api/session.ts` -- `useSession` (`["session"]` query, invalidate after signup); `lib/api/errors.ts` `parseErrorBody`/`ApiError`.
- `frontend/components/common/input.tsx` -- `Input` (`errorId` → `aria-invalid`) and `InputError`; `button.tsx` `Button`/`buttonClassName`.
- `frontend/modules/new-plan/new-plan-page.tsx:272` -- form pattern (labels above, `noValidate`, errors per field).
- `frontend/components/common/app-shell/toolbar.tsx` -- off plan paths it renders `<FlowBar />`; on auth pages it must render only the logo and name.
- `frontend/lib/view-state/urls.ts` -- add `SIGNUP_HREF="/signup"`, `LOGIN_HREF="/login"`, `isAuthPath(pathname)`.
- `frontend/playwright.config.ts` -- `webServer.env`; `frontend/e2e/support/warm-routes.ts` -- route list.
- `frontend/lib/api/schema.ts` -- regenerated by `npm run gen:api` (CI diffs it).

## Tasks & Acceptance

**Execution:**
- `backend/pyproject.toml`, `backend/uv.lock` -- add `bcrypt==5.0.0`, `PyJWT==2.15.1` -- spine stack.
- `backend/.importlinter` -- forbid `bcrypt`, `jwt` in domain; add `swp.domain.accounts` to slice independence -- layer rules.
- `backend/swp/domain/accounts.py` -- `RESERVED_USERNAMES`, `username_key()`, `signup_errors(username, password, password_repeat) -> list[FieldError]` with the copy above, `TAKEN` constant -- pure rules.
- `backend/swp/store/models.py`, `backend/swp/store/migrations/versions/0002_users.py`, `backend/swp/store/users.py` -- table, migration, persistence.
- `backend/swp/config.py` -- `jwt_secret: str` with a long local default.
- `backend/swp/app/auth/__init__.py` -- `signup(username, password, password_repeat, *, now) -> SignedUp(username, token)`, `session_user(token, *, now) -> str | None`, `SESSION_COOKIE`, `SESSION_DAYS`, `cookie_secure()`; bcrypt hash; JWT encode/decode (catch `jwt.InvalidTokenError`, bad UUID).
- `backend/swp/api/schemas/auth.py`, `backend/swp/api/routers/auth.py` -- `SignupRequest`, `SignupResponse{user}`; router with a dependency raising `not_found` when the flag is off, plus a catch-all `/auth/{path:path}` (all methods) returning `not_found`; 201 sets the cookie.
- `backend/swp/api/routers/session.py`, `backend/swp/api/app.py` -- read `swp_session` cookie; mount router.
- `backend/tests/domain/test_accounts.py`, `backend/tests/app/test_signup.py`, updates to `tests/app/conftest.py`, `tests/app/test_create_plan.py`, `tests/test_cli.py`, `tests/api/test_api_errors.py` -- every I/O row, the migration-only-adds-users check, hash never equals password and verifies with bcrypt, cookie attributes, flag-off 404s, cross-site 403.
- `frontend/lib/api/schema.ts` -- regenerate.
- `frontend/lib/view-state/urls.ts`, `frontend/components/common/app-shell/toolbar.tsx` -- auth paths show only logo and name.
- `frontend/modules/auth/signup-page.tsx`, `frontend/modules/auth/password-input.tsx`, `frontend/modules/auth/api.ts`, `frontend/app/signup/page.tsx` -- the page per UX-DR53; `notFound()` once the session says `feature_auth` is false.
- `frontend/tests/auth.test.tsx` -- Vitest: field errors render as `InputError` with `aria-invalid`, focus goes to the first failing field, success invalidates the session and navigates to `/plans`, Show toggles the password type.
- `frontend/playwright.config.ts` (`FEATURE_AUTH: "true"` in `webServer.env`), `frontend/e2e/support/warm-routes.ts` (`/signup`), `frontend/e2e/signup.spec.ts` -- UJ-5 journey.

**Acceptance Criteria:**
- Given the migrated database, when the tables are inspected, then exactly `alembic_version`, `imports`, `plans`, `users` exist, `imports`/`plans` columns are unchanged, and `users` has `id`, `username`, `username_key`, `password_hash`, `created_at` with `username_key` unique (SQLite and Postgres).
- Given `/signup` with the flag on, when it renders, then a 380px surface card under a header holding only the logo and name shows the title "Create account", Username with hint "Letters and numbers. Must not be taken.", Password with a Show link-button, Repeat password, a full-width primary "Create account" submit, and a "Log in" link to `/login`.
- Given a submit with errors, when the server rejects it, then each failing field shows its `InputError`, has `aria-invalid="true"`, and focus is on the first failing field; given a valid submit, then the saved-plans list (`/plans`) opens and `GET /api/session` returns the new username.
- Given CI, when `test_fr39_*` run, then they cover reserved names, casefold uniqueness, password byte limits and hash ≠ password on SQLite and (tests/app) Postgres.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 29 findings — high 0, medium 4, low 15, false 10, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind: signup has no rate limit; every valid call runs bcrypt and the taken reply enumerates usernames — account limits and throttling are Stories 9.4/9.5 per the epic, and the taken copy is required by the story AC.
  - `[medium]` `[defer]` Blind: production with `FEATURE_AUTH` on would run on the committed default `JWT_SECRET` — real, but the startup refusal is explicitly Story 9.7 in the epic; deferred to 9.7.
  - `[low]` `[reject]` Blind: usernames not NFKC-normalised, so fullwidth or lookalike names (incl. fullwidth `planner`) are separate accounts — AD-10 binds `isalnum` + `casefold`; changing the key rule is a design change, unlikely in everyday use of a course demo.
  - `[false]` `[reject]` Blind: NUL byte in password gives 500 — checked: bcrypt 5.0.0 `hashpw(b'ab\x00cd', ...)` hashes without error.
  - `[low]` `[patch]` Blind: no 422 test asserts that a rejected signup sets no cookie — patched: `"set-cookie" not in response.headers` added to taken, reserved, bad-username, password-limit and mismatch tests.
  - `[false]` `[reject]` Blind: signup while signed in replaces the cookie and keeps stale queries — creating an account logs in as it (intended); plans are shared across users, so cached plan queries are not identity-scoped.
  - `[low]` `[patch]` Blind: with auth off `/signup` shows the form until the session loads (and for good if it fails) — patched with the Edge finding below: nothing renders while the session is pending; `notFound()` when `feature_auth` is false.
  - `[low]` `[reject]` Blind: whole e2e suite now runs with `FEATURE_AUTH=true` — by design (Design Notes); no guard exists in 9.1, so flag-on changes nothing for other specs (85/85 passed), and flag-off API/session behaviour is covered by pytest.
  - `[low]` `[reject]` Blind: Log in link leads to 404 — required by the AC; `/login` arrives in Story 9.2 (Design Notes).
  - `[low]` `[reject]` Blind: `/signup` exports no page `metadata` title — no app page sets its own title (only `app/layout.tsx`); consistent with the app.
  - `[low]` `[reject]` Blind: DB columns do not enforce 32 characters — the app layer enforces it; schema-level limits would add complexity no other column uses.
  - `[low]` `[patch]` Blind: form-level error never clears while typing — patched: `onChange` now clears `formError`.
  - `[low]` `[patch]` Blind: e2e taken test posts to hard-coded `http://localhost:3000` — patched (with Edge below): uses the `request` fixture with a relative URL.
  - `[false]` `[reject]` Blind: production-cookie test will break when 9.7 adds the startup check — not a defect today; 9.7 owns adjusting tests for its check.
  - `[medium]` `[patch]` Edge: a lone-surrogate password makes `password.encode("utf-8")` raise, giving a 500 — reproduced; patched: `PASSWORD_INVALID` "Use letters, numbers and ordinary symbols only." with domain and HTTP 422 tests.
  - `[low]` `[reject]` Edge: fullwidth usernames bypass reserved names / create lookalikes — same as the Blind NFKC finding; rejected for the same reason.
  - `[false]` `[reject]` Edge: `isalnum` accepts superscripts and other-script characters — that is exactly the binding AD-10 rule (`str.isalnum`).
  - `[false]` `[reject]` Edge: cookie not Secure for `app_env` values other than `production` — the architecture defines only `local` and `production`; Secure in production is the specified rule.
  - `[low]` `[reject]` Edge: `GET /api/session` with a cookie returns 500 when the DB is down — every DB-backed endpoint behaves this way; the migration guarantees `users` exists.
  - `[low]` `[patch]` Edge: form renders while session loading/failed — grouped with the Blind finding above; same patch.
  - `[false]` `[reject]` Edge: signed-in user on `/signup` silently replaces the session — same as Blind finding; intended behaviour.
  - `[false]` `[reject]` Edge: busy state sticks if `invalidateSession` throws or `router.push` never completes — `invalidateQueries` does not reject on refetch failure (throwOnError default false) and `router.push` returns void.
  - `[low]` `[patch]` Edge: e2e hard-coded base URL — grouped with Blind; same patch.
  - `[medium]` `[patch]` Verification gap: nothing tests that `/signup` is a 404 when the session reports `feature_auth: false` — patched: e2e "fr39 the page is a 404 when the session reports auth off" (route-fulfilled session).
  - `[false]` `[reject]` Intent: "checked on submit" might mean client-side validation — the AC is met: errors appear only on submit as `InputError` with `aria-invalid` and focus; the server is the single source of the rules.
  - `[false]` `[reject]` Intent: toolbar, urls, session and Playwright edits outside the slice — wiring the header for UX-DR53 and the flag; no other slice's code path changes; full e2e (85) re-ran green.
  - `[medium]` `[patch]` Intent: frontend flag-off behaviour untested — grouped with the verification-gap finding; same patch.
  - `[false]` `[reject]` Intent: Postgres coverage only `tests/app` — that is the CI design; the named `test_fr39_*` cases (reserved, casefold, bytes, hash) live in `tests/app` and passed on Postgres 17.
  - `[low]` `[reject]` Intent: e2e does not assert full-width submit or graphite colour — cosmetic; layout width, input heights and header contents are asserted.

## Design Notes

Open retrospective action items were checked: none concerns the files this story changes (the auth slice is new; the toolbar change only hides the flow bar on auth paths), so none is closed here.

The `/login` page arrives in Story 9.2; until then the Log in link leads to Next's 404. With `FEATURE_AUTH=true` in the e2e server, existing specs are unaffected in this story because no guard exists yet. The e2e spec uses a unique username per run (e.g. `uj5` + timestamp + random digits, ≤32 alphanumerics) since `backend/var/e2e.db` is reused within a run.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test` against a local `postgres:17` container -- expected: all pass.
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: schema matches the backend.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean.
- `npm run e2e -- --project=chromium` -- expected: all pass including `signup.spec.ts`.

## Auto Run Result

Status: done

**Summary:** Create account (FR-39) end to end: expand-only `users` migration, pure username/password rules (`swp/domain/accounts.py`), bcrypt + PyJWT service (`swp/app/auth`), `POST /api/auth/signup` gated by `FEATURE_AUTH` (every `/api/auth/*` is `not_found` when off) setting the httpOnly `SameSite=Lax` `swp_session` cookie, `GET /api/session` returning the cookie's user, and the `/signup` page (`modules/auth`) per UX-DR53 with server-checked field errors and focus on the first failing field.

**Files changed:**
- `backend/pyproject.toml`, `backend/uv.lock` -- bcrypt 5.0.0, PyJWT 2.15.1.
- `backend/.importlinter` -- bcrypt/jwt forbidden in domain; `swp.domain.accounts` in the slice contract.
- `backend/swp/domain/accounts.py` -- username/password rules and copy.
- `backend/swp/store/models.py`, `backend/swp/store/migrations/versions/0002_users.py`, `backend/swp/store/users.py` -- users table and persistence.
- `backend/swp/config.py` -- `jwt_secret` with a local default.
- `backend/swp/app/auth/__init__.py` -- signup, hashing, JWT, session lookup.
- `backend/swp/api/schemas/auth.py`, `backend/swp/api/routers/auth.py`, `backend/swp/api/routers/session.py`, `backend/swp/api/app.py` -- endpoint, cookie, session user, mounting.
- `backend/tests/domain/test_accounts.py`, `backend/tests/app/test_signup.py`, `backend/tests/app/conftest.py`, `backend/tests/app/test_create_plan.py`, `backend/tests/test_cli.py`, `backend/tests/api/test_api_errors.py` -- FR-39/NFR-6/NFR-12 tests.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/lib/api/session.ts`, `frontend/lib/view-state/urls.ts`, `frontend/components/common/app-shell/toolbar.tsx` -- session key, auth URLs, logo-only header on auth pages.
- `frontend/modules/auth/{api.ts,password-input.tsx,signup-page.tsx}`, `frontend/app/signup/page.tsx` -- the Create account page.
- `frontend/tests/auth.test.tsx` -- Vitest.
- `frontend/playwright.config.ts`, `frontend/e2e/support/warm-routes.ts`, `frontend/e2e/signup.spec.ts` -- FEATURE_AUTH on for e2e, UJ-5 Create account journey.

**Review findings:** 29 findings (high 0, medium 4, low 15, false 10). Patches applied: 6 entries (medium 2: lone-surrogate password 500; flag-off `/signup` 404 untested; low 4: no-cookie asserts on 422, form hidden while session loads, form error clears on typing, e2e uses baseURL). Deferred: 1 (default `JWT_SECRET` in production, Story 9.7). Rejected: see Review Triage Log rows with reasons (rate limit -> 9.4/9.5; NFKC usernames vs AD-10 casefold; e2e flag-on by design; Log in link until 9.2; no page metadata like the rest of the app; DB length constraints; cosmetic e2e asserts; and 10 false findings).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 2, low 4. Both medium patches are pinned by new tests (`test_fr39_password_with_lone_surrogate_rejected`, e2e "fr39 the page is a 404 when the session reports auth off"); no specific unverified risk remains.

**Verification:**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 770 passed, 2 skipped.
- `pytest tests/app --database-url postgresql://…@localhost:55433/swp_test` (local postgres:17 container, removed after) -- 201 passed, 3 skipped.
- `npm run gen:api` -- schema.ts matches the backend.
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- clean, 412 passed.
- `npm run e2e -- --project=chromium` -- 86 passed.

**Residual risks:** auth inputs force 40px with `h-[40px]!` over the shared 36px `Input` (a shared size variant would be cleaner); the Log in link 404s until Story 9.2; production `JWT_SECRET` check deferred to 9.7; whole e2e suite now runs with `FEATURE_AUTH=true`, which Story 9.2's guard must account for.
