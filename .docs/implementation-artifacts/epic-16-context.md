# Epic 16 Context: Go live on the public URL [DEPLOY]

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Put the app, already built and approved locally, on the public Vercel URL against Supabase Postgres. First close the security and integrity gaps found in earlier retrospectives (Epics 9 and 13). Then deploy the skeleton to production. Finally, turn on login and the demo so examiners can use the app at the URL it will be judged on. The epic adds no new FRs. It takes FR-40 (login) and FR-50 (Demo version) to production under NFR-5 (public demo, synthetic data only) and NFR-6 (secrets from env). The deployment steps need the user's own Vercel and Supabase accounts, so this epic is not part of the autonomous run. Story 16.0 is local code work. Stories 16.1 and 16.2 need the user present.

## Stories

- Story 16.0: Production hardening before going public
- Story 16.1: Live on the public Vercel URL
- Story 16.2: Production with login and the demo on

## Requirements & Constraints

- **Safe startup.** The backend refuses to start when `VERCEL` is set and `APP_ENV` is anything other than `production` (unset or `local`). It also refuses in production with an empty or default `JWT_SECRET`. An invalid setting, such as a `DEMO_PASSWORD` the validator rejects, produces exactly one `Refusing to start: …` line. That line names the setting and the reason, never the value, and no pydantic traceback is printed. This applies to both app startup and `swp db upgrade`. Tests cover every case.
- **Login throttle under concurrency.** Failures are counted per casefolded submitted username, whether or not the account exists. After 5 failures, that name is locked for 60 s with `login_locked`. The attempt must be counted *before* the password is verified, so concurrent requests can't run more than 5 password checks. The test sends the requests concurrently and runs on both SQLite and Postgres. `POST /api/auth/demo` bypasses the throttle.
- **Starter seed (FR-47).** It reads `starter_categories.toml` only after checking that both `keyword_rules` and `aisle_categories` are empty, and it never overwrites the planner's lists. A locked SQLite database must not crash startup, and the bootstrap docstring describes what it does.
- **Session-expiry handoff.** A change held back because the session expired is sent again only when the *same* user logs back in. If a different user logs in, the held change is dropped with a message and is never saved under that user's name.
- **Secrets and data.** No real secret is ever committed. `.env.example` holds no real values. The deployment holds synthetic demo data only, and the README says so; the site itself shows no notice.
- **Response size.** Vercel caps requests and responses at 4.5 MB. Test a maximum-size import (`MAX_ROWS_PER_FILE` = 25,000 locations, about 3.66 MB of wall layout uncompressed) on the public URL and record in the session log whether the limit applies to the gzipped or the uncompressed body. If the wall fails to load, lower the limit and update the limits decision (AD-18).
- **Known accepted limit.** On a maximum-size import, Apply all can exceed the function time limit. This is documented and will not be optimized.
- **Demo-only limits** (apply when `FEATURE_DEMO` is on): `MAX_PLANS` 50 and `MAX_ACCOUNTS` 200. The demo account does not count toward `MAX_ACCOUNTS`. Accepted risks: any visitor can delete any plan, and drive-by sign-ups can fill the account limit.
- **Done criteria.** The public URL opens on the demo front page, and both Demo version and Log in work. The SM-2 flow runs on `data/sample/` and `GET /api/health` is green. The results are recorded in the session log.

## Technical Decisions

- **One origin.** `vercel.json` uses Vercel Services: the Next.js frontend plus the backend at `swp.main:app`, with `/api/(.*)` routed to the backend. The browser only ever calls relative `/api/*` paths. Preview deployments are off for the whole project, and `main` deploys to production. If Services (Beta) fails, the fallback is two Vercel projects joined by a Next.js rewrite, with the same API contract.
- **Database.** The runtime uses the Supabase transaction pooler (port 6543), `NullPool` and psycopg `prepare_threshold=None`. A `postgresql://` URL is rewritten to `postgresql+psycopg://`. Migrations use `MIGRATION_DATABASE_URL` (the session pooler, port 5432).
- **Migrate and seed.** `swp.app.bootstrap(upgrade, seed)` is the only path that migrates or seeds. The FastAPI lifespan calls it only when `APP_ENV=local`. In production, run `uv run swp db upgrade` by hand before deploying a schema change. Migrations are expand-only. The seed is idempotent: it creates the `demo` account (an integrity error counts as success), then the starter categories.
- **Env scoping (Production only).** Story 16.1 sets `APP_ENV=production`, `DATABASE_URL` and `MIGRATION_DATABASE_URL`. Story 16.2 adds `JWT_SECRET`, `DEMO_PASSWORD`, `FEATURE_AUTH=on` and `FEATURE_DEMO=on`.
- **Flags.** The frontend reads the flags at runtime from `GET /api/session` (`{user, feature_auth, feature_demo, max_upload_bytes}`). There are no `NEXT_PUBLIC_FEATURE_*` vars.
- **Session cookie.** The session is an HS256 JWT in the httpOnly, `SameSite=Lax` cookie `swp_session`, valid for 30 days and `Secure` in production.
- **Postgres writes** go through `store.db.write_transaction`, with `SET LOCAL lock_timeout = '3s'`. The login-throttle writes go through it too. CI runs `tests/app` against Postgres 17.
- **Keep-alive.** `.github/workflows/keep-alive.yml` sends `GET /api/health` (which runs `SELECT 1`) to the public URL once a day and also supports `workflow_dispatch`.
- **Out of scope.** No IP-based rate limiting, since serverless instances share no memory. No backups, Redis, monitoring beyond the keep-alive, or maintenance page.

## UX & Interaction Patterns

- **Public deployment.** The app opens on the demo front page with Log in (primary), Create account and Demo version. The Log in page also offers Demo version under an "or" rule. Log out returns to the demo front page. A local install has no front page and no Demo version.
- **Demo version.** It opens the saved-plans list as the seeded `demo` account with no password. No plan is preloaded: visitors upload the three `data/sample/` files through New Plan, as the README describes.
- **Expired session.** Log in opens. After the same user logs in, the unsaved change is sent again and the plan reopens where it was. Story 16.0 adds the different-user case, where the change is dropped with a message.

## Cross-Story Dependencies

- Story 16.0 must be finished before anything goes public. Story 16.1 relies on its hardened startup checks.
- Story 16.2 needs Story 16.1 live and Story 9.7's production-like build (`npm run e2e:production`) passing locally.
- Story 16.1 picks up the deferred response-size check from Story 12.5. Its result may require changing AD-18 and `MAX_ROWS_PER_FILE`.
- The README (from Stories 9.7 and 12.x) gets the public URL and the manual `swp db upgrade` steps in Story 16.1.
