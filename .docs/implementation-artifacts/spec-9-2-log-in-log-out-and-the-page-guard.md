---
title: 'Story 9.2: Log in, log out and the page guard'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '478f6b52a0a046c4c744044ed7501d652872d4b5'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      When the session ends while the app is open (cookie expiry, deleted user, logout in another tab), the cached session still names the user, so the guard keeps rendering while every API call answers 401 and nothing sends the user to Log in.
    evidence: |-
      frontend/lib/api/session.ts uses staleTime Infinity and frontend/lib/api/query-errors.ts handles only plan_not_found. The epic assigns client session-expiry handling (401 on a GET or command -> Log in, then resend) to Story 9.3; the 9.2 spec excludes it.
    location: >-
      frontend/lib/api/query-errors.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Accounts exist (Story 9.1) but nobody can log in or out, and with `FEATURE_AUTH` on every page and API route still works anonymously (FR-40, AD-10).

**Approach:** Add `POST /api/auth/login` and `/logout` to the auth slice, a backend dependency that answers `unauthenticated` on every `/api/*` route except `health`, `session` and `auth/*` when auth is on and there is no valid session, a `/login` page (UX-DR53), a client page guard that sends visitors without a session to `/login`, and a Log out button in the toolbar. The e2e suite gets a shared logged-in fixture so every existing spec keeps working.

## Boundaries & Constraints

