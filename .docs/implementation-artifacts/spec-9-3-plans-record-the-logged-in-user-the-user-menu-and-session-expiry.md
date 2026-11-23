---
title: 'Story 9.3: Plans record the logged-in user, the user menu and session expiry'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '2d06333509727539e08ccf9f3467d2a4db4f6c44'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['multiple-goals', 'oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** With `FEATURE_AUTH` on, plans, commands and runs still record the fixed `planner`; the toolbar has only a stopgap Log out button (Story 9.2); and when the session ends while the app is open (expiry, deleted user, logout in another tab) every request answers 401 and nothing sends the user to Log in, so an unsaved change is lost (deferred from 9.2; FR-11, FR-40, AD-10, AD-12, UX-DR4, UX-DR55).

**Approach:** The backend resolves the request's user once (logged-in username with auth on, `planner` with auth off) and passes it to plan creation and `run_command`. The frontend replaces the Log out button with the avatar user menu, and a small session-expiry coordinator in `lib/api` lets the command client hold a command that got `unauthenticated` and the shared query error hook react to a 401 GET: both mark the session logged out, open Log in, and after a successful login the page that was open reopens and held commands are resent unchanged.

## Boundaries & Constraints

**Always:**
- Layers: `swp.api` never imports `swp.store`; the user dependency lives in `swp/api/session_guard.py` and uses `swp.app.auth` and `swp.app.plans.DEFAULT_USER`.
- One dependency `current_user(request) -> str`: auth off → `DEFAULT_USER` (`planner`); auth on → `auth.session_user(cookie, now)` or raise `DomainError("unauthenticated", "Log in to continue.")`. It replaces `require_session` as the router-level guard (same behaviour and message) and is also declared as a parameter of `create_plan` and `post_command`, so FastAPI's per-request dependency cache loads the user once. The user goes to `plans.create(..., user=)`, `plans.create_from_import(..., user=)` and `run_command(..., user=)`; `CommandContext.user`, `created_by`, `last_edited_by` and the run's `created_by` then hold the username as text (no FK, no migration).
- GETs never write: listing or opening a plan made by `planner` keeps `created_by`/`last_edited_by` = `planner` and its `version` unchanged (FR-9).
- Avatar (UX-DR4): `frontend/modules/auth/user-menu.tsx` exports `avatarInitials(username)` = first two characters (by code point, `Array.from`) upper-cased ("demo" → "DE", "a" → "A") and `UserMenu`. `UserMenu` renders nothing unless `feature_auth` and a user are present; otherwise a 34px round `bg-ink` button with the initials in white (`aria-label` "User menu", `aria-haspopup` from radix) opening a radix `DropdownMenu` (`modal={false}`, `align="end"`, `MENU_CONTENT_CLASS`, white surface): a non-interactive "Logged in as" line, the username in Barlow bold (`font-code font-bold`), a separator, and a "Log out" item (`MENU_ITEM_CLASS`) that runs the existing `runLogout` flow (clear cache, set logged out, `router.replace(LOGIN_HREF)`, toast on failure). Keyboard: radix default (Enter/Space/ArrowDown open, arrows move, `Esc` closes and focus returns to the avatar). `logout-button.tsx` is deleted; `app/layout.tsx` passes `account={<UserMenu />}`.
- Session expiry coordinator `frontend/lib/api/session-expiry.ts` (framework-free, class plus one exported app instance): `expire(href)` remembers the first non-auth-path `href` until restored and returns a promise that resolves on the next `restore()`; `restore()` returns the remembered href (or null), clears it and resolves every waiting promise; `isWaiting()`.
- `QueryErrorEffects` gains `sessionExpired: () => Promise<void>`. `app/providers.tsx` implements it: `expire(location.pathname + location.search)`, set the cached session's `user` to null (as Log out does), then `router.replace(LOGIN_HREF)`; it returns the expiry promise.
- `handleQueryError`: `unauthenticated` → `void effects.sessionExpired()` (no toast); `plan_not_found` unchanged.
- `CommandClient.sendWithEvents`: a POST answering `unauthenticated` keeps the command (state stays `pending`, notice null), awaits `effects.sessionExpired()`, then posts the identical body again (same `command_id` and `base_version`) and continues the normal flow (retry, reject, confirm). It is not counted as a transient attempt.
- Log in and Create account success: after the awaited session refetch, call the coordinator's `restore()` and navigate to its href, else `SAVED_PLANS_HREF` (push, as today). Held commands are resent at that moment.
- Every test names its FR/NFR; new e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts` and name the journey.

**Never:** no new tables, migrations or FK on `created_by`/`last_edited_by`; no change with auth off; no `?next=` URL parameter (the return page lives in memory only; a reload while waiting loses the held command); no session-expiry handling for the New Plan upload or Delete plan mutations (they keep showing the server message); no extra copy on the Log in page; no throttle (9.4), demo seed/button (9.5), front page or demo Log out destination (9.6), production secret checks (9.7); no fix for retro item epic-6-50 (plan_not_found scoping); no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create, auth on | `Kari7` logged in; POST `/api/plans` (files, or `import_id`) | `created_by` = `last_edited_by` = `Kari7` | — |
| Command, auth on | `Kari7` sends a command / runs recommendations | `last_edited_by` = `Kari7`; recommendations `run.created_by` = `Kari7` | — |
| Old plan | plan made with auth off, then listed/opened by `Kari7` | rows/summary show `planner`; `version` unchanged | — |
| Auth off | no cookie | everything records `planner` | — |
| Guard | auth on, no/invalid cookie on POST `/api/plans` or a command | 401 "Log in to continue.", nothing written | — |
| Avatar | `demo` / `a` / `Kari7` | "DE" / "A" / "KA" | — |
| Command 401 | command POST → 401, user logs in | Log in opens; after login the plan URL reopens and the same command (same `command_id`) is posted once and confirmed | another 401 waits again |
| GET 401 | a plan GET → 401 | session set logged out, Log in opens; after login the same URL reopens | no toast |

</intent-contract>

## Code Map

- `backend/swp/api/session_guard.py` -- `require_session`, `LOG_IN_TO_CONTINUE`; becomes `current_user` returning the username.
- `backend/swp/api/app.py:46-60` -- `guarded = [Depends(require_session)]` loop over data routers; switch to `current_user`.
- `backend/swp/api/routers/plans.py:43-72` -- `create_plan` calls `plans.create_from_import(...)` and `plans.create(...)` without `user`.
- `backend/swp/api/routers/commands.py:18` -- `post_command` calls `run_command(plan_id, command)` without `user`.
- `backend/swp/app/plans.py:27` -- `DEFAULT_USER = "planner"`; `create`/`create_from_import` already take `user`. `backend/swp/app/commands.py:35` -- `run_command(..., user=DEFAULT_USER)` already builds `CommandContext(user=)` and saves `last_edited_by=ctx.user`. `backend/swp/domain/rules.py:274` -- run `created_by=ctx.user`. No domain/store change needed.
- `backend/tests/app/test_login.py` -- fixtures `auth_on`, `client`, `account`, `_login`, `SAME_ORIGIN`, `LOG_IN` to reuse. `backend/tests/app/test_create_plan.py` -- `_multipart`, `_small_files`, `NOW`; `backend/tests/app/test_reuse_import.py` -- `_reuse`, `_row`, `_send`; `backend/tests/app/test_apply_command.py` -- `_command`.
- `frontend/lib/api/query-errors.ts` -- `handleQueryError`, `QueryErrorEffects {notify, navigate}`.
- `frontend/app/providers.tsx` -- builds the effects and the `QueryCache` once (effects closed over at construction: reach the queryClient through a variable/ref).
- `frontend/lib/commands/client.ts:139-166` -- `sendWithEvents` loop; `post()` returns `ApiError` for 401; `reject()` handles other codes.
- `frontend/lib/api/session.ts` -- `SESSION_KEY`, `Session`. `frontend/lib/view-state/urls.ts` -- `LOGIN_HREF`, `isAuthPath`, `SAVED_PLANS_HREF`.
- `frontend/modules/auth/login-page.tsx` (`navigate: () => router.push(SAVED_PLANS_HREF)`), `frontend/modules/auth/signup-page.tsx` (same success navigate), `frontend/modules/auth/api.ts` (`runLogout`, `LOGOUT_LABEL`), `frontend/modules/auth/logout-button.tsx` (logout wiring to move into the menu, then delete), `frontend/modules/auth/auth-guard.tsx` (redirects when the cached session user is null).
- `frontend/components/common/app-shell/plan-plate.tsx` -- radix `DropdownMenu` pattern to follow; `frontend/components/common/menu-styles.ts` -- `MENU_CONTENT_CLASS`, `MENU_ITEM_CLASS`. `frontend/components/common/app-shell/toolbar.tsx`, `index.tsx` -- `account` slot comments mention Log out / Story 9.2.
- `frontend/tests/auth.test.tsx:420-460` (LogoutButton tests to move to UserMenu), `frontend/tests/commands.test.tsx` (CommandClient tests with mocked fetch and `envelope()` helper).
- `frontend/e2e/login.spec.ts:96-125` -- Log out test clicks the banner "Log out" button; must open the avatar menu first. `frontend/e2e/support/test.ts` (`E2E_USER`, logged-out opt-out), `frontend/e2e/support/sample-plan.ts` (`createSamplePlan`), `frontend/e2e/best-locations.spec.ts` (a UI mark command to copy).

## Tasks & Acceptance

**Execution:**
- `backend/swp/api/session_guard.py`, `backend/swp/api/app.py`, `backend/swp/api/routers/plans.py`, `backend/swp/api/routers/commands.py` -- `current_user` dependency; guard and pass `user` to create, reuse and commands -- FR-11, FR-40.
- `backend/tests/app/test_who_edited.py` -- new, auth on/off on SQLite (and Postgres in CI): `test_fr11_upload_and_reuse_record_logged_in_user`, `test_fr11_command_and_run_record_logged_in_user` (last_edited_by and recommendations `run.created_by`), `test_fr9_milestone1_plans_still_show_planner` (list + summary, version unchanged), `test_fr11_auth_off_records_planner`, `test_fr40_create_without_session_writes_nothing`.
- `frontend/lib/api/session-expiry.ts`, `frontend/lib/api/query-errors.ts`, `frontend/app/providers.tsx` -- coordinator, `sessionExpired` effect, 401 branch.
- `frontend/lib/commands/client.ts` -- hold and resend on `unauthenticated`.
- `frontend/modules/auth/user-menu.tsx` (new), `frontend/modules/auth/logout-button.tsx` (delete), `frontend/app/layout.tsx`, `frontend/components/common/app-shell/toolbar.tsx`, `index.tsx` (comments) -- avatar user menu.
- `frontend/modules/auth/login-page.tsx`, `frontend/modules/auth/signup-page.tsx` -- restore and return after success.
- `frontend/tests/auth.test.tsx`, `frontend/tests/commands.test.tsx` (or a new `frontend/tests/session-expiry.test.ts`) -- Vitest: `avatarInitials`; UserMenu renders the 34px ink disc with initials and nothing when auth off or no user; coordinator keeps the first href, `restore` resolves waiters and returns null when nothing waits; `handleQueryError` on 401 calls `sessionExpired` and never notifies; a command whose first POST is 401 stays pending, posts nothing more until restore, then posts the same body (same `command_id`, `base_version`) and confirms; login success navigates to the restored href, else `/plans`.
- `frontend/e2e/login.spec.ts` -- Log out through the avatar menu.
- `frontend/e2e/session-expiry.spec.ts` (new, logged-out opt-out, own signed-up account) -- `uj3 fr40 the avatar menu shows who is logged in` (initials, menu by keyboard, "Logged in as", username, `Esc` returns focus to the avatar, saved-plans row Created by = username); `uj3 fr40 a change made after the session expired is sent after Log in` (open a plan step, clear cookies, make a best-location mark in the UI → `/login`; log in → same URL reopens, the mark shows, API shows exactly one mark and `last_edited_by` = username); `uj3 fr40 a page opened after the session expired returns after Log in` (clear cookies, open another step via the flow bar → `/login`; log in → that step URL).

**Acceptance Criteria:**
- Given `FEATURE_AUTH` on and a logged-in user, when a plan is created (upload or reuse) or changed by a command or a run, then `created_by`/`last_edited_by` and the round line's "by" show that username.
- Given a logged-in user on any non-auth page, when the toolbar renders, then its right end shows the 34px ink avatar with the initials and no separate Log out button; its menu shows "Logged in as", the username and Log out, works by keyboard, and `Esc` returns focus to the avatar; Log out returns to `/login`.
- Given an open plan whose session has ended, when a change is made, then Log in opens, and after logging in the plan reopens at the same URL with the change saved once.
- Given the full Playwright suite with `FEATURE_AUTH=true`, when it runs on chromium, then every spec passes.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 32 findings — high 0, medium 1, low 28, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` Verification gap: the return through Create account (`signup-page.tsx` `router.push(afterLoginHref())`) was untested; reverting it fails nothing and held commands would stay pending — patched: e2e `uj3 fr40 a change held after the session expired is sent after Create account` (plan URL back, mark shown, exactly one mark, `last_edited_by` = new user).
  - `[low]` `[reject]` Verification gap (other): a held command is released by whichever user logs in next and saved under that user — needs a different person to log in in the same tab after an expiry; plans are shared by everyone who logs in, and the change is sent by the session that logged in; fixing it adds a stored user, a comparison and a drop path.
  - `[low]` `[reject]` Blind: held command sent under a different user — same as the row above.
  - `[low]` `[reject]` Blind: plan queries stay cached after expiry, and Log out does not clear the expiry state — plans are shared by every logged-in user, so cached data reveals nothing the next user cannot open, and pages refetch on mount; the Log out part cannot happen: the menu is hidden while the session is logged out and `restore()` clears the state on the next login.
  - `[low]` `[reject]` Blind: New Plan upload and Delete plan do not handle a 401 — the intent (AC) names commands and GETs only; they show "Log in to continue." and the next GET opens Log in; handling them adds a mutation path.
  - `[low]` `[reject]` Blind: OpenAPI does not list 401 on guarded routes — present since 9.2's guard; the client branches on `code`, not on generated error types; negligible harm.
  - `[low]` `[reject]` Blind: a held command waits forever with no notice — intended (EXPERIENCE.md "Session expired": the change is sent after login); controls show "Saving the last change…"; a timeout adds a cancel path.
  - `[low]` `[reject]` Blind: `isWaiting()` unused — the spec requires it on the coordinator; removing it would edit the spec.
  - `[low]` `[reject]` Blind: several 401 GETs redirect several times — each `router.replace` goes to the same `/login`; extra waiters resolve harmlessly on `restore()`; no visible effect.
  - `[low]` `[reject]` Blind: the avatar's accessible name lacks the username — the spec fixes the label "User menu"; the username is the first thing in the opened menu.
  - `[low]` `[patch]` Blind: `avatarInitials` upper-cases after slicing, so "ßa" gives "SSA" — patched: capped at two code points after upper-casing; Vitest asserts "ßa" → "SS".
  - `[low]` `[reject]` Blind: Log out shows no in-progress state — the menu closes on select and the request is quick; a failure toasts; adding state for a rare slow logout.
  - `[low]` `[reject]` Blind: `DEFAULT_USER` imported from `swp.app.plans` into the API guard — the spec places it there; `swp.api` may import `swp.app` and import-linter passes; no named caller diverges.
  - `[low]` `[reject]` Blind: repeated test effects objects and import order in auth.test.tsx — test-only duplication; ESLint passes, so the import-order part does not occur.
  - `[low]` `[reject]` Blind: no test that the user loads once, exact 34px bounding box, no different-user e2e — FastAPI dependency caching is framework behaviour; the box check passed on the fixed `size-[34px]` element; different user rejected above.
  - `[low]` `[reject]` Edge: 401 from mutations — same as the Blind upload/delete row.
  - `[low]` `[reject]` Edge: cache outlives the session — same as the Blind cache row.
  - `[low]` `[reject]` Edge: different user releases the held command — same as the Verification gap (other) row.
  - `[low]` `[reject]` Edge: held command never released when the user never logs in — same as the Blind wait-forever row.
  - `[low]` `[reject]` Edge: GET 401s add waiters nothing awaits — same as the Blind repeated-redirect row.
  - `[low]` `[reject]` Edge: `isWaiting()` dead — same as the Blind row; spec-mandated.
  - `[low]` `[reject]` Intent: the round line "by <user>" is not rendered in a test with a real username — the copy (`lib/copy` run line) is unchanged and has its own Vitest; the value is asserted through the API.
  - `[low]` `[reject]` Intent: milestone-1 plans showing `planner` are checked only through the API — the list and summary render the server fields verbatim.
  - `[low]` `[reject]` Intent: no UI check that distinguishes last edited by from created by — same verbatim rendering; asserted through the API and the e2e summary.
  - `[false]` `[reject]` Intent: the username uses Barlow Semi Condensed, not "Barlow" — the design's Barlow is the self-hosted Barlow Semi Condensed (`--font-code`), as for the plan plate name.
  - `[false]` `[reject]` Intent: "where it was" checked only at URL level — AD-20 makes the URL the view state; the e2e asserts the full URL including the query.
  - `[false]` `[reject]` Intent: no test of a JWT past its expiry — an expired token takes the same `session_user` → None → 401 path, pinned by the 9.1/9.2 session tests; the client sees the identical 401.
  - `[low]` `[reject]` Intent: same `command_id` on resend is checked only in Vitest — the unit test asserts byte-equal bodies; the e2e asserts the server end state (one mark, version 2).
  - `[low]` `[reject]` Intent: any user, and Create account, release held commands — same as the different-user rows; Create account is now covered by e2e.
  - `[low]` `[reject]` Intent: upload and delete not covered by "no edit is lost" — same as the Blind upload/delete row.
  - `[low]` `[reject]` Intent: held state lost on reload — documented memory-only behaviour; persisting adds storage of commands.
  - `[low]` `[reject]` Intent: a command retrying across Log out is held until the next login — needs Log out pressed mid-retry (rejected as rare in 9.2); then it is sent after the next login instead of toasting.

## Design Notes

Open retrospective action items were checked. Epic-6 item 50 (scope the `plan_not_found` hook to the plan on screen) touches `query-errors.ts`, which this story extends; the new `unauthenticated` branch does not depend on which plan is shown, so item 50 is neither fixed nor made harder here and stays open. Item epic-1-11 (read earlier specs' deferred items) is honoured: the 9.2 deferral (session ends while the app is open) is this story's session-expiry work and is closed by it.

The session is set to logged out on a 401 so the 9.2 guard hides plan data at once and stops further 401 GETs; the explicit `router.replace(LOGIN_HREF)` also covers a failed session read (no cached session to change). The held command waits on a promise rather than being re-queued, so the per-plan "one command at a time" rule and the "Saving the last change…" reason hold across the login.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:<port>/swp_test` against a local `postgres:17` container (removed afterwards) -- expected: all pass.
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: no change.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean.
- `npm run e2e -- --project=chromium` -- expected: all pass including `session-expiry.spec.ts` and `login.spec.ts`.

## Auto Run Result

Status: done

**Summary:** Plans record the logged-in user, the avatar user menu and client session expiry (FR-11, FR-9, FR-40, AD-10, AD-12, UX-DR4, UX-DR55). Backend: one `current_user` dependency (username with auth on, `planner` with auth off, `unauthenticated` without a session) guards the data routers and feeds plan create, reuse and `run_command`, so `created_by`, `last_edited_by` and a run's `created_by` hold the username; milestone-1 plans keep `planner`. Frontend: the avatar (34px ink disc, initials) opens a radix menu with "Logged in as", the username and Log out, replacing the 9.2 toolbar button. A `SessionExpiry` coordinator lets a 401 on a GET or a command set the session logged out and open Log in; commands are held and posted again unchanged after Log in or Create account, which reopen the page that was open. Closes the 9.2 deferral (session ends while the app is open).

**Files changed:**
- `backend/swp/api/session_guard.py`, `backend/swp/api/app.py` -- `current_user` replaces `require_session`.
- `backend/swp/api/routers/plans.py`, `backend/swp/api/routers/commands.py` -- pass the user to create, reuse and commands.
- `backend/tests/app/test_who_edited.py` -- FR-11/FR-9/FR-40 tests (SQLite and Postgres).
- `frontend/lib/api/session-expiry.ts` -- the coordinator; `frontend/lib/api/query-errors.ts` -- 401 branch; `frontend/app/providers.tsx` -- `sessionExpired` effect.
- `frontend/lib/commands/client.ts` -- hold and resend on `unauthenticated`.
- `frontend/modules/auth/user-menu.tsx` (new), `frontend/modules/auth/logout-button.tsx` (deleted), `frontend/app/layout.tsx`, `frontend/components/common/app-shell/{toolbar.tsx,index.tsx}` -- avatar user menu.
- `frontend/modules/auth/{api.ts,login-page.tsx,signup-page.tsx}` -- `afterLoginHref` return after login or signup.
- `frontend/tests/{session-expiry.test.ts,auth.test.tsx,commands.test.tsx,part-panel.test.tsx,plan-views.test.tsx}` -- Vitest.
- `frontend/e2e/session-expiry.spec.ts` (new, 4 tests), `frontend/e2e/login.spec.ts` -- UJ-3 journeys; Log out through the avatar menu.

**Review findings:** 32 findings (high 0, medium 1, low 28, false 3). Patches applied: 2 (medium: Create account return untested -> new e2e; low: `avatarInitials` "ßa" -> "SSA" -> capped at two code points). Deferred: 0. Rejected: 30 -- see the Review Triage Log rows with reasons (a different user releasing held commands: rare, plans shared; upload/delete 401: outside the AC; held command waiting/reload: intended memory-only design; `isWaiting()` and the "User menu" label: spec-mandated; OpenAPI 401: pre-existing; repeated redirects, cache after expiry, logout feedback, test duplication, UI-level checks of verbatim server fields: negligible; 3 false: Barlow font, URL as view state, expired-JWT path).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 1, low 1; no specific unverified risk remains (the medium patch is itself a test).

**Verification:**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 812 passed, 2 skipped.
- `pytest tests/app --database-url postgresql://…@localhost:55493/swp_test` (local postgres:17 container, removed after) -- 241 passed, 3 skipped (backend unchanged by the review patches).
- `npm run gen:api` -- schema.ts unchanged.
- `npm run lint`, `npm run typecheck`, `npm run test:web` -- clean, 434 passed.
- `npm run e2e -- --project=chromium` -- 94 passed (after review patches).

**Residual risks:** held commands and the return page live in memory only (a reload on Log in loses them); a different user logging in after an expiry sends the held change under their name; New Plan upload and Delete plan show "Log in to continue." instead of opening Log in; firefox and msedge e2e were not run.
