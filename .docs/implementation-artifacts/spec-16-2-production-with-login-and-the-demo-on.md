---
title: 'Production with login and the demo on'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'a9253312f3a7e40324290d16491f0243e3e334e1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The public deployment at https://g36steponaitis.vercel.app runs with `FEATURE_AUTH` and `FEATURE_DEMO` off, so examiners get no demo front page, no Demo version and no login. The README still says the flags come "with Story 16.2", and the only automated check of the deployed demo is the skipped `uj5` placeholder.

**Approach:** Update the README runbook so that `FEATURE_AUTH=true`, `FEATURE_DEMO=true` and the public demo password are set in Vercel (Production only) with a redeploy and a check list. Add an opt-in `npm run e2e:public` that runs the production-like `uj5` specs against the public URL without creating data, and replace the skipped placeholder with it. The author then does the dashboard steps, runs `e2e:public` and the SM-2 flow on `data/sample/`, and records the result in the session log.

## Boundaries & Constraints

**Always:** `JWT_SECRET` and the DB URLs stay in Vercel and the author's shell only, never in the repo, README, test config or the chat. Flags are read at runtime from `GET /api/session`, and no `NEXT_PUBLIC_*` vars are added. The public deployment holds only synthetic `data/sample/` data. `e2e:public` creates no plan and no account.

**Never:** No backend or frontend behaviour changes (login, demo, limits and startup checks are accepted as built). No new CLI command. No CI job against the public URL. No preview deployments. No change to the startup check. Nothing is run against Supabase or Vercel from this session.

**Decisions (author, 2026-11-28):**
- **Public demo password.** The `demo` account's password on the public site is published as `demo`, so examiners can Log in as `demo`/`demo`. `DEMO_PASSWORD` in Vercel becomes `demo`; it is no longer a secret (Demo version already gives the same access without a password). The seed never changes an existing row, so the author deletes the `demo` row in Supabase (Table Editor → `users`; nothing references it by foreign key) after the redeploy. The next Demo version click recreates it with `DEMO_PASSWORD` (`demo_login` seeds on demand).
- **«Testing» plan.** The 25,000-location test plan from 16.1 is deleted. After the flags are on, the author enters as `demo` and deletes it under Saved plans.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Public session | `GET /api/session`, no cookie | `feature_auth: true`, `feature_demo: true`, `user: null` | flags off → `e2e:public` fails on the first assertion |
| Demo version | front page → **Demo version** | saved-plans list as `demo` (avatar `DE`); Log out returns to the front page | N/A |
| Log in as demo | Log in with `demo` + the demo password | saved-plans list as `demo` | wrong password → test fails (row not recreated) |
| Cookie | after Demo version over https | `swp_session` is `Secure` and `httpOnly` | N/A |
| Local runs | `npm run e2e` / `e2e:production` | `e2e` no longer lists the `uj5` deploy skip; `e2e:production` also runs the Log in test with its throwaway password | N/A |
| Other URL | `PUBLIC_URL=https://…` | `e2e:public` targets that origin | N/A |

</frozen-after-approval>

## Code Map