**Always:**
- Layers as in 9.1: bcrypt/PyJWT only in `swp.app.auth`; SQLAlchemy only in `swp.store`; `swp.api` never imports `swp.store`.
- Login looks the user up by `username_key(username)` (casefold), checks the password with `bcrypt.checkpw`, and on success sets `swp_session` exactly as signup does (reuse `set_session_cookie`, `session_token`). Response 200 `{user: <stored username>}`.
- Any failed login (unknown user, wrong password, empty fields, password over 72 UTF-8 bytes or not encodable) returns `unauthenticated` 401 with the message "Wrong username or password. Check both and try again." and no `details`; never a 500, never which part was wrong, no cookie set. An unknown username still runs one bcrypt check against a fixed dummy hash (computed lazily once) so timing does not reveal accounts.
- Logout: `POST /api/auth/logout` returns 204 and clears the cookie (same name, `Path=/`, httpOnly, SameSite=Lax, Secure as `cookie_secure()`, Max-Age 0); works with or without a session.
- Guard: with `FEATURE_AUTH` on, a request to any router other than `health`, `session`, `auth` without a cookie whose `session_user(...)` is a user gets `unauthenticated` 401 with message "Log in to continue.". The user is loaded from the database on every request (existing `session_user`). With `FEATURE_AUTH` off nothing changes (every request acts as `planner`).
- The same-origin guard still runs first on the auth POSTs (`forbidden_origin` 403 before anything else).
- `/login` page: same 380px card and logo-only header as `/signup`; title "Log in", lead "Plans are shared by everyone who logs in.", Username, Password with Show (reuse `PasswordInput`), full-width primary "Log in" submit, "No account? Create account" linking to `/signup`. `notFound()` when the session says `feature_auth` is false; nothing renders while the session is pending.
- Failed login (`unauthenticated`): one alert panel (`role="alert"`, `border-error bg-error-tint`, warning icon) above the fields with the server message; username kept; password cleared, hidden again (Show off) and focused. Other errors show their message in the same panel. Success: invalidate the session query (await the refetch), then `router.push("/plans")`.
- Shared card layout and the POST helper live once in `modules/auth` (extract from the signup page/api; signup keeps its behaviour).
- Page guard: a client component in `modules/auth`, mounted in `app/layout.tsx` around the shell. On `/login` and `/signup` it always renders. Elsewhere: while the session is pending it renders nothing; when `feature_auth` is true and `user` is null it renders nothing and `router.replace("/login")`; otherwise (auth off, user present, or session request failed) it renders the app.
- Log out: when `feature_auth` and a user are present, the toolbar shows a "Log out" button at its right end on every non-auth page (passed in as a slot from `app/layout.tsx`, like the launcher; the toolbar never imports a module). It posts logout, clears the query cache, sets the session to logged-out, and navigates to `/login`. (Story 9.3 moves it into the avatar user menu; Story 9.6 changes the destination when `feature_demo` is on.)
- E2E: a shared logged-in fixture in `frontend/e2e/support/test.ts`: a worker-scoped fixture logs in a fixed e2e account through the API (sign up when login is 401; log in again when sign-up says taken), and both browser contexts and the `request` fixture carry its cookie. When `/api/auth/login` is 404 (a reused server with auth off) it uses no cookie. Specs that need a logged-out visitor opt out with `test.use({ storageState: { cookies: [], origins: [] } })` (signup.spec.ts and the new login spec).
- Every test names its FR/NFR (`test_fr40_*`, `test_nfr6_*`); new e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts` and name the journey.

**Never:** no throttle or lockout (9.4); no Demo version button or demo seed (9.5); no front page or demo logout destination (9.6); no avatar/user menu, `CommandContext.user`/`created_by` change, or 401 retry/resend in `lib/commands` or the query hook (9.3); no production `JWT_SECRET` check (9.7); no redirect-back `?next=` parameter; no new tables or migrations; no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Login ok | `Kari7`/`secret` exists; POST `{username:"kari7", password:"secret"}` | 200 `{user:"Kari7"}`, `swp_session` set; `GET /api/session` → `Kari7` | — |
| Wrong password | existing user, bad password | 401 `unauthenticated`, wrong-login message, no Set-Cookie | — |
| Unknown user | `nobody` | identical 401 body to wrong password | — |
| Odd input | `""`/`""`; 73-byte password; lone surrogate | 401 wrong-login message | no 500 |
| Missing field | `{username:"x"}` | 422 `validation_failed` | — |
| Logout | with or without cookie | 204, Set-Cookie clears `swp_session` | — |
| Guard, auth on | no cookie / tampered / deleted user → `GET /api/plans`, `POST /api/plans/{id}/commands` | 401 `unauthenticated` "Log in to continue." | — |
| Guard open routes | auth on, no cookie → `/api/health`, `/api/session`, `/api/auth/login` | not 401 | — |
| Guard, logged in | valid cookie → `GET /api/plans` | 200 | — |
| Auth off | no cookie → `GET /api/plans`; POST `/api/auth/login` | 200; 404 `not_found` | — |
| Cross-site | `Sec-Fetch-Site: cross-site` to `/api/auth/login` | 403 `forbidden_origin`, no cookie | — |

</intent-contract>

## Code Map

- `backend/swp/app/auth/__init__.py` -- add `login(username, password, *, now) -> SignedUp` (raise `DomainError("unauthenticated", WRONG_LOGIN)`), `WRONG_LOGIN`, lazy dummy hash; reuse `session_token`, `username_key`, `session_user`.
- `backend/swp/store/users.py` -- add `get_user_by_key(key) -> StoredUser | None` (pattern: `get_user`, `username_key_taken`).
- `backend/swp/api/routers/auth.py` -- add `/login` (200, `error_responses(401, 403, 404, 422)`) and `/logout` (204) before the catch-all `/{path:path}` route; `set_session_cookie` exists; add a `clear_session_cookie`.
- `backend/swp/api/schemas/auth.py` -- `LoginRequest{username, password}`, `LoginResponse{user}`.
- `backend/swp/api/app.py` -- `include_router(..., dependencies=[Depends(require_session)])` for every router except `health`, `session`, `auth`.
- New `backend/swp/api/session_guard.py` -- `require_session(request)`: if `auth.auth_enabled()` and `session_user(request.cookies.get(SESSION_COOKIE), now=datetime.now(UTC))` is None → `DomainError("unauthenticated", "Log in to continue.")`. Same cookie read as `routers/session.py`.
- `backend/swp/api/errors.py` -- `unauthenticated` already maps to 401.
- `backend/tests/app/test_signup.py` -- fixtures `auth_on`, `client`, `SAME_ORIGIN`, `_error` to copy for new `backend/tests/app/test_login.py` (runs on Postgres in CI).
- `backend/tests/api/test_api_errors.py:79` `test_nfr6_cross_site_post_rejected`, `:390` `test_nfr6_cross_site_signup_rejected` / `auth_client` fixture -- extend to `/api/auth/login` and `/logout`.
- `frontend/modules/auth/api.ts` -- `postSignup` fetch/parse pattern to generalise into a shared JSON POST; add `postLogin`, `postLogout`, `runLogin`, `LOGIN_TITLE`, `WRONG_LOGIN` handling.
- `frontend/modules/auth/signup-page.tsx` -- `SignupCard` card markup (380px section, title, link row) to extract into a shared `auth-card.tsx`; `SignupPage` session/notFound/pending pattern to reuse.
- `frontend/modules/auth/password-input.tsx` -- `PasswordInput` with parent-owned `shown`.
- `frontend/modules/new-plan/import-error-panel.tsx:16` -- pale-red panel class pattern (`border-error bg-error-tint`).
- `frontend/lib/api/session.ts` -- `SESSION_KEY`, `useSession`; `frontend/lib/view-state/urls.ts` -- `LOGIN_HREF`, `SIGNUP_HREF`, `isAuthPath`, `SAVED_PLANS_HREF`.
- `frontend/app/layout.tsx` -- mount the guard around `<AppShell>` and pass the Log out slot; `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx` -- add an `account` slot rendered at the right end (`ml-auto`) on non-auth paths.
- `frontend/app/page.tsx` -- `/` redirects to `/plans` (unchanged; the guard then sends to `/login`).
- `frontend/e2e/support/test.ts` -- shared `test`; add the logged-in fixture here. `frontend/e2e/support/warm-routes.ts` -- add `/login`. `frontend/e2e/signup.spec.ts` -- opt out to logged-out; its success path still lands on `/plans`.
- `frontend/playwright.config.ts` -- comment on `FEATURE_AUTH` to update (guard now exists).
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/store/users.py` -- `get_user_by_key` -- login lookup.
- `backend/swp/app/auth/__init__.py` -- `login`, `WRONG_LOGIN`, dummy hash, byte/encoding guard -- FR-40.
- `backend/swp/api/schemas/auth.py`, `backend/swp/api/routers/auth.py` -- login/logout endpoints and cookie clearing.
- `backend/swp/api/session_guard.py`, `backend/swp/api/app.py` -- the API guard.
- `backend/tests/app/test_login.py` -- every I/O row (`test_fr40_*`), cookie attributes on login and logout, guard on a GET and a command POST, open routes, deleted-user cookie, auth-off unchanged.
- `backend/tests/api/test_api_errors.py` -- cross-site POST to `/api/auth/login` and `/logout` rejected (403, no cookie).
- `frontend/lib/api/schema.ts` -- regenerate.
- `frontend/modules/auth/api.ts`, `frontend/modules/auth/auth-card.tsx`, `frontend/modules/auth/signup-page.tsx`, `frontend/modules/auth/login-page.tsx`, `frontend/app/login/page.tsx` -- shared card + POST helper; the Log in page.
- `frontend/modules/auth/auth-guard.tsx`, `frontend/modules/auth/logout-button.tsx`, `frontend/app/layout.tsx`, `frontend/components/common/app-shell/index.tsx`, `frontend/components/common/app-shell/toolbar.tsx` -- guard and Log out slot.
- `frontend/tests/auth.test.tsx` -- Vitest: failed login shows one alert, keeps username, clears + focuses password and hides it; success invalidates session then navigates to `/plans`; guard renders nothing and replaces to `/login` when auth on and no user, renders children when auth off / user / on auth paths; logout clears cache and goes to `/login`.
- `frontend/e2e/support/test.ts`, `frontend/e2e/support/warm-routes.ts`, `frontend/e2e/signup.spec.ts`, `frontend/playwright.config.ts` -- logged-in fixture, opt-outs, `/login` warm-up.
- `frontend/e2e/login.spec.ts` -- UJ-3 "continues a saved plan" entry via Log in: `/` without session lands on `/login`; wrong password shows the alert, keeps username, empty focused password; correct login lands on `/plans`; Log out returns to `/login` and `/plans` then redirects to `/login`; card layout matches UX-DR53.

