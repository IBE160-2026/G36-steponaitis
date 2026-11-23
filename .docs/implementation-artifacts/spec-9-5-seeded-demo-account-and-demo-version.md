---
title: 'Story 9.5: Seeded demo account and Demo version'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'b67c5f27922783a639661a326a396e20eb59b31b'
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

**Problem:** Examiners and visitors must create an account before they can try the app; there is no `demo` account and no one-click way in on the public demo (FR-50, AD-10, UX-DR53).

**Approach:** `swp.app.bootstrap(seed=True)` (lifespan when `APP_ENV=local`, and `swp db upgrade`) creates the user `demo` once, with the password from `DEMO_PASSWORD` (default `demo`). With `FEATURE_DEMO` on, `POST /api/auth/demo` logs the visitor in as `demo` with no password and no throttle, and the Log in page shows a full-width tertiary **Demo version** button with a play glyph under an "or" rule that calls it and opens the saved-plans list.

## Boundaries & Constraints

**Always:**
- Seed (`swp/app/auth/__init__.py`): `DEMO_USERNAME = "demo"`; `seed_demo_account(*, now)` returns at once when `store.username_key_taken("demo")`; otherwise it inserts `StoredUser(id=uuid4(), username="demo", username_key="demo", password_hash=hash_password(settings.demo_password), created_at=now)` through `store.insert_user`, whose `False` (an `IntegrityError` from a concurrent seed) counts as success. It never updates an existing `demo` row. No plan, import or other row is seeded.
- `swp/app/bootstrap.py`: `if seed: auth.seed_demo_account(now=datetime.now(UTC))` (after the upgrade). `swp/api/app.py` lifespan and `swp/cli.py` `db upgrade` call `bootstrap(upgrade=True, seed=True)`. Seeding runs whatever `FEATURE_AUTH`/`FEATURE_DEMO` say.
- Settings (`swp/config.py`): `demo_password: str = "demo"` (env `DEMO_PASSWORD`), with a `field_validator` that raises `ValueError` when `swp.domain.accounts.password_error(value)` is not None, so a password that could never log in fails at startup.
- `demo_enabled() -> bool` in `swp.app.auth` returns `get_settings().feature_demo`. `demo_login(*, now) -> SignedUp`: loads `store.get_user_by_key("demo")`; when missing, calls `seed_demo_account(now=now)` and loads it again; returns `SignedUp(username=user.username, token=session_token(user.id, now=now))`. It never reads, records or clears `login_attempts`, and never runs bcrypt when the row exists.
- Router (`swp/api/routers/auth.py`): `POST /auth/demo` declared before the catch-all `/{path:path}` route, with a dependency that raises `DomainError("not_found", NOT_FOUND)` unless `auth.demo_enabled()` (the router's auth dependency already gives 404 with auth off). Body: none. Answer: 200 `LoginResponse(user="demo")` plus `set_session_cookie`. `responses=error_responses(403, 404)`. The same-origin guard applies as for every POST. Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- Frontend `modules/auth/api.ts`: `DEMO_VERSION_LABEL = "Demo version"`, `postDemo(fetchImpl)` (POST `/api/auth/demo` with `{}`), `runDemo(effects)` with the same effects and outcome shape as `runLogin` (`logged-in` → invalidate session, then `navigate()` to `afterLoginHref()`; any error → `failed` with the server message).
- `components/common/icons.tsx`: add `play` (lucide `Play`). `modules/auth/auth-card.tsx`: optional `footer?: ReactNode` rendered after the link row. `modules/auth/login-page.tsx`: when `session.data?.feature_demo` is true, the footer is a horizontal rule with a centred "or" (`ink-tertiary`/`border` tokens, decorative, `aria-hidden` on the line) and a full-width `Button variant="tertiary"` with `<Icon name="play" />` and the label "Demo version". While the demo or the login request is in flight both buttons are disabled (`disabledReason`). A failed demo shows the existing `AuthAlert` with the server message and keeps both fields. With `feature_demo` false or the session not loaded, nothing of the footer renders.
- Created by / last edited by: no new code — `CommandContext.user` is already the session username, so `demo` appears; plans stay shared; Log out is unchanged.
- README: in *Run locally*, one short English paragraph: with `FEATURE_AUTH=true npm run dev` every page needs a login; log in as `demo`/`demo` (seeded on start, `DEMO_PASSWORD` changes the password); a local install has no Demo version button. Leave the Norwegian section as it is.
- Every test names its FR/NFR (`test_fr50_*`, `test_fr40_*`); new e2e tests import `test`/`expect` from `frontend/e2e/support/test.ts` and name the journey (UJ-5).

**Never:** no front page or Log out target change (9.6); no production secret checks or `.env.example` (9.7); no `FEATURE_DEMO` in the Playwright server env; no seeded plan or import, no data from `data/private/`; no change to the throttle or limits besides leaving `demo` out of both as today; no new copy module (retro item epic-6-54, moving copy into `lib/copy`, stays open — auth copy stays in `modules/auth/api.ts` like 9.1–9.4); no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First seed | empty `users` | one row `demo`/`demo`, password checks against `DEMO_PASSWORD` | — |
| Seed again | `demo` exists, `DEMO_PASSWORD` changed | row unchanged (same id, same hash) | — |
| Concurrent seed | `insert_user` returns False | no error | integrity error = success |
| Seed and limits | demo on, `max_accounts` 1, only `demo` | signup still 201 (demo not counted) | — |
| Demo on | `POST /api/auth/demo` | 200 `{"user": "demo"}`, `swp_session` cookie; `GET /api/session` user `demo` | — |
| Demo while locked | 5 wrong logins for `demo` | `/auth/demo` 200; `login_attempts` row unchanged; `/auth/login` as demo still 429 | — |
| Demo row missing | demo on, `users` empty | `/auth/demo` seeds, then 200 | — |
| Demo off | `FEATURE_DEMO` false, auth on | `/auth/demo` 404 `not_found` | — |
| Auth off | `FEATURE_AUTH` false | `/auth/demo` 404 | — |
| Cross-site | `Sec-Fetch-Site: cross-site` | 403 `forbidden_origin` | — |
| Bad env | `DEMO_PASSWORD="abc"` | `Settings()` raises ValidationError | — |

</intent-contract>

## Code Map

- `backend/swp/app/bootstrap.py` -- `bootstrap(upgrade, seed)`; the `seed` branch is a `pass` placeholder today.
- `backend/swp/app/auth/__init__.py` -- `hash_password`, `session_token`, `SignedUp`, `login` (throttle order to leave alone), `auth_enabled`; add `DEMO_USERNAME`, `seed_demo_account`, `demo_enabled`, `demo_login`.
- `backend/swp/store/users.py` -- `insert_user` (False on `IntegrityError`), `get_user_by_key`, `username_key_taken`, `count_accounts` (already excludes key `demo`).
- `backend/swp/config.py` -- `Settings`; add `demo_password` and its validator (config may import `swp.domain`).
- `backend/swp/domain/accounts.py:59` -- `password_error`; `RESERVED_USERNAMES` already holds `demo`.
- `backend/swp/api/routers/auth.py` -- `require_auth_feature`, `set_session_cookie`, `login` route pattern, catch-all `unknown` route (must stay last).
- `backend/swp/api/app.py:32-36` -- lifespan `bootstrap(upgrade=True, seed=False)`; `backend/swp/cli.py:20` -- same call.
- `backend/tests/app/conftest.py` -- `empty_tables` (seed=False, deletes users; demo tests call `bootstrap(upgrade=False, seed=True)` or rely on `demo_login` seeding); `backend/tests/app/test_login.py` -- `auth_on`, `client`, `SAME_ORIGIN`, `_login` patterns; `backend/tests/app/test_fr40_login_throttle.py` -- throttle helpers and `NOW`; `backend/tests/app/test_fr39_limits.py` -- demo-flag fixtures; `backend/tests/test_cli.py` -- `db upgrade` test (add a `demo` row assertion); `backend/tests/test_config.py` -- settings tests.
- `frontend/modules/auth/api.ts` -- `postJson`, `runLogin`, `afterLoginHref`, `LoginOutcome`; `frontend/modules/auth/login-page.tsx` -- `LoginCard`, `LoginPage` (busy, `afterFailedLogin`); `frontend/modules/auth/auth-card.tsx` -- `AuthCard`; `frontend/components/common/icons.tsx` -- `ICONS`; `frontend/components/common/button.tsx` -- `tertiary` variant, `disabledReason`; `frontend/lib/api/session.ts` -- `useSession`, `SESSION_KEY`.
- `frontend/tests/auth.test.tsx` -- Vitest patterns for `runLogin` and `LoginCard`.
- `frontend/e2e/login.spec.ts` -- logged-out pattern (`test.use({ storageState: ... })`, `card(page)`); `frontend/e2e/session-expiry.spec.ts:47-70` -- avatar text and user-menu assertions; `frontend/e2e/support/test.ts` -- shared `test`/`expect`. The e2e backend runs `swp db upgrade` before uvicorn, so `demo`/`demo` exists there after this story; `FEATURE_DEMO` stays off.

## Tasks & Acceptance

**Execution:**
- `backend/swp/config.py` -- `demo_password` with validator -- AD-10 `DEMO_PASSWORD`.
- `backend/swp/app/auth/__init__.py`, `backend/swp/app/bootstrap.py` -- seed, `demo_enabled`, `demo_login`; seed branch calls the seed -- FR-50, AD-10.
- `backend/swp/api/app.py`, `backend/swp/cli.py` -- `seed=True`.
- `backend/swp/api/routers/auth.py` -- `POST /auth/demo` -- FR-50.
- `backend/tests/app/test_fr50_demo_account.py` (new, SQLite and Postgres) -- every matrix row: seed once/again/concurrent (monkeypatch `insert_user` to return False), no plan or import seeded, `count_accounts` 0 after seed, the `DEMO_PASSWORD` env is used, demo endpoint on/off/auth off/cross-site/row missing, demo while locked (rows via `auth.login(now=...)`), `GET /api/session` after demo, `/auth/login` with `demo`/`demo` works after seed, a plan created after demo login shows `created_by` `demo`, and `TestClient` lifespan with `APP_ENV=local` seeds `demo`.
- `backend/tests/test_cli.py`, `backend/tests/test_config.py` -- `db upgrade` leaves one `demo` user; `DEMO_PASSWORD` default and validator.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/components/common/icons.tsx`, `frontend/modules/auth/auth-card.tsx`, `frontend/modules/auth/api.ts`, `frontend/modules/auth/login-page.tsx` -- play icon, footer slot, `runDemo`, Demo version button.
- `frontend/tests/auth.test.tsx` -- Vitest: `runDemo` success (session invalidated before navigate) and failure (`failed` with message); `LoginCard` shows the "or" rule and the full-width Demo version button only when demo is on.
- `frontend/e2e/demo-version.spec.ts` (new, logged out) -- `fr50 uj5 a local install logs in as demo/demo with no Demo version button` (real login, saved-plans list, avatar "DE", menu shows `demo`, Log out returns to Log in); `fr50 uj5 Demo version opens the saved-plans list as demo` (`page.route` on `/api/session` passes the real answer through with `feature_demo: true`; `page.route` on `POST /api/auth/demo` forwards with `route.fetch` to `/api/auth/login` with `demo`/`demo`, since the e2e server runs with the flag off; click Demo version → saved-plans list and avatar "DE"; the button is under the "or" rule and as wide as the form).
- `README.md` -- local login paragraph.

**Acceptance Criteria:**
- Given `bootstrap(seed=True)` runs once or many times, then exactly one `demo` user exists with the `DEMO_PASSWORD` password, no plan exists, and `demo` does not count toward `MAX_ACCOUNTS`.
- Given `FEATURE_DEMO` on, when `POST /api/auth/demo` is called, even while `demo` is locked by the throttle, then the visitor is logged in as `demo` and the client opens the saved-plans list with the avatar "DE"; with the flag off it returns 404.
- Given the Log in page, when `feature_demo` is on, then a full-width tertiary Demo version button with a play glyph sits under an "or" rule; when it is off the button is absent.
- Given a local install following the README, when logging in as `demo`/`demo`, then the saved-plans list opens and there is no Demo version button.
- Given the full suites, then pytest (SQLite and Postgres 17), Vitest and Playwright chromium pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 22 findings — high 0, medium 0, low 17, false 5, maybe-false 0
- findings:
  - `[low]` `[reject]` Edge: production `swp db upgrade` seeds `demo` with the default password `demo` even with `FEATURE_DEMO` off — the AC requires `swp db upgrade` to seed with `DEMO_PASSWORD` default `demo`; with auth off every `/api/auth/*` route is 404 so the account is unusable, and with auth on `demo`/`demo` is the publicly documented demo login (README); production secret checks belong to Story 9.7.
  - `[low]` `[reject]` Edge: a later `DEMO_PASSWORD` change is ignored once `demo` exists — the AC says the account is created "exactly once"; rotating needs deleting the row; changing this adds an update path the intent does not ask for.
  - `[low]` `[reject]` Blind: CLI always creates a known-password account outside local — same as the first Edge row.
  - `[low]` `[reject]` Blind: `seed_demo_account` returns None, forcing a re-read and an unreachable `internal` branch — no user or caller is harmed; the branch only satisfies the type checker; refactoring the return type adds churn for no named caller.
  - `[low]` `[reject]` Blind: concurrent-seed test only shows no exception — the store's real `IntegrityError` → False conversion is covered by `test_signup.py::test_fr39_unique_constraint_race_gives_taken`; a real two-process race test needs process orchestration.
  - `[low]` `[reject]` Blind: the "not demo" user filter is copied into three test files — test-only helpers, as accepted for 9.1–9.4 test duplication; `_rows()` needs rows, not the store count.
  - `[low]` `[patch]` Blind: `"demo"` defined in three places (app constant, reserved list, `count_accounts`) — patched: `DEMO_USERNAME` moved to `swp.domain.accounts`, `RESERVED_USERNAMES` built from it, `count_accounts` and `swp.app.auth` import it.
  - `[low]` `[reject]` Blind: README paragraph omits `FEATURE_DEMO`, its limits and the `DEMO_PASSWORD` rules — a local install has no Demo version by design (AC4); the README env-setup section is Story 9.7's.
  - `[low]` `[reject]` Blind: e2e Demo version never hits the real endpoint; copied `content-length` header looks fragile — the reroute is the spec's stated choice (FEATURE_DEMO on in e2e caps the suite at 50 plans); the endpoint is proven by TestClient; Playwright recomputes the forwarded body length and the test passes; Story 9.7 runs the examiner journey against a production-like build with the flag on.
  - `[false]` `[reject]` Blind: no test of the `LoginPage` wiring — both e2e tests exercise it through the real page: the button is absent with the flag off, and with the flag on the click must send exactly one `POST /api/auth/demo` and land on the saved-plans list as `demo`.
  - `[low]` `[reject]` Blind: a failed Demo version shows the raw "Not found." — needs the server flag switched off after the page loaded; a demo-specific message adds copy and a branch.
  - `[low]` `[patch]` Blind: `runDemo` doc comment says it opens the saved-plans list though it navigates to `afterLoginHref()` — patched: the comment now says it opens the same page as a successful Log in.
  - `[low]` `[patch]` Blind: dead `_users()`, hard-coded throttle numbers, and the `MAX_ACCOUNTS` test never checks the seed ran — patched: `_users()` deleted, `LOGIN_MAX_FAILURES`/`LOGIN_LOCK` used, the test asserts the seeded `demo` row before signing up (wall-clock `now` is kept because the endpoint uses it).
  - `[low]` `[reject]` Blind: the lifespan seeds `demo` with auth off — AD-9/AD-10 make the lifespan the local seed path regardless of flags; the row is harmless with auth off.
  - `[low]` `[reject]` Intent: `demo_login` seeds on a request path, outside `bootstrap` (AD-9) — both paths call the single `seed_demo_account`, so AD-9's prevented harm (two seeding implementations) does not occur; removing it changes the contract's "Demo row missing" row and would break the public button after a reset.
  - `[low]` `[reject]` Intent: Demo version is not proven end to end in the browser and the throttle bypass only at the API — same as the Blind e2e row.
  - `[low]` `[reject]` Intent: the local install needs the opt-in `FEATURE_AUTH=true`, and no test follows the README command — auth off by default is AD-10's milestone 1 compatibility; the lifespan seed path is tested through TestClient; README auth setup is Story 9.7's.
  - `[low]` `[reject]` Intent: no UI test of created-by columns, shared plans or Log out after a Demo version session — created/edited by `demo` is asserted through `GET /api/plans`; plan sharing and Log out are unchanged code covered by 9.2/9.3 tests.
  - `[false]` `[reject]` Intent: Demo version may land on a restored page rather than always `/plans` — this is the same post-login target as Log in (Story 9.3), and with no stored page it is the saved-plans list the AC names.
  - `[false]` `[reject]` Intent: concurrent seed never raises a real `IntegrityError` — the store's conversion is real code covered by the signup race test; the claim describes test shape, not a defect.
  - `[false]` `[reject]` Intent: additions beyond the intent (startup password check, test helper updates) — descriptive; the check prevents an unusable demo login and the helpers follow from the lifespan seed.
  - `[false]` `[reject]` Verification-gap other: one bcrypt hash per TestClient start slows the suite — full pytest ran in 2:43–2:44 both before and after, in line with earlier stories; not a correctness issue.

## Design Notes

`demo_login` seeds on demand when the row is missing so the public button never fails after a database reset; `seed_demo_account` stays the single code path that creates `demo`, so "created exactly once" still holds. The e2e test reroutes the demo POST to a real `demo`/`demo` login because turning `FEATURE_DEMO` on in the e2e server would cap the suite at 50 plans (Story 9.4); the backend endpoint itself is proven by TestClient.

Retro items checked: no open item names the auth slice, bootstrap or the Log in page. Epic-6 item 54 (copy into `lib/copy`) is left open; this story follows the 9.1–9.4 placement of auth copy.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:<port>/swp_test` against a local `postgres:17` container (removed afterwards) -- expected: all pass.
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: only `/api/auth/demo` added.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean.
- `npm run e2e -- --project=chromium` -- expected: all pass.

## Auto Run Result

Status: done

**Summary:** Seeded demo account and Demo version (FR-50, AD-9, AD-10, UX-DR53). `bootstrap(seed=True)`, now run by the local lifespan and by `swp db upgrade`, creates `demo` once with `DEMO_PASSWORD` (default `demo`, checked against the password rules at startup); an existing row is never changed and a lost insert race counts as success; no plan is seeded and `demo` is not counted toward `MAX_ACCOUNTS`. With `FEATURE_DEMO` on, `POST /api/auth/demo` logs in as `demo` with no password and no throttle (seeding the row first if missing); with the flag or auth off it is 404. The Log in page shows a full-width tertiary Demo version button with a play glyph under an "or" rule only when `feature_demo` is on; it opens the same page as a successful Log in (the saved-plans list by default).

**Files changed:**
- `backend/swp/domain/accounts.py` -- `DEMO_USERNAME`, reserved list built from it.
- `backend/swp/config.py` -- `demo_password` (env `DEMO_PASSWORD`) with a password-rule validator.
- `backend/swp/app/auth/__init__.py` -- `seed_demo_account`, `demo_enabled`, `demo_login`.
- `backend/swp/app/bootstrap.py`, `backend/swp/api/app.py`, `backend/swp/cli.py` -- seed branch; lifespan and CLI seed.
- `backend/swp/store/users.py` -- `count_accounts` uses `DEMO_USERNAME`.
- `backend/swp/api/routers/auth.py` -- `POST /auth/demo`.
- `backend/tests/app/test_fr50_demo_account.py` (new); `backend/tests/test_cli.py`, `backend/tests/test_config.py`, `backend/tests/app/test_signup.py`, `backend/tests/app/test_fr39_limits.py`, `backend/tests/api/test_api_errors.py` -- tests (helpers leave out the lifespan-seeded `demo`).
- `frontend/lib/api/schema.ts` -- regenerated (`/api/auth/demo` only).
- `frontend/components/common/icons.tsx` -- `play` icon.
- `frontend/modules/auth/auth-card.tsx`, `frontend/modules/auth/api.ts`, `frontend/modules/auth/login-page.tsx` -- footer slot, `postDemo`/`runDemo`, Demo version button.
- `frontend/tests/auth.test.tsx`, `frontend/tests/components.test.tsx` -- Vitest.
- `frontend/e2e/demo-version.spec.ts` (new) -- UJ-5 journeys.
- `README.md` -- local login paragraph.

**Review findings:** 22 findings (high 0, medium 0, low 17, false 5). Patches applied: 3 rows (all low: one `DEMO_USERNAME` source, `runDemo` comment, test cleanup). Deferred: 0. Rejected: 19 -- see the Review Triage Log (production seed with default password and no password rotation: mandated by the AC, secrets are Story 9.7's; e2e reroute of the demo POST: spec choice, endpoint proven by TestClient, Story 9.7 runs the examiner journey; on-demand seed in `demo_login`: same single seed function; README scope: Story 9.7; test-helper duplication, raw "Not found." on a flag flip, re-read branch: negligible; 5 false).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 0, low 3.

**Verification (after the review patches):**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run lint`, `npm run typecheck` -- clean.
- `npm run gen:api` -- schema.ts diff only adds `/api/auth/demo`.
- `npm run test:py` -- 868 passed, 2 skipped.
- `pytest tests/app --database-url postgresql://...` on a local postgres:17 container (removed after) -- 282 passed, 3 skipped.
- `npm run test:web` -- 442 passed.
- `npm run e2e -- --project=chromium` -- 99 passed.

**Residual risks:** the real `POST /api/auth/demo` is not exercised through the browser and Next.js proxy until Story 9.7's production-like run; `swp db upgrade` creates `demo`/`demo` on any database where `DEMO_PASSWORD` is unset (by design, Story 9.7 adds production secret checks); the "or" text uses `text-ink-muted` because the spec's `ink-tertiary` token does not exist; firefox and msedge e2e were not run.