- `frontend/playwright.production.config.ts` -- the template. It generates `demoPassword` per run and passes it to the backend env. Also expose it to the tests as `process.env.E2E_DEMO_PASSWORD` (set in the config module; workers inherit it).
- `frontend/e2e/production/demo-front-page.spec.ts` -- two read-only `uj5` tests (flags, Demo version → Log out, Secure cookie). Add a `fr40 uj5 …` test: Log in page → `demo` + `process.env.E2E_DEMO_PASSWORD` → `/plans` with avatar `DE`. Fail clearly if the env var is missing; never skip. Widen the header comment to "production-like build or the public deployment". Look at `frontend/e2e/login.spec.ts` for the Log in locators.
- `frontend/e2e/user-journeys.spec.ts:1523` -- the `test.skip("uj5 … public deployment …")` placeholder. Delete it, and fix the comments at l.30 and l.1420 that announce it.
- `package.json:29` -- `e2e:production`. Add `e2e:public` in the same shape (`--config=playwright.public.config.ts`).
- `README.md:13-21` (Norwegian "Demo og data") -- drop "(når innloggingen er bygget, milestone 2)". Log in `demo`/`demo` is now true on the public site too.
- `README.md:79,101` -- the `DEMO_PASSWORD` row and the closing paragraph. Say that the public demo publishes `demo` on purpose and that `JWT_SECRET` stays secret. Drop "comes with Story 16.2".
- `README.md:103-132` (Deploy) -- step 2: `DEMO_PASSWORD=demo` is the public value. Step 4: add `FEATURE_AUTH=true` and `FEATURE_DEMO=true`, make `DEMO_PASSWORD` `demo`, and drop the "until Story 16.2" sentence. Step 5: after the redeploy, check the front page, Demo version, Log in `demo`/`demo` and `npm run e2e:public`. Add an upgrade note: a `demo` row created with an older password is deleted in the Table Editor and recreated by the next Demo version click.
- `scripts/traceability.py` -- check that `npm run trace` still lists `uj5`, `fr40`, `fr50`, `nfr5`.
- Don't touch: `backend/`, `vercel.json`, `.github/workflows/*`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/playwright.public.config.ts` -- create. `testDir: "./e2e/production"`, Chromium, `baseURL: process.env.PUBLIC_URL ?? "https://g36steponaitis.vercel.app"`, `retries: 1`, no `webServer`/`globalSetup`, `E2E_DEMO_PASSWORD` defaulting to `demo`. Header: opt-in, run after a deploy, creates no data. Gives one post-deploy check without a local server.
- [x] `frontend/playwright.production.config.ts` -- export the throwaway password as `E2E_DEMO_PASSWORD`, so the new Log in test runs locally too.
- [x] `frontend/e2e/production/demo-front-page.spec.ts` -- add the Log in test and widen the comment. This covers "Log in works".
- [x] `package.json` -- add the `e2e:public` script.
- [x] `frontend/e2e/user-journeys.spec.ts` -- remove the skip and its comment references, so `npm run e2e` reaches 0 skipped.
- [x] `README.md` -- the sections in the Code Map, and an `npm run e2e:public` line next to `e2e:production`. This is the runbook.
- [ ] Author (dashboards) -- in Vercel, set `FEATURE_AUTH=true`, `FEATURE_DEMO=true` and `DEMO_PASSWORD=demo` for Production and redeploy. In Supabase, delete the `demo` row. Then click Demo version, delete «Testing», run `npm run e2e:public`, walk SM-2 on `data/sample/`, and log the result.

**Acceptance Criteria:**
- Given the updated repo, when `npm run e2e` runs, then chromium, firefox and msedge pass with 0 failed, 0 flaky and 0 skipped, and `npm run e2e:production` passes 3 tests.
- Given `main` redeployed with the flags on and the `demo` row recreated, when the author runs `npm run e2e:public`, then the 3 tests pass against the public URL (author-checked).
- Given the public URL, when the author opens it, then the demo front page shows, Demo version and Log in `demo`/`demo` work, «Testing» is gone, SM-2 runs on `data/sample/`, `/api/health` is green, and the session log records it (author-checked).
- Given the diff, when it is searched, then no `JWT_SECRET` value or connection string with a password is present (NFR-6).

## Implementation Notes

- Playwright loads the config module again in every worker, so a per-module `randomBytes` password differed between the backend (main process) and the test workers and Log in failed. `playwright.production.config.ts` now sets `process.env.E2E_DEMO_PASSWORD ??= randomBytes(...)` and uses that value for `DEMO_PASSWORD`: the main process generates it, the workers inherit it.
- The production specs opt out of the shared e2e session (`test.use({ storageState: … })`), so the worker fixture that signs up `e2eplanner` never runs: after `npm run e2e:production`, `users` holds only `demo`, with 0 plans and 0 `login_attempts` rows.

- Review patches (triage rows 1-4, 6-8, 12-13): public config `retries: 0` and `||`/`||=` defaults; neutral test titles ("uj5 the production deployment", IDs kept); README documents the 60 s `demo` lock, `E2E_DEMO_PASSWORD` for another `PUBLIC_URL`, "Demo version once before `e2e:public`" after a row delete, deleting leftover test plans, and "0 failed, 0 flaky" instead of a test count.
- Verification (2026-11-28): ESLint, tsc clean; `npm run trace` OK (FR-40, FR-50, NFR-5, NFR-6 listed, `demo-front-page` tests included); secret grep on the diff empty; `npm run e2e` (chromium, firefox, msedge) 453 passed, 0 failed, 0 flaky, 0 skipped; `npm run e2e:production` 3 passed. No backend change, so pytest/ruff were not rerun.
- Author-checked ACs remain (Vercel flags and `DEMO_PASSWORD=demo`, `demo` row reset, «Testing» deleted, `npm run e2e:public`, SM-2 on the public URL): the story stays `review` until the author confirms them in a session log.