**Acceptance Criteria:**
- Given `FEATURE_AUTH` on and no session, when `/` or any plan page is opened, then `/login` opens; after a correct login the saved-plans list (`/plans`) shows and `/` opens it.
- Given `/login`, when it renders, then a 380px card under a logo-only header shows "Log in", Username, Password with Show, a full-width primary "Log in" and a "Create account" link to `/signup`.
- Given a logged-in user, when Log out is pressed in the toolbar, then the cookie is cleared, `/login` opens, and opening `/plans` again sends the visitor back to `/login`.
- Given the full Playwright suite with `FEATURE_AUTH=true`, when it runs on chromium, then every existing spec passes through the shared logged-in fixture.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 28 findings — high 0, medium 5, low 14, false 9, maybe-false 0
- findings:
  - `[medium]` `[defer]` Blind: a session that ends mid-use never returns the user to Log in (staleTime Infinity, no 401 handler) — real; client session-expiry handling is Story 9.3 in the epic; deferred (frontmatter).
  - `[false]` `[reject]` Blind: the requested page is lost after login (no `?next=`) — the story AC says the client lands on the saved-plans list after login; intended.
  - `[low]` `[reject]` Blind: a logged-in user opening /login or /signup still sees the form — logging in again just replaces the session (plans are shared, queries not identity-scoped); fix adds a new redirect branch for an uncommon path.
  - `[low]` `[reject]` Blind: Log out does not revoke the stateless JWT — AD-10 binds a stateless HS256 JWT cookie; revocation would be an architecture change.
  - `[low]` `[reject]` Blind: /api/auth/login has no brute-force protection — the login throttle is Story 9.4 in the epic.
  - `[low]` `[patch]` Blind: Log out navigates twice (guard replace + push) and leaves a history entry for the guarded page — patched: LogoutButton uses `router.replace(LOGIN_HREF)`.
  - `[low]` `[patch]` Blind: signup's form error used its own inline alert while Log in uses `AuthAlert` — patched: signup renders `AuthAlert`; Vitest `fr39_form_error_is_one_alert` asserts the panel. The duplicated Username/Password field markup part is rejected (two short blocks with different autocomplete/hint; extraction adds props for little gain).
  - `[low]` `[reject]` Blind: `postJson` lives in modules/auth and maps an empty 200 to undefined — only auth uses it; the backend never answers an empty 200 on these routes.
  - `[false]` `[reject]` Blind: the custom e2e `request` fixture drops config options and the same-origin header — playwright.config `use` sets only baseURL and trace (baseURL is passed), and the built-in fixture never added Sec-Fetch-Site either.
  - `[low]` `[patch]` Blind: /login with auth off is untested (and only a client-side 404, like /signup) — patched with the verification-gap finding below: e2e "fr40 the page is a 404 when the session reports auth off". The status-code part matches /signup (9.1) and is rejected for the same reason.
  - `[false]` `[reject]` Blind: the move of the `[step]` page to `next.config.ts` redirects is untested — `frontend/e2e/plan-overview.spec.ts` asserts the old move-list URL redirect and the 404 status for an unknown step, and passed (that spec is what exposed the issue).
  - `[false]` `[reject]` Blind: the review copy leaves out the spec — intentional: the spec is the claims file, given only to the edge-case layer.
  - `[false]` `[reject]` Blind: tests too weak (health only "not 401"; dummy-hash cost; no Unicode casefold test) — health's job is only to be open; `_dummy_hash` uses `bcrypt.gensalt()` like `hash_password`, so the cost is equal; casefold lookup is pinned by `test_fr40_login_by_casefolded_key` and the e2e uppercase login.
  - `[medium]` `[patch]` Edge: a lone-surrogate username reaches `get_user_by_key` and gives a 500 (reproduced; NUL would fail on Postgres) — patched: `login()` rejects any username with a `username_error` as wrong login before the lookup; `test_fr40_lone_surrogate_username_gives_wrong_login`.
  - `[medium]` `[defer]` Edge: session expiry while the app is open keeps rendering with every call 401 — same root cause as the first Blind finding; deferred to Story 9.3.
  - `[low]` `[reject]` Edge: a logged-in user sees /login — same as the Blind finding; rejected for the same reason.
  - `[low]` `[reject]` Edge: login 200 followed by a failed session refetch looks like a silent failed login — needs the session request to fail right after a successful login; a guard here adds a branch for a rare path.
  - `[false]` `[reject]` Edge: an empty 2xx login body makes `runLogin` throw — the login route always returns `{user}` with 200; no reachable path gives an empty body.
  - `[low]` `[reject]` Edge: a command still retrying after Log out could toast 401s on Log in — needs Log out pressed mid-retry; cancelling the command queue adds public surface to `lib/commands` (9.3 owns 401 handling there).
  - `[false]` `[reject]` Edge: `setLoggedOut` leaves the session undefined when it had no data — `LogoutButton` renders only when `session.data.user` is set, so the cache always has data when it runs.
  - `[medium]` `[patch]` Verification gap: the API guard was tested on only 2 of 10 guarded routers — patched: `test_fr40_guard_covers_every_data_router` sends a GET to each guarded router and expects 401 "Log in to continue.".
  - `[low]` `[patch]` Verification gap: /login 404 with auth off untested — patched: e2e test in login.spec.ts mirroring signup.spec.ts.
  - `[medium]` `[patch]` Verification gap: LogoutButton's cache wiring unverified (the e2e reloaded) — patched: the e2e Log out test now goes Back before reloading and asserts /login, no Log out button and no Saved plans heading.
  - `[low]` `[reject]` Intent: no test opens a guarded plan-step URL without a session — the guard is path-generic (`isAuthPath` only) and `/` and `/plans` are covered end to end.
  - `[false]` `[reject]` Intent: deleting `app/plans/[planId]/[step]/page.tsx` is a side change outside the intent — required to keep the existing 404/redirect e2e spec green under the guard (the intent requires every existing spec to keep working); behaviour unchanged and covered by plan-overview.spec.ts.
  - `[low]` `[reject]` Intent: `test_nfr6_cross_site_post_rejected` is not literally extended; a new `test_nfr6_cross_site_login_and_logout_rejected` covers login and logout — the substance of the AC is met.
  - `[false]` `[reject]` Intent: the full e2e suite under the guard is not shown to pass — it was run: 89 passed (chromium) before review, and re-run after patches.
  - `[low]` `[reject]` Intent: retro item 19 (command retry through the proxy) sits next to the new 401 — 401 handling in `lib/commands` is Story 9.3; nothing in 9.2 changes command retries.

