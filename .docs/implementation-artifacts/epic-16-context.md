# Epic 16 Context: Go live on the public URL [DEPLOY]

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Put the app, already built and approved locally, on the public Vercel URL against Supabase Postgres, where it will be judged. First close the security and integrity gaps found in the Epic 9 and Epic 13 retrospectives. Then deploy the skeleton to production. Finally, turn on login and the demo so examiners can use the app at that URL. The epic adds no new FRs: it takes login (FR-40) and Demo version (FR-50) to production under the public-demo rule (NFR-5, synthetic data only) and the secrets rule (NFR-6, secrets from env, never committed). The deploy steps need the user's own Vercel and Supabase accounts, so the epic is not part of the autonomous run. Story 16.0 is local code work; Stories 16.1 and 16.2 need the user present.

## Stories

- Story 16.0: Production hardening before going public
- Story 16.1: Live on the public Vercel URL
- Story 16.2: Production with login and the demo on

## Requirements & Constraints

- **Safe startup.** The backend refuses to start when `VERCEL` is set and `APP_ENV` is not `production`, and in production with an empty or default `JWT_SECRET`, or with `DEMO_PASSWORD` or `DATABASE_URL` unset. An invalid setting gives exactly one `Refusing to start: …` line that names the setting and the reason, never the value, and prints no pydantic traceback. This applies to app startup and to `swp db upgrade`.
- **Login throttle.** Attempts are counted per casefolded submitted username, whether or not the account exists, before the password is checked, so concurrent requests run at most 5 password checks. After 5 counted attempts, that name is locked for 60 s with `login_locked` (429). A successful login clears the count. `POST /api/auth/demo` bypasses the throttle.
- **Starter seed (FR-47).** It reads `starter_categories.toml` only when both keyword rules and aisle categories are empty, never overwrites the planner's lists, and a locked SQLite database doesn't crash startup.
- **Session-expiry handoff.** A change held back by an expired session is sent again only if the same user logs back in. If a different user (or demo) logs in, the change is dropped with a message.
- **Secrets and data.** No real secret is committed, and `.env.example` holds no real values. The deployment holds synthetic demo data only. The README says so; the site shows no notice.
- **Demo-only limits** (when `FEATURE_DEMO` is on): `MAX_PLANS` 50 and `MAX_ACCOUNTS` 200, with the demo account not counted. Accepted risks: any visitor can delete any plan, and drive-by sign-ups can fill the account limit. A job with more than 100 distinct parts adds no pick-group pairs (`MAX_JOB_PARTS`), which guards the public demo against quadratic pair counting.
- **Accepted as built (decided 2026-11-26).**
  - The `demo` account is seeded whether or not `FEATURE_DEMO` is on, and demo login seeds it on demand if the row is missing.
  - Log out clears only the cookie, so the JWT stays valid until it expires. Rotating `JWT_SECRET` revokes every session.
  - Usernames are casefolded, not NFKC-normalised.
  - The plan and account limits check the count before inserting, so concurrent requests can overshoot them slightly.
  - Five or more concurrent correct logins for one account can briefly get `login_locked`.
- **Known limits.**
  - Apply all on a maximum-size import can exceed the function time limit. This is documented and will not be optimized.
  - Vercel caps requests and responses at 4.5 MB.
- **Done criteria.** The public URL opens on the demo front page, and Demo version and Log in both work. The SM-2 flow runs there on `data/sample/`. `GET /api/health` is green. The results are recorded in the session log.

## Technical Decisions

- **One origin.** `vercel.json` uses Vercel Services: the Next.js frontend plus the backend `swp.main:app`, with `/api/(.*)` routed to the backend. The browser calls only relative `/api/*` paths. Preview deployments are off, and `main` deploys to production. The fallback, if Services (Beta) fails, is two projects joined by a Next.js rewrite, with the same contract.
- **Database.** The runtime uses the Supabase transaction pooler (port 6543), `NullPool` and psycopg `prepare_threshold=None`, and rewrites `postgresql://` to `postgresql+psycopg://`. Migrations use `MIGRATION_DATABASE_URL` (the session pooler, port 5432). Postgres writes go through `store.db.write_transaction` with `lock_timeout = '3s'`.
- **Migrate and seed.** `swp.app.bootstrap` is the only path that migrates or seeds, and the lifespan runs it only when `APP_ENV=local`. In production, run `uv run swp db upgrade` by hand before a schema change. Migrations are expand-only, and the seed is idempotent.
- **Env, scoped to Production only.** Set `APP_ENV=production`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET` and `DEMO_PASSWORD`. With `FEATURE_AUTH` and `FEATURE_DEMO` off, the app opens with no front page. Story 16.2 turns both flags on.
- **Flags at runtime.** The frontend reads the flags from `GET /api/session` (`{user, feature_auth, feature_demo, max_upload_bytes}`). There are no `NEXT_PUBLIC_FEATURE_*` vars.
- **Session.** An HS256 JWT in the httpOnly `SameSite=Lax` cookie `swp_session`, valid for 30 days and `Secure` in production.
- **Keep-alive.** `.github/workflows/keep-alive.yml` calls `GET /api/health` on the public URL daily and also supports `workflow_dispatch`.
- **Out of scope.** IP rate limiting, backups, Redis, monitoring beyond the keep-alive, and a maintenance page.

## UX & Interaction Patterns

- **Public deployment.** The app opens on the demo front page with Log in (primary), Create account and Demo version. The Log in page also offers Demo version under an "or" rule. Log out returns to the demo front page. A local install has no front page and no Demo version.
- **Demo version.** It opens the saved-plans list as the seeded `demo` account with no password. No plan is preloaded: visitors upload the three `data/sample/` files through New Plan, following the README.
- **Expired session.** Log in opens. After the same user logs back in, the held change is sent again and the plan reopens where it was.

## Cross-Story Dependencies

- Story 16.0 (done) had to be finished before anything went public. Story 16.1 (done) relies on its startup checks.
- In Story 16.1, `JWT_SECRET` and `DEMO_PASSWORD` were already set in Vercel because the hardened startup check requires them. The maximum-size wall measured 3.66 MB uncompressed and 0.21 MB gzipped, both under the 4.5 MB limit, so AD-18 is unchanged.
- Story 16.2 needs Story 16.1 live and Story 9.7's production-like build (`npm run e2e:production`) passing locally. Before turning the demo on, delete the 25,000-location test plan "Testing" from the public database, or decide to keep it (open point from Story 16.1).