- First live `npm run e2e:public` (2026-11-28): the Log in test failed on the 5 s default while the page still showed "Logging in." (a cold function plus bcrypt against Supabase). Both `/plans` URL waits now use `LOGIN_TIMEOUT_MS` (30 s); rerun: 3 passed, Log in 5.0 s. `e2e:production` 3 passed.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | blind, verification-gap, edge | Published `demo` login can be locked 60 s by 5 wrong passwords; `e2e:public` Log in then fails | low | patch | `login()` counts per username before the password check; Demo version bypasses the throttle. Accepted throttle design (AD-18); README now says so and how to rerun. |
| 2 | blind, verification-gap, edge | `retries: 1` in the public config retries inside the same lock and hides flakes | low | patch | Retry starts at once; repo gates require 0 flaky. Set to 0. |
| 3 | blind, edge | "creates no plan and no account" wrong when the `demo` row is missing | low | patch | `demo_login` calls `seed_demo_account` when the row is missing. Reworded. ("sessions rows" part false: the session is a stateless JWT.) |
| 4 | blind | `PUBLIC_URL` to another origin also needs its demo password | low | patch | Config honours `E2E_DEMO_PASSWORD`; README didn't say. |
| 5 | blind, edge | Exported `E2E_DEMO_PASSWORD` replaces the production config's throwaway password | low | reject | Nobody exports it in everyday use; telling main process from worker adds a branch. |
| 6 | blind, verification-gap | Titles/comment say "production-like build" on the public run | low | patch | Report text from `e2e:public` would misname where UJ-5 ran; neutral titles, IDs kept. |
| 7 | blind | README hardcodes "3 tests" | low | patch | The public config runs the whole `e2e/production/` directory. |
| 8 | blind | Upgrade note omits leftover demo plans («Testing») | low | patch | Spec author task deletes «Testing»; checklist line added. |
| 9 | blind | Checklist lacks page-guard / demo-limit / Create account checks | low | reject | Covered by the local e2e suites (login, signup, demo-version, front-page specs); manual extra checks add no new code path. |
| 10 | blind | Unscoped `page.getByLabel` in the Log in test | false | reject | The page has one Username and one Password field; `login.spec.ts:38,59-61` uses the same unscoped locators. |
| 11 | blind | Retained traces hold a live `demo` session cookie | low | reject | The `demo` session gives nothing Demo version does not; `test-results/` is git-ignored. |
| 12 | edge | Empty exported `PUBLIC_URL` / `E2E_DEMO_PASSWORD` kept by `??` | low | patch | Direct correction (`||`, `||=`). |
| 13 | edge | After the row delete, a parallel Log in may run before any Demo version re-seeds `demo` | low | patch | Only in the one-off upgrade window; README now says to click Demo version first. |
| 14 | edge | `workers` on the shared site push `demo` toward lockout | false | reject | Only failed logins count after a success clears; the run makes one Log in attempt, and retries are now 0. |
| 15 | verification-gap | sprint-status `in-progress` vs spec `in-review` | false | reject | Sprint status is synced in the present step by design. |

## Design Notes

`e2e:public` reuses the production specs because they already assert the AC surface (flags, Demo version, Log in, Log out, Secure cookie) without writing plans or accounts. Log in writes and clears a `login_attempts` row, which is harmless. It is not run in CI, because CI finishes before Vercel deploys. Deleting the `demo` row instead of adding a reset command keeps the story free of backend changes: `plans.created_by` is text with no FK, so old plans keep their creator name, and existing `demo` sessions end because the new row has a new id.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run trace` -- expected: clean; trace lists `uj5`, `fr40`, `fr50`, `nfr5`
- `npm run e2e` -- expected: 0 failed, 0 flaky, 0 skipped (three browsers)
- `npm run e2e:production` -- expected: 3 passed
- `git diff a9253312f3a7e40324290d16491f0243e3e334e1 | grep -iE 'postgresql://[^…]*:[^@…]+@|JWT_SECRET=[A-Za-z0-9_-]{20,}'` -- expected: no output

**Manual checks (author):**
- After the redeploy and the `demo` row reset: `npm run e2e:public` green; SM-2 on `data/sample/`; «Testing» deleted; `/api/health` `{"status":"ok"}`.