## Design Notes

Open retrospective action items were checked; none concerns code this story changes (the 401 handling in the shared query hook and `lib/commands` is Story 9.3; epic-6 item 54 e2e helper consolidation is not taken on here), so none is closed.

The guard hides the whole shell (toolbar, launcher, page) on non-auth paths until the session answers, so a logged-out visitor never sees plan data or fires plan queries. A failed session request still renders the app, as `/signup` does; the backend guard keeps data protected.

Log out sits in the toolbar now because the story's AC needs a client path to it; the avatar user menu (Story 9.3) replaces this button.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:<port>/swp_test` against a local `postgres:17` container (removed afterwards) -- expected: all pass.
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: schema matches the backend.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean.
- `npm run e2e -- --project=chromium` -- expected: all pass including `login.spec.ts` and `signup.spec.ts`.

## Auto Run Result

Status: done

**Summary:** Log in, log out and the page guard (FR-40, AD-10). `POST /api/auth/login` (casefold lookup, bcrypt check, one wrong-login 401 for every failure, a dummy-hash check for unknown users) and `POST /api/auth/logout` (204, cookie cleared). A `require_session` dependency answers `unauthenticated` "Log in to continue." on every router except health, session and auth when `FEATURE_AUTH` is on; auth off is unchanged. Frontend: the `/login` page (UX-DR53) on a shared `AuthCard`/`AuthAlert`, a client `AuthGuard` around the shell that sends visitors without a session to `/login`, and a toolbar Log out button (account slot; Story 9.3 moves it into the avatar menu). E2E: a once-per-worker logged-in fixture in `e2e/support/test.ts` (browser contexts and `request`), with logged-out opt-outs for the signup and login specs.

**Files changed:**
- `backend/swp/store/users.py` -- `get_user_by_key`.
- `backend/swp/app/auth/__init__.py` -- `login`, `WRONG_LOGIN`, dummy hash, username/byte/encoding guards.
- `backend/swp/api/schemas/auth.py`, `backend/swp/api/routers/auth.py` -- login/logout endpoints, `clear_session_cookie`.
- `backend/swp/api/session_guard.py`, `backend/swp/api/app.py` -- the API guard on every data router.
- `backend/tests/app/test_login.py`, `backend/tests/api/test_api_errors.py` -- FR-40 / NFR-6 tests.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/modules/auth/{api.ts,auth-card.tsx,login-page.tsx,auth-guard.tsx,logout-button.tsx,signup-page.tsx}`, `frontend/app/login/page.tsx` -- Log in page, guard, Log out, shared card and POST helper.
- `frontend/app/layout.tsx`, `frontend/components/common/app-shell/{index.tsx,toolbar.tsx}` -- guard mount and account slot.
- `frontend/app/plans/[planId]/[step]/page.tsx` (deleted), `frontend/next.config.ts` -- the move-list redirect moved to `redirects()`, so unknown steps stay real 404s under the guard (which renders nothing on the server).
- `frontend/tests/auth.test.tsx` -- Vitest for login, guard and logout.
- `frontend/e2e/support/test.ts`, `frontend/e2e/support/warm-routes.ts`, `frontend/e2e/signup.spec.ts`, `frontend/e2e/login.spec.ts`, `frontend/playwright.config.ts` -- logged-in fixture, opt-outs, UJ-3 Log in/Log out journey.

**Review findings:** 28 findings (high 0, medium 5, low 14, false 9). Patches applied: 6 entries (medium 3: lone-surrogate username 500; guard tested on only 2 of 10 routers; logout cache wiring unverified; low 3: logout push -> replace, signup error uses `AuthAlert`, /login auth-off 404 e2e). Deferred: 1 (client session expiry while the app is open -> Story 9.3). Rejected: see Review Triage Log rows with reasons (no `?next=` per AC; logged-in user on /login; stateless JWT per AD-10; throttle -> 9.4; `postJson` placement; rare refetch/retry paths; literal NFR-6 test name; and 9 false findings).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 3, low 3. Every medium patch is pinned by a test (`test_fr40_lone_surrogate_username_gives_wrong_login`, `test_fr40_guard_covers_every_data_router`, the e2e Log out Back step); no specific unverified risk remains.

**Verification:**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 806 passed, 2 skipped.
- `pytest tests/app --database-url postgresql://…@localhost:55492/swp_test` (local postgres:17 container, removed after) -- 235 passed, 3 skipped.
- `npm run gen:api` -- schema.ts matches the backend.
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- clean, 426 passed.
- `npm run e2e -- --project=chromium` -- 90 passed.

**Residual risks:** the Log out button is a stopgap secondary button on the graphite toolbar until Story 9.3; the guard renders nothing on the server, so guarded pages have no SSR content and a page-level `notFound()` no longer sets a 404 status (the `[step]` route was replaced by a config redirect for that reason); client session expiry is deferred to 9.3; firefox and msedge e2e were not run.
